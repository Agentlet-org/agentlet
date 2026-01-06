/**
 * Agent Runtime - Executes agents in sandboxed iframes
 *
 * Orchestrates:
 * - IframeSandbox for agent isolation
 * - BridgeHandler for message routing
 * - Context, Inference, UI, Storage adapters
 *
 * SDK-CANDIDATE: 80% reusable
 * - AgentRun interface: 100% reusable
 * - Runtime orchestration logic: 80% reusable (lifecycle, invoke, cancel)
 * - HOST-SPECIFIC: Zotero context adapter, preference access
 */

import logger, { ztLog } from "../utils/logger";
import { getPref } from "../utils/prefs";
import { AgentManager, InstalledAgent } from "./agent-manager";
import {
  IframeSandbox,
  fetchAgentHtml,
  injectBridgeIntoHtml,
} from "./iframe-sandbox";
import {
  ZoteroBridgeHandler,
  convertLegacyOptions,
} from "./bridge-handler";
import { ZoteroIntentHandler } from "./adapters/intent-handler";
import type {
  IContextAdapter,
  IInferenceProvider,
  IUIHandler,
  GrantedPermissions,
  ResourceLimits,
} from "../types/agentlet";
import { StorageAdapter } from "./storage-adapter";
import { getInferenceProvider, initInference, shutdownInference } from "./inference-provider";
import { getUIHandler, UIHandler } from "./ui-handler";

declare const Zotero: any;

export interface AgentRun {
  runId: string;
  agentId: string;
  actionId: string;
  startTime: number;
  sandbox: IframeSandbox;
  bridgeHandler: ZoteroBridgeHandler;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export class AgentRuntime {
  private static runs = new Map<string, AgentRun>();
  private static storageAdapter: StorageAdapter | null = null;

  /**
   * Initialize the runtime
   */
  static async init(): Promise<void> {
    this.storageAdapter = new StorageAdapter();
    await this.storageAdapter.init();
    logger.info("Agent runtime initialized");
  }

  /**
   * Shutdown the runtime
   */
  static shutdown(): void {
    // Cancel all running agents
    for (const [runId, run] of this.runs) {
      this.cancelRun(runId);
    }
    this.runs.clear();

    if (this.storageAdapter) {
      this.storageAdapter.close();
      this.storageAdapter = null;
    }
    logger.info("Agent runtime shutdown");
  }

  /**
   * Invoke an agent action
   */
  static async invoke(
    agentId: string,
    actionId: string,
    input?: any
  ): Promise<any> {
    const agent = AgentManager.get(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found\n`);
    }

    const action = agent.manifest.actions?.[actionId];
    if (!action) {
      throw new Error(`Action "${actionId}" not found in agent "${agentId}"\n`);
    }

    logger.info(`Invoking ${agentId}/${actionId}\n`);

    // Create unique run ID
    const runId = `${agentId}:${actionId}:${Date.now()}`;

    // Track in global state
    addon.data.agents.running.set(runId, {
      agentId,
      actionId,
      startTime: Date.now(),
    });

    try {
      const result = await this._executeAgent(runId, agent, actionId, input);
      return result;
    } finally {
      addon.data.agents.running.delete(runId);
      this.runs.delete(runId);
    }
  }

  /**
   * Execute an agent in sandbox
   */
  private static async _executeAgent(
    runId: string,
    agent: InstalledAgent,
    actionId: string,
    input: any
  ): Promise<any> {
    // Get resource limits from preferences
    const limits: ResourceLimits = {
      maxExecutionTime: getPref("limits.maxExecutionTime") as number || 300000,
      maxInferenceCalls: getPref("limits.maxInferenceCalls") as number || 50,
      maxNetworkRequests: getPref("limits.maxNetworkRequests") as number || 100,
      maxStorageBytes: getPref("limits.maxStorageBytes") as number || 5242880,
    };

    // Parse permissions from agent
    const permissions = this._parsePermissions(agent);

    // Use stored HTML or refetch, inject bridge
    logger.info(`Loading agent from ${agent.url}\n`);
    let agentHtml = agent.agentHtml;
    if (!agentHtml) {
      // Refetch if not stored (shouldn't happen normally)
      agentHtml = await fetchAgentHtml(agent.url);
    }
    const networkDomains = agent.manifest.capabilities?.network || [];
    const html = injectBridgeIntoHtml(agentHtml, networkDomains);

    // Create sandbox
    const sandbox = new IframeSandbox();

    return new Promise(async (resolve, reject) => {
      // Create adapters
      const contextAdapter = this._createContextAdapter();
      const uiHandler = this._createUIHandler() as UIHandler;
      const inferenceProvider = this._createInferenceProvider();

      // Create intent handler (no permission checks - act() is a higher-level API)
      const intentHandler = new ZoteroIntentHandler(contextAdapter);

      // Set up panel message forwarder to inject messages into sandbox
      // This enables panel button clicks to be received by the agentlet
      uiHandler.setPanelMessageForwarder((message) => {
        logger.debug(`[Panel Forwarder] Forwarding message to sandbox: ${JSON.stringify(message)}`);
        sandbox.postMessage({ type: 'panel-message', message });
      });

      // Create bridge handler with new config format
      const bridgeHandler = new ZoteroBridgeHandler({
        base: {
          agentId: agent.id,
          permissions,
          limits,
          onSendMessage: (msg) => sandbox.postMessage(msg),
        },
        adapters: {
          context: contextAdapter,
          storage: this.storageAdapter!,
          ui: uiHandler,
          inference: inferenceProvider,
          intent: intentHandler,
        },
      });

      // Store run info
      const run: AgentRun = {
        runId,
        agentId: agent.id,
        actionId,
        startTime: Date.now(),
        sandbox,
        bridgeHandler,
        resolve,
        reject,
      };
      this.runs.set(runId, run);

      // Set up message handler
      sandbox.onMessage((data) => {
        this._handleSandboxMessage(runId, data);
      });

      try {
        // Load sandbox
        await sandbox.load(html);

        // Wait for ready signal with timeout
        await this._waitForReady(runId, 10000);

        // Send init message with host info
        sandbox.postMessage({
          type: "init",
          host: {
            name: "zotero",
            version: Zotero.version,
            specVersion: "0.1",
            capabilities: this._getHostCapabilities(permissions),
            features: this._getSupportedFeatures(permissions),
          },
        });

        // Small delay for init processing
        await new Promise((r) => setTimeout(r, 100));

        // Trigger activate lifecycle hook
        const activateId = `activate-${Date.now()}`;
        sandbox.postMessage({
          type: "lifecycle",
          event: "activate",
          invokeId: activateId,
        });

        // Small delay for activate processing
        await new Promise((r) => setTimeout(r, 50));

        // Invoke the action
        const invokeId = `invoke-${Date.now()}`;
        sandbox.postMessage({
          type: "invoke",
          invokeId,
          action: actionId,
          input,
        });

        // Wait for result with execution timeout
        const result = await this._waitForResult(runId, invokeId, limits.maxExecutionTime);

        // If there are open panels, wait for them to close before destroying sandbox
        // This allows panel interactions (button clicks) to be processed
        if (uiHandler.hasOpenPanels()) {
          logger.info(`[AgentRuntime] Action completed, waiting for panels to close before cleanup`);
          await uiHandler.waitForPanelsToClose();
        }

        resolve(result);
      } catch (error) {
        reject(error as Error);
      } finally {
        // Clean up sandbox and forwarder
        uiHandler.clearPanelMessageForwarder();
        sandbox.destroy();
      }
    });
  }

  /**
   * Handle message from sandbox
   */
  private static _handleSandboxMessage(runId: string, data: any): void {
    const run = this.runs.get(runId);
    if (!run) return;

    logger.debug(`Sandbox message [${runId}]:`, data.type);

    // Handle invoke result
    if (data.type === "invoke-result") {
      run.resolve(data.result);
      return;
    }

    // Handle invoke error
    if (data.type === "invoke-error") {
      run.reject(new Error(data.error));
      return;
    }

    // Handle load error
    if (data.type === "load-error") {
      run.reject(new Error(`Failed to load agent: ${data.error}`));
      return;
    }

    // Route to bridge handler
    run.bridgeHandler.handleMessage(data);
  }

  /**
   * Wait for sandbox ready signal
   * We wait for 'bridge-loaded' which indicates the bridge is ready
   *
   * NOTE: Do NOT call bridgeHandler.handleMessage here - messages are already
   * routed through the handler registered in _executeAgent(). Adding another
   * handler here would cause duplicate message processing.
   */
  private static _waitForReady(runId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const run = this.runs.get(runId);
      if (!run) {
        reject(new Error("Run not found"));
        return;
      }

      let resolved = false;
      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error("Sandbox ready timeout"));
        }
      }, timeout);

      run.sandbox.onMessage((data) => {
        // Accept 'bridge-loaded' or 'ready' signals
        if ((data.type === "bridge-loaded" || data.type === "ready") && !resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve();
        }
        // Messages are routed via the handler in _executeAgent() - don't duplicate here
      });
    });
  }

  /**
   * Wait for invoke result
   */
  private static _waitForResult(
    runId: string,
    invokeId: string,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const run = this.runs.get(runId);
      if (!run) {
        reject(new Error("Run not found"));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error("Execution timeout"));
      }, timeout);

      // Override resolve/reject to clear timer
      const originalResolve = run.resolve;
      const originalReject = run.reject;

      run.resolve = (result) => {
        clearTimeout(timer);
        resolve(result);
      };

      run.reject = (error) => {
        clearTimeout(timer);
        reject(error);
      };
    });
  }

  /**
   * Parse permissions from agent manifest
   */
  private static _parsePermissions(agent: InstalledAgent): GrantedPermissions {
    const caps = agent.manifest.capabilities || {};
    const stored = agent.permissions || {};

    ztLog(`[ZotAgentlet] Permissions - Agent: ${agent.id}\n`);
    ztLog(`[ZotAgentlet] Permissions - manifest.capabilities: ${JSON.stringify(caps)}\n`);
    ztLog(`[ZotAgentlet] Permissions - stored.permissions: ${JSON.stringify(stored)}\n`);

    // Merge manifest capabilities with stored granted permissions
    const permissions = {
      context: caps.context || stored.context || [],
      network: caps.network || stored.network || [],
      inference: caps.inference || stored.inference || false,
      storage: caps.storage !== false,
      ui: {
        notify: true, // Always allowed
        confirm: caps.ui?.confirm || stored.ui?.confirm || false,
        prompt: caps.ui?.prompt || stored.ui?.prompt || false,
        form: caps.ui?.form || stored.ui?.form || false,
        panel: caps.ui?.panel || stored.ui?.panel || false,
      },
    };

    ztLog(`[ZotAgentlet] Permissions - Resolved: ${JSON.stringify(permissions)}\n`);

    return permissions;
  }

  /**
   * Get host capabilities for init message
   */
  private static _getHostCapabilities(permissions: GrantedPermissions): string[] {
    const caps: string[] = [];

    if (permissions.context?.length) caps.push("context");
    if (permissions.inference) caps.push("inference");
    if (permissions.storage) caps.push("storage");
    if (permissions.network?.length) caps.push("network");
    if (permissions.ui?.notify) caps.push("ui.notify");
    if (permissions.ui?.confirm) caps.push("ui.confirm");
    if (permissions.ui?.prompt) caps.push("ui.prompt");
    if (permissions.ui?.form) caps.push("ui.form");
    if (permissions.ui?.panel) caps.push("ui.panel");

    return caps;
  }

  /**
   * Get supported features for init message
   * Features represent Bridge API availability
   */
  private static _getSupportedFeatures(permissions: GrantedPermissions): string[] {
    const features: string[] = ["context", "storage", "ui", "activity", "preferences"];

    if (permissions.inference) {
      features.push("inference", "inference:streaming");
    }

    // Perceive/act are always available for adaptive agents
    features.push("perceive", "act");

    return features;
  }

  /**
   * Create context adapter for Zotero
   */
  private static _createContextAdapter(): IContextAdapter {
    // Import dynamically to avoid circular deps
    // For now, return a stub - will be implemented in Phase 4
    return {
      async query(type: string, filter?: any): Promise<any[]> {
        logger.debug(`Context query: ${type}`, filter);

        if (type === "bibliographic") {
          // Get items from Zotero
          const libraryID = Zotero.Libraries.userLibraryID;
          let items = await Zotero.Items.getAll(libraryID);

          // Filter out attachments and notes by default
          items = items.filter(
            (item: any) => !item.isAttachment() && !item.isNote()
          );

          // Apply filter
          if (filter) {
            if (filter.itemType) {
              items = items.filter(
                (item: any) => item.itemType === filter.itemType
              );
            }
            if (filter.collection) {
              const collection = Zotero.Collections.getByLibraryAndKey(
                libraryID,
                filter.collection
              );
              if (collection) {
                const collectionItems = collection.getChildItems();
                const collectionIds = new Set(collectionItems.map((i: any) => i.id));
                items = items.filter((item: any) => collectionIds.has(item.id));
              }
            }
            if (filter.tag) {
              items = items.filter((item: any) =>
                item.getTags().some((t: any) => t.tag === filter.tag)
              );
            }
            if (filter.search) {
              const searchLower = filter.search.toLowerCase();
              items = items.filter((item: any) => {
                const title = item.getField("title")?.toLowerCase() || "";
                return title.includes(searchLower);
              });
            }
          }

          return items.map((item: any) => serializeZoteroItem(item));
        }

        if (type === "collection") {
          const libraryID = Zotero.Libraries.userLibraryID;
          const collections = Zotero.Collections.getByLibrary(libraryID);
          return collections.map((c: any) => ({
            id: c.id,
            key: c.key,
            name: c.name,
            parentKey: c.parentKey,
          }));
        }

        return [];
      },

      async get(type: string, id: string | number): Promise<any> {
        logger.debug(`Context get: ${type}/${id}\n`);

        if (type === "bibliographic") {
          const item = await Zotero.Items.getAsync(id as number);
          if (!item) return null;
          return serializeZoteroItem(item);
        }

        if (type === "collection") {
          const collection = Zotero.Collections.get(id as number);
          if (!collection) return null;
          return {
            id: collection.id,
            key: collection.key,
            name: collection.name,
            parentKey: collection.parentKey,
          };
        }

        return null;
      },

      async update(type: string, id: string | number, data: any): Promise<void> {
        logger.debug(`Context update: ${type}/${id}`, data);

        if (type === "bibliographic") {
          const item = await Zotero.Items.getAsync(id as number);
          if (!item) throw new Error(`Item ${id} not found\n`);

          // Update fields
          for (const [field, value] of Object.entries(data)) {
            if (field === "creators") {
              item.setCreators(value as any[]);
            } else if (field === "tags") {
              item.setTags((value as string[]).map((t) => ({ tag: t })));
            } else if (field === "collections") {
              item.setCollections(value as number[]);
            } else {
              try {
                item.setField(field, value as string);
              } catch (e) {
                logger.warn(`Could not set field ${field}:`, e);
              }
            }
          }

          await item.saveTx();
        }
      },

      async create(type: string, data: any): Promise<any> {
        logger.debug(`Context create: ${type}`, data);

        if (type === "bibliographic") {
          const item = new Zotero.Item(data.itemType || "journalArticle");
          item.libraryID = Zotero.Libraries.userLibraryID;

          for (const [field, value] of Object.entries(data)) {
            if (field === "itemType") continue;
            if (field === "creators") {
              item.setCreators(value as any[]);
            } else if (field === "tags") {
              item.setTags((value as string[]).map((t) => ({ tag: t })));
            } else {
              try {
                item.setField(field, value as string);
              } catch (e) {
                logger.warn(`Could not set field ${field}:`, e);
              }
            }
          }

          await item.saveTx();
          return serializeZoteroItem(item);
        }

        throw new Error(`Cannot create type: ${type}\n`);
      },

      async delete(type: string, id: string | number): Promise<void> {
        logger.debug(`Context delete: ${type}/${id}\n`);

        if (type === "bibliographic") {
          const item = await Zotero.Items.getAsync(id as number);
          if (item) {
            await item.eraseTx();
          }
        }
      },

      async getSelection(): Promise<any[]> {
        const zp = Zotero.getActiveZoteroPane();
        if (!zp) return [];

        const items = zp.getSelectedItems();
        return items
          .filter((item: any) => !item.isAttachment() && !item.isNote())
          .map((item: any) => serializeZoteroItem(item));
      },
    };
  }

  /**
   * Create UI handler for Zotero
   */
  private static _createUIHandler(): IUIHandler {
    return getUIHandler();
  }

  /**
   * Create inference provider
   */
  private static _createInferenceProvider(): IInferenceProvider | undefined {
    try {
      const provider = getInferenceProvider();
      return {
        isAvailable(): boolean {
          return provider.isAvailable();
        },

        async inference(request: any): Promise<any> {
          return provider.inference(request);
        },

        async streamingInference(
          request: any,
          onToken: (token: string) => void
        ): Promise<string> {
          return provider.streamingInference(request, onToken);
        },
      };
    } catch (error) {
      logger.warn("Inference provider not available:", error);
      return undefined;
    }
  }

  /**
   * Cancel a running agent
   */
  static cancel(agentId: string, actionId?: string): void {
    for (const [runId, run] of this.runs) {
      if (run.agentId === agentId && (!actionId || run.actionId === actionId)) {
        this.cancelRun(runId);
      }
    }
  }

  /**
   * Cancel a specific run
   */
  private static cancelRun(runId: string): void {
    const run = this.runs.get(runId);
    if (!run) return;

    // Send cancel signal
    run.bridgeHandler.cancel();

    // Destroy sandbox
    run.sandbox.destroy();

    // Reject promise
    run.reject(new Error("Cancelled"));

    // Clean up
    this.runs.delete(runId);
    addon.data.agents.running.delete(runId);

    logger.info(`Cancelled ${runId}\n`);
  }

  /**
   * Get all running agents
   */
  static getRunning(): AgentRun[] {
    return Array.from(this.runs.values());
  }
}

/**
 * Serialize a Zotero item to Agentlet format
 */
function serializeZoteroItem(item: any): any {
  return {
    id: item.id,
    key: item.key,
    itemType: item.itemType,
    title: item.getField("title") || "",
    abstractNote: item.getField("abstractNote") || "",
    date: item.getField("date") || "",
    DOI: item.getField("DOI") || "",
    ISBN: item.getField("ISBN") || "",
    ISSN: item.getField("ISSN") || "",
    url: item.getField("url") || "",
    publicationTitle: item.getField("publicationTitle") || "",
    journalAbbreviation: item.getField("journalAbbreviation") || "",
    volume: item.getField("volume") || "",
    issue: item.getField("issue") || "",
    pages: item.getField("pages") || "",
    publisher: item.getField("publisher") || "",
    place: item.getField("place") || "",
    language: item.getField("language") || "",
    creators: item.getCreators().map((c: any) => ({
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      creatorType: c.creatorType || "author",
    })),
    tags: item.getTags().map((t: any) => t.tag),
    collections: item.getCollections(),
    dateAdded: item.dateAdded,
    dateModified: item.dateModified,
  };
}
