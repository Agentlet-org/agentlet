/**
 * @agentlet/host-sdk - SDK for building Agentlet host implementations
 *
 * This package provides the shared infrastructure for implementing
 * Agentlet hosts across different platforms (Zotero, Obsidian, VS Code, etc.).
 *
 * @packageDocumentation
 */

// ═══ ERROR CODES ═══

export { ErrorCodes, ErrorCode, AgentletError } from "./errors";

// ═══ TYPES ═══

export {
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
} from "./types";

// ═══ MANIFEST PARSING ═══

// Environment-aware parser (works in Node.js and browser)
export {
  extractManifest,
  extractManifestRegex,
  parseCapabilities,
  getCapabilityNames,
} from "./manifest/index";

// ═══ TRANSPORT ═══

export {
  TransportType,
  TransportConfig,
  TransportAdapter,
  generateBridgeScript,
  detectTransport,
  TRANSPORTS,
} from "./transport";

// ═══ BRIDGE HANDLER ═══

export { BridgeHandlerBase, BridgeHandlerConfig } from "./bridge-handler";

// ═══ SANDBOX ═══

export {
  SandboxConfig,
  SandboxFactory,
  createSandbox,
  HeadlessSandbox,
  createHeadlessSandbox,
} from "./sandbox/index";
