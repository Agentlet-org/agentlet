/**
 * Type definitions for Agentlet v0.1 specification
 *
 * These types are shared across all host implementations.
 * Host-specific constants (capabilities, intents) should be defined
 * in the host implementation, not here.
 */

// ═══ VERSION TYPES ═══

/**
 * Version constraint for capabilities and requirements
 */
export interface VersionConstraint {
  minSpec?: string;
  maxSpec?: string;
}

/**
 * Capability or requirement with optional version constraint
 */
export interface ConstrainedCapability {
  name: string;
  constraint?: VersionConstraint;
}

// ═══ MANIFEST TYPES ═══

/**
 * Extracted manifest from v0.1 agent HTML
 */
export interface ExtractedManifest {
  specVersion: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  icon?: string;
  portability?: "host-specific" | "host-family" | "universal" | "adaptive";
  hosts?: string[];
  requires?: ConstrainedCapability[];
  optional?: ConstrainedCapability[];
  intents?: string[];
  capabilities: ConstrainedCapability[];
  actions: AgentActionMeta[];
  defaultAction?: string;
  preferences?: AgentPreferenceMeta[];
  triggers?: ManifestTrigger[];
}

/**
 * Agent action metadata from manifest
 */
export interface AgentActionMeta {
  id: string;
  label?: string;
  description?: string;
  confirm?: boolean;
  deprecated?: boolean;
  deprecatedMessage?: string;
  removeIn?: string;
}

/**
 * Agent preference metadata from manifest
 */
export interface AgentPreferenceMeta {
  key: string;
  type: string;
  label?: string;
  default?: unknown;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Manifest trigger definition
 */
export interface ManifestTrigger {
  event: string;
  action: string;
  filter?: Record<string, unknown>;
}

// ═══ PERMISSION TYPES ═══

/**
 * Granted permissions for an agent
 */
export interface GrantedPermissions {
  context?: string[];
  network?: string[];
  inference?: string | boolean;
  storage?: boolean;
  ui?: {
    notify?: boolean;
    confirm?: boolean;
    prompt?: boolean;
    form?: boolean;
    panel?: boolean;
  };
}

/**
 * Resource limits for agent execution
 */
export interface ResourceLimits {
  maxExecutionTime: number;
  maxInferenceCalls: number;
  maxNetworkRequests: number;
  maxStorageBytes: number;
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  inferenceCalls: number;
  networkRequests: number;
  storageBytes: number;
  startTime: number;
}

// ═══ BRIDGE MESSAGE TYPES ═══

/**
 * Request from agent to host
 */
export interface BridgeRequest {
  id: string;
  type: "request";
  method: string;
  params: unknown;
}

/**
 * Response from host to agent
 */
export interface BridgeResponse {
  id: string;
  type: "response";
  result?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ═══ HOST INFO ═══

/**
 * Host information sent to agent on init
 */
export interface HostInfo {
  name: string;
  version: string;
  specVersion: string;
  capabilities: string[];
  features: string[];
}

// ═══ INSTALLED AGENT ═══

/**
 * Installed agent record
 */
export interface InstalledAgent {
  id: string;
  url: string;
  manifest: ExtractedManifest;
  html: string;
  permissions: GrantedPermissions;
  installedAt: string;
  updatedAt: string;
}

// ═══ SANDBOX INTERFACE ═══

/**
 * Interface for sandboxed execution environments
 */
export interface ISandbox {
  load(html: string): Promise<void>;
  postMessage(message: unknown): void;
  onMessage(handler: (message: unknown) => void): void;
  destroy(): void;
  isReady(): boolean;
}

// ═══ ADAPTER INTERFACES ═══

/**
 * Interface for context adapters (host-specific implementations)
 */
export interface IContextAdapter {
  query(type: string, filter?: unknown): Promise<unknown[]>;
  get(type: string, id: string | number): Promise<unknown>;
  update(type: string, id: string | number, data: unknown): Promise<void>;
  create(type: string, data: unknown): Promise<unknown>;
  delete(type: string, id: string | number): Promise<void>;
  getSelection(): Promise<unknown[]>;
}

/**
 * Interface for UI handlers (host-specific implementations)
 */
export interface IUIHandler {
  notify(message: string, type?: string): Promise<void>;
  confirm(message: string): Promise<boolean>;
  prompt(message: string, defaultValue?: string): Promise<string | null>;
  form(config: unknown): Promise<unknown>;
  select(config: unknown): Promise<unknown>;
  panel(config: unknown): Promise<string>;
  updatePanel(id: string, updates: unknown): Promise<void>;
  closePanel(id: string): Promise<void>;
  activityStart(message: string): Promise<void>;
  activityStep(message: string): Promise<void>;
  activityProgress(current: number, total: number, message?: string): Promise<void>;
  activityLog(message: string, level?: string): Promise<void>;
  activityComplete(message: string): Promise<void>;
  activityError(message: string): Promise<void>;
}

/**
 * Interface for storage adapters (host-specific implementations)
 */
export interface IStorageAdapter {
  get(agentId: string, key: string): Promise<unknown>;
  set(agentId: string, key: string, value: unknown): Promise<void>;
  remove(agentId: string, key: string): Promise<void>;
  clear(agentId: string): Promise<void>;
  keys(agentId: string): Promise<string[]>;
}

/**
 * Interface for inference providers (host-specific implementations)
 */
export interface IInferenceProvider {
  inference(request: unknown): Promise<unknown>;
  streamingInference?(
    request: unknown,
    onToken: (token: string) => void
  ): Promise<string>;
  isAvailable(): boolean;
}

/**
 * Interface for intent handlers (host-specific implementations)
 */
export interface IIntentHandler {
  execute(
    intent: string,
    items: unknown[],
    params: unknown
  ): Promise<{
    success: boolean;
    affected: number;
    result?: unknown;
  }>;
}

// ═══ PERCEPTION TYPES ═══

/**
 * Options for perceive API
 */
export interface PerceiveOptions {
  scope?: "selection" | "all" | "query";
  query?: string;
  understand?: boolean;
  limit?: number;
}

/**
 * Result from perceive API
 */
export interface PerceiveResult {
  host: string;
  hostVersion: string;
  items: unknown[];
  capabilities: string[];
  schema?: Record<string, unknown>;
  understanding?: string;
}

// ═══ ACT TYPES ═══

/**
 * Options for act API
 */
export interface ActOptions {
  intent: string;
  items?: unknown[];
  [key: string]: unknown;
}

/**
 * Result from act API
 */
export interface ActResult {
  success: boolean;
  affected: number;
  result?: unknown;
}
