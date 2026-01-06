/**
 * HeadlessSandbox - Sandbox for Node.js environments (testing, CLI)
 *
 * This sandbox runs agents in a jsdom environment without a real browser.
 * It's used by:
 * - @agentlet/testing for test harness
 * - @agentlet/cli for `agentlet serve` and `agentlet test`
 *
 * SECURITY CONTEXT:
 * This module intentionally loads and executes agent HTML/scripts.
 * This is the core purpose of a test sandbox - to run agent code.
 * The security model relies on:
 * 1. jsdom isolation from the Node.js process
 * 2. Developer trust in their own agent code being tested
 * 3. This is for DEVELOPMENT/TESTING, not production execution
 *
 * Note: This module requires jsdom as a peer dependency.
 */

import { ISandbox } from "../types";
import { generateBridgeScript } from "../transport";
import { SandboxConfig } from "./types";

/**
 * Headless sandbox for running agents without a browser.
 *
 * This implementation simulates the iframe environment using jsdom.
 * The sandbox injects the bridge script and handles postMessage emulation.
 *
 * @example
 * ```typescript
 * import { JSDOM } from 'jsdom';
 *
 * const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
 * const sandbox = new HeadlessSandbox({
 *   permissions: { inference: true },
 *   windowProvider: () => dom.window as unknown as Window,
 *   documentProvider: () => dom.window.document
 * });
 *
 * await sandbox.load(agentHtml);
 * ```
 */
export class HeadlessSandbox implements ISandbox {
  protected messageHandlers: Array<(message: unknown) => void> = [];
  protected _ready = false;
  protected config: SandboxConfig;
  protected sandboxWindow: Window | null = null;
  protected sandboxDocument: Document | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected dom: any = null;

  /**
   * Create a new headless sandbox
   *
   * @param config Sandbox configuration with jsdom providers
   */
  constructor(config: SandboxConfig) {
    this.config = config;

    if (!config.windowProvider || !config.documentProvider) {
      throw new Error(
        "HeadlessSandbox requires windowProvider and documentProvider. " +
          "Install jsdom and provide these functions."
      );
    }
  }

  /**
   * Load agent HTML into the sandbox.
   *
   * This method intentionally loads HTML content including scripts
   * for the purpose of testing agent behavior in isolation.
   *
   * @param html The agent HTML content (trusted developer code)
   */
  async load(html: string): Promise<void> {
    // Get the jsdom window and document
    this.sandboxWindow = this.config.windowProvider!();
    this.sandboxDocument = this.config.documentProvider!();

    // Inject the bridge script
    const bridgeScript = generateBridgeScript("iframe");
    const networkDomains = this.config.permissions.network || [];

    // Build CSP
    const connectSrc =
      networkDomains.length > 0
        ? networkDomains.map((d) => `https://${d}`).join(" ")
        : "'none'";

    const csp = [
      "default-src 'none'",
      "script-src 'unsafe-inline' blob:",
      `connect-src ${connectSrc}`,
      "style-src 'unsafe-inline'",
      "img-src data: blob:",
    ].join("; ");

    // Inject CSP meta tag
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

    // Modify HTML to inject bridge
    let modifiedHtml = html;

    // Add CSP to head
    const headMatch = modifiedHtml.match(/<head[^>]*>/i);
    if (headMatch) {
      const insertPos = headMatch.index! + headMatch[0].length;
      modifiedHtml =
        modifiedHtml.slice(0, insertPos) +
        "\n" +
        cspMeta +
        modifiedHtml.slice(insertPos);
    }

    // Insert bridge script before first module script
    const bridgeScriptTag = `<script>${bridgeScript}</script>`;
    const scriptMatch = modifiedHtml.match(
      /<script\s+type\s*=\s*["']module["'][^>]*>/i
    );
    if (scriptMatch) {
      const insertPos = scriptMatch.index!;
      modifiedHtml =
        modifiedHtml.slice(0, insertPos) +
        bridgeScriptTag +
        "\n" +
        modifiedHtml.slice(insertPos);
    } else {
      // No module script found, insert before </body>
      const bodyEnd = modifiedHtml.lastIndexOf("</body>");
      if (bodyEnd !== -1) {
        modifiedHtml =
          modifiedHtml.slice(0, bodyEnd) +
          bridgeScriptTag +
          "\n" +
          modifiedHtml.slice(bodyEnd);
      }
    }

    // Set up message passing emulation
    this.setupMessagePassing();

    // Load the HTML into jsdom - this is the core sandbox functionality
    // intentionally loading developer-provided agent code for testing
    this.loadHtmlContent(modifiedHtml);

    // Execute scripts using jsdom's built-in script execution
    await this.executeScripts();

    this._ready = true;
  }

  /**
   * Load HTML content into the sandbox document.
   * This is intentionally loading agent HTML for testing purposes.
   */
  protected loadHtmlContent(html: string): void {
    // Parse the HTML to extract head and body content
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

    // Clear existing content
    while (this.sandboxDocument!.head.firstChild) {
      this.sandboxDocument!.head.removeChild(this.sandboxDocument!.head.firstChild);
    }
    while (this.sandboxDocument!.body.firstChild) {
      this.sandboxDocument!.body.removeChild(this.sandboxDocument!.body.firstChild);
    }

    // Insert head content using DOM parser
    if (headMatch) {
      const template = this.sandboxDocument!.createElement("template");
      template.innerHTML = headMatch[1];
      while (template.content.firstChild) {
        this.sandboxDocument!.head.appendChild(template.content.firstChild);
      }
    }

    // Insert body content using DOM parser
    if (bodyMatch) {
      const template = this.sandboxDocument!.createElement("template");
      template.innerHTML = bodyMatch[1];
      while (template.content.firstChild) {
        this.sandboxDocument!.body.appendChild(template.content.firstChild);
      }
    }
  }

  /**
   * Set up postMessage emulation between host and sandbox
   */
  protected setupMessagePassing(): void {
    const self = this;

    // Create a fake parent that captures messages
    Object.defineProperty(this.sandboxWindow!, "parent", {
      value: {
        postMessage: (message: unknown) => {
          // Route messages to registered handlers
          for (const handler of self.messageHandlers) {
            try {
              handler(message);
            } catch (error) {
              console.error("[HeadlessSandbox] Error in message handler:", error);
            }
          }
        },
      },
      writable: true,
      configurable: true,
    });
  }

  /**
   * Execute scripts in the sandbox document
   *
   * jsdom with runScripts: 'dangerously' handles script execution.
   * We re-insert scripts to ensure they execute.
   */
  protected async executeScripts(): Promise<void> {
    if (!this.sandboxDocument) return;

    const scripts = Array.from(this.sandboxDocument.querySelectorAll("script"));

    for (const oldScript of scripts) {
      const newScript = this.sandboxDocument.createElement("script");

      // Copy attributes
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }

      // Copy content
      newScript.textContent = oldScript.textContent;

      // Replace to trigger execution
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    }

    // Give scripts time to execute
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Send message to the sandboxed agent
   */
  postMessage(message: unknown): void {
    if (!this.sandboxWindow) {
      throw new Error("Sandbox not loaded");
    }

    // Dispatch a message event to the sandbox window
    // Use the MessageEvent from the sandbox window if available
    const win = this.sandboxWindow as unknown as { MessageEvent?: typeof MessageEvent };
    const MessageEventClass = win.MessageEvent || MessageEvent;
    const event = new MessageEventClass("message", {
      data: message,
      origin: "*",
    });
    this.sandboxWindow.dispatchEvent(event);
  }

  /**
   * Register message handler for messages from the sandbox
   */
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Destroy the sandbox and clean up resources
   */
  destroy(): void {
    this.sandboxWindow = null;
    this.sandboxDocument = null;
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

/**
 * Create a HeadlessSandbox with jsdom
 *
 * This is a convenience function that creates a jsdom instance
 * and returns a configured HeadlessSandbox.
 *
 * @param config Sandbox configuration
 * @param JSDOM The JSDOM class from jsdom package
 * @returns Configured HeadlessSandbox
 *
 * @example
 * ```typescript
 * import { JSDOM } from 'jsdom';
 * import { createHeadlessSandbox } from '@agentlet/host-sdk';
 *
 * const sandbox = createHeadlessSandbox(
 *   { permissions: { inference: true } },
 *   JSDOM
 * );
 * ```
 */
export function createHeadlessSandbox(
  config: Omit<SandboxConfig, "windowProvider" | "documentProvider">,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  JSDOM: any
): HeadlessSandbox {
  const dom = new JSDOM(
    "<!DOCTYPE html><html><head></head><body></body></html>",
    {
      runScripts: "dangerously",
      pretendToBeVisual: true,
    }
  );

  return new HeadlessSandbox({
    ...config,
    windowProvider: () => dom.window as unknown as Window,
    documentProvider: () => dom.window.document,
  });
}
