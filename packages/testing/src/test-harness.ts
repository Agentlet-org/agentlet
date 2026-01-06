/**
 * TestHarness - Run agents in isolated test environments
 *
 * Uses the SDK's HeadlessSandbox with jsdom to execute agents
 * and MockBridge to control and observe their behavior.
 */

import type { JSDOM as JSDOMType } from "jsdom";
import {
  extractManifest,
  createHeadlessSandbox,
  HeadlessSandbox,
  BridgeRequest,
  BridgeResponse,
  ExtractedManifest,
  GrantedPermissions,
  ErrorCodes,
  AgentletError,
} from "@agentlet/host-sdk";

import type { TestHarness, TestHarnessConfig, MockBridge } from "./types.js";
import { createMockBridge } from "./mock-bridge.js";

// ═══ TEST HARNESS IMPLEMENTATION ═══

/**
 * Create a test harness for running agents in isolation
 *
 * The harness uses jsdom to create a browser-like environment
 * and routes all bridge calls through a MockBridge.
 *
 * @param config Test harness configuration
 * @returns Configured TestHarness instance
 *
 * @example
 * ```typescript
 * import { JSDOM } from 'jsdom';
 * import { createTestHarness } from '@agentlet/testing';
 *
 * const harness = await createTestHarness({
 *   html: agentHtml,
 *   permissions: { inference: true },
 *   mockConfig: {
 *     inferenceResponses: [{ content: "Test response" }],
 *   },
 * }, JSDOM);
 *
 * await harness.executeAction('summarize');
 * expect(harness.bridge.inference.inference.callCount).toBe(1);
 *
 * harness.destroy();
 * ```
 */
export async function createTestHarness(
  config: TestHarnessConfig,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  JSDOM: any
): Promise<TestHarness> {
  const { html, permissions, mockConfig, timeout = 5000 } = config;

  // Extract manifest
  const manifest = extractManifest(html);

  // Create mock bridge
  const bridge = createMockBridge(mockConfig);

  // Track requests and pending responses
  const requests: BridgeRequest[] = [];
  const pendingRequests = new Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }>();
  const requestWaiters = new Map<string, {
    resolve: (request: BridgeRequest) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();

  // Create sandbox with jsdom
  const sandbox = createHeadlessSandbox(
    {
      permissions: {
        context: permissions?.context || [],
        network: permissions?.network || [],
        inference: !!permissions?.inference,
        storage: !!permissions?.storage,
      },
    },
    JSDOM
  );

  // Set up message handling
  sandbox.onMessage(async (message: unknown) => {
    const request = message as BridgeRequest;
    if (request.type !== "request") return;

    // Track request
    requests.push(request);
    bridge.requests.push(request);

    // Notify waiters
    const waiter = requestWaiters.get(request.method);
    if (waiter) {
      clearTimeout(waiter.timeout);
      requestWaiters.delete(request.method);
      waiter.resolve(request);
    }

    // Route to mock bridge
    try {
      const result = await routeRequest(request, bridge, manifest);
      sendResponse(sandbox, request.id, result);
    } catch (error) {
      const err = error as Error & { code?: string };
      sendErrorResponse(sandbox, request.id, err.code || ErrorCodes.AGENT_INVALID, err.message);
    }
  });

  // Load the agent
  await sandbox.load(html);

  // Wait for ready with timeout
  let ready = false;
  const readyPromise = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!ready) {
        reject(new AgentletError(ErrorCodes.AGENT_INVALID, "Agent ready timeout"));
      }
    }, timeout);

    // Agents signal ready via bridge.onReady
    const originalOnMessage = sandbox.onMessage.bind(sandbox);
    sandbox.onMessage((msg: unknown) => {
      const message = msg as { type?: string; method?: string };
      if (message.type === "request" && message.method === "ready") {
        ready = true;
        clearTimeout(timer);
        resolve();
      }
    });
  });

  // Send init message
  sandbox.postMessage({
    type: "init",
    host: {
      name: "test-harness",
      version: "1.0.0",
      specVersion: "0.1",
      capabilities: permissions?.context || [],
      features: [],
    },
    agent: {
      id: "test-agent",
      permissions: permissions || {},
    },
  });

  // Don't fail if ready times out - some agents don't signal ready
  await Promise.race([
    readyPromise,
    new Promise(resolve => setTimeout(resolve, 100)),
  ]).catch(() => {});

  const harness: TestHarness = {
    manifest,
    bridge,

    async executeAction(actionId: string, params?: unknown) {
      sandbox.postMessage({
        type: "action",
        action: actionId,
        params: params || {},
      });

      // Wait a bit for the action to process
      await new Promise(resolve => setTimeout(resolve, 50));
    },

    async waitForRequest(method: string, waitTimeout = timeout) {
      // Check if we already have it
      const existing = requests.find(r => r.method === method);
      if (existing) return existing;

      // Wait for it
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          requestWaiters.delete(method);
          reject(new Error(`Timeout waiting for request: ${method}`));
        }, waitTimeout);

        requestWaiters.set(method, { resolve, timeout: timer });
      });
    },

    async waitForReady(waitTimeout = timeout) {
      if (ready) return;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new AgentletError(ErrorCodes.AGENT_INVALID, "Agent ready timeout"));
        }, waitTimeout);

        const checkReady = () => {
          if (ready) {
            clearTimeout(timer);
            resolve();
          } else {
            setTimeout(checkReady, 10);
          }
        };
        checkReady();
      });
    },

    getRequests(methodPattern?: RegExp) {
      if (!methodPattern) return [...requests];
      return requests.filter(r => methodPattern.test(r.method));
    },

    assertRequest(method: string, params?: unknown) {
      const found = requests.find(r => r.method === method);
      if (!found) {
        throw new Error(`Expected request "${method}" was not made. Requests: ${requests.map(r => r.method).join(", ")}`);
      }
      if (params !== undefined) {
        const paramsMatch = JSON.stringify(found.params) === JSON.stringify(params);
        if (!paramsMatch) {
          throw new Error(`Request "${method}" params mismatch.\nExpected: ${JSON.stringify(params)}\nActual: ${JSON.stringify(found.params)}`);
        }
      }
    },

    assertNoRequest(method: string) {
      const found = requests.find(r => r.method === method);
      if (found) {
        throw new Error(`Expected no request "${method}" but it was made`);
      }
    },

    destroy() {
      sandbox.destroy();
      for (const [, waiter] of requestWaiters) {
        clearTimeout(waiter.timeout);
      }
      requestWaiters.clear();
    },
  };

  return harness;
}

// ═══ REQUEST ROUTING ═══

async function routeRequest(
  request: BridgeRequest,
  bridge: MockBridge,
  manifest: ExtractedManifest
): Promise<unknown> {
  const { method, params } = request;
  const p = params as Record<string, unknown>;

  // Storage
  if (method === "storage.get") {
    return bridge.storage.get(p.key as string);
  }
  if (method === "storage.set") {
    return bridge.storage.set(p.key as string, p.value);
  }
  if (method === "storage.remove") {
    return bridge.storage.remove(p.key as string);
  }
  if (method === "storage.clear") {
    return bridge.storage.clear();
  }
  if (method === "storage.keys") {
    return bridge.storage.keys();
  }

  // UI
  if (method === "ui.notify") {
    return bridge.ui.notify(p.message as string, p.type as string | undefined);
  }
  if (method === "ui.confirm") {
    return bridge.ui.confirm(p.message as string);
  }
  if (method === "ui.prompt") {
    return bridge.ui.prompt(p.message as string, p.defaultValue as string | undefined);
  }
  if (method === "ui.form") {
    return bridge.ui.form(p.config);
  }
  if (method === "ui.select") {
    return bridge.ui.select(p.config);
  }
  if (method === "ui.panel") {
    return bridge.ui.panel(p.config);
  }
  if (method === "ui.updatePanel") {
    return bridge.ui.updatePanel(p.id as string, p.updates);
  }
  if (method === "ui.closePanel") {
    return bridge.ui.closePanel(p.id as string);
  }

  // Activity
  if (method === "activity.start") {
    return bridge.activity.start(p.message as string);
  }
  if (method === "activity.step") {
    return bridge.activity.step(p.message as string);
  }
  if (method === "activity.progress") {
    return bridge.activity.progress(p.current as number, p.total as number, p.message as string | undefined);
  }
  if (method === "activity.log") {
    return bridge.activity.log(p.message as string, p.level as string | undefined);
  }
  if (method === "activity.complete") {
    return bridge.activity.complete(p.message as string);
  }
  if (method === "activity.error") {
    return bridge.activity.error(p.message as string);
  }

  // Context
  if (method === "context.query") {
    return bridge.context.query(p.type as string, p.filter);
  }
  if (method === "context.get") {
    return bridge.context.get(p.type as string, p.id as string | number);
  }
  if (method === "context.update") {
    return bridge.context.update(p.type as string, p.id as string | number, p.data);
  }
  if (method === "context.create") {
    return bridge.context.create(p.type as string, p.data);
  }
  if (method === "context.delete") {
    return bridge.context.delete(p.type as string, p.id as string | number);
  }
  if (method === "context.getSelection") {
    return bridge.context.getSelection();
  }

  // Inference
  if (method === "inference") {
    return bridge.inference.inference(params);
  }

  // Perceive/Act
  if (method === "perceive") {
    return bridge.perceive(params);
  }
  if (method === "act") {
    return bridge.act(params);
  }

  // Limits
  if (method === "limits") {
    return bridge.limits();
  }

  // Ready acknowledgment
  if (method === "ready") {
    return { ok: true };
  }

  // Unknown method
  throw new AgentletError(ErrorCodes.HOST_UNSUPPORTED, `Unknown method: ${method}`);
}

// ═══ RESPONSE HELPERS ═══

function sendResponse(sandbox: HeadlessSandbox, id: string, result: unknown): void {
  const response: BridgeResponse = {
    id,
    type: "response",
    result,
  };
  sandbox.postMessage(response);
}

function sendErrorResponse(
  sandbox: HeadlessSandbox,
  id: string,
  code: string,
  message: string
): void {
  const response: BridgeResponse = {
    id,
    type: "response",
    error: { code, message },
  };
  sandbox.postMessage(response);
}
