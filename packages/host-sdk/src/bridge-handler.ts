/**
 * BridgeHandler - Abstract base class for host-side message handling
 *
 * This class implements the shared bridge handling logic. Host implementations
 * extend this class and provide host-specific adapters and behavior.
 */

import { ErrorCodes } from "./errors";
import {
  BridgeRequest,
  GrantedPermissions,
  ResourceLimits,
  ResourceUsage,
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,
  PerceiveOptions,
  PerceiveResult,
  ActOptions,
  ActResult,
} from "./types";

// ═══ CONFIGURATION ═══

/**
 * Configuration options for BridgeHandlerBase
 */
export interface BridgeHandlerConfig {
  agentId: string;
  permissions: GrantedPermissions;
  limits: ResourceLimits;
  onSendMessage: (message: unknown) => void;
}

// ═══ ABSTRACT BASE CLASS ═══

/**
 * Abstract base class for bridge handlers.
 *
 * Hosts extend this class and:
 * 1. Provide adapters via abstract getters
 * 2. Implement host-specific perceive/act behavior
 * 3. Optionally override other handlers for customization
 */
export abstract class BridgeHandlerBase {
  protected agentId: string;
  protected permissions: GrantedPermissions;
  protected limits: ResourceLimits;
  protected usage: ResourceUsage;
  protected sendMessage: (message: unknown) => void;
  protected cancelled = false;
  protected activityTrace: Array<{
    timestamp: number;
    message: string;
    level: string;
  }> = [];

  constructor(config: BridgeHandlerConfig) {
    this.agentId = config.agentId;
    this.permissions = config.permissions;
    this.limits = config.limits;
    this.sendMessage = config.onSendMessage;

    this.usage = {
      inferenceCalls: 0,
      networkRequests: 0,
      storageBytes: 0,
      startTime: Date.now(),
    };
  }

  // ═══ ABSTRACT METHODS - Host must implement ═══

  /**
   * Get the host name (e.g., "zotero", "obsidian")
   */
  abstract getHostName(): string;

  /**
   * Get the host version
   */
  abstract getHostVersion(): string;

  /**
   * Get the host capabilities list
   */
  abstract getHostCapabilities(): string[];

  /**
   * Get the list of supported intents
   */
  abstract getSupportedIntents(): string[];

  /**
   * Get the context adapter
   */
  abstract getContextAdapter(): IContextAdapter;

  /**
   * Get the storage adapter
   */
  abstract getStorageAdapter(): IStorageAdapter;

  /**
   * Get the UI handler
   */
  abstract getUIHandler(): IUIHandler;

  /**
   * Get the inference provider (optional)
   */
  abstract getInferenceProvider(): IInferenceProvider | undefined;

  /**
   * Get the intent handler for act() calls
   */
  abstract getIntentHandler(): IIntentHandler | undefined;

  /**
   * Get the list of supported features (for bridge.features())
   * Features represent Bridge API availability (perceive, act, inference, etc.)
   */
  abstract getSupportedFeatures(): string[];

  /**
   * Get the spec version
   */
  getSpecVersion(): string {
    return "0.1";
  }

  /**
   * Get the schema for items returned by perceive
   */
  protected abstract getItemSchema(): Record<string, unknown>;

  // ═══ PUBLIC API ═══

  /**
   * Handle incoming message from sandbox
   */
  async handleMessage(data: unknown): Promise<void> {
    const msg = data as Record<string, unknown>;

    // Handle ready signal
    if (msg.type === "ready" || msg.type === "bridge-loaded") {
      return;
    }

    // Handle invoke result (handled by AgentRuntime)
    if (
      msg.type === "invoke-result" ||
      msg.type === "invoke-error" ||
      msg.type === "lifecycle-result" ||
      msg.type === "lifecycle-error"
    ) {
      return;
    }

    // Handle tool results for tool-calling inference
    if (msg.type === "tool-result") {
      return;
    }

    // Handle bridge requests
    if (msg.type === "request") {
      await this.handleRequest(msg as unknown as BridgeRequest);
    }
  }

  /**
   * Cancel the current execution
   */
  cancel(): void {
    this.cancelled = true;
    this.sendMessage({ type: "cancel" });
  }

  /**
   * Check if cancelled
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Get resource usage
   */
  getUsage(): ResourceUsage {
    return { ...this.usage };
  }

  /**
   * Get activity trace
   */
  getActivityTrace(): Array<{
    timestamp: number;
    message: string;
    level: string;
  }> {
    return [...this.activityTrace];
  }

  // ═══ REQUEST HANDLING ═══

  /**
   * Process a bridge request
   */
  protected async handleRequest(request: BridgeRequest): Promise<void> {
    const { id, method, params } = request;

    try {
      this.checkTimeLimit();
      const result = await this.routeRequest(method, params);
      this.sendResponse(id, result);
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      this.sendError(id, err.code || ErrorCodes.HOST_ERROR, err.message);
    }
  }

  /**
   * Route request to appropriate handler
   */
  protected async routeRequest(
    method: string,
    params: unknown
  ): Promise<unknown> {
    // Handle top-level methods (perceive, act)
    if (method === "perceive") {
      return this.handlePerceive(params as PerceiveOptions);
    }
    if (method === "act") {
      return this.handleAct(params as ActOptions);
    }

    const parts = method.split(".");
    const [namespace, action] = parts;

    // Handle context.selection.get -> selection.get
    if (namespace === "context" && action === "selection" && parts[2]) {
      return this.handleSelection(parts[2], params);
    }

    switch (namespace) {
      case "context":
        return this.handleContext(action, params);
      case "selection":
        return this.handleSelection(action, params);
      case "storage":
        return this.handleStorage(action, params);
      case "ui":
        return this.handleUI(action, params);
      case "activity":
        return this.handleActivity(action, params);
      case "inference":
        return this.handleInference(action, params);
      case "preferences":
        return this.handlePreferences(action, params);
      case "limits":
        return this.handleLimits(action, params);
      case "mcp":
        return this.handleMCP(action, params);
      default:
        throw this.error(
          ErrorCodes.HOST_UNSUPPORTED,
          `Unknown method: ${method}`
        );
    }
  }

  // ═══ PERCEIVE HANDLER ═══

  /**
   * Handle perceive requests (adaptive agents)
   */
  protected async handlePerceive(options: PerceiveOptions): Promise<PerceiveResult> {
    const { scope = "selection", query, understand = false, limit = 100 } = options;

    const contextAdapter = this.getContextAdapter();
    let items: unknown[] = [];

    switch (scope) {
      case "selection":
        items = await contextAdapter.getSelection();
        break;
      case "all":
        items = await contextAdapter.query(this.getDefaultContextType(), {});
        if (items.length > limit) {
          items = items.slice(0, limit);
        }
        break;
      case "query":
        if (!query) {
          throw this.error(
            ErrorCodes.CONTEXT_VALIDATION_FAILED,
            "Query parameter required for scope 'query'"
          );
        }
        items = await contextAdapter.query(this.getDefaultContextType(), {
          search: query,
        });
        if (items.length > limit) {
          items = items.slice(0, limit);
        }
        break;
      default:
        throw this.error(
          ErrorCodes.CONTEXT_VALIDATION_FAILED,
          `Invalid scope: ${scope}`
        );
    }

    const result: PerceiveResult = {
      host: this.getHostName(),
      hostVersion: this.getHostVersion(),
      items,
      capabilities: this.getHostCapabilities(),
      schema: this.getItemSchema(),
    };

    // Add AI understanding if requested
    if (understand && items.length > 0) {
      const inferenceProvider = this.getInferenceProvider();
      if (inferenceProvider?.isAvailable()) {
        try {
          this.checkPermission("inference");
          this.checkInferenceLimit();
          this.usage.inferenceCalls++;

          const understanding = await this.generateUnderstanding(items);
          if (understanding) {
            result.understanding = understanding;
          }
        } catch {
          // If inference fails, continue without understanding
        }
      }
    }

    return result;
  }

  /**
   * Get the default context type for this host (e.g., "note", "bibliographic")
   * Override in host implementation
   */
  protected getDefaultContextType(): string {
    return "item";
  }

  /**
   * Generate AI understanding of items
   * Override in host implementation for custom formatting
   */
  protected async generateUnderstanding(items: unknown[]): Promise<string | undefined> {
    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider) return undefined;

    const itemSummary = items
      .slice(0, 10)
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return `- ${i.title || i.name || "Untitled"}`;
      })
      .join("\n");

    const response = await inferenceProvider.inference({
      prompt: `Briefly describe this collection of ${items.length} items in 1-2 sentences:\n${itemSummary}`,
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

  // ═══ ACT HANDLER ═══

  /**
   * Handle act requests (adaptive agents)
   */
  protected async handleAct(options: ActOptions): Promise<ActResult> {
    const { intent, items = [], ...intentParams } = options;

    if (!intent) {
      throw this.error(
        ErrorCodes.CONTEXT_VALIDATION_FAILED,
        "Intent is required"
      );
    }

    const supportedIntents = this.getSupportedIntents();
    if (!supportedIntents.includes(intent)) {
      throw this.error(
        ErrorCodes.INTENT_NOT_SUPPORTED,
        `Intent '${intent}' is not supported by this host`
      );
    }

    const intentHandler = this.getIntentHandler();
    if (!intentHandler) {
      throw this.error(
        ErrorCodes.NOT_IMPLEMENTED,
        "Intent handler not available"
      );
    }

    return intentHandler.execute(intent, items as unknown[], intentParams);
  }

  // ═══ CONTEXT HANDLER ═══

  /**
   * Handle context requests
   */
  protected async handleContext(
    action: string,
    params: unknown
  ): Promise<unknown> {
    const p = params as Record<string, unknown>;
    const contextAdapter = this.getContextAdapter();

    switch (action) {
      case "query":
        this.checkPermission("context", `${p.type}:read`);
        return contextAdapter.query(p.type as string, p.filter);

      case "get":
        this.checkPermission("context", `${p.type}:read`);
        return contextAdapter.get(p.type as string, p.id as string | number);

      case "update":
        this.checkPermission("context", `${p.type}:write`);
        return contextAdapter.update(
          p.type as string,
          p.id as string | number,
          p.data
        );

      case "create":
        this.checkPermission("context", `${p.type}:write`);
        return contextAdapter.create(p.type as string, p.data);

      case "delete":
        this.checkPermission("context", `${p.type}:write`);
        return contextAdapter.delete(p.type as string, p.id as string | number);

      case "batch":
        return this.handleBatch(p.operations as unknown[]);

      default:
        throw this.error(
          ErrorCodes.HOST_UNSUPPORTED,
          `Unknown context action: ${action}`
        );
    }
  }

  /**
   * Handle batch context operations
   */
  protected async handleBatch(operations: unknown[]): Promise<unknown[]> {
    const contextAdapter = this.getContextAdapter();
    const results: unknown[] = [];

    for (const op of operations) {
      const o = op as Record<string, unknown>;
      const perm = o.operation === "query" || o.operation === "get" ? "read" : "write";
      this.checkPermission("context", `${o.type}:${perm}`);

      try {
        let result: unknown;
        switch (o.operation) {
          case "query":
            result = await contextAdapter.query(o.type as string, o.filter);
            break;
          case "get":
            result = await contextAdapter.get(
              o.type as string,
              o.id as string | number
            );
            break;
          case "update":
            await contextAdapter.update(
              o.type as string,
              o.id as string | number,
              o.data
            );
            result = { success: true };
            break;
          case "create":
            result = await contextAdapter.create(o.type as string, o.data);
            break;
          case "delete":
            await contextAdapter.delete(
              o.type as string,
              o.id as string | number
            );
            result = { success: true };
            break;
        }
        results.push({ success: true, result });
      } catch (error: unknown) {
        const err = error as Error;
        results.push({ success: false, error: err.message });
      }
    }

    return results;
  }

  // ═══ SELECTION HANDLER ═══

  /**
   * Handle selection requests
   */
  protected async handleSelection(
    action: string,
    _params: unknown
  ): Promise<unknown> {
    if (action === "get") {
      this.checkPermission("context", "selection:read");
      return this.getContextAdapter().getSelection();
    }
    throw this.error(
      ErrorCodes.HOST_UNSUPPORTED,
      `Unknown selection action: ${action}`
    );
  }

  // ═══ STORAGE HANDLER ═══

  /**
   * Handle storage requests
   */
  protected async handleStorage(
    action: string,
    params: unknown
  ): Promise<unknown> {
    this.checkPermission("storage");

    const p = params as Record<string, unknown>;
    const storageAdapter = this.getStorageAdapter();

    switch (action) {
      case "get":
        return storageAdapter.get(this.agentId, p.key as string);
      case "set":
        const serialized = JSON.stringify(p.value);
        this.checkStorageLimit(serialized.length);
        return storageAdapter.set(this.agentId, p.key as string, p.value);
      case "remove":
        return storageAdapter.remove(this.agentId, p.key as string);
      case "clear":
        return storageAdapter.clear(this.agentId);
      case "keys":
        return storageAdapter.keys(this.agentId);
      default:
        throw this.error(
          ErrorCodes.HOST_UNSUPPORTED,
          `Unknown storage action: ${action}`
        );
    }
  }

  // ═══ UI HANDLER ═══

  /**
   * Handle UI requests
   */
  protected async handleUI(action: string, params: unknown): Promise<unknown> {
    this.checkUIPermission(action);

    const p = params as Record<string, unknown>;
    const uiHandler = this.getUIHandler();

    switch (action) {
      case "notify":
        return uiHandler.notify(p.message as string, p.type as string);
      case "confirm":
        return uiHandler.confirm(p.message as string);
      case "prompt":
        return uiHandler.prompt(p.message as string, p.defaultValue as string);
      case "form":
        return uiHandler.form(p);
      case "select":
        return uiHandler.select(p);
      case "panel":
        return uiHandler.panel(p);
      case "updatePanel":
        return uiHandler.updatePanel(p.id as string, p);
      case "closePanel":
        return uiHandler.closePanel(p.id as string);
      default:
        throw this.error(
          ErrorCodes.HOST_UNSUPPORTED,
          `Unknown UI action: ${action}`
        );
    }
  }

  // ═══ ACTIVITY HANDLER ═══

  /**
   * Handle activity requests
   */
  protected async handleActivity(
    action: string,
    params: unknown
  ): Promise<unknown> {
    const p = params as Record<string, unknown>;
    const uiHandler = this.getUIHandler();

    // Log to activity trace
    this.activityTrace.push({
      timestamp: Date.now(),
      message: (p.message as string) || "",
      level: (p.level as string) || "info",
    });

    switch (action) {
      case "start":
        return uiHandler.activityStart(p.message as string);
      case "step":
        return uiHandler.activityStep(p.message as string);
      case "progress":
        return uiHandler.activityProgress(
          p.current as number,
          p.total as number,
          p.message as string
        );
      case "log":
        return uiHandler.activityLog(p.message as string, p.level as string);
      case "complete":
        return uiHandler.activityComplete(p.message as string);
      case "error":
        return uiHandler.activityError(p.message as string);
      case "getTrace":
        return [...this.activityTrace];
      default:
        throw this.error(
          ErrorCodes.HOST_UNSUPPORTED,
          `Unknown activity action: ${action}`
        );
    }
  }

  // ═══ INFERENCE HANDLER ═══

  /**
   * Handle inference requests
   */
  protected async handleInference(
    action: string,
    params: unknown
  ): Promise<unknown> {
    this.checkPermission("inference");
    this.checkInferenceLimit();

    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider?.isAvailable()) {
      throw this.error(
        ErrorCodes.INFERENCE_UNAVAILABLE,
        "No inference provider configured"
      );
    }

    this.usage.inferenceCalls++;

    if (action === "stream") {
      return this.handleStreamingInference(params);
    }

    if (action === "tools") {
      return this.handleToolInference(params);
    }

    // Regular inference
    return inferenceProvider.inference(params);
  }

  /**
   * Handle streaming inference
   */
  protected async handleStreamingInference(params: unknown): Promise<void> {
    const p = params as Record<string, unknown>;
    const id = p.id as string;

    const inferenceProvider = this.getInferenceProvider();
    if (!inferenceProvider?.streamingInference) {
      throw this.error(
        ErrorCodes.NOT_IMPLEMENTED,
        "Streaming inference not supported"
      );
    }

    try {
      const result = await inferenceProvider.streamingInference(
        params,
        (token: string) => {
          this.sendMessage({ type: "inference-token", id, token });
        }
      );
      this.sendMessage({ type: "inference-complete", id, result });
    } catch (error: unknown) {
      const err = error as Error & { code?: string };
      this.sendMessage({
        type: "inference-error",
        id,
        error: { code: err.code || ErrorCodes.INFERENCE_FAILED, message: err.message },
      });
    }
  }

  /**
   * Handle tool-calling inference
   */
  protected async handleToolInference(_params: unknown): Promise<void> {
    throw this.error(
      ErrorCodes.NOT_IMPLEMENTED,
      "Tool inference not yet implemented"
    );
  }

  // ═══ PREFERENCES HANDLER ═══

  /**
   * Handle preferences requests
   */
  protected async handlePreferences(
    action: string,
    params: unknown
  ): Promise<unknown> {
    const p = params as Record<string, unknown>;

    if (action === "get") {
      const prefKey = `__pref__${p.key}`;
      return this.getStorageAdapter().get(this.agentId, prefKey);
    }

    throw this.error(
      ErrorCodes.HOST_UNSUPPORTED,
      `Unknown preferences action: ${action}`
    );
  }

  // ═══ LIMITS HANDLER ═══

  /**
   * Handle limits requests
   */
  protected async handleLimits(
    action: string,
    _params: unknown
  ): Promise<unknown> {
    if (action === "remaining") {
      const elapsed = Date.now() - this.usage.startTime;
      return {
        time: Math.max(0, this.limits.maxExecutionTime - elapsed),
        inferenceCalls: Math.max(
          0,
          this.limits.maxInferenceCalls - this.usage.inferenceCalls
        ),
        networkRequests: Math.max(
          0,
          this.limits.maxNetworkRequests - this.usage.networkRequests
        ),
        storageBytes: Math.max(
          0,
          this.limits.maxStorageBytes - this.usage.storageBytes
        ),
      };
    }
    throw this.error(
      ErrorCodes.HOST_UNSUPPORTED,
      `Unknown limits action: ${action}`
    );
  }

  // ═══ MCP HANDLER ═══

  /**
   * Handle MCP requests (Model Context Protocol)
   * Override in host implementation if MCP is supported
   */
  protected async handleMCP(
    _action: string,
    _params: unknown
  ): Promise<unknown> {
    throw this.error(
      ErrorCodes.NOT_IMPLEMENTED,
      "MCP not supported in this host"
    );
  }

  // ═══ PERMISSION CHECKING ═══

  /**
   * Check if permission is granted
   */
  protected checkPermission(type: string, action?: string): void {
    switch (type) {
      case "context":
        if (!action) return;
        const [contextType, accessType] = action.split(":");
        const contextPerms = this.permissions.context || [];
        const hasPermission = contextPerms.some((p) => {
          const [pType, pAccess] = p.split(":");
          return (
            (pType === contextType || pType === "*") &&
            (pAccess === accessType || pAccess === "write") // write implies read
          );
        });
        if (!hasPermission) {
          throw this.error(
            ErrorCodes.PERMISSION_DENIED,
            `Permission denied: ${action}`
          );
        }
        break;

      case "inference":
        if (!this.permissions.inference) {
          throw this.error(
            ErrorCodes.PERMISSION_DENIED,
            "Inference permission not granted"
          );
        }
        break;

      case "storage":
        if (!this.permissions.storage) {
          throw this.error(
            ErrorCodes.PERMISSION_DENIED,
            "Storage permission not granted"
          );
        }
        break;

      case "network":
        if (!action) return;
        const networkPerms = this.permissions.network || [];
        if (!networkPerms.some((d) => action.includes(d))) {
          throw this.error(
            ErrorCodes.NETWORK_DOMAIN_NOT_ALLOWED,
            `Network access not allowed for: ${action}`
          );
        }
        break;
    }
  }

  /**
   * Check UI permission for action
   */
  protected checkUIPermission(action: string): void {
    const uiPerms = this.permissions.ui || {};

    const permMap: Record<string, keyof typeof uiPerms> = {
      notify: "notify",
      confirm: "confirm",
      prompt: "prompt",
      form: "form",
      select: "form",
      panel: "panel",
      updatePanel: "panel",
      closePanel: "panel",
    };

    const required = permMap[action];
    if (required && !uiPerms[required]) {
      throw this.error(
        ErrorCodes.PERMISSION_DENIED,
        `UI permission denied: ${action}`
      );
    }
  }

  // ═══ LIMIT CHECKING ═══

  /**
   * Check execution time limit
   */
  protected checkTimeLimit(): void {
    const elapsed = Date.now() - this.usage.startTime;
    if (elapsed > this.limits.maxExecutionTime) {
      throw this.error(
        ErrorCodes.LIMIT_TIME_EXCEEDED,
        "Execution time limit exceeded"
      );
    }
  }

  /**
   * Check inference call limit
   */
  protected checkInferenceLimit(): void {
    if (this.usage.inferenceCalls >= this.limits.maxInferenceCalls) {
      throw this.error(
        ErrorCodes.LIMIT_INFERENCE_EXCEEDED,
        "Inference call limit exceeded"
      );
    }
  }

  /**
   * Check storage limit
   */
  protected checkStorageLimit(additionalBytes: number): void {
    if (this.usage.storageBytes + additionalBytes > this.limits.maxStorageBytes) {
      throw this.error(
        ErrorCodes.LIMIT_STORAGE_EXCEEDED,
        "Storage limit exceeded"
      );
    }
    this.usage.storageBytes += additionalBytes;
  }

  // ═══ RESPONSE HELPERS ═══

  /**
   * Send success response
   */
  protected sendResponse(id: string, result: unknown): void {
    this.sendMessage({ id, type: "response", result });
  }

  /**
   * Send error response
   */
  protected sendError(id: string, code: string, message: string): void {
    this.sendMessage({ id, type: "response", error: { code, message } });
  }

  /**
   * Create error with code
   */
  protected error(code: string, message: string): Error {
    const error = new Error(message);
    (error as Error & { code: string }).code = code;
    return error;
  }
}
