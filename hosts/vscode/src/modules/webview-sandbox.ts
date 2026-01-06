/**
 * WebView Sandbox - Sandboxed execution environment for VS Code
 *
 * VS Code uses WebviewPanel instead of iframes. The communication pattern differs:
 * - Iframe: window.parent.postMessage() / window.addEventListener('message')
 * - WebView: vscode.postMessage() / webview.onDidReceiveMessage
 *
 * This module adapts the bridge script for WebView communication.
 */

import * as vscode from "vscode";
import type { ISandbox, GrantedPermissions } from "../types/agentlet";

/**
 * VS Code-adapted bridge script
 *
 * Key differences from standard bridge:
 * - Uses acquireVsCodeApi() instead of window.parent
 * - Communication via vscode.postMessage()
 */
const VSCODE_BRIDGE_SCRIPT = `
class AgentletError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AgentletError';
    this.code = code;
    this.details = details;
  }
}

class CancellationError extends Error {
  constructor() {
    super('Operation cancelled');
    this.name = 'CancellationError';
    this.code = 'E701';
  }
}

// Acquire VS Code API (can only be called once)
const vscode = acquireVsCodeApi();

const bridge = {
  _pending: new Map(),
  _requestId: 0,
  _actionHandlers: new Map(),
  _streamHandlers: new Map(),
  _subscriptionHandlers: new Map(),
  _cancelHandlers: [],
  _cancelled: false,
  _ready: false,
  _installHandler: null,
  _uninstallHandler: null,
  _activateHandler: null,
  _deactivateHandler: null,
  host: null,

  // Action registration (v0.1 pattern)
  action(name, handler) {
    this._actionHandlers.set(name, handler);
  },

  // Lifecycle hooks
  onInstall(handler) { this._installHandler = handler; },
  onUninstall(handler) { this._uninstallHandler = handler; },
  onActivate(handler) { this._activateHandler = handler; },
  onDeactivate(handler) { this._deactivateHandler = handler; },

  // Core request mechanism - uses VS Code API
  _request(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this._requestId);
      this._pending.set(id, { resolve, reject });
      vscode.postMessage({ id, type: 'request', method, params });
    });
  },

  // Host info
  get capabilities() {
    return this.host?.capabilities || [];
  },
  hasCapability(cap) {
    return this.capabilities.includes(cap);
  },

  // Perceive API (adaptive agents)
  perceive(options = {}) {
    return this._request('perceive', options);
  },

  // Act API (adaptive agents)
  act(action) {
    return this._request('act', action);
  },

  // Context API (host-specific agents)
  context: {
    query: (type, filter) => bridge._request('context.query', { type, filter }),
    get: (type, id) => bridge._request('context.get', { type, id }),
    update: (type, id, data) => bridge._request('context.update', { type, id, data }),
    create: (type, data) => bridge._request('context.create', { type, data }),
    delete: (type, id) => bridge._request('context.delete', { type, id }),
    batch: (operations) => bridge._request('context.batch', { operations }),
    selection: {
      get: () => bridge._request('context.selection.get', {})
    }
  },

  // Storage API
  storage: {
    get: (key) => bridge._request('storage.get', { key }),
    set: (key, value) => bridge._request('storage.set', { key, value }),
    remove: (key) => bridge._request('storage.remove', { key }),
    clear: () => bridge._request('storage.clear', {}),
    keys: () => bridge._request('storage.keys', {})
  },

  // Preferences API
  preferences: {
    get: (key) => bridge._request('preferences.get', { key }),
    _changeHandlers: [],
    onChange(handler) {
      this._changeHandlers.push(handler);
    }
  },

  // Limits API
  limits: {
    remaining: () => bridge._request('limits.remaining', {})
  },

  // Inference API
  inference(request) {
    if (request.stream && request.onToken) {
      return this._streamingInference(request);
    }
    if (request.tools && request.onToolCall) {
      return this._toolInference(request);
    }
    return this._request('inference', request);
  },

  _streamingInference(request) {
    const { onToken, ...rest } = request;
    const id = String(++this._requestId);

    return new Promise((resolve, reject) => {
      let fullText = '';

      this._streamHandlers.set(id, {
        onToken: (token) => {
          fullText += token;
          onToken(token);
        },
        onComplete: () => {
          this._streamHandlers.delete(id);
          resolve(fullText);
        },
        onError: (error) => {
          this._streamHandlers.delete(id);
          reject(new AgentletError(error.code, error.message));
        }
      });

      vscode.postMessage({
        id,
        type: 'request',
        method: 'inference.stream',
        params: rest
      });
    });
  },

  _toolInference(request) {
    const { onToolCall, ...rest } = request;
    const id = String(++this._requestId);

    return new Promise((resolve, reject) => {
      this._streamHandlers.set(id, {
        onToolCall: async (name, params) => {
          try {
            const result = await onToolCall(name, params);
            vscode.postMessage({
              id,
              type: 'tool-result',
              result
            });
          } catch (error) {
            vscode.postMessage({
              id,
              type: 'tool-result',
              error: { message: error.message }
            });
          }
        },
        onComplete: (result) => {
          this._streamHandlers.delete(id);
          resolve(result);
        },
        onError: (error) => {
          this._streamHandlers.delete(id);
          reject(new AgentletError(error.code, error.message));
        }
      });

      vscode.postMessage({
        id,
        type: 'request',
        method: 'inference.tools',
        params: rest
      });
    });
  },

  // UI API
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

  // Activity API
  activity: {
    start: (message) => bridge._request('activity.start', { message }),
    step: (message) => bridge._request('activity.step', { message }),
    progress: (current, total, message = '') => bridge._request('activity.progress', { current, total, message }),
    log: (message, level = 'info') => bridge._request('activity.log', { message, level }),
    complete: (message) => bridge._request('activity.complete', { message }),
    error: (message) => bridge._request('activity.error', { message }),
    getTrace: () => bridge._request('activity.getTrace', {})
  },

  // Cancellation
  isCancelled: () => bridge._cancelled,
  onCancel: (handler) => bridge._cancelHandlers.push(handler),
  throwIfCancelled: () => { if (bridge._cancelled) throw new CancellationError(); },

  // Utilities
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
    }
  },

  // Message handler - receives from VS Code host
  _handleMessage(data) {
    if (data.type === 'init') {
      bridge.host = data.host;
      vscode.postMessage({ type: 'ready' });
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

    if (data.type === 'invoke') {
      handleInvoke(data.invokeId, data.action, data.input);
      return;
    }

    if (data.type === 'lifecycle') {
      handleLifecycle(data.event, data.invokeId);
      return;
    }
  }
};

// Listen for messages from VS Code host
window.addEventListener('message', (e) => bridge._handleMessage(e.data));

async function handleInvoke(invokeId, action, input) {
  try {
    const handler = bridge._actionHandlers.get(action);

    if (!handler) {
      throw new Error('Unknown action: ' + action);
    }

    bridge._cancelled = false;

    const result = await handler(input);
    vscode.postMessage({ type: 'invoke-result', invokeId, result });
  } catch (error) {
    vscode.postMessage({ type: 'invoke-error', invokeId, error: error.message });
  }
}

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
    vscode.postMessage({ type: 'lifecycle-result', invokeId, result });
  } catch (error) {
    vscode.postMessage({ type: 'lifecycle-error', invokeId, error: error.message });
  }
}

window.bridge = bridge;
window.AgentletError = AgentletError;
window.CancellationError = CancellationError;

// Signal that bridge is loaded
vscode.postMessage({ type: 'bridge-loaded' });
`;

/**
 * Inject VS Code bridge script into agent HTML
 */
function injectVSCodeBridgeIntoHtml(
  html: string,
  networkDomains: string[]
): string {
  // Build CSP for WebView
  const connectSrc =
    networkDomains.length > 0
      ? networkDomains.map((d) => `https://${d}`).join(" ")
      : "'none'";

  const csp = [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    `connect-src ${connectSrc}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob: https:",
  ].join("; ");

  // Create bridge script tag
  const bridgeScriptTag = `<script>${VSCODE_BRIDGE_SCRIPT}</script>`;

  // Insert CSP meta tag in head
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

  let result = html;

  // Add CSP to head
  const headMatch = result.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    result =
      result.slice(0, insertPos) + "\n" + cspMeta + result.slice(insertPos);
  }

  // Insert bridge before first module script
  const scriptMatch = result.match(/<script\s+type\s*=\s*["']module["'][^>]*>/i);
  if (scriptMatch) {
    const insertPos = scriptMatch.index!;
    result =
      result.slice(0, insertPos) + bridgeScriptTag + "\n" + result.slice(insertPos);
  } else {
    // No module script found, insert before </body>
    const bodyEnd = result.lastIndexOf("</body>");
    if (bodyEnd !== -1) {
      result =
        result.slice(0, bodyEnd) + bridgeScriptTag + "\n" + result.slice(bodyEnd);
    }
  }

  return result;
}

/**
 * WebView-based sandbox for VS Code
 *
 * Implements ISandbox using VS Code's WebviewPanel
 */
export class WebViewSandbox implements ISandbox {
  private panel: vscode.WebviewPanel | null = null;
  private messageHandlers: Array<(message: unknown) => void> = [];
  private disposeHandlers: Array<() => void> = [];
  private _ready = false;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private permissions: GrantedPermissions,
    private agentName: string
  ) {}

  /**
   * Load agent HTML into the WebView
   */
  async load(html: string): Promise<void> {
    console.log("[Agentlet] Loading sandbox for agent:", this.agentName);
    console.log("[Agentlet] HTML length:", html.length);

    // Inject bridge script
    const networkDomains = this.permissions.network || [];
    const modifiedHtml = injectVSCodeBridgeIntoHtml(html, networkDomains);
    console.log("[Agentlet] Modified HTML length:", modifiedHtml.length);

    // Create WebView panel (hidden by default for background execution)
    console.log("[Agentlet] Creating WebView panel...");
    this.panel = vscode.window.createWebviewPanel(
      "agentlet.sandbox",
      `Agent: ${this.agentName}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );
    console.log("[Agentlet] WebView panel created");

    // Hide panel immediately (agents run in background)
    // Note: VS Code doesn't have a way to truly hide panels, but we can
    // minimize visibility by not focusing it

    // Set up message listener
    this.disposables.push(
      this.panel.webview.onDidReceiveMessage((message) => {
        for (const handler of this.messageHandlers) {
          try {
            handler(message);
          } catch (error) {
            console.error("[Agentlet] Error in message handler:", error);
          }
        }
      })
    );

    // Handle panel disposal
    this.disposables.push(
      this.panel.onDidDispose(() => {
        console.log("[Agentlet] Sandbox panel disposed");
        this._ready = false;
        this.panel = null;
        // Notify dispose handlers
        for (const handler of this.disposeHandlers) {
          try {
            handler();
          } catch (error) {
            console.error("[Agentlet] Error in dispose handler:", error);
          }
        }
      })
    );

    // Set content
    this.panel.webview.html = modifiedHtml;
    this._ready = true;
  }

  /**
   * Send message to the WebView
   */
  postMessage(message: unknown): void {
    if (!this.panel) {
      throw new Error("Sandbox not loaded");
    }
    this.panel.webview.postMessage(message);
  }

  /**
   * Register message handler
   */
  onMessage(handler: (message: unknown) => void): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Register dispose handler (called when panel is closed)
   */
  onDispose(handler: () => void): void {
    this.disposeHandlers.push(handler);
  }

  /**
   * Destroy the sandbox
   */
  destroy(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];

    if (this.panel) {
      this.panel.dispose();
      this.panel = null;
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

  /**
   * Get the WebView panel (for showing to user if needed)
   */
  getPanel(): vscode.WebviewPanel | null {
    return this.panel;
  }
}
