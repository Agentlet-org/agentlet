/**
 * VS Code Bridge Handler - Extends SDK base class
 *
 * Implements the abstract methods from BridgeHandlerBase with
 * VS Code-specific adapters and behavior.
 */

import * as vscode from "vscode";
import {
  BridgeHandlerBase,
  type BridgeHandlerConfig,
} from "@agentlet/host-sdk";
import type {
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,
} from "../types/agentlet";
import {
  VSCODE_CAPABILITIES,
  SUPPORTED_INTENTS,
  VSCODE_HOST_NAME,
  VSCODE_ITEM_SCHEMA,
} from "../types/agentlet";

/**
 * VS Code Bridge Handler
 *
 * Implements the Agentlet bridge protocol for VS Code,
 * routing messages to appropriate adapters.
 */
export class VSCodeBridgeHandler extends BridgeHandlerBase {
  private vscodeContext: vscode.ExtensionContext;
  private contextAdapter: IContextAdapter;
  private storageAdapter: IStorageAdapter;
  private uiHandler: IUIHandler;
  private inferenceProvider: IInferenceProvider | undefined;
  private intentHandler: IIntentHandler | undefined;

  constructor(
    config: BridgeHandlerConfig,
    context: vscode.ExtensionContext,
    adapters: {
      context: IContextAdapter;
      storage: IStorageAdapter;
      ui: IUIHandler;
      inference?: IInferenceProvider;
      intent?: IIntentHandler;
    }
  ) {
    super(config);
    this.vscodeContext = context;
    this.contextAdapter = adapters.context;
    this.storageAdapter = adapters.storage;
    this.uiHandler = adapters.ui;
    this.inferenceProvider = adapters.inference;
    this.intentHandler = adapters.intent;
  }

  // ═══ ABSTRACT METHOD IMPLEMENTATIONS ═══

  getHostName(): string {
    return VSCODE_HOST_NAME;
  }

  getHostVersion(): string {
    return vscode.version;
  }

  getHostCapabilities(): string[] {
    return [...VSCODE_CAPABILITIES];
  }

  getSupportedIntents(): string[] {
    return [...SUPPORTED_INTENTS];
  }

  getContextAdapter(): IContextAdapter {
    return this.contextAdapter;
  }

  getStorageAdapter(): IStorageAdapter {
    return this.storageAdapter;
  }

  getUIHandler(): IUIHandler {
    return this.uiHandler;
  }

  getInferenceProvider(): IInferenceProvider | undefined {
    return this.inferenceProvider;
  }

  getIntentHandler(): IIntentHandler | undefined {
    return this.intentHandler;
  }

  protected getItemSchema(): Record<string, unknown> {
    return VSCODE_ITEM_SCHEMA as unknown as Record<string, unknown>;
  }

  protected getDefaultContextType(): string {
    return "file";
  }

  getSupportedFeatures(): string[] {
    const features = ["context", "storage", "ui", "activity", "preferences"];

    if (this.inferenceProvider?.isAvailable()) {
      features.push("inference", "inference:streaming");
    }

    if (this.intentHandler) {
      features.push("perceive", "act");
    }

    return features;
  }

  // ═══ VS CODE-SPECIFIC OVERRIDES ═══

  /**
   * Generate AI understanding of items (VS Code-specific formatting)
   */
  protected async generateUnderstanding(
    items: unknown[]
  ): Promise<string | undefined> {
    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider) return undefined;

    const itemSummary = items
      .slice(0, 10)
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        if (i.path) {
          return `- ${i.path} (${i.languageId || "unknown"})`;
        }
        if (i.text) {
          const text = String(i.text);
          const preview = text.slice(0, 100);
          return `- Selection: "${preview}${text.length > 100 ? "..." : ""}"`;
        }
        return `- ${i.title || i.name || "Untitled"}`;
      })
      .join("\n");

    const response = await inferenceProvider.inference({
      prompt: `Briefly describe this code context in 1-2 sentences:\n${itemSummary}`,
      max_tokens: 150,
    });

    if (typeof response === "string") {
      return response;
    }
    if (response && typeof response === "object" && "text" in response) {
      return (response as { text: string }).text;
    }
    return undefined;
  }
}
