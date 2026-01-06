/**
 * Sandbox - Abstract base class for iframe-based agent sandboxes
 *
 * This class implements the shared iframe sandbox logic. Host implementations
 * can extend this class or use it directly depending on their needs.
 */

import { ISandbox, GrantedPermissions } from "./types";
import { BRIDGE_SCRIPT, injectBridgeIntoHtml } from "./bridge-script";

// ═══ IFRAME SANDBOX ═══

/**
 * Message types that the sandbox handles
 */
const AGENTLET_MESSAGE_TYPES = [
  "ready",
  "bridge-loaded",
  "request",
  "invoke-result",
  "invoke-error",
  "load-error",
  "lifecycle-result",
  "lifecycle-error",
  "tool-result",
] as const;

/**
 * Iframe-based sandbox for running Agentlet agents.
 *
 * The sandbox:
 * 1. Creates a sandboxed iframe with allow-scripts and allow-same-origin
 * 2. Injects the bridge script and CSP into the agent HTML
 * 3. Handles postMessage communication between host and agent
 */
export class IframeSandbox implements ISandbox {
  protected iframe: HTMLIFrameElement | null = null;
  protected messageHandlers: Array<(message: unknown) => void> = [];
  protected _ready = false;
  protected boundHandler: (event: MessageEvent) => void;
  protected permissions: GrantedPermissions;

  /**
   * Create a new iframe sandbox
   *
   * @param permissions Granted permissions for the agent (used to build CSP)
   */
  constructor(permissions: GrantedPermissions) {
    this.permissions = permissions;
    this.boundHandler = this.handleMessage.bind(this);
  }

  /**
   * Load agent HTML into the sandbox
   *
   * @param html The agent HTML content
   */
  async load(html: string): Promise<void> {
    // Inject bridge script and CSP into HTML
    const networkDomains = this.permissions.network || [];
    const modifiedHtml = injectBridgeIntoHtml(html, networkDomains);

    // Create iframe with sandboxing
    // allow-scripts: Run JavaScript
    // allow-same-origin: Allow postMessage to parent
    this.iframe = document.createElement("iframe");
    this.iframe.sandbox.add("allow-scripts");
    this.iframe.sandbox.add("allow-same-origin");
    this.iframe.style.display = "none";
    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this.iframe.style.border = "none";

    // Set up message listener before loading content
    window.addEventListener("message", this.boundHandler);

    // Load content via srcdoc
    this.iframe.srcdoc = modifiedHtml;

    // Attach to container (must be implemented or overridden)
    this.attachToDOM(this.iframe);

    this._ready = true;
  }

  /**
   * Attach iframe to DOM. Override in host implementation if needed.
   * Default attaches to document.body.
   */
  protected attachToDOM(iframe: HTMLIFrameElement): void {
    document.body.appendChild(iframe);
  }

  /**
   * Send message to the sandboxed agent
   */
  postMessage(message: unknown): void {
    if (!this.iframe?.contentWindow) {
      throw new Error("Sandbox not loaded");
    }
    this.iframe.contentWindow.postMessage(message, "*");
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Handle incoming messages from iframe
   */
  protected handleMessage(event: MessageEvent): void {
    // Only handle messages from our iframe or valid Agentlet messages
    const isFromOurIframe = event.source === this.iframe?.contentWindow;
    const isAgentletMessage =
      event.data &&
      typeof event.data === "object" &&
      AGENTLET_MESSAGE_TYPES.includes(event.data.type);

    if (!isFromOurIframe && !isAgentletMessage) {
      return;
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(event.data);
      } catch (error) {
        console.error("[Agentlet] Error in message handler:", error);
      }
    }
  }

  /**
   * Destroy the sandbox and clean up resources
   */
  destroy(): void {
    window.removeEventListener("message", this.boundHandler);

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    this.messageHandlers = [];
    this._ready = false;
  }

  /**
   * Check if sandbox is ready
   */
  isReady(): boolean {
    return this._ready;
  }
}

// ═══ SANDBOX WITH CONTAINER ═══

/**
 * Iframe sandbox that attaches to a specific container element.
 * Use this when you need to control where the iframe is placed in the DOM.
 */
export class ContainerIframeSandbox extends IframeSandbox {
  protected container: HTMLElement;

  /**
   * Create a new sandbox attached to a container
   *
   * @param container The container element to attach the iframe to
   * @param permissions Granted permissions for the agent
   */
  constructor(container: HTMLElement, permissions: GrantedPermissions) {
    super(permissions);
    this.container = container;
  }

  protected attachToDOM(iframe: HTMLIFrameElement): void {
    this.container.appendChild(iframe);
  }
}

// ═══ HELPER EXPORTS ═══

/**
 * Re-export bridge script for hosts that need custom injection
 */
export { BRIDGE_SCRIPT, injectBridgeIntoHtml };
