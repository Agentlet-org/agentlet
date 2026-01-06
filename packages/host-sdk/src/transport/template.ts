/**
 * Bridge Script Template
 *
 * This template generates transport-specific bridge scripts.
 * The core bridge logic is shared; only transport-specific parts are injected.
 */

import { TransportType, TransportConfig } from "./types";

/**
 * Transport configurations for each supported type
 */
export const TRANSPORTS: Record<TransportType, TransportConfig> = {
  iframe: {
    setup: "",
    send: 'window.parent.postMessage(msg, "*")',
    receive: 'window.addEventListener("message", (e) => handler(e.data))',
  },
  "vscode-webview": {
    setup: "const vscode = acquireVsCodeApi();",
    send: "vscode.postMessage(msg)",
    receive: 'window.addEventListener("message", (e) => handler(e.data))',
  },
  "native-bridge": {
    setup: "",
    send: "window.NativeBridge.send(JSON.stringify(msg))",
    receive: "window.NativeBridge.onMessage = handler",
  },
  worker: {
    setup: "",
    send: "self.postMessage(msg)",
    receive: 'self.addEventListener("message", (e) => handler(e.data))',
  },
};

/**
 * Bridge script template with placeholders for transport-specific code
 *
 * Placeholders:
 * - {{TRANSPORT_SETUP}} - Transport initialization code
 * - {{SEND}} - Function to send messages
 * - {{RECEIVE}} - Function to register message handler
 */
const BRIDGE_TEMPLATE = `
// ═══ TRANSPORT SETUP ═══
{{TRANSPORT_SETUP}}

// ═══ BRIDGE SCRIPT ═══
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

const _send = {{SEND}};
const _receive = {{RECEIVE}};

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

  // Core request mechanism
  _request(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this._requestId);
      this._pending.set(id, { resolve, reject });
      _send({ id, type: 'request', method, params });
    });
  },

  // Host info
  get capabilities() {
    return this.host?.capabilities || [];
  },
  hasCapability(cap) {
    return this.capabilities.includes(cap);
  },

  // Versioning
  get specVersion() {
    return this.host?.specVersion || '0.1';
  },
  features() {
    return this.host?.features || [];
  },
  supports(feature) {
    return (this.host?.features || []).includes(feature);
  },
  compareVersion(a, b) {
    const partsA = String(a).split('.').map(Number);
    const partsB = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const numA = partsA[i] || 0;
      const numB = partsB[i] || 0;
      if (numA > numB) return 1;
      if (numA < numB) return -1;
    }
    return 0;
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

  // MCP API
  mcp: {
    list: () => bridge._request('mcp.list', {}),
    isAvailable: (server) => bridge._request('mcp.isAvailable', { server }),
    getTools: (server) => bridge._request('mcp.getTools', { server }),
    call: (server, tool, params) => bridge._request('mcp.call', { server, tool, params }),
    read: (server, uri) => bridge._request('mcp.read', { server, uri }),
    subscribe: (server, uri, handler) => {
      const subId = 'sub-' + (++bridge._requestId);
      bridge._subscriptionHandlers.set(subId, handler);
      return bridge._request('mcp.subscribe', { server, uri, subscriptionId: subId });
    }
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

      _send({
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
            _send({
              id,
              type: 'tool-result',
              result
            });
          } catch (error) {
            _send({
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

      _send({
        id,
        type: 'request',
        method: 'inference.tools',
        params: rest
      });
    });
  },

  // UI API
  ui: {
    notify: (options) => {
      // Support both old (message, type) and new ({ message, type }) signatures
      if (typeof options === 'string') {
        return bridge._request('ui.notify', { message: options, type: arguments[1] || 'info' });
      }
      return bridge._request('ui.notify', { message: options.message, type: options.type || 'info' });
    },
    confirm: (options) => {
      if (typeof options === 'string') {
        return bridge._request('ui.confirm', { message: options });
      }
      return bridge._request('ui.confirm', options);
    },
    prompt: (options) => {
      if (typeof options === 'string') {
        return bridge._request('ui.prompt', { message: options, defaultValue: arguments[1] || '' });
      }
      return bridge._request('ui.prompt', options);
    },
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

  // Message handler
  _handleMessage(data) {
    if (data.type === 'init') {
      bridge.host = data.host;
      _send({ type: 'ready' });
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

_receive((msg) => bridge._handleMessage(msg));

async function handleInvoke(invokeId, action, input) {
  try {
    const handler = bridge._actionHandlers.get(action);

    if (!handler) {
      throw new Error('Unknown action: ' + action);
    }

    bridge._cancelled = false;

    const result = await handler(input);
    _send({ type: 'invoke-result', invokeId, result });
  } catch (error) {
    _send({ type: 'invoke-error', invokeId, error: error.message });
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
    _send({ type: 'lifecycle-result', invokeId, result });
  } catch (error) {
    _send({ type: 'lifecycle-error', invokeId, error: error.message });
  }
}

window.bridge = bridge;
window.AgentletError = AgentletError;
window.CancellationError = CancellationError;

// Signal that bridge is loaded
_send({ type: 'bridge-loaded' });
`;

/**
 * Generate a bridge script for the specified transport type
 *
 * @param transport The transport type to generate for
 * @returns The complete bridge script as a string
 */
export function generateBridgeScript(transport: TransportType): string {
  const config = TRANSPORTS[transport];
  if (!config) {
    throw new Error(`Unknown transport type: ${transport}`);
  }

  return BRIDGE_TEMPLATE.replace("{{TRANSPORT_SETUP}}", config.setup)
    .replace("{{SEND}}", `(msg) => ${config.send}`)
    .replace("{{RECEIVE}}", `(handler) => { ${config.receive}; }`);
}

/**
 * Get the default transport type for the current environment
 */
export function detectTransport(): TransportType {
  // Node.js environment (VS Code extension host, CLI)
  if (typeof window === "undefined") {
    return "worker";
  }

  // VS Code WebView
  if (typeof (globalThis as unknown as { acquireVsCodeApi?: unknown }).acquireVsCodeApi !== "undefined") {
    return "vscode-webview";
  }

  // Native bridge (React Native, Capacitor)
  if (typeof (window as unknown as { NativeBridge?: unknown }).NativeBridge !== "undefined") {
    return "native-bridge";
  }

  // Default to iframe
  return "iframe";
}
