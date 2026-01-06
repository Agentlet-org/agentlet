/**
 * Type definitions for VS Code Agentlet host
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
  // Version types
  VersionConstraint,
  ConstrainedCapability,
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

// ═══ VS CODE-SPECIFIC TYPES ═══

/**
 * VS Code's supported intents
 */
export const SUPPORTED_INTENTS = [
  "create",
  "update",
  "delete",
  "move-to",
  "copy-to",
  "search",
  "open",
  "replace-selection",
  "git-commit",
] as const;

export type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];

/**
 * VS Code's capabilities
 */
export const VSCODE_CAPABILITIES = [
  "content",
  "content:code",
  "folders",
  "search",
  "diagnostics",
  "git",
] as const;

export type VSCodeCapability = (typeof VSCODE_CAPABILITIES)[number];

/**
 * Item schema for VS Code context
 */
export interface VSCodeItemSchema {
  file: {
    fields: string[];
    description: string;
  };
  selection: {
    fields: string[];
    description: string;
  };
  workspace: {
    fields: string[];
    description: string;
  };
}

export const VSCODE_ITEM_SCHEMA: VSCodeItemSchema = {
  file: {
    fields: ["path", "content", "languageId", "isDirty", "isUntitled"],
    description: "A file in the workspace",
  },
  selection: {
    fields: ["text", "path", "startLine", "endLine", "languageId"],
    description: "Selected text in the editor",
  },
  workspace: {
    fields: ["name", "folders", "rootPath"],
    description: "Workspace information",
  },
};

/**
 * Context types VS Code supports
 */
export type VSCodeContextType = "file" | "selection" | "workspace" | "editor" | "diagnostic" | "git";

/**
 * Host version for VS Code
 */
export const VSCODE_HOST_NAME = "vscode";
