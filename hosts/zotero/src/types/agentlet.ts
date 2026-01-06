/**
 * Type definitions for Zotero Agentlet host
 *
 * Re-exports shared types from @agentlet/host-sdk and defines
 * Zotero-specific constants and types.
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

// ═══ ZOTERO-SPECIFIC TYPES ═══

/**
 * Zotero's supported intents
 */
export const SUPPORTED_INTENTS = [
  "add-tags",
  "remove-tags",
  "move-to",
  "create",
  "update",
  "delete",
  "search",
  "open",
] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

/**
 * Zotero's capabilities
 */
export const ZOTERO_CAPABILITIES = [
  "content",
  "tags",
  "collections",
  "metadata",
  "metadata:custom",
  "dates",
  "authors",
  "search",
  "batch",
  "attachments",
  "pdf",
  "references",
] as const;

export type ZoteroCapability = (typeof ZOTERO_CAPABILITIES)[number];

/**
 * Zotero host name constant
 */
export const ZOTERO_HOST_NAME = "zotero";

/**
 * Item schema for Zotero context
 */
export const ZOTERO_ITEM_SCHEMA = {
  bibliographic: {
    fields: [
      "id",
      "key",
      "itemType",
      "title",
      "creators",
      "date",
      "DOI",
      "ISBN",
      "abstract",
      "tags",
    ],
    description: "A bibliographic item in Zotero",
  },
  creator: {
    fields: ["firstName", "lastName", "creatorType"],
    description: "An author or contributor",
  },
  collection: {
    fields: ["id", "key", "name", "parentKey"],
    description: "A Zotero collection",
  },
} as const;
