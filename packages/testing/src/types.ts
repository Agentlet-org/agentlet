/**
 * @agentlet/testing - Type definitions
 *
 * These types extend the SDK interfaces for testing purposes.
 */

import type {
  ExtractedManifest,
  GrantedPermissions,
  BridgeRequest,
  BridgeResponse,
  PerceiveResult,
  ActResult,
} from "@agentlet/host-sdk";

// ═══ MOCK FUNCTION TYPES ═══

/**
 * Mock function that tracks calls and can return preset values
 */
export interface MockFunction<TArgs extends unknown[] = unknown[], TReturn = unknown> {
  (...args: TArgs): TReturn;
  calls: TArgs[];
  callCount: number;
  returnValue: TReturn | undefined;
  mockReturnValue(value: TReturn): void;
  mockImplementation(fn: (...args: TArgs) => TReturn): void;
  mockRejectedValue(error: Error): void;
  mockResolvedValue(value: Awaited<TReturn>): void;
  reset(): void;
}

// ═══ MOCK BRIDGE TYPES ═══

/**
 * Mock storage interface for testing
 */
export interface MockStorage {
  data: Map<string, unknown>;
  get: MockFunction<[key: string], Promise<unknown>>;
  set: MockFunction<[key: string, value: unknown], Promise<void>>;
  remove: MockFunction<[key: string], Promise<void>>;
  clear: MockFunction<[], Promise<void>>;
  keys: MockFunction<[], Promise<string[]>>;
}

/**
 * Mock UI interface for testing
 */
export interface MockUI {
  notifications: Array<{ message: string; type?: string }>;
  confirmResults: boolean[];
  promptResults: Array<string | null>;
  notify: MockFunction<[message: string, type?: string], Promise<void>>;
  confirm: MockFunction<[message: string], Promise<boolean>>;
  prompt: MockFunction<[message: string, defaultValue?: string], Promise<string | null>>;
  form: MockFunction<[config: unknown], Promise<unknown>>;
  select: MockFunction<[config: unknown], Promise<unknown>>;
  panel: MockFunction<[config: unknown], Promise<string>>;
  updatePanel: MockFunction<[id: string, updates: unknown], Promise<void>>;
  closePanel: MockFunction<[id: string], Promise<void>>;
}

/**
 * Mock activity interface for testing
 */
export interface MockActivity {
  steps: Array<{ type: string; message: string; level?: string }>;
  start: MockFunction<[message: string], Promise<void>>;
  step: MockFunction<[message: string], Promise<void>>;
  progress: MockFunction<[current: number, total: number, message?: string], Promise<void>>;
  log: MockFunction<[message: string, level?: string], Promise<void>>;
  complete: MockFunction<[message: string], Promise<void>>;
  error: MockFunction<[message: string], Promise<void>>;
}

/**
 * Mock context interface for testing
 */
export interface MockContext {
  items: Map<string, Map<string | number, unknown>>;
  selection: unknown[];
  query: MockFunction<[type: string, filter?: unknown], Promise<unknown[]>>;
  get: MockFunction<[type: string, id: string | number], Promise<unknown>>;
  update: MockFunction<[type: string, id: string | number, data: unknown], Promise<void>>;
  create: MockFunction<[type: string, data: unknown], Promise<unknown>>;
  delete: MockFunction<[type: string, id: string | number], Promise<void>>;
  getSelection: MockFunction<[], Promise<unknown[]>>;
}

/**
 * Mock inference response
 */
export interface MockInferenceResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

/**
 * Mock inference interface for testing
 */
export interface MockInference {
  responses: MockInferenceResponse[];
  responseIndex: number;
  inference: MockFunction<[request: unknown], Promise<MockInferenceResponse>>;
  addResponse(response: MockInferenceResponse): void;
  setResponses(responses: MockInferenceResponse[]): void;
}

/**
 * Mock bridge configuration
 */
export interface MockBridgeConfig {
  /**
   * Initial storage data
   */
  storage?: Record<string, unknown>;

  /**
   * Preset confirm dialog results (consumed in order)
   */
  confirmResults?: boolean[];

  /**
   * Preset prompt dialog results (consumed in order)
   */
  promptResults?: Array<string | null>;

  /**
   * Preset inference responses (consumed in order, cycles)
   */
  inferenceResponses?: MockInferenceResponse[];

  /**
   * Initial context items by type
   */
  contextItems?: Record<string, unknown[]>;

  /**
   * Initial selection
   */
  selection?: unknown[];

  /**
   * Perceive result to return
   */
  perceiveResult?: Partial<PerceiveResult>;

  /**
   * Act result to return
   */
  actResult?: Partial<ActResult>;
}

/**
 * Complete mock bridge interface for testing
 */
export interface MockBridge {
  storage: MockStorage;
  ui: MockUI;
  activity: MockActivity;
  context: MockContext;
  inference: MockInference;

  /**
   * All bridge requests received
   */
  requests: BridgeRequest[];

  /**
   * Perceive mock function
   */
  perceive: MockFunction<[options?: unknown], Promise<PerceiveResult>>;

  /**
   * Act mock function
   */
  act: MockFunction<[options: unknown], Promise<ActResult>>;

  /**
   * Limits mock function
   */
  limits: MockFunction<[], Promise<{ remaining: Record<string, number> }>>;

  /**
   * Reset all mocks to initial state
   */
  reset(): void;
}

// ═══ TEST HARNESS TYPES ═══

/**
 * Test harness configuration
 */
export interface TestHarnessConfig {
  /**
   * Agent HTML content
   */
  html: string;

  /**
   * Permissions to grant
   */
  permissions?: GrantedPermissions;

  /**
   * Mock bridge configuration
   */
  mockConfig?: MockBridgeConfig;

  /**
   * Timeout for operations (default: 5000ms)
   */
  timeout?: number;
}

/**
 * Test harness for running agents in isolation
 */
export interface TestHarness {
  /**
   * Extracted manifest from agent HTML
   */
  manifest: ExtractedManifest;

  /**
   * Mock bridge instance
   */
  bridge: MockBridge;

  /**
   * Execute an agent action
   */
  executeAction(actionId: string, params?: unknown): Promise<void>;

  /**
   * Wait for a specific bridge request
   */
  waitForRequest(method: string, timeout?: number): Promise<BridgeRequest>;

  /**
   * Wait for agent to become ready
   */
  waitForReady(timeout?: number): Promise<void>;

  /**
   * Get all requests matching a pattern
   */
  getRequests(methodPattern?: RegExp): BridgeRequest[];

  /**
   * Assert that a request was made
   */
  assertRequest(method: string, params?: unknown): void;

  /**
   * Assert that no request was made
   */
  assertNoRequest(method: string): void;

  /**
   * Destroy the test harness
   */
  destroy(): void;
}

// ═══ ASSERTION TYPES ═══

/**
 * Matcher result for custom assertions
 */
export interface MatcherResult {
  pass: boolean;
  message: () => string;
}

/**
 * Custom matchers for Agentlet testing
 */
export interface AgentletMatchers {
  /**
   * Assert that a request was made with given method
   */
  toHaveRequested(method: string): MatcherResult;

  /**
   * Assert that a notification was shown
   */
  toHaveNotified(message: string, type?: string): MatcherResult;

  /**
   * Assert that storage was updated
   */
  toHaveStoredValue(key: string, value?: unknown): MatcherResult;

  /**
   * Assert that inference was called
   */
  toHaveCalledInference(prompt?: string): MatcherResult;

  /**
   * Assert error code
   */
  toHaveErrorCode(code: string): MatcherResult;
}
