/**
 * MockBridge - Controllable mock of the Agentlet bridge for testing
 *
 * This implementation provides a complete mock of the bridge API
 * with controllable responses and call tracking.
 */

import type {
  PerceiveResult,
  ActResult,
} from "@agentlet/host-sdk";

import type {
  MockFunction,
  MockBridge,
  MockBridgeConfig,
  MockStorage,
  MockUI,
  MockActivity,
  MockContext,
  MockInference,
  MockInferenceResponse,
} from "./types.js";

// ═══ MOCK FUNCTION FACTORY ═══

/**
 * Create a mock function with tracking
 */
export function createMockFunction<TArgs extends unknown[], TReturn>(
  defaultReturn?: TReturn
): MockFunction<TArgs, TReturn> {
  let returnValue = defaultReturn;
  let implementation: ((...args: TArgs) => TReturn) | undefined;
  let rejectedError: Error | undefined;
  let resolvedValue: Awaited<TReturn> | undefined;
  let useResolved = false;
  let useRejected = false;

  const fn = ((...args: TArgs): TReturn => {
    fn.calls.push(args);
    fn.callCount++;

    if (useRejected && rejectedError) {
      return Promise.reject(rejectedError) as TReturn;
    }

    if (useResolved && resolvedValue !== undefined) {
      return Promise.resolve(resolvedValue) as TReturn;
    }

    if (implementation) {
      return implementation(...args);
    }

    return returnValue as TReturn;
  }) as MockFunction<TArgs, TReturn>;

  fn.calls = [];
  fn.callCount = 0;
  fn.returnValue = returnValue;

  fn.mockReturnValue = (value: TReturn) => {
    returnValue = value;
    fn.returnValue = value;
    useResolved = false;
    useRejected = false;
  };

  fn.mockImplementation = (fnImpl: (...args: TArgs) => TReturn) => {
    implementation = fnImpl;
    useResolved = false;
    useRejected = false;
  };

  fn.mockRejectedValue = (error: Error) => {
    rejectedError = error;
    useRejected = true;
    useResolved = false;
  };

  fn.mockResolvedValue = (value: Awaited<TReturn>) => {
    resolvedValue = value;
    useResolved = true;
    useRejected = false;
  };

  fn.reset = () => {
    fn.calls = [];
    fn.callCount = 0;
    returnValue = defaultReturn;
    fn.returnValue = defaultReturn;
    implementation = undefined;
    rejectedError = undefined;
    resolvedValue = undefined;
    useResolved = false;
    useRejected = false;
  };

  return fn;
}

// ═══ MOCK STORAGE ═══

function createMockStorage(initialData?: Record<string, unknown>): MockStorage {
  const data = new Map<string, unknown>(
    initialData ? Object.entries(initialData) : []
  );

  const storage: MockStorage = {
    data,
    get: createMockFunction<[key: string], Promise<unknown>>(),
    set: createMockFunction<[key: string, value: unknown], Promise<void>>(),
    remove: createMockFunction<[key: string], Promise<void>>(),
    clear: createMockFunction<[], Promise<void>>(),
    keys: createMockFunction<[], Promise<string[]>>(),
  };

  // Wire up default implementations
  storage.get.mockImplementation(async (key) => data.get(key));
  storage.set.mockImplementation(async (key, value) => {
    data.set(key, value);
  });
  storage.remove.mockImplementation(async (key) => {
    data.delete(key);
  });
  storage.clear.mockImplementation(async () => {
    data.clear();
  });
  storage.keys.mockImplementation(async () => Array.from(data.keys()));

  return storage;
}

// ═══ MOCK UI ═══

function createMockUI(config?: MockBridgeConfig): MockUI {
  const notifications: Array<{ message: string; type?: string }> = [];
  const confirmResults = [...(config?.confirmResults || [true])];
  const promptResults = [...(config?.promptResults || [""])];

  const ui: MockUI = {
    notifications,
    confirmResults,
    promptResults,
    notify: createMockFunction<[message: string, type?: string], Promise<void>>(),
    confirm: createMockFunction<[message: string], Promise<boolean>>(),
    prompt: createMockFunction<[message: string, defaultValue?: string], Promise<string | null>>(),
    form: createMockFunction<[config: unknown], Promise<unknown>>(),
    select: createMockFunction<[config: unknown], Promise<unknown>>(),
    panel: createMockFunction<[config: unknown], Promise<string>>(),
    updatePanel: createMockFunction<[id: string, updates: unknown], Promise<void>>(),
    closePanel: createMockFunction<[id: string], Promise<void>>(),
  };

  // Wire up default implementations
  ui.notify.mockImplementation(async (message, type) => {
    notifications.push({ message, type });
  });

  ui.confirm.mockImplementation(async () => {
    return confirmResults.shift() ?? true;
  });

  ui.prompt.mockImplementation(async (_message, defaultValue) => {
    const result = promptResults.shift();
    return result !== undefined ? result : (defaultValue ?? null);
  });

  ui.form.mockResolvedValue({});
  ui.select.mockResolvedValue(null);
  ui.panel.mockResolvedValue("panel-1");
  ui.updatePanel.mockResolvedValue(undefined);
  ui.closePanel.mockResolvedValue(undefined);

  return ui;
}

// ═══ MOCK ACTIVITY ═══

function createMockActivity(): MockActivity {
  const steps: Array<{ type: string; message: string; level?: string }> = [];

  const activity: MockActivity = {
    steps,
    start: createMockFunction<[message: string], Promise<void>>(),
    step: createMockFunction<[message: string], Promise<void>>(),
    progress: createMockFunction<[current: number, total: number, message?: string], Promise<void>>(),
    log: createMockFunction<[message: string, level?: string], Promise<void>>(),
    complete: createMockFunction<[message: string], Promise<void>>(),
    error: createMockFunction<[message: string], Promise<void>>(),
  };

  // Wire up default implementations
  activity.start.mockImplementation(async (message) => {
    steps.push({ type: "start", message });
  });

  activity.step.mockImplementation(async (message) => {
    steps.push({ type: "step", message });
  });

  activity.progress.mockImplementation(async (_current, _total, message) => {
    steps.push({ type: "progress", message: message || "" });
  });

  activity.log.mockImplementation(async (message, level) => {
    steps.push({ type: "log", message, level });
  });

  activity.complete.mockImplementation(async (message) => {
    steps.push({ type: "complete", message });
  });

  activity.error.mockImplementation(async (message) => {
    steps.push({ type: "error", message });
  });

  return activity;
}

// ═══ MOCK CONTEXT ═══

function createMockContext(config?: MockBridgeConfig): MockContext {
  const items = new Map<string, Map<string | number, unknown>>();
  const selection = [...(config?.selection || [])];

  // Initialize from config
  if (config?.contextItems) {
    for (const [type, typeItems] of Object.entries(config.contextItems)) {
      const typeMap = new Map<string | number, unknown>();
      for (let i = 0; i < typeItems.length; i++) {
        const item = typeItems[i] as Record<string, unknown>;
        const id = (item.id as string | number) ?? i;
        typeMap.set(id, item);
      }
      items.set(type, typeMap);
    }
  }

  const context: MockContext = {
    items,
    selection,
    query: createMockFunction<[type: string, filter?: unknown], Promise<unknown[]>>(),
    get: createMockFunction<[type: string, id: string | number], Promise<unknown>>(),
    update: createMockFunction<[type: string, id: string | number, data: unknown], Promise<void>>(),
    create: createMockFunction<[type: string, data: unknown], Promise<unknown>>(),
    delete: createMockFunction<[type: string, id: string | number], Promise<void>>(),
    getSelection: createMockFunction<[], Promise<unknown[]>>(),
  };

  // Wire up default implementations
  context.query.mockImplementation(async (type) => {
    const typeMap = items.get(type);
    return typeMap ? Array.from(typeMap.values()) : [];
  });

  context.get.mockImplementation(async (type, id) => {
    const typeMap = items.get(type);
    return typeMap?.get(id);
  });

  context.update.mockImplementation(async (type, id, data) => {
    let typeMap = items.get(type);
    if (!typeMap) {
      typeMap = new Map();
      items.set(type, typeMap);
    }
    const existing = typeMap.get(id) || {};
    typeMap.set(id, { ...existing as object, ...data as object });
  });

  context.create.mockImplementation(async (type, data) => {
    let typeMap = items.get(type);
    if (!typeMap) {
      typeMap = new Map();
      items.set(type, typeMap);
    }
    const id = `created-${Date.now()}`;
    const item = { id, ...data as object };
    typeMap.set(id, item);
    return item;
  });

  context.delete.mockImplementation(async (type, id) => {
    const typeMap = items.get(type);
    typeMap?.delete(id);
  });

  context.getSelection.mockImplementation(async () => selection);

  return context;
}

// ═══ MOCK INFERENCE ═══

function createMockInference(config?: MockBridgeConfig): MockInference {
  const responses: MockInferenceResponse[] = [
    ...(config?.inferenceResponses || [
      { content: "Mock inference response" },
    ]),
  ];
  let responseIndex = 0;

  const inference: MockInference = {
    responses,
    responseIndex,
    inference: createMockFunction<[request: unknown], Promise<MockInferenceResponse>>(),
    addResponse(response: MockInferenceResponse) {
      responses.push(response);
    },
    setResponses(newResponses: MockInferenceResponse[]) {
      responses.length = 0;
      responses.push(...newResponses);
      responseIndex = 0;
    },
  };

  // Wire up default implementation
  inference.inference.mockImplementation(async () => {
    const response = responses[responseIndex % responses.length];
    responseIndex++;
    inference.responseIndex = responseIndex;
    return response;
  });

  return inference;
}

// ═══ MOCK BRIDGE FACTORY ═══

/**
 * Create a complete MockBridge instance
 *
 * @param config Optional configuration for initial state
 * @returns Configured MockBridge
 *
 * @example
 * ```typescript
 * const bridge = createMockBridge({
 *   storage: { apiKey: "test-key" },
 *   confirmResults: [true, false],
 *   inferenceResponses: [{ content: "Hello!" }],
 * });
 *
 * // Use in tests
 * await bridge.storage.get("apiKey"); // Returns "test-key"
 * await bridge.inference.inference({}); // Returns { content: "Hello!" }
 * ```
 */
export function createMockBridge(config?: MockBridgeConfig): MockBridge {
  const storage = createMockStorage(config?.storage);
  const ui = createMockUI(config);
  const activity = createMockActivity();
  const context = createMockContext(config);
  const inference = createMockInference(config);

  const defaultPerceiveResult: PerceiveResult = {
    host: "test-host",
    hostVersion: "1.0.0",
    items: config?.perceiveResult?.items || [],
    capabilities: config?.perceiveResult?.capabilities || [],
    schema: config?.perceiveResult?.schema,
    understanding: config?.perceiveResult?.understanding,
  };

  const defaultActResult: ActResult = {
    success: config?.actResult?.success ?? true,
    affected: config?.actResult?.affected ?? 0,
    result: config?.actResult?.result,
  };

  const bridge: MockBridge = {
    storage,
    ui,
    activity,
    context,
    inference,
    requests: [],
    perceive: createMockFunction<[options?: unknown], Promise<PerceiveResult>>(),
    act: createMockFunction<[options: unknown], Promise<ActResult>>(),
    limits: createMockFunction<[], Promise<{ remaining: Record<string, number> }>>(),
    reset() {
      storage.data.clear();
      if (config?.storage) {
        for (const [k, v] of Object.entries(config.storage)) {
          storage.data.set(k, v);
        }
      }
      storage.get.reset();
      storage.set.reset();
      storage.remove.reset();
      storage.clear.reset();
      storage.keys.reset();

      ui.notifications.length = 0;
      ui.confirmResults.length = 0;
      ui.confirmResults.push(...(config?.confirmResults || [true]));
      ui.promptResults.length = 0;
      ui.promptResults.push(...(config?.promptResults || [""]));
      ui.notify.reset();
      ui.confirm.reset();
      ui.prompt.reset();
      ui.form.reset();
      ui.select.reset();
      ui.panel.reset();
      ui.updatePanel.reset();
      ui.closePanel.reset();

      activity.steps.length = 0;
      activity.start.reset();
      activity.step.reset();
      activity.progress.reset();
      activity.log.reset();
      activity.complete.reset();
      activity.error.reset();

      context.items.clear();
      context.selection.length = 0;
      context.selection.push(...(config?.selection || []));
      context.query.reset();
      context.get.reset();
      context.update.reset();
      context.create.reset();
      context.delete.reset();
      context.getSelection.reset();

      inference.responses.length = 0;
      inference.responses.push(
        ...(config?.inferenceResponses || [{ content: "Mock inference response" }])
      );
      inference.responseIndex = 0;
      inference.inference.reset();

      bridge.requests.length = 0;
      bridge.perceive.reset();
      bridge.act.reset();
      bridge.limits.reset();

      // Re-wire implementations
      wireImplementations();
    },
  };

  function wireImplementations() {
    storage.get.mockImplementation(async (key) => storage.data.get(key));
    storage.set.mockImplementation(async (key, value) => {
      storage.data.set(key, value);
    });
    storage.remove.mockImplementation(async (key) => {
      storage.data.delete(key);
    });
    storage.clear.mockImplementation(async () => {
      storage.data.clear();
    });
    storage.keys.mockImplementation(async () => Array.from(storage.data.keys()));

    ui.notify.mockImplementation(async (message, type) => {
      ui.notifications.push({ message, type });
    });
    ui.confirm.mockImplementation(async () => {
      return ui.confirmResults.shift() ?? true;
    });
    ui.prompt.mockImplementation(async (_message, defaultValue) => {
      const result = ui.promptResults.shift();
      return result !== undefined ? result : (defaultValue ?? null);
    });

    bridge.perceive.mockResolvedValue(defaultPerceiveResult);
    bridge.act.mockResolvedValue(defaultActResult);
    bridge.limits.mockResolvedValue({
      remaining: {
        inferenceCalls: 100,
        networkRequests: 50,
        storageBytes: 1048576,
      },
    });
  }

  wireImplementations();

  return bridge;
}
