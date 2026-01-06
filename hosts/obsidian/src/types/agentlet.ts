/**
 * Type definitions for Obsidian Agentlet host
 *
 * Re-exports shared types from @agentlet/host-sdk and defines
 * host-specific constants and types.
 */

// ═══ RE-EXPORT SDK VALUES ═══

export { ErrorCodes, AgentletError } from "@agentlet/host-sdk";

// ═══ RE-EXPORT SDK TYPES ═══

export type {
  // Error codes
  ErrorCode,
  // Manifest types
  ExtractedManifest,
  AgentActionMeta,
  AgentPreferenceMeta,
  ManifestTrigger,
  // Permission types
  GrantedPermissions,
  ResourceLimits,
  ResourceUsage,
  // Bridge message types
  BridgeRequest,
  BridgeResponse,
  // Host info
  HostInfo,
  InstalledAgent,
  // Adapter interfaces
  ISandbox,
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,
  // Perceive/Act types
  PerceiveOptions,
  PerceiveResult,
  ActOptions,
  ActResult,
} from "@agentlet/host-sdk";

// ═══ OBSIDIAN-SPECIFIC TYPES ═══

/**
 * Obsidian's supported intents
 */
export const SUPPORTED_INTENTS = [
  "add-tags",
  "remove-tags",
  "move-to",
  "link",
  "unlink",
  "create",
  "update",
  "delete",
  "search",
  "open",
] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

/**
 * Obsidian's capabilities
 */
export const OBSIDIAN_CAPABILITIES = [
  "content",
  "content:markdown",
  "tags",
  "folders",
  "links",
  "backlinks",
  "metadata",
  "metadata:custom",
  "search",
  // "search:semantic",  // Not yet - requires embeddings
] as const;

export type ObsidianCapability = (typeof OBSIDIAN_CAPABILITIES)[number];

/**
 * Inference settings for the plugin
 */
export interface InferenceSettings {
  ollamaUrl: string;
  ollamaModel: string;
  openaiKey: string;
  openaiModel: string;
}
