/**
 * AgentRuntime - Execute agents in sandboxed environment
 *
 * Creates sandbox, injects bridge, and manages agent lifecycle
 */

import { App } from "obsidian";
import { createSandbox, ISandbox } from "@agentlet/host-sdk";
import { InstalledAgent, ResourceLimits, OBSIDIAN_CAPABILITIES } from "../types/agentlet";
import { BridgeHandler } from "./bridge-handler";
import { ObsidianContextAdapter } from "./adapters/context";
import { ObsidianUIHandler } from "./adapters/ui";
import { ObsidianStorageAdapter } from "./adapters/storage";
import { ObsidianInferenceProvider } from "./adapters/inference";
import { ObsidianIntentHandler } from "./adapters/intents";

/**
 * Runtime for executing agent actions
 */
export class AgentRuntime {
  private sandbox: ISandbox | null = null;
  private bridgeHandler: BridgeHandler | null = null;
  private container: HTMLElement | null = null;

  constructor(
    private app: App,
    private agent: InstalledAgent,
    private storageAdapter: ObsidianStorageAdapter,
    private inferenceProvider: ObsidianInferenceProvider
  ) {}

  async executeAction(actionId: string, input?: any): Promise<any> {
    // Create hidden sandbox container
    this.container = document.createElement("div");
    this.container.style.display = "none";
    document.body.appendChild(this.container);

    try {
      // Create sandbox with permissions
      this.sandbox = createSandbox({
        container: this.container,
        permissions: this.agent.permissions,
      });

      // Create adapters
      const contextAdapter = new ObsidianContextAdapter(this.app);
      const uiHandler = new ObsidianUIHandler(this.app);
      const intentHandler = new ObsidianIntentHandler(this.app, contextAdapter);

      // Create bridge handler
      this.bridgeHandler = new BridgeHandler({
        agentId: this.agent.id,
        permissions: this.agent.permissions,
        limits: this.getDefaultLimits(),
        contextAdapter,
        inferenceProvider: this.inferenceProvider,
        uiHandler,
        storageAdapter: this.storageAdapter,
        intentHandler,
        onSendMessage: (msg) => this.sandbox?.postMessage(msg),
        getAppVersion: () => contextAdapter.getAppVersion(),
      });

      // Set up message handling
      this.sandbox.onMessage((msg) => this.bridgeHandler?.handleMessage(msg));

      // Load agent HTML (bridge is injected by the SDK sandbox)
      await this.sandbox.load(this.agent.html);

      // Wait for bridge to be ready
      await this.waitForBridgeLoaded();

      // Send init with host info
      this.sandbox.postMessage({
        type: "init",
        host: {
          name: "obsidian",
          version: contextAdapter.getAppVersion(),
          capabilities: [...OBSIDIAN_CAPABILITIES],
        },
      });

      // Wait for agent ready
      await this.waitForReady();

      // Invoke action
      const result = await this.invokeAction(actionId, input);

      return result;
    } finally {
      this.cleanup();
    }
  }

  private getDefaultLimits(): ResourceLimits {
    return {
      maxExecutionTime: 300000, // 5 minutes
      maxInferenceCalls: 50,
      maxNetworkRequests: 100,
      maxStorageBytes: 5 * 1024 * 1024, // 5MB
    };
  }

  private waitForBridgeLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for bridge")),
        10000
      );

      const handler = (msg: any) => {
        if (msg.type === "bridge-loaded") {
          clearTimeout(timeout);
          resolve();
        }
      };

      this.sandbox?.onMessage(handler);
    });
  }

  private waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for agent ready")),
        10000
      );

      const handler = (msg: any) => {
        if (msg.type === "ready") {
          clearTimeout(timeout);
          resolve();
        }
      };

      this.sandbox?.onMessage(handler);
    });
  }

  private invokeAction(actionId: string, input?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const invokeId = `invoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(
        () => reject(new Error("Action timeout")),
        300000
      );

      const handler = (msg: any) => {
        if (msg.invokeId === invokeId) {
          clearTimeout(timeout);
          if (msg.type === "invoke-result") {
            resolve(msg.result);
          } else if (msg.type === "invoke-error") {
            reject(new Error(msg.error));
          }
        }
      };

      this.sandbox?.onMessage(handler);
      this.sandbox?.postMessage({
        type: "invoke",
        invokeId,
        action: actionId,
        input: input || {},
      });
    });
  }

  cancel(): void {
    this.bridgeHandler?.cancel();
  }

  private cleanup(): void {
    this.sandbox?.destroy();
    this.sandbox = null;
    this.bridgeHandler = null;

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
