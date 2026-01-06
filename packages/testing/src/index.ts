/**
 * @agentlet/testing - Testing utilities for Agentlet agents
 *
 * This package provides:
 * - MockBridge: Controllable mock of the bridge API
 * - TestHarness: Run agents in isolated jsdom environments
 * - Matchers: Jest/Vitest assertions for agent behavior
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { JSDOM } from 'jsdom';
 * import { createTestHarness, createMockBridge, extendExpect } from '@agentlet/testing';
 * import { expect } from 'vitest';
 *
 * // Extend expect with Agentlet matchers
 * extendExpect(expect);
 *
 * describe('My Agent', () => {
 *   it('should summarize text', async () => {
 *     const harness = await createTestHarness({
 *       html: agentHtml,
 *       permissions: { inference: true },
 *       mockConfig: {
 *         inferenceResponses: [{ content: 'Summary: This is about testing.' }],
 *       },
 *     }, JSDOM);
 *
 *     await harness.executeAction('summarize');
 *
 *     expect(harness.bridge).toHaveCalledInference();
 *     expect(harness.bridge).toHaveNotified('Summary');
 *
 *     harness.destroy();
 *   });
 * });
 * ```
 */

// ═══ TYPES ═══

export type {
  // Mock function
  MockFunction,
  // Mock bridge components
  MockStorage,
  MockUI,
  MockActivity,
  MockContext,
  MockInference,
  MockInferenceResponse,
  MockBridgeConfig,
  MockBridge,
  // Test harness
  TestHarnessConfig,
  TestHarness,
  // Matchers
  MatcherResult,
  AgentletMatchers,
} from "./types.js";

// ═══ MOCK BRIDGE ═══

export { createMockFunction, createMockBridge } from "./mock-bridge.js";

// ═══ TEST HARNESS ═══

export { createTestHarness } from "./test-harness.js";

// ═══ MATCHERS ═══

export {
  toHaveRequested,
  toHaveNotified,
  toHaveStoredValue,
  toHaveCalledInference,
  toHaveErrorCode,
  extendExpect,
} from "./matchers.js";

// ═══ RE-EXPORTS FROM SDK ═══

// Re-export commonly used SDK types for convenience
export type {
  ExtractedManifest,
  GrantedPermissions,
  BridgeRequest,
  BridgeResponse,
  PerceiveResult,
  ActResult,
  PerceiveOptions,
  ActOptions,
} from "@agentlet/host-sdk";

export { ErrorCodes, AgentletError } from "@agentlet/host-sdk";
