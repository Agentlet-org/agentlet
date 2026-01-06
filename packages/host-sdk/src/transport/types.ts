/**
 * Transport layer types for bridge script generation
 *
 * Transports handle the communication between the agent sandbox
 * and the host application via different messaging mechanisms.
 */

/**
 * Available transport types for bridge scripts
 */
export type TransportType =
  | "iframe"
  | "vscode-webview"
  | "native-bridge"
  | "worker";

/**
 * Transport configuration for message passing
 */
export interface TransportConfig {
  /** Setup code run before bridge initialization */
  setup: string;
  /** Expression to send a message (receives `msg` variable) */
  send: string;
  /** Expression to register a message handler (receives `handler` function) */
  receive: string;
}

/**
 * Runtime transport adapter interface
 * Used by hosts to handle message passing at runtime
 */
export interface TransportAdapter {
  /** Send a message to the agent */
  send(message: unknown): void;
  /** Register a handler for incoming messages */
  onReceive(handler: (message: unknown) => void): void;
  /** Cleanup resources (optional) */
  destroy?(): void;
}
