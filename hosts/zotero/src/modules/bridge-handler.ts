/**
 * Zotero Bridge Handler - Extends SDK base class
 *
 * Implements the Agentlet bridge protocol for Zotero,
 * extending the SDK base class with Zotero-specific behavior.
 *
 * Key customizations:
 * - generateUnderstanding(): Zotero-specific item formatting
 * - handlePreferences(): Additional 'open' action
 * - handleFiles(): Zotero file access (stub)
 * - Logging via ztLog for debugging
 */

import {
  BridgeHandlerBase,
  type BridgeHandlerConfig,
  ErrorCodes,
} from "@agentlet/host-sdk";
import type {
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,
} from "../types/agentlet";
import {
  ZOTERO_CAPABILITIES,
  SUPPORTED_INTENTS,
  ZOTERO_HOST_NAME,
  ZOTERO_ITEM_SCHEMA,
} from "../types/agentlet";
import logger, { ztLog } from "../utils/logger";

// Declare Zotero global
declare const Zotero: {
  version: string;
  [key: string]: unknown;
};

// ═══ CONFIGURATION ═══

/**
 * Configuration for ZoteroBridgeHandler
 */
export interface ZoteroBridgeHandlerConfig {
  base: BridgeHandlerConfig;
  adapters: {
    context: IContextAdapter;
    storage: IStorageAdapter;
    ui: IUIHandler;
    inference?: IInferenceProvider;
    intent?: IIntentHandler;
  };
}

// ═══ ZOTERO BRIDGE HANDLER ═══

/**
 * Zotero Bridge Handler
 *
 * Extends the SDK's BridgeHandlerBase with Zotero-specific behavior.
 * Implements all abstract methods and overrides where needed.
 */
export class ZoteroBridgeHandler extends BridgeHandlerBase {
  private contextAdapter: IContextAdapter;
  private storageAdapter: IStorageAdapter;
  private uiHandler: IUIHandler;
  private inferenceProvider: IInferenceProvider | undefined;
  private intentHandler: IIntentHandler | undefined;

  constructor(config: ZoteroBridgeHandlerConfig) {
    super(config.base);
    this.contextAdapter = config.adapters.context;
    this.storageAdapter = config.adapters.storage;
    this.uiHandler = config.adapters.ui;
    this.inferenceProvider = config.adapters.inference;
    this.intentHandler = config.adapters.intent;
  }

  // ═══ ABSTRACT METHOD IMPLEMENTATIONS ═══

  getHostName(): string {
    return ZOTERO_HOST_NAME;
  }

  getHostVersion(): string {
    return Zotero.version || "8.0";
  }

  getHostCapabilities(): string[] {
    return [...ZOTERO_CAPABILITIES];
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

  protected getItemSchema(): Record<string, unknown> {
    return ZOTERO_ITEM_SCHEMA as unknown as Record<string, unknown>;
  }

  protected getDefaultContextType(): string {
    return "bibliographic";
  }

  // ═══ ZOTERO-SPECIFIC OVERRIDES ═══

  /**
   * Override to add Zotero-specific logging
   */
  async handleMessage(data: unknown): Promise<void> {
    const msg = data as Record<string, unknown>;

    // Handle ready signal with logging
    if (msg.type === "ready") {
      logger.debug("Agent sandbox ready");
    }

    // Delegate to base implementation
    return super.handleMessage(data);
  }

  /**
   * Override to add inference logging
   */
  protected async handleInference(
    action: string,
    params: unknown
  ): Promise<unknown> {
    ztLog(`[ZotAgentlet] Inference - handling action: ${action || "default"}`);

    try {
      const result = await super.handleInference(action, params);
      ztLog(
        `[ZotAgentlet] Inference - call count: ${this.getUsage().inferenceCalls}`
      );
      return result;
    } catch (error) {
      ztLog(`[ZotAgentlet] Inference - error: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Override to add Zotero-specific item formatting for understanding
   */
  protected async generateUnderstanding(
    items: unknown[]
  ): Promise<string | undefined> {
    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider) return undefined;

    // Format items with Zotero-specific fields
    const itemSummary = items
      .slice(0, 10)
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return `- ${i.title || "Untitled"} (${i.itemType || "unknown"})`;
      })
      .join("\n");

    const response = await inferenceProvider.inference({
      prompt: `Briefly describe this collection of items in 1-2 sentences:\n${itemSummary}`,
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

  /**
   * Override preferences to add 'open' action and support getting all preferences
   */
  protected async handlePreferences(
    action: string,
    params: unknown
  ): Promise<unknown> {
    if (action === "open") {
      // Open agent preferences dialog
      return this.getUIHandler().panel({
        id: "agent-preferences",
        title: "Agent Preferences",
        content: `Preferences for agent: ${this.agentId}`,
      });
    }

    if (action === "get") {
      const p = (params || {}) as Record<string, unknown>;

      // If a specific key is requested, get that preference
      if (p.key) {
        const prefKey = `__pref__${p.key}`;
        return this.getStorageAdapter().get(this.agentId, prefKey);
      }

      // If no key specified, return all preferences as an object
      // This matches what agents expect from bridge.preferences.get()
      const allKeys = await this.getStorageAdapter().keys(this.agentId);
      const prefKeys = allKeys.filter((k) => k.startsWith("__pref__"));
      const prefs: Record<string, unknown> = {};

      for (const prefKey of prefKeys) {
        const key = prefKey.replace("__pref__", "");
        prefs[key] = await this.getStorageAdapter().get(this.agentId, prefKey);
      }

      return prefs;
    }

    // Delegate other actions to base implementation
    return super.handlePreferences(action, params);
  }

  /**
   * Override routing to add files handler
   */
  protected async routeRequest(
    method: string,
    params: unknown
  ): Promise<unknown> {
    const [namespace] = method.split(".");

    if (namespace === "files") {
      const action = method.split(".")[1];
      return this.handleFiles(action, params);
    }

    return super.routeRequest(method, params);
  }

  /**
   * Zotero-specific files handler (stub)
   */
  protected async handleFiles(
    action: string,
    params: unknown
  ): Promise<unknown> {
    this.checkPermission("context", "files:read");

    switch (action) {
      case "read":
        // Read attachment file
        // Implementation depends on Zotero file access
        throw this.error(
          ErrorCodes.NOT_IMPLEMENTED,
          "File reading not yet implemented"
        );

      case "write":
        this.checkPermission("context", "files:write");
        throw this.error(
          ErrorCodes.NOT_IMPLEMENTED,
          "File writing not yet implemented"
        );

      default:
        throw this.error(
          ErrorCodes.NOT_IMPLEMENTED,
          `Unknown files action: ${action}`
        );
    }
  }
}

// ═══ BACKWARDS COMPATIBILITY ═══

/**
 * Legacy alias for ZoteroBridgeHandler
 * @deprecated Use ZoteroBridgeHandler directly
 */
export const BridgeHandler = ZoteroBridgeHandler;

/**
 * Legacy options interface
 * @deprecated Use ZoteroBridgeHandlerConfig directly
 */
export interface BridgeHandlerOptions {
  agentId: string;
  permissions: import("../types/agentlet").GrantedPermissions;
  limits: import("../types/agentlet").ResourceLimits;
  contextAdapter: IContextAdapter;
  inferenceProvider?: IInferenceProvider;
  uiHandler: IUIHandler;
  storageAdapter: IStorageAdapter;
  onSendMessage: (message: unknown) => void;
}

/**
 * Convert legacy options to new config format
 */
export function convertLegacyOptions(
  options: BridgeHandlerOptions
): ZoteroBridgeHandlerConfig {
  return {
    base: {
      agentId: options.agentId,
      permissions: options.permissions,
      limits: options.limits,
      onSendMessage: options.onSendMessage,
    },
    adapters: {
      context: options.contextAdapter,
      storage: options.storageAdapter,
      ui: options.uiHandler,
      inference: options.inferenceProvider,
    },
  };
}
