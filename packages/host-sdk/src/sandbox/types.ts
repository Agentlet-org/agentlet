/**
 * Sandbox configuration types
 */

import { GrantedPermissions, ISandbox } from "../types";
import { TransportType } from "../transport";

/**
 * Configuration for creating a sandbox
 */
export interface SandboxConfig {
  /** Permissions granted to the agent */
  permissions: GrantedPermissions;

  /** Transport type (default: auto-detect) */
  transport?: TransportType;

  // ═══ DOM SANDBOX OPTIONS ═══

  /** Container element for DOM sandboxes */
  container?: HTMLElement | "body" | "create";

  /** Whether iframe should be hidden (default: true for DOM) */
  hidden?: boolean;

  // ═══ HEADLESS SANDBOX OPTIONS ═══

  /** Custom document provider (for jsdom) */
  documentProvider?: () => Document;

  /** Custom window provider (for jsdom) */
  windowProvider?: () => Window;

  // ═══ VS CODE WEBVIEW OPTIONS ═══

  /** VS Code WebviewPanel instance */
  webviewPanel?: unknown;
}

/**
 * Factory function type for creating sandboxes
 */
export type SandboxFactory = (config: SandboxConfig) => ISandbox;
