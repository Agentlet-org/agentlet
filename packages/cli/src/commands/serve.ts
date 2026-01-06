/**
 * serve command - Development server for testing agents
 *
 * Serves agents directly to the browser with an injected dev bridge
 * that communicates with the server via fetch.
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { extractManifest } from "@agentlet/host-sdk";

export interface ServeOptions {
  port?: number;
  watch?: boolean;
  inference?: "mock" | "openai" | "ollama";
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

export interface InferenceConfig {
  provider: "mock" | "openai" | "ollama";
  apiKey?: string;
  model: string;
  ollamaUrl: string;
}

export interface ServeResult {
  port: number;
  url: string;
  close: () => void;
}

/**
 * Start development server for an agent
 *
 * The server:
 * 1. Serves the agent HTML with an injected dev bridge
 * 2. The bridge routes all calls through the server
 * 3. Server provides mock responses and logs activity
 */
export async function serveAgent(
  filePath: string,
  options: ServeOptions = {}
): Promise<ServeResult> {
  const { port = 3456, watch = false } = options;

  // Read agent file
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent file not found: ${filePath}`);
  }

  let html = fs.readFileSync(filePath, "utf-8");
  let manifest = extractManifest(html);

  console.log(`\nLoading agent: ${manifest.name} v${manifest.version}`);
  console.log(`Actions: ${manifest.actions.map((a) => a.id).join(", ") || "(none)"}`);

  // Inference configuration (mutable - can be changed via control panel)
  const inferenceConfig: InferenceConfig = {
    provider: options.inference || "mock",
    apiKey: options.apiKey || process.env.OPENAI_API_KEY,
    model: options.model || (options.inference === "ollama" ? "llama3" : "gpt-4o-mini"),
    ollamaUrl: options.ollamaUrl || process.env.OLLAMA_URL || "http://localhost:11434",
  };

  console.log(`Inference: ${inferenceConfig.provider}${inferenceConfig.provider !== "mock" ? ` (${inferenceConfig.model})` : ""}`);

  // Activity logs stored on server
  const logs: Array<{ type: string; message: string; timestamp: number }> = [];

  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    // API: Get manifest
    if (url.pathname === "/api/manifest") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(manifest, null, 2));
      return;
    }

    // API: Get logs
    if (url.pathname === "/api/logs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(logs));
      return;
    }

    // API: Clear logs
    if (url.pathname === "/api/logs/clear" && req.method === "POST") {
      logs.length = 0;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // API: Get inference config
    if (url.pathname === "/api/inference" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        provider: inferenceConfig.provider,
        model: inferenceConfig.model,
        ollamaUrl: inferenceConfig.ollamaUrl,
        hasApiKey: !!inferenceConfig.apiKey,
      }));
      return;
    }

    // API: Update inference config
    if (url.pathname === "/api/inference" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const update = JSON.parse(body);
          if (update.provider) inferenceConfig.provider = update.provider;
          if (update.apiKey !== undefined) inferenceConfig.apiKey = update.apiKey || undefined;
          if (update.model) inferenceConfig.model = update.model;
          if (update.ollamaUrl) inferenceConfig.ollamaUrl = update.ollamaUrl;
          console.log(`Inference config updated: ${inferenceConfig.provider} (${inferenceConfig.model})`);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // API: Bridge calls from the agent
    if (url.pathname === "/api/bridge" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", async () => {
        try {
          const request = JSON.parse(body);
          const result = await handleBridgeRequest(request, logs, inferenceConfig);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ result }));
        } catch (error) {
          const err = error as Error;
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { code: "E999", message: err.message } }));
        }
      });
      return;
    }

    // Serve the agent with injected dev bridge
    if (url.pathname === "/agent" || url.pathname === "/agent.html") {
      // Reload if watching
      if (watch) {
        html = fs.readFileSync(filePath, "utf-8");
        manifest = extractManifest(html);
      }

      const injectedHtml = injectDevBridge(html, port);
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(injectedHtml);
      return;
    }

    // Serve control panel UI
    if (url.pathname === "/" || url.pathname === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(generateControlPanel(manifest, port));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, () => {
      const url = `http://localhost:${port}`;
      console.log(`\nDev server running at ${url}`);
      console.log(`  Control panel: ${url}/`);
      console.log(`  Agent: ${url}/agent`);
      console.log(`\nPress Ctrl+C to stop\n`);

      resolve({
        port,
        url,
        close: () => server.close(),
      });
    });
  });
}

/**
 * Handle bridge requests from the agent
 */
async function handleBridgeRequest(
  request: { method: string; params: unknown },
  logs: Array<{ type: string; message: string; timestamp: number }>,
  inferenceConfig: InferenceConfig
): Promise<unknown> {
  const { method, params } = request;
  const p = params as Record<string, unknown>;

  const log = (type: string, message: string) => {
    logs.push({ type, message, timestamp: Date.now() });
    console.log(`[${type.toUpperCase()}] ${message}`);
  };

  // Activity logging
  if (method === "activity.start") {
    log("start", p.message as string || "Started");
    return undefined;
  }
  if (method === "activity.step") {
    log("step", p.message as string || "");
    return undefined;
  }
  if (method === "activity.progress") {
    log("progress", `${p.current}/${p.total} ${p.message || ""}`);
    return undefined;
  }
  if (method === "activity.log") {
    log("log", p.message as string || "");
    return undefined;
  }
  if (method === "activity.complete") {
    log("complete", p.message as string || "Done");
    return undefined;
  }
  if (method === "activity.error") {
    log("error", p.message as string || "Error");
    return undefined;
  }

  // UI methods
  if (method === "ui.notify") {
    const msg = typeof p.message === "string"
      ? p.message
      : (p.message as Record<string, unknown>)?.message || JSON.stringify(p);
    log("notify", String(msg));
    return undefined;
  }
  if (method === "ui.confirm") {
    log("confirm", p.message as string || "Confirm?");
    return true; // Auto-confirm in dev
  }
  if (method === "ui.prompt") {
    log("prompt", p.message as string || "Input?");
    return p.defaultValue || "dev-input"; // Return default or mock
  }
  if (method === "ui.select") {
    const config = p.config as { title?: string; items?: Array<{ id: string; label: string }> };
    log("select", config?.title || "Selection dialog");
    // Return first item's id as mock selection
    return config?.items?.[0]?.id || null;
  }
  if (method === "ui.panel") {
    const config = p.config as { title?: string };
    log("panel", `Showing panel: ${config?.title || "Panel"}`);
    return "panel-1"; // Return panel ID
  }
  if (method === "ui.form") {
    log("form", "Form dialog");
    return {}; // Return empty form result
  }

  // Storage (in-memory for dev - note: resets each request, use closure in real impl)
  if (method === "storage.get") {
    return undefined; // Mock: always empty
  }
  if (method === "storage.set") {
    return undefined;
  }
  if (method === "storage.remove") {
    return undefined;
  }
  if (method === "storage.clear") {
    return undefined;
  }
  if (method === "storage.keys") {
    return [];
  }

  // Preferences
  if (method === "preferences.get") {
    log("preferences", "Getting preferences (returning defaults)");
    return { targetLanguage: "es" }; // Return default preferences
  }
  if (method === "preferences.set") {
    log("preferences", "Setting preferences");
    return undefined;
  }

  // Inference - supports mock, OpenAI, and Ollama
  if (method === "inference") {
    const inferenceParams = p as {
      messages?: Array<{ role: string; content: string }>;
      prompt?: string;
      max_tokens?: number;
      temperature?: number;
    };

    // Mock provider
    if (inferenceConfig.provider === "mock") {
      log("inference", "Mock inference called");
      return {
        content: "This is a mock inference response from the dev server. Configure a real provider (OpenAI/Ollama) for actual AI responses.",
        usage: { promptTokens: 10, completionTokens: 25, totalTokens: 35 },
      };
    }

    // OpenAI provider
    if (inferenceConfig.provider === "openai") {
      if (!inferenceConfig.apiKey) {
        log("error", "OpenAI API key not configured");
        throw new Error("OpenAI API key required. Set --api-key or OPENAI_API_KEY environment variable.");
      }

      const messages = inferenceParams.messages || [{ role: "user", content: inferenceParams.prompt || "" }];
      log("inference", `OpenAI (${inferenceConfig.model}): ${messages[messages.length - 1]?.content?.slice(0, 50)}...`);

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${inferenceConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: inferenceConfig.model,
            messages,
            max_tokens: inferenceParams.max_tokens || 1000,
            temperature: inferenceParams.temperature ?? 0.7,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        log("inference", `Response: ${content.slice(0, 80)}...`);

        return {
          content,
          usage: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0,
          },
        };
      } catch (error) {
        const err = error as Error;
        log("error", `OpenAI error: ${err.message}`);
        throw err;
      }
    }

    // Ollama provider
    if (inferenceConfig.provider === "ollama") {
      const messages = inferenceParams.messages || [{ role: "user", content: inferenceParams.prompt || "" }];
      log("inference", `Ollama (${inferenceConfig.model}): ${messages[messages.length - 1]?.content?.slice(0, 50)}...`);

      try {
        const response = await fetch(`${inferenceConfig.ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: inferenceConfig.model,
            messages,
            stream: false,
            options: {
              num_predict: inferenceParams.max_tokens || 1000,
              temperature: inferenceParams.temperature ?? 0.7,
            },
          }),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Ollama error: ${response.status} - ${text}`);
        }

        const data = await response.json();
        const content = data.message?.content || "";
        log("inference", `Response: ${content.slice(0, 80)}...`);

        return {
          content,
          usage: {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          },
        };
      } catch (error) {
        const err = error as Error;
        log("error", `Ollama error: ${err.message}`);
        throw err;
      }
    }
  }

  // Perceive (mock)
  if (method === "perceive") {
    log("perceive", `scope: ${(p as Record<string, unknown>).scope || "all"}`);
    return {
      host: "dev-server",
      hostVersion: "1.0.0",
      items: [
        { id: 1, type: "mock-item", title: "Sample Item 1" },
        { id: 2, type: "mock-item", title: "Sample Item 2" },
      ],
      capabilities: ["inference", "storage"],
      understanding: "This is a development environment with mock items.",
    };
  }

  // Act (mock)
  if (method === "act") {
    log("act", `intent: ${(p as Record<string, unknown>).intent}`);
    return { success: true, affected: 2 };
  }

  // Limits
  if (method === "limits") {
    return {
      remaining: {
        inferenceCalls: 100,
        networkRequests: 50,
        storageBytes: 1048576,
      },
    };
  }

  log("unknown", `Unknown method: ${method}`);
  return undefined;
}

/**
 * Inject development bridge into agent HTML
 */
function injectDevBridge(html: string, port: number): string {
  const devBridge = `
<script>
// Development Bridge - routes all calls through the dev server
(function() {
  let requestId = 0;
  const actionHandlers = new Map();

  async function callBridge(method, params) {
    const res = await fetch('http://localhost:${port}/api/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params })
    });
    const data = await res.json();
    if (data.error) {
      throw new Error(data.error.message);
    }
    return data.result;
  }

  window.bridge = {
    // Activity
    activity: {
      start: (message) => callBridge('activity.start', { message }),
      step: (message) => callBridge('activity.step', { message }),
      progress: (current, total, message) => callBridge('activity.progress', { current, total, message }),
      log: (message, level) => callBridge('activity.log', { message, level }),
      complete: (message) => callBridge('activity.complete', { message }),
      error: (message) => callBridge('activity.error', { message }),
    },
    // UI - support both (message, type) and ({ message, type }) signatures
    ui: {
      notify: (msgOrOpts, type) => {
        if (typeof msgOrOpts === 'string') {
          return callBridge('ui.notify', { message: msgOrOpts, type: type });
        }
        return callBridge('ui.notify', msgOrOpts);
      },
      confirm: (message) => callBridge('ui.confirm', { message }),
      prompt: (message, defaultValue) => callBridge('ui.prompt', { message, defaultValue }),
      form: (config) => callBridge('ui.form', { config }),
      select: (config) => callBridge('ui.select', { config }),
      panel: (config) => callBridge('ui.panel', { config }),
      updatePanel: (id, updates) => callBridge('ui.updatePanel', { id, updates }),
      closePanel: (id) => callBridge('ui.closePanel', { id }),
    },
    // Storage
    storage: {
      get: (key) => callBridge('storage.get', { key }),
      set: (key, value) => callBridge('storage.set', { key, value }),
      remove: (key) => callBridge('storage.remove', { key }),
      clear: () => callBridge('storage.clear', {}),
      keys: () => callBridge('storage.keys', {}),
    },
    // Inference - returns content string directly
    inference: async (opts) => {
      const result = await callBridge('inference', opts);
      return result.content || result;
    },
    // Adaptive
    perceive: (opts) => callBridge('perceive', opts || {}),
    act: (opts) => callBridge('act', opts),
    // Limits
    limits: () => callBridge('limits', {}),
    // Preferences
    preferences: {
      get: () => callBridge('preferences.get', {}),
      set: (prefs) => callBridge('preferences.set', { prefs }),
    },
    // Action registration - support both action() and onAction()
    action: (actionId, handler) => {
      actionHandlers.set(actionId, handler);
    },
    onAction: (actionId, handler) => {
      actionHandlers.set(actionId, handler);
    },
    // Lifecycle hooks (no-op in dev, just register)
    onInstall: (handler) => {
      console.log('[DevBridge] onInstall registered (simulating fresh install)');
      // Simulate fresh install
      setTimeout(() => handler({ previousVersion: undefined }), 100);
    },
    onUninstall: (handler) => {
      console.log('[DevBridge] onUninstall registered');
    },
    // Ready signal
    onReady: () => {
      console.log('[DevBridge] Agent ready');
      window.parent.postMessage({ type: 'agent-ready' }, '*');
    },
  };

  // Listen for action triggers from parent
  window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'trigger-action') {
      const handler = actionHandlers.get(event.data.action);
      if (handler) {
        try {
          await handler(event.data.params || {});
          window.parent.postMessage({ type: 'action-complete', action: event.data.action }, '*');
        } catch (error) {
          window.parent.postMessage({ type: 'action-error', action: event.data.action, error: error.message }, '*');
        }
      }
    }
  });

  // Hide noscript content and fallback UI (it's a browser preview fallback)
  const hideStyle = document.createElement('style');
  hideStyle.textContent = 'noscript, noscript *, svg[hidden], [hidden] { display: none !important; } body { background: white; }';
  document.head.insertBefore(hideStyle, document.head.firstChild);
  document.querySelectorAll('noscript').forEach(el => el.remove());

  // Show notifications visually in the agent preview
  function showNotification(message, type) {
    const container = document.getElementById('dev-notifications') || createNotificationContainer();
    const toast = document.createElement('div');
    toast.className = 'dev-toast dev-toast-' + (type || 'info');
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'dev-notifications';
    container.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    const style = document.createElement('style');
    style.textContent = '.dev-toast{padding:12px 16px;border-radius:6px;font-family:system-ui;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15);animation:slideIn 0.2s ease;max-width:280px;}.dev-toast-success{background:#10b981;color:white;}.dev-toast-error{background:#ef4444;color:white;}.dev-toast-warning{background:#f59e0b;color:white;}.dev-toast-info{background:#3b82f6;color:white;}@keyframes slideIn{from{transform:translateX(100%);opacity:0;}to{transform:translateX(0);opacity:1;}}';
    document.head.appendChild(style);
    document.body.appendChild(container);
    return container;
  }

  // Override notify to show visual feedback
  const originalNotify = window.bridge.ui.notify;
  window.bridge.ui.notify = (msgOrOpts, type) => {
    const message = typeof msgOrOpts === 'string' ? msgOrOpts : msgOrOpts.message;
    const notifyType = typeof msgOrOpts === 'string' ? type : msgOrOpts.type;
    showNotification(message, notifyType);
    return originalNotify(msgOrOpts, type);
  };

  // Visual prompt implementation
  const originalPrompt = window.bridge.ui.prompt;
  window.bridge.ui.prompt = (message, defaultValue) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
      const dialog = document.createElement('div');
      dialog.style.cssText = 'background:white;padding:20px;border-radius:8px;min-width:300px;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
      dialog.innerHTML = '<div style="margin-bottom:12px;font-family:system-ui;font-weight:500;">' + message + '</div><input type="text" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;font-size:14px;box-sizing:border-box;" /><div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end;"><button class="cancel" style="padding:8px 16px;border:1px solid #ddd;background:white;border-radius:4px;cursor:pointer;">Cancel</button><button class="ok" style="padding:8px 16px;border:none;background:#0066cc;color:white;border-radius:4px;cursor:pointer;">OK</button></div>';
      const input = dialog.querySelector('input');
      input.value = defaultValue || '';
      dialog.querySelector('.ok').onclick = () => { overlay.remove(); resolve(input.value); };
      dialog.querySelector('.cancel').onclick = () => { overlay.remove(); resolve(null); };
      input.onkeydown = (e) => { if (e.key === 'Enter') { overlay.remove(); resolve(input.value); } };
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      input.focus();
      input.select();
    });
  };

  // Visual panel implementation
  const originalPanel = window.bridge.ui.panel;
  window.bridge.ui.panel = (config) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
    const panel = document.createElement('div');
    panel.style.cssText = 'background:white;border-radius:8px;max-width:' + (config.width || 400) + 'px;width:90%;max-height:80vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
    panel.innerHTML = '<div style="padding:16px;border-bottom:1px solid #eee;font-family:system-ui;font-weight:600;display:flex;justify-content:space-between;align-items:center;">' + (config.title || 'Panel') + '<button style="border:none;background:none;font-size:20px;cursor:pointer;color:#666;">&times;</button></div><div class="panel-content">' + (config.content || '') + '</div>';
    panel.querySelector('button').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return originalPanel(config);
  };

  // Visual select implementation
  const originalSelect = window.bridge.ui.select;
  window.bridge.ui.select = (config) => {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
      const dialog = document.createElement('div');
      dialog.style.cssText = 'background:white;padding:20px;border-radius:8px;min-width:250px;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
      let html = '<div style="margin-bottom:12px;font-family:system-ui;font-weight:500;">' + (config.title || 'Select') + '</div>';
      (config.items || []).forEach((item, i) => {
        html += '<div class="select-item" data-id="' + item.id + '" style="padding:10px;margin:4px 0;border:1px solid #ddd;border-radius:4px;cursor:pointer;font-family:system-ui;">' + item.label + '</div>';
      });
      dialog.innerHTML = html;
      dialog.querySelectorAll('.select-item').forEach(el => {
        el.onmouseover = () => el.style.background = '#f0f0f0';
        el.onmouseout = () => el.style.background = 'white';
        el.onclick = () => { overlay.remove(); resolve(el.dataset.id); };
      });
      overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
  };

  console.log('[DevBridge] Initialized');
})();
</script>
`;

  // Insert dev bridge before first script
  const scriptMatch = html.match(/<script[\s>]/i);
  if (scriptMatch && scriptMatch.index !== undefined) {
    return html.slice(0, scriptMatch.index) + devBridge + "\n" + html.slice(scriptMatch.index);
  }

  // Insert before </head> or </body>
  const insertPoint = html.lastIndexOf("</head>");
  if (insertPoint !== -1) {
    return html.slice(0, insertPoint) + devBridge + "\n" + html.slice(insertPoint);
  }

  return html + devBridge;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Generate control panel UI
 */
function generateControlPanel(manifest: ReturnType<typeof extractManifest>, port: number): string {
  const safeName = escapeHtml(manifest.name);
  const safeDescription = escapeHtml(manifest.description || "");
  const safeVersion = escapeHtml(manifest.version);

  const actionButtons = manifest.actions
    .map((a) => `<button class="action-btn" data-action="${escapeHtml(a.id)}">${escapeHtml(a.label || a.id)}</button>`)
    .join("\n        ");

  return `<!DOCTYPE html>
<html>
<head>
  <title>${safeName} - Dev Server</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0; padding: 20px; background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .panel { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { margin: 0 0 5px; font-size: 24px; }
    h2 { margin: 0 0 15px; font-size: 16px; color: #666; border-bottom: 1px solid #eee; padding-bottom: 10px; }
    .meta { color: #888; font-size: 14px; margin-bottom: 20px; }
    .action-btn {
      background: #0066cc; color: white; border: none; padding: 10px 20px;
      border-radius: 6px; cursor: pointer; margin: 5px 5px 5px 0; font-size: 14px;
    }
    .action-btn:hover { background: #0055aa; }
    .action-btn:disabled { background: #ccc; cursor: not-allowed; }
    .logs {
      background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace; font-size: 13px;
      height: 300px; overflow-y: auto;
    }
    .log { margin: 4px 0; }
    .log-start { color: #569cd6; }
    .log-step { color: #9cdcfe; }
    .log-complete { color: #4ec9b0; }
    .log-error { color: #f14c4c; }
    .log-notify { color: #dcdcaa; }
    .log-inference { color: #c586c0; }
    .log-perceive { color: #ce9178; }
    .log-act { color: #b5cea8; }
    .log-time { color: #666; margin-right: 8px; }
    iframe { width: 100%; height: 350px; border: 1px solid #ddd; border-radius: 6px; background: white; }
    .preview-hint { font-size: 12px; color: #888; margin: 0 0 10px; }
    .clear-btn { background: #666; font-size: 12px; padding: 5px 10px; float: right; }
    .settings-form { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
    .form-row { display: flex; align-items: center; gap: 10px; }
    .form-row label { min-width: 80px; font-size: 13px; color: #666; }
    .form-row select, .form-row input {
      flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;
    }
    .form-row select:focus, .form-row input:focus { outline: none; border-color: #0066cc; }
    .save-btn { background: #28a745; margin-top: 5px; }
    .save-btn:hover { background: #218838; }
    .status-badge {
      display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500;
    }
    .status-mock { background: #ffc107; color: #333; }
    .status-openai { background: #10a37f; color: white; }
    .status-ollama { background: #0066cc; color: white; }
    .provider-hint { font-size: 11px; color: #888; margin-top: 4px; }
    .hidden-row { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <h1>${safeName}</h1>
      <p class="meta">v${safeVersion} | ${safeDescription}</p>

      <h2>Actions</h2>
      <div id="actions">
        ${actionButtons || "<em>No actions defined</em>"}
      </div>

      <h2 style="margin-top: 20px;">Agent Preview</h2>
      <p class="preview-hint">Shows the agent's UI and notifications. Most agents are headless (no UI) - notifications will appear as toasts.</p>
      <iframe id="agent-frame" src="/agent"></iframe>
    </div>

    <div class="panel">
      <h2>Inference Settings <span id="status-badge" class="status-badge status-mock">Mock</span></h2>
      <form class="settings-form" id="inference-form">
        <div class="form-row">
          <label for="provider">Provider</label>
          <select id="provider" name="provider">
            <option value="mock">Mock (no AI)</option>
            <option value="openai">OpenAI</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </div>
        <div class="form-row" id="apikey-row">
          <label for="apiKey">API Key</label>
          <input type="password" id="apiKey" name="apiKey" placeholder="sk-...">
        </div>
        <div class="form-row" id="model-row">
          <label for="model">Model</label>
          <input type="text" id="model" name="model" placeholder="gpt-4o-mini">
        </div>
        <div class="form-row hidden-row" id="ollama-row">
          <label for="ollamaUrl">Ollama URL</label>
          <input type="text" id="ollamaUrl" name="ollamaUrl" placeholder="http://localhost:11434">
        </div>
        <div class="form-row">
          <label></label>
          <button type="submit" class="action-btn save-btn">Save Settings</button>
        </div>
        <p class="provider-hint" id="provider-hint">Mock mode: Inference calls return placeholder responses.</p>
      </form>

      <h2>Activity Logs <button class="action-btn clear-btn" id="clear-logs">Clear</button></h2>
      <div class="logs" id="logs"></div>
    </div>
  </div>

  <script>
    const logsEl = document.getElementById('logs');
    const frame = document.getElementById('agent-frame');
    let lastLogCount = 0;

    // Poll for logs
    async function pollLogs() {
      try {
        const res = await fetch('/api/logs');
        const logs = await res.json();
        if (logs.length !== lastLogCount) {
          renderLogs(logs);
          lastLogCount = logs.length;
        }
      } catch (e) {}
      setTimeout(pollLogs, 500);
    }

    function renderLogs(logs) {
      while (logsEl.firstChild) logsEl.removeChild(logsEl.firstChild);
      logs.forEach(function(log) {
        var div = document.createElement('div');
        div.className = 'log log-' + log.type;
        var time = new Date(log.timestamp).toLocaleTimeString();
        var timeSpan = document.createElement('span');
        timeSpan.className = 'log-time';
        timeSpan.textContent = time;
        div.appendChild(timeSpan);
        div.appendChild(document.createTextNode('[' + log.type.toUpperCase() + '] ' + log.message));
        logsEl.appendChild(div);
      });
      logsEl.scrollTop = logsEl.scrollHeight;
    }

    // Action buttons
    document.querySelectorAll('.action-btn[data-action]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = this.getAttribute('data-action');
        this.disabled = true;
        frame.contentWindow.postMessage({ type: 'trigger-action', action: action, params: {} }, '*');
        setTimeout(function() { btn.disabled = false; }, 1000);
      });
    });

    // Clear logs
    document.getElementById('clear-logs').addEventListener('click', async function() {
      await fetch('/api/logs/clear', { method: 'POST' });
      while (logsEl.firstChild) logsEl.removeChild(logsEl.firstChild);
      lastLogCount = 0;
    });

    // Listen for agent messages
    window.addEventListener('message', function(event) {
      if (event.data.type === 'agent-ready') {
        console.log('Agent ready');
      }
    });

    // Inference settings
    const providerSelect = document.getElementById('provider');
    const apikeyRow = document.getElementById('apikey-row');
    const modelRow = document.getElementById('model-row');
    const ollamaRow = document.getElementById('ollama-row');
    const statusBadge = document.getElementById('status-badge');
    const providerHint = document.getElementById('provider-hint');
    const modelInput = document.getElementById('model');
    const apiKeyInput = document.getElementById('apiKey');
    const ollamaUrlInput = document.getElementById('ollamaUrl');

    const hints = {
      mock: 'Mock mode: Inference calls return placeholder responses.',
      openai: 'OpenAI: Uses GPT models via API. Requires API key.',
      ollama: 'Ollama: Uses local models. Make sure Ollama is running.'
    };

    function updateProviderUI(provider) {
      // Update visibility
      apikeyRow.classList.toggle('hidden-row', provider !== 'openai');
      ollamaRow.classList.toggle('hidden-row', provider !== 'ollama');
      modelRow.classList.toggle('hidden-row', provider === 'mock');

      // Update badge
      statusBadge.className = 'status-badge status-' + provider;
      statusBadge.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);

      // Update hint
      providerHint.textContent = hints[provider] || '';

      // Update model placeholder
      if (provider === 'openai') {
        modelInput.placeholder = 'gpt-4o-mini';
      } else if (provider === 'ollama') {
        modelInput.placeholder = 'llama3';
      }
    }

    providerSelect.addEventListener('change', function() {
      updateProviderUI(this.value);
    });

    // Load current settings
    async function loadInferenceSettings() {
      try {
        const res = await fetch('/api/inference');
        const config = await res.json();
        providerSelect.value = config.provider;
        modelInput.value = config.model || '';
        ollamaUrlInput.value = config.ollamaUrl || 'http://localhost:11434';
        if (config.hasApiKey) {
          apiKeyInput.placeholder = '****************';
        }
        updateProviderUI(config.provider);
      } catch (e) {
        console.error('Failed to load inference settings:', e);
      }
    }

    // Save settings
    document.getElementById('inference-form').addEventListener('submit', async function(e) {
      e.preventDefault();
      const formData = {
        provider: providerSelect.value,
        model: modelInput.value,
        ollamaUrl: ollamaUrlInput.value
      };
      // Only include apiKey if user entered one
      if (apiKeyInput.value) {
        formData.apiKey = apiKeyInput.value;
      }
      try {
        const res = await fetch('/api/inference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (res.ok) {
          updateProviderUI(providerSelect.value);
          if (apiKeyInput.value) {
            apiKeyInput.value = '';
            apiKeyInput.placeholder = '****************';
          }
          // Show success feedback
          const btn = this.querySelector('.save-btn');
          const origText = btn.textContent;
          btn.textContent = 'Saved!';
          setTimeout(function() { btn.textContent = origText; }, 1500);
        }
      } catch (e) {
        console.error('Failed to save settings:', e);
      }
    });

    loadInferenceSettings();
    pollLogs();
  </script>
</body>
</html>`;
}
