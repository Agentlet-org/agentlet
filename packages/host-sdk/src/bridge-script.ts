/**
 * Bridge Script - Injected JavaScript that runs inside the agent sandbox
 *
 * This script is identical across all hosts. It defines the bridge API
 * that agents use to communicate with the host via postMessage.
 */

/**
 * The bridge client code as a string to be injected into agent HTML.
 * This runs inside the sandboxed iframe and provides the agent API.
 */
export const BRIDGE_SCRIPT = `
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
      window.parent.postMessage({ id, type: 'request', method, params }, '*');
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

      window.parent.postMessage({
        id,
        type: 'request',
        method: 'inference.stream',
        params: rest
      }, '*');
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
          this._streamHandlers.delete(id);
          resolve(result);
        },
        onError: (error) => {
          this._streamHandlers.delete(id);
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
      window.parent.postMessage({ type: 'ready' }, '*');
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

window.addEventListener('message', (e) => bridge._handleMessage(e.data));

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

// Signal that bridge is loaded
window.parent.postMessage({ type: 'bridge-loaded' }, '*');
`;

/**
 * Inject bridge script into agent HTML
 *
 * @param html The agent HTML content
 * @param networkDomains Allowed network domains for CSP
 * @returns Modified HTML with bridge script and CSP injected
 */
export function injectBridgeIntoHtml(
  html: string,
  networkDomains: string[]
): string {
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

  // Create bridge script tag
  const bridgeScriptTag = `<script>${BRIDGE_SCRIPT}</script>`;

  // Insert CSP meta tag in head
  const cspMeta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

  // Find insertion points
  let result = html;

  // Add CSP to head
  const headMatch = result.match(/<head[^>]*>/i);
  if (headMatch) {
    const insertPos = headMatch.index! + headMatch[0].length;
    result = result.slice(0, insertPos) + "\n" + cspMeta + result.slice(insertPos);
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
