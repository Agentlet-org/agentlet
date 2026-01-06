/**
 * IframeSandbox - Sandboxed iframe for running Agentlet v0.1 agents
 *
 * Implements the Agentlet v0.1 specification for Zotero.
 * Agents are HTML files with embedded metadata and code.
 *
 * SDK-CANDIDATE: 90% reusable
 * - ISandbox interface: 100% reusable (identical across hosts)
 * - ExtractedManifest interface: 100% reusable
 * - IframeSandbox class: 90% reusable (Zotero-specific window handling)
 * - extractManifestFromHtml(): 100% reusable (pure HTML parsing)
 * - injectBridgeIntoHtml(): 100% reusable
 * - BRIDGE_CLIENT_CODE: 100% reusable (identical across hosts)
 * - HOST-SPECIFIC: getMainWindow(), getDocument() helpers
 */

import logger, { ztLog } from "../utils/logger";

// Declare Zotero global
declare const Zotero: any;

// SDK-CANDIDATE: 100% reusable - identical across all hosts
export interface ISandbox {
  load(html: string): Promise<void>;
  postMessage(message: any): void;
  onMessage(handler: (message: any) => void): void;
  destroy(): void;
  isReady(): boolean;
}

// SDK-CANDIDATE: 100% reusable - spec-defined interface
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
  // Portability type: host-specific, host-family, universal, adaptive
  portability?: "host-specific" | "host-family" | "universal" | "adaptive";
  // Host compatibility (for host-specific and host-family)
  hosts?: string[];
  // Required capabilities
  requires?: string[];
  // Optional capabilities (for adaptive agents)
  optional?: string[];
  // Intents this agent uses (for adaptive agents)
  intents?: string[];
  // Legacy capabilities field (backwards compat)
  capabilities: string[];
  actions: Array<{
    id: string;
    label?: string;
    description?: string;
    confirm?: boolean;
    input?: any;
  }>;
  defaultAction?: string;
  preferences?: Array<{
    key: string;
    type: string;
    label?: string;
    default?: any;
    options?: Array<{ value: string; label: string }>;
  }>;
}

// HOST-SPECIFIC: Zotero window access
/**
 * Get the main window for Zotero
 */
function getMainWindow(): Window {
  return Zotero.getMainWindow();
}

/**
 * Get the document from main window
 */
function getDocument(): Document {
  return getMainWindow().document;
}

// SDK-CANDIDATE: 90% reusable - core logic identical, container handling host-specific
export class IframeSandbox implements ISandbox {
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private messageHandlers: Array<(message: any) => void> = [];
  private _ready = false;
  private _boundHandler: (event: MessageEvent) => void;
  private _window: Window;

  constructor(container?: HTMLElement) {
    this._window = getMainWindow();
    this._boundHandler = this._handleMessage.bind(this);

    if (container) {
      this.container = container;
    }
    // Container will be set in load() if not provided
  }

  /**
   * Get or create the sandbox container
   */
  private getContainer(): HTMLElement {
    if (this.container) return this.container;

    const doc = getDocument();

    // Try to find existing container
    let container = doc.getElementById("zotagentlet-sandbox-container");
    if (container) {
      this.container = container as HTMLElement;
      return this.container;
    }

    // Create new hidden container
    container = doc.createElement("div");
    container.id = "zotagentlet-sandbox-container";
    container.style.display = "none";
    container.style.position = "absolute";
    container.style.left = "-9999px";

    // Append to document element if body not available
    const parent = doc.body || doc.documentElement;
    if (parent) {
      parent.appendChild(container);
      Zotero.debug("[ZotAgentlet] Created sandbox container");
    } else {
      throw new Error("Cannot find document body or documentElement");
    }

    this.container = container as HTMLElement;
    return this.container;
  }

  /**
   * Create a new sandbox instance
   */
  create(): IframeSandbox {
    return new IframeSandbox(this.container || undefined);
  }

  /**
   * Load HTML content into the sandbox
   */
  async load(html: string): Promise<void> {
    const doc = getDocument();
    const container = this.getContainer();

    // Create iframe with sandboxing
    // allow-scripts: Run JavaScript
    // allow-same-origin: Allow postMessage to parent and blob URL imports
    // Note: This combination is less secure but necessary for agent communication
    this.iframe = doc.createElement("iframe") as HTMLIFrameElement;
    this.iframe.sandbox.add("allow-scripts");
    this.iframe.sandbox.add("allow-same-origin");
    this.iframe.style.display = "none";
    this.iframe.style.width = "0";
    this.iframe.style.height = "0";
    this.iframe.style.border = "none";

    // Set up message listener before loading content
    this._window.addEventListener("message", this._boundHandler as any);

    // Load content via srcdoc
    this.iframe.srcdoc = html;
    container.appendChild(this.iframe);

    // Poll for contentWindow availability (onload doesn't fire reliably in Zotero/Gecko)
    await this._waitForContentWindow();
    this._ready = true;
    Zotero.debug("[ZotAgentlet] Sandbox: Iframe loaded, contentWindow available");
  }

  /**
   * Wait for iframe contentWindow to become available
   */
  private async _waitForContentWindow(): Promise<void> {
    const maxAttempts = 100; // 10 seconds max
    const interval = 100; // 100ms between checks

    for (let i = 0; i < maxAttempts; i++) {
      if (this.iframe?.contentWindow) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    throw new Error("Iframe contentWindow not available after timeout");
  }

  /**
   * Send a message to the sandboxed agent
   */
  postMessage(message: any): void {
    if (!this.iframe?.contentWindow) {
      // Sandbox was destroyed, silently ignore late messages
      logger.debug(`Sandbox: postMessage skipped (destroyed). Type: ${message?.type}`);
      return;
    }
    this.iframe.contentWindow.postMessage(message, "*");
  }

  /**
   * Register a message handler
   */
  onMessage(handler: (message: any) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Handle incoming messages from the iframe
   */
  private _handleMessage(event: MessageEvent): void {
    // Validate message structure
    if (!event.data || typeof event.data !== 'object') {
      return;
    }

    // Check if message is from our iframe OR has agentlet-specific marker
    const isFromOurIframe = event.source === this.iframe?.contentWindow;
    const hasAgentletMarker = event.data._agentlet === true;

    // For srcdoc iframes, event.source may not match, so also check message types
    const validTypes = ['ready', 'bridge-loaded', 'request', 'invoke-result', 'invoke-error', 'load-error', 'lifecycle-result', 'lifecycle-error'];
    const isAgentletType = validTypes.includes(event.data.type);

    // Must be from our iframe OR have agentlet marker OR be a valid type when iframe is active
    if (!isFromOurIframe && !hasAgentletMarker && !(isAgentletType && this.iframe)) {
      return;
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(event.data);
      } catch (error) {
        logger.error("Error in message handler:", error);
      }
    }
  }

  /**
   * Destroy the sandbox and clean up
   */
  destroy(): void {
    this._window.removeEventListener("message", this._boundHandler as any);

    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }

    this.messageHandlers = [];
    this._ready = false;

    logger.debug("Sandbox destroyed");
  }

  /**
   * Check if sandbox is ready
   */
  isReady(): boolean {
    return this._ready;
  }
}

// SDK-CANDIDATE: 100% reusable - pure HTML parsing, no host dependencies
/**
 * Extract manifest from v0.1 agent HTML using DOMParser
 * This is safe - no code execution, just HTML parsing
 *
 * @param agentHtml - The agent's HTML content
 * @returns The extracted manifest
 */
export function extractManifestFromHtml(agentHtml: string): ExtractedManifest {
  // Use DOMParser for safe HTML parsing (no script execution)
  const parser = new DOMParser();
  const doc = parser.parseFromString(agentHtml, "text/html");

  // Check spec version - support 0.1.x
  const specVersionMeta = doc.querySelector('meta[name="agentlet"]');
  const specVersion = specVersionMeta?.getAttribute("content") || "";
  if (!specVersion.startsWith("0.1")) {
    throw new Error(`Unsupported Agentlet spec version: ${specVersion || "missing"}\n`);
  }

  // Extract basic metadata
  const getMeta = (name: string): string | undefined => {
    const meta = doc.querySelector(`meta[name="agentlet:${name}"]\n`);
    return meta?.getAttribute("content") || undefined;
  };

  // Extract multiple values for a meta tag name
  const getMetaAll = (name: string): string[] => {
    const metas = doc.querySelectorAll(`meta[name="agentlet:${name}"]\n`);
    const values: string[] = [];
    metas.forEach((meta) => {
      const content = meta.getAttribute("content");
      if (content) values.push(content);
    });
    return values;
  };

  const name = getMeta("name");
  const version = getMeta("version");

  if (!name) throw new Error("Agent missing required agentlet:name meta tag");
  if (!version) throw new Error("Agent missing required agentlet:version meta tag");

  // Extract portability type (new in v0.1)
  const portability = getMeta("portability") as ExtractedManifest["portability"];

  // Extract host compatibility (multiple tags)
  const hosts = getMetaAll("host");

  // Extract required capabilities (new in v0.1 for adaptive agents)
  const requires = getMetaAll("requires");

  // Extract optional capabilities (new in v0.1 for adaptive agents)
  const optional = getMetaAll("optional");

  // Extract intents (new in v0.1 for adaptive agents)
  const intents = getMetaAll("intent");

  // Extract legacy capabilities (multiple meta tags)
  const capabilityMetas = doc.querySelectorAll('meta[name="agentlet:capability"]');
  const capabilities: string[] = [];
  capabilityMetas.forEach((meta) => {
    const content = meta.getAttribute("content");
    if (content) capabilities.push(content);
  });

  // Extract actions (multiple meta tags with data attributes)
  const actionMetas = doc.querySelectorAll('meta[name="agentlet:action"]');
  const actions: ExtractedManifest["actions"] = [];
  actionMetas.forEach((meta) => {
    const id = meta.getAttribute("content");
    if (id) {
      actions.push({
        id,
        label: meta.getAttribute("data-label") || undefined,
        description: meta.getAttribute("data-description") || undefined,
        confirm: meta.getAttribute("data-confirm") === "true",
        input: undefined, // TODO: Parse input schema if needed
      });
    }
  });

  // Extract preferences (multiple meta tags)
  const prefMetas = doc.querySelectorAll('meta[name="agentlet:preference"]');
  const preferences: ExtractedManifest["preferences"] = [];
  prefMetas.forEach((meta) => {
    const key = meta.getAttribute("content");
    if (key) {
      // First try data-options JSON format
      const optionsStr = meta.getAttribute("data-options");
      let options;
      if (optionsStr) {
        try {
          options = JSON.parse(optionsStr);
        } catch {}
      }
      preferences.push({
        key,
        type: meta.getAttribute("data-type") || "string",
        label: meta.getAttribute("data-label") || undefined,
        default: meta.getAttribute("data-default") || undefined,
        options,
      });
    }
  });

  // Extract preference options (agentlet:preference:option meta tags)
  // Format: <meta name="agentlet:preference:option" content="prefKey:optionValue" data-label="Option Label">
  const optionMetas = doc.querySelectorAll('meta[name="agentlet:preference:option"]');
  optionMetas.forEach((meta) => {
    const content = meta.getAttribute("content");
    if (content && content.includes(":")) {
      const colonIndex = content.indexOf(":");
      const prefKey = content.substring(0, colonIndex);
      const optionValue = content.substring(colonIndex + 1);
      const optionLabel = meta.getAttribute("data-label") || optionValue;

      // Find the preference and add the option
      const pref = preferences.find((p) => p.key === prefKey);
      if (pref) {
        if (!pref.options) pref.options = [];
        pref.options.push({ value: optionValue, label: optionLabel });
      }
    }
  });

  return {
    specVersion,
    name,
    version,
    description: getMeta("description"),
    author: getMeta("author"),
    license: getMeta("license"),
    homepage: getMeta("homepage"),
    icon: getMeta("icon"),
    portability,
    hosts: hosts.length > 0 ? hosts : undefined,
    requires: requires.length > 0 ? requires : undefined,
    optional: optional.length > 0 ? optional : undefined,
    intents: intents.length > 0 ? intents : undefined,
    capabilities,
    actions,
    defaultAction: getMeta("default-action"),
    preferences: preferences.length > 0 ? preferences : undefined,
  };
}

// SDK-CANDIDATE: 100% reusable - spec-defined parsing logic
/**
 * Parse capabilities from ExtractedManifest into internal format.
 * Combines 'requires' (mandatory) and 'capabilities' (optional) arrays.
 *
 * Note: No backwards compatibility needed until spec is released.
 */
export function parseManifestCapabilities(manifest: ExtractedManifest): ParsedCapabilities {
  const result: ParsedCapabilities = {
    context: [],
    network: [],
    ui: {},
    storage: false,
    inference: false,
  };

  // Combine requires and capabilities - both use the same format
  const allCaps = [
    ...(manifest.requires || []),
    ...(manifest.capabilities || []),
  ];

  for (const cap of allCaps) {
    // Context capabilities: context:bibliographic:read → bibliographic:read
    if (cap.startsWith("context:")) {
      result.context.push(cap.substring(8));
    }
    // Network capabilities: network:api.example.com → api.example.com
    else if (cap.startsWith("network:")) {
      result.network.push(cap.substring(8));
    }
    // UI capabilities: ui:notify, ui:confirm, ui:panel, etc.
    else if (cap.startsWith("ui:")) {
      const uiCap = cap.substring(3);
      result.ui[uiCap] = true;
    }
    // Storage capability
    else if (cap === "storage") {
      result.storage = true;
    }
    // Inference capabilities: inference, inference:basic, inference:streaming, etc.
    else if (cap.startsWith("inference")) {
      if (cap === "inference") {
        result.inference = "basic";
      } else {
        result.inference = cap.substring(10); // Remove "inference:" prefix
      }
    }
  }

  return result;
}

/**
 * Internal capabilities format used throughout the runtime.
 * Easier to work with than raw capability strings.
 */
export interface ParsedCapabilities {
  context: string[];
  network: string[];
  ui: Record<string, boolean>;
  storage: boolean;
  inference: string | false;
}

// SDK-CANDIDATE: 100% reusable - bridge injection logic identical across hosts
/**
 * Inject bridge client code into agent HTML
 *
 * @param agentHtml - The agent's HTML content
 * @param networkDomains - Allowed network domains for CSP
 * @returns Modified HTML with bridge code injected
 */
export function injectBridgeIntoHtml(
  agentHtml: string,
  networkDomains: string[] = []
): string {
  const csp = buildCSP(networkDomains);

  // Create bridge script tag
  const bridgeScript = `<script type="module">
${BRIDGE_CLIENT_CODE}
</script>`;

  // Insert CSP meta tag and bridge script into head
  // If there's a <head>, insert after it; otherwise create one
  let modifiedHtml = agentHtml;

  // Add CSP if not present
  if (!modifiedHtml.includes('http-equiv="Content-Security-Policy"')) {
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
    if (modifiedHtml.includes("<head>")) {
      modifiedHtml = modifiedHtml.replace("<head>", `<head>\n${cspMeta}\n`);
    } else if (modifiedHtml.includes("<!DOCTYPE html>")) {
      modifiedHtml = modifiedHtml.replace(
        "<!DOCTYPE html>",
        `<!DOCTYPE html>\n<head>${cspMeta}</head>`
      );
    }
  }

  // Insert bridge script before the first <script type="module"> tag
  // This ensures bridge is available when agent code runs
  const scriptMatch = modifiedHtml.match(/<script\s+type=["']module["']/i);
  if (scriptMatch && scriptMatch.index !== undefined) {
    modifiedHtml =
      modifiedHtml.slice(0, scriptMatch.index) +
      bridgeScript +
      "\n" +
      modifiedHtml.slice(scriptMatch.index);
  } else {
    // No module script found, append before </body> or at end
    if (modifiedHtml.includes("</body>")) {
      modifiedHtml = modifiedHtml.replace("</body>", `${bridgeScript}\n</body>\n`);
    } else {
      modifiedHtml += bridgeScript;
    }
  }

  return modifiedHtml;
}

// SDK-CANDIDATE: 90% reusable - fetch logic same, logging host-specific
/**
 * Fetch agent HTML from URL
 * Supports both .agentlet (preferred) and .agent extensions
 */
export async function fetchAgentHtml(agentUrl: string): Promise<string> {
  // Both .agentlet and .agent extensions are supported
  const url = agentUrl;

  ztLog(`[ZotAgentlet] Fetching agent HTML from: ${url}\n`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch agent: ${response.status} ${response.statusText}\n`);
  }

  const html = await response.text();
  ztLog(`[ZotAgentlet] Fetched agent HTML: ${html.length} bytes\n`);

  return html;
}

/**
 * Build Content Security Policy from allowed domains
 */
function buildCSP(allowedDomains: string[]): string {
  // Build connect-src from allowed domains
  const connectSrc =
    allowedDomains.length > 0
      ? allowedDomains.map((d) => `https://${d}`).join(" ")
      : "'none'";

  // CSP directives:
  // - default-src 'none': Block everything by default
  // - script-src: Allow inline scripts, eval, and blob URLs
  // - style-src: Allow inline styles for agent UI
  // - img-src: Allow data URIs and blob URLs for images
  // - connect-src: Allow network to specified domains
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' 'unsafe-eval' blob:",
    "style-src 'unsafe-inline'",
    "img-src data: blob:",
    `connect-src ${connectSrc}`,
  ].join("; ");
}

// SDK-CANDIDATE: 100% reusable - identical across all hosts
/**
 * Bridge client code that runs inside the sandbox
 * Supports bridge.action() pattern for registering handlers
 */
const BRIDGE_CLIENT_CODE = `
class AgentletError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgentletError';
    this.code = code;
    this.details = details;
    this.retryable = details.retryable || false;
    this.retryAfter = details.retryAfter || null;
  }
}

class CancellationError extends Error {
  constructor() {
    super('Operation cancelled by user');
    this.name = 'CancellationError';
    this.code = 'E701';
  }
}

const bridge = {
  _pending: new Map(),
  _requestId: 0,
  _cancelled: false,
  _cancelHandlers: [],
  _preferenceHandlers: [],
  _preferenceObservers: new Map(),
  _limitWarningHandlers: [],
  _limitExceededHandlers: [],
  _streamHandlers: new Map(),
  _subscriptionHandlers: new Map(),
  _actionHandlers: new Map(),
  _installHandler: null,
  _uninstallHandler: null,
  _activateHandler: null,
  _deactivateHandler: null,
  host: null,
  _ready: false,

  version: {
    runtime: '0.1.0',
    satisfies(semver) {
      const match = semver.match(/^>=?(\\d+)\\.(\\d+)\\.(\\d+)$/);
      if (!match) return false;
      const [, major, minor, patch] = match.map(Number);
      const [rMajor, rMinor, rPatch] = this.runtime.split('.').map(Number);
      return rMajor > major || (rMajor === major && (rMinor > minor || (rMinor === minor && rPatch >= patch)));
    }
  },

  capabilities: {
    check(list) {
      const result = {};
      for (const cap of list) {
        result[cap] = bridge.host?.capabilities?.includes(cap) || false;
      }
      return result;
    }
  },

  // v0.1: Check if host has a capability
  hasCapability(cap) {
    return bridge.host?.capabilities?.includes(cap) || false;
  },

  // v0.1: Perceive API for adaptive agents
  perceive(options = {}) {
    return bridge._request('perceive', options);
  },

  // v0.1: Act API for adaptive agents
  act(action) {
    return bridge._request('act', action);
  },

  // v0.5: Register action handler
  action(name, handler) {
    bridge._actionHandlers.set(name, handler);
  },

  // v0.5: Register install hook
  onInstall(handler) {
    bridge._installHandler = handler;
  },

  // v0.5: Register uninstall hook
  onUninstall(handler) {
    bridge._uninstallHandler = handler;
  },

  // v0.5: Register activate hook (called each time agent loads)
  onActivate(handler) {
    bridge._activateHandler = handler;
  },

  // v0.5: Register deactivate hook (called when agent unloads)
  onDeactivate(handler) {
    bridge._deactivateHandler = handler;
  },

  async _request(method, params) {
    const id = String(++this._requestId);
    return new Promise((resolve, reject) => {
      this._pending.set(id, { resolve, reject });
      window.parent.postMessage({ id, type: 'request', method, params }, '*');
    });
  },

  context: {
    query: (type, filter) => bridge._request('context.query', { type, filter }),
    get: (type, id) => bridge._request('context.get', { type, id }),
    update: (type, id, data) => bridge._request('context.update', { type, id, data }),
    create: (type, data) => bridge._request('context.create', { type, data }),
    delete: (type, id) => bridge._request('context.delete', { type, id }),
    batch: (operations) => bridge._request('context.batch', { operations }),
    // Also available as bridge.context.selection for spec compatibility
    selection: {
      get: () => bridge._request('selection.get', {})
    }
  },

  // Also available at top level for convenience
  selection: {
    get: () => bridge._request('selection.get', {})
  },

  files: {
    read: (path) => bridge._request('files.read', { path }),
    write: (path, content) => bridge._request('files.write', { path, content })
  },

  storage: {
    get: (key) => bridge._request('storage.get', { key }),
    set: (key, value) => bridge._request('storage.set', { key, value }),
    remove: (key) => bridge._request('storage.remove', { key }),
    clear: () => bridge._request('storage.clear', {}),
    keys: () => bridge._request('storage.keys', {})
  },

  preferences: {
    get: (key, defaultValue) => bridge._request('preferences.get', { key }).then(r => r ?? defaultValue),
    onChange: (handler) => bridge._preferenceHandlers.push(handler),
    observe: (key, handler) => {
      if (!bridge._preferenceObservers.has(key)) {
        bridge._preferenceObservers.set(key, []);
      }
      bridge._preferenceObservers.get(key).push(handler);
    },
    open: () => bridge._request('preferences.open', {})
  },

  limits: {
    remaining: () => bridge._request('limits.remaining', {}),
    onWarning: (handler) => bridge._limitWarningHandlers.push(handler),
    onExceeded: (handler) => bridge._limitExceededHandlers.push(handler)
  },

  mcp: {
    list: () => bridge._request('mcp.list', {}),
    isAvailable: (server) => bridge._request('mcp.isAvailable', { server }),
    getTools: (server) => bridge._request('mcp.getTools', { server }),
    getResources: (server) => bridge._request('mcp.getResources', { server }),
    call: (server, tool, params) => bridge._request('mcp.call', { server, tool, params }),
    read: (server, uri) => bridge._request('mcp.read', { server, uri }),
    subscribe: async (server, uri) => {
      const result = await bridge._request('mcp.subscribe', { server, uri });
      return {
        subscriptionId: result.subscriptionId,
        [Symbol.asyncIterator]: () => ({
          next: () => new Promise((resolve) => {
            bridge._subscriptionHandlers.set(result.subscriptionId, (data) => {
              resolve({ value: data, done: false });
            });
          })
        }),
        unsubscribe: () => bridge._request('mcp.unsubscribe', { subscriptionId: result.subscriptionId })
      };
    },
    unsubscribe: (subscriptionId) => bridge._request('mcp.unsubscribe', { subscriptionId })
  },

  inference: (request) => {
    if (request.stream && request.onToken) {
      return bridge._streamingInference(request);
    }
    if (request.tools && request.onToolCall) {
      return bridge._toolInference(request);
    }
    return bridge._request('inference', request);
  },

  _streamingInference: async (request) => {
    const { onToken, ...rest } = request;
    const id = String(++bridge._requestId);

    return new Promise((resolve, reject) => {
      let fullText = '';

      bridge._streamHandlers.set(id, {
        onToken: (token) => {
          fullText += token;
          onToken(token);
        },
        onComplete: () => {
          bridge._streamHandlers.delete(id);
          resolve(fullText);
        },
        onError: (error) => {
          bridge._streamHandlers.delete(id);
          reject(new AgentletError(error.code, error.message));
        }
      });

      window.parent.postMessage({
        id,
        type: 'request',
        method: 'inference.stream',
        params: rest
      }, '*');
    });
  },

  _toolInference: async (request) => {
    const { onToolCall, ...rest } = request;
    const id = String(++bridge._requestId);

    return new Promise((resolve, reject) => {
      bridge._streamHandlers.set(id, {
        onToolCall: async (name, params) => {
          try {
            const result = await onToolCall(name, params);
            window.parent.postMessage({
              id,
              type: 'tool-result',
              result
            }, '*');
          } catch (error) {
            window.parent.postMessage({
              id,
              type: 'tool-result',
              error: { message: error.message }
            }, '*');
          }
        },
        onComplete: (result) => {
          bridge._streamHandlers.delete(id);
          resolve(result);
        },
        onError: (error) => {
          bridge._streamHandlers.delete(id);
          reject(new AgentletError(error.code, error.message));
        }
      });

      window.parent.postMessage({
        id,
        type: 'request',
        method: 'inference.tools',
        params: rest
      }, '*');
    });
  },

  ui: {
    notify: (message, type = 'info') => bridge._request('ui.notify', { message, type }),
    confirm: (message) => bridge._request('ui.confirm', { message }),
    prompt: (message, defaultValue = '') => bridge._request('ui.prompt', { message, defaultValue }),
    form: (config) => bridge._request('ui.form', config),
    select: (config) => bridge._request('ui.select', config),
    panel: (config) => bridge._request('ui.panel', config),
    updatePanel: (id, updates) => bridge._request('ui.updatePanel', { id, ...updates }),
    closePanel: (id) => bridge._request('ui.closePanel', { id })
  },

  activity: {
    start: (message) => bridge._request('activity.start', { message }),
    step: (message) => bridge._request('activity.step', { message }),
    progress: (current, total, message = '') => bridge._request('activity.progress', { current, total, message }),
    log: (message, level = 'info') => bridge._request('activity.log', { message, level }),
    complete: (message) => bridge._request('activity.complete', { message }),
    error: (message) => bridge._request('activity.error', { message }),
    getTrace: () => bridge._request('activity.getTrace', {})
  },

  isCancelled: () => bridge._cancelled,
  onCancel: (handler) => bridge._cancelHandlers.push(handler),
  throwIfCancelled: () => { if (bridge._cancelled) throw new CancellationError(); },

  utils: {
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    async retry(fn, options = {}) {
      const { maxAttempts = 3, backoff = 'exponential', initialDelay = 1000, maxDelay = 30000, retryOn = [] } = options;
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (retryOn.length && !retryOn.includes(error.code)) throw error;
          if (attempt === maxAttempts) throw error;
          let delay = backoff === 'exponential'
            ? initialDelay * Math.pow(2, attempt - 1)
            : initialDelay * attempt;
          delay = Math.min(delay, maxDelay);
          await bridge.utils.sleep(error.retryAfter || delay);
        }
      }
      throw lastError;
    },

    withRetry(fn, options = {}) {
      return (...args) => bridge.utils.retry(() => fn(...args), options);
    },

    debounce(fn, ms) {
      let timeout;
      return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), ms);
      };
    },

    throttle(fn, ms) {
      let last = 0;
      return (...args) => {
        const now = Date.now();
        if (now - last >= ms) {
          last = now;
          return fn(...args);
        }
      };
    }
  },

  _handleMessage(data) {
    if (data.type === 'init') {
      bridge.host = data.host;
      // Signal ready - actions are already registered from script execution
      window.parent.postMessage({ type: 'ready', _agentlet: true }, '*');
      bridge._ready = true;
      return;
    }

    if (data.type === 'response') {
      const pending = bridge._pending.get(data.id);
      if (pending) {
        bridge._pending.delete(data.id);
        if (data.error) {
          pending.reject(new AgentletError(data.error.code, data.error.message, data.error.details));
        } else {
          pending.resolve(data.result);
        }
      }
      return;
    }

    if (data.type === 'cancel') {
      bridge._cancelled = true;
      bridge._cancelHandlers.forEach(h => { try { h(); } catch(e) {} });
      return;
    }

    if (data.type === 'inference-token') {
      const handler = bridge._streamHandlers.get(data.id);
      if (handler?.onToken) handler.onToken(data.token);
      return;
    }

    if (data.type === 'inference-complete') {
      const handler = bridge._streamHandlers.get(data.id);
      if (handler?.onComplete) handler.onComplete(data.result);
      return;
    }

    if (data.type === 'inference-error') {
      const handler = bridge._streamHandlers.get(data.id);
      if (handler?.onError) handler.onError(data.error);
      return;
    }

    if (data.type === 'inference-tool-call') {
      const handler = bridge._streamHandlers.get(data.id);
      if (handler?.onToolCall) handler.onToolCall(data.name, data.params);
      return;
    }

    if (data.type === 'mcp-subscription-update') {
      const handler = bridge._subscriptionHandlers.get(data.subscriptionId);
      if (handler) handler(data.update);
      return;
    }

    // v0.5: Handle invoke with registered action handlers
    if (data.type === 'invoke') {
      handleInvoke(data.invokeId, data.action, data.input);
      return;
    }

    // v0.5: Handle lifecycle hooks
    if (data.type === 'lifecycle') {
      handleLifecycle(data.event, data.invokeId);
      return;
    }

    // Handle panel messages (forwarded from UIHandler)
    // This dispatches the message as a regular message event
    // so agentlet code with window.addEventListener('message', ...) can receive it
    if (data.type === 'panel-message') {
      // Create a synthetic message event
      const syntheticEvent = new MessageEvent('message', {
        data: data.message,
        origin: window.location.origin,
        source: window
      });
      window.dispatchEvent(syntheticEvent);
      return;
    }
  }
};

window.addEventListener('message', (e) => bridge._handleMessage(e.data));

// v0.5: Handle invoke using registered action handlers
async function handleInvoke(invokeId, action, input) {
  try {
    const handler = bridge._actionHandlers.get(action);

    if (!handler) {
      throw new Error('Unknown action: ' + action);
    }

    bridge._cancelled = false;

    const result = await handler(input);
    window.parent.postMessage({ type: 'invoke-result', invokeId, result }, '*');
  } catch (error) {
    window.parent.postMessage({ type: 'invoke-error', invokeId, error: error.message }, '*');
  }
}

// v0.5: Handle lifecycle events
async function handleLifecycle(event, invokeId) {
  try {
    let result;
    if (event === 'install' && bridge._installHandler) {
      result = await bridge._installHandler();
    } else if (event === 'uninstall' && bridge._uninstallHandler) {
      result = await bridge._uninstallHandler();
    } else if (event === 'activate' && bridge._activateHandler) {
      result = await bridge._activateHandler();
    } else if (event === 'deactivate' && bridge._deactivateHandler) {
      result = await bridge._deactivateHandler();
    }
    window.parent.postMessage({ type: 'lifecycle-result', invokeId, result }, '*');
  } catch (error) {
    window.parent.postMessage({ type: 'lifecycle-error', invokeId, error: error.message }, '*');
  }
}

window.bridge = bridge;
window.AgentletError = AgentletError;
window.CancellationError = CancellationError;

// Signal that bridge is loaded (agent scripts will register handlers, then init message triggers ready)
window.parent.postMessage({ type: 'bridge-loaded', _agentlet: true }, '*');
`;
