/**
 * BridgeHandler - Obsidian-specific bridge handler
 *
 * Extends BridgeHandlerBase from SDK with Obsidian-specific adapters and behavior.
 */

import { BridgeHandlerBase, BridgeHandlerConfig } from "@agentlet/host-sdk";
import {
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,
  SUPPORTED_INTENTS,
  OBSIDIAN_CAPABILITIES,
} from "../types/agentlet";

// ═══ CONFIGURATION ═══

export interface ObsidianBridgeHandlerOptions extends BridgeHandlerConfig {
  contextAdapter: IContextAdapter;
  inferenceProvider?: IInferenceProvider;
  uiHandler: IUIHandler;
  storageAdapter: IStorageAdapter;
  intentHandler: IIntentHandler;
  getAppVersion: () => string;
}

// ═══ OBSIDIAN BRIDGE HANDLER ═══

/**
 * Obsidian-specific bridge handler implementation
 */
export class BridgeHandler extends BridgeHandlerBase {
  private contextAdapter: IContextAdapter;
  private inferenceProvider?: IInferenceProvider;
  private uiHandler: IUIHandler;
  private storageAdapter: IStorageAdapter;
  private intentHandler: IIntentHandler;
  private getAppVersion: () => string;

  constructor(options: ObsidianBridgeHandlerOptions) {
    super({
      agentId: options.agentId,
      permissions: options.permissions,
      limits: options.limits,
      onSendMessage: options.onSendMessage,
    });

    this.contextAdapter = options.contextAdapter;
    this.inferenceProvider = options.inferenceProvider;
    this.uiHandler = options.uiHandler;
    this.storageAdapter = options.storageAdapter;
    this.intentHandler = options.intentHandler;
    this.getAppVersion = options.getAppVersion;
  }

  // ═══ ABSTRACT METHOD IMPLEMENTATIONS ═══

  getHostName(): string {
    return "obsidian";
  }

  getHostVersion(): string {
    return this.getAppVersion();
  }

  getHostCapabilities(): string[] {
    return [...OBSIDIAN_CAPABILITIES];
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

  protected getDefaultContextType(): string {
    return "note";
  }

  protected getItemSchema(): Record<string, unknown> {
    return {
      noteFields: [
        "id",
        "path",
        "name",
        "title",
        "content",
        "tags",
        "frontmatter",
        "links",
        "backlinks",
        "created",
        "modified",
      ],
    };
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

  // ═══ OPTIONAL OVERRIDES ═══

  /**
   * Override to customize understanding generation for Obsidian notes
   */
  protected async generateUnderstanding(
    items: unknown[]
  ): Promise<string | undefined> {
    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider) return undefined;

    const itemSummary = items
      .slice(0, 5)
      .map((item) => {
        const i = item as Record<string, unknown>;
        return {
          title: i.title || i.name,
          tags: i.tags,
          excerpt: (i.content as string)?.slice(0, 200),
        };
      });

    const response = await inferenceProvider.inference({
      prompt: `Briefly describe these ${items.length} notes:\n${JSON.stringify(itemSummary)}`,
      max_tokens: 150,
    });

    if (typeof response === "string") {
      return response;
    }
    return undefined;
  }
}

// Re-export the options type for compatibility
export type BridgeHandlerOptions = ObsidianBridgeHandlerOptions;
