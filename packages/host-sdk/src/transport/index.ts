/**
 * Transport layer for bridge script generation
 *
 * This module provides transport-agnostic bridge script generation.
 * Different hosts use different messaging mechanisms:
 * - iframe: postMessage to parent window
 * - vscode-webview: VS Code acquireVsCodeApi
 * - native-bridge: Native mobile bridges
 * - worker: Web Worker postMessage
 */

export { TransportType, TransportConfig, TransportAdapter } from "./types";
export {
  generateBridgeScript,
  detectTransport,
  TRANSPORTS,
} from "./template";
