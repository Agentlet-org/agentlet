/**
 * Agent Runtime - Execute agents in sandboxed WebViews
 *
 * Creates a sandboxed environment, wires up the bridge handler,
 * and executes agent actions.
 */

import * as vscode from "vscode";
import { WebViewSandbox } from "./webview-sandbox";
import { VSCodeBridgeHandler } from "./bridge-handler";
import { VSCodeContextAdapter } from "./adapters/context";
import { VSCodeUIHandler } from "./adapters/ui";
import { VSCodeStorageAdapter } from "./adapters/storage";
import { VSCodeInferenceProvider } from "./adapters/inference";
import { VSCodeIntentHandler } from "./adapters/intents";
import type { InstalledAgent, GrantedPermissions, ResourceLimits } from "../types/agentlet";

/**
 * Default resource limits for agent execution
 */
const DEFAULT_LIMITS: ResourceLimits = {
  maxExecutionTime: 5 * 60 * 1000, // 5 minutes
  maxInferenceCalls: 50,
  maxNetworkRequests: 100,
  maxStorageBytes: 10 * 1024 * 1024, // 10MB
};

/**
 * Agent Runtime - manages execution of a single agent
 */
export class AgentRuntime {
  private sandbox: WebViewSandbox | null = null;
  private bridgeHandler: VSCodeBridgeHandler | null = null;
  private resolveAction: ((value: unknown) => void) | null = null;
  private rejectAction: ((error: Error) => void) | null = null;
  private actionTimeout: NodeJS.Timeout | null = null;

  constructor(
    private context: vscode.ExtensionContext,
    private agent: InstalledAgent,
    private storageAdapter: VSCodeStorageAdapter,
    private inferenceProvider: VSCodeInferenceProvider
  ) {}

  /**
   * Execute an action on this agent
   */
  async executeAction(actionId: string, input?: unknown): Promise<unknown> {
    console.log("[Agentlet] Executing action:", actionId, "on agent:", this.agent.id);
    console.log("[Agentlet] Agent permissions:", JSON.stringify(this.agent.permissions, null, 2));

    // Validate action exists
    const action = this.agent.manifest.actions.find((a) => a.id === actionId);
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`);
    }

    // Create sandbox
    console.log("[Agentlet] Creating sandbox...");
    this.sandbox = new WebViewSandbox(
      this.context,
      this.agent.permissions,
      this.agent.manifest.name
    );
    console.log("[Agentlet] Sandbox created");

    // Create adapters
    const contextAdapter = new VSCodeContextAdapter();
    const uiHandler = new VSCodeUIHandler();
    const intentHandler = new VSCodeIntentHandler();

    // Create bridge handler
    this.bridgeHandler = new VSCodeBridgeHandler(
      {
        agentId: this.agent.id,
        permissions: this.agent.permissions,
        limits: DEFAULT_LIMITS,
        onSendMessage: (message) => {
          this.sandbox?.postMessage(message);
        },
      },
      this.context,
      {
        context: contextAdapter,
        storage: this.storageAdapter,
        ui: uiHandler,
        inference: this.inferenceProvider,
        intent: intentHandler,
      }
    );

    // Set up message handling
    this.sandbox.onMessage((message) => this.handleMessage(message));

    // Handle sandbox disposal (user closed the panel)
    this.sandbox.onDispose(() => {
      console.log("[Agentlet] Sandbox disposed during execution");
      if (this.rejectAction) {
        this.rejectAction(new Error("Agent panel was closed"));
        this.resolveAction = null;
        this.rejectAction = null;
      }
    });

    // Load agent HTML
    console.log("[Agentlet] Loading agent HTML...");
    await this.sandbox.load(this.agent.html);
    console.log("[Agentlet] Agent HTML loaded");

    // Verify sandbox is ready
    if (!this.sandbox.isReady()) {
      throw new Error("Failed to create agent sandbox - please try again");
    }

    // Wait for bridge to be ready
    console.log("[Agentlet] Waiting for bridge ready...");
    await this.waitForReady();
    console.log("[Agentlet] Bridge ready");

    // Send host info
    console.log("[Agentlet] Sending init message...");
    this.sandbox.postMessage({
      type: "init",
      host: {
        name: "vscode",
        version: vscode.version,
        capabilities: this.bridgeHandler.getHostCapabilities(),
      },
    });
    console.log("[Agentlet] Init message sent");

    // Invoke the action
    console.log("[Agentlet] Invoking action:", actionId);
    return this.invokeAction(actionId, input);
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.bridgeHandler?.cancel();
  }

  /**
   * Destroy the runtime and clean up
   */
  destroy(): void {
    this.sandbox?.destroy();
    this.sandbox = null;
    this.bridgeHandler = null;
  }

  // ═══ PRIVATE METHODS ═══

  /**
   * Handle messages from sandbox
   */
  private async handleMessage(message: unknown): Promise<void> {
    const msg = message as Record<string, unknown>;
    console.log("[Agentlet] handleMessage:", msg.type, msg.method || "");

    // Handle bridge-loaded signal
    if (msg.type === "bridge-loaded") {
      return;
    }

    // Handle ready signal
    if (msg.type === "ready") {
      return;
    }

    // Handle invoke result
    if (msg.type === "invoke-result") {
      console.log("[Agentlet] Action completed with result");
      if (this.resolveAction) {
        const resolve = this.resolveAction;
        this.cleanup();
        resolve(msg.result);
        console.log("[Agentlet] Action promise resolved");
      }
      return;
    }

    // Handle invoke error
    if (msg.type === "invoke-error") {
      console.log("[Agentlet] Action failed with error:", msg.error);
      if (this.rejectAction) {
        this.rejectAction(new Error(msg.error as string));
        this.cleanup();
      }
      return;
    }

    // Handle lifecycle events
    if (msg.type === "lifecycle-result" || msg.type === "lifecycle-error") {
      return;
    }

    // Route request to bridge handler
    if (msg.type === "request") {
      console.log("[Agentlet] Routing request:", msg.method);
      await this.bridgeHandler?.handleMessage(msg);
    }
  }

  /**
   * Wait for the sandbox to signal ready
   */
  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Sandbox ready timeout"));
      }, 10000);

      const checkReady = () => {
        if (this.sandbox?.isReady()) {
          clearTimeout(timeout);
          // Give a short delay for the bridge to initialize
          setTimeout(resolve, 100);
        } else {
          setTimeout(checkReady, 50);
        }
      };

      checkReady();
    });
  }

  /**
   * Invoke an action and wait for result
   */
  private invokeAction(actionId: string, input?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      this.resolveAction = resolve;
      this.rejectAction = reject;

      const invokeId = `invoke-${Date.now()}`;

      // Set up timeout
      this.actionTimeout = setTimeout(() => {
        this.rejectAction?.(new Error("Action execution timeout"));
        this.cleanup();
      }, DEFAULT_LIMITS.maxExecutionTime);

      // Send invoke message
      this.sandbox?.postMessage({
        type: "invoke",
        invokeId,
        action: actionId,
        input,
      });
    });
  }

  /**
   * Clean up after action completes
   */
  private cleanup(): void {
    // Clear timeout
    if (this.actionTimeout) {
      clearTimeout(this.actionTimeout);
      this.actionTimeout = null;
    }
    this.resolveAction = null;
    this.rejectAction = null;
    this.destroy();
  }
}
