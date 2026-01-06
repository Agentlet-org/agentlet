/**
 * Custom Matchers for Agentlet Testing
 *
 * Jest/Vitest compatible matchers for asserting agent behavior.
 * These can be extended with expect.extend() in your test setup.
 */

import type { MockBridge, MatcherResult } from "./types.js";

// ═══ MATCHER FUNCTIONS ═══

/**
 * Assert that a bridge method was called
 */
export function toHaveRequested(
  bridge: MockBridge,
  method: string
): MatcherResult {
  const found = bridge.requests.find((r) => r.method === method);

  return {
    pass: !!found,
    message: () =>
      found
        ? `Expected bridge NOT to have request "${method}"`
        : `Expected bridge to have request "${method}". Requests made: ${bridge.requests.map((r) => r.method).join(", ") || "(none)"}`,
  };
}

/**
 * Assert that a notification was shown
 */
export function toHaveNotified(
  bridge: MockBridge,
  message: string,
  type?: string
): MatcherResult {
  const found = bridge.ui.notifications.find(
    (n) =>
      n.message.includes(message) && (type === undefined || n.type === type)
  );

  return {
    pass: !!found,
    message: () =>
      found
        ? `Expected NOT to have notification containing "${message}"`
        : `Expected notification containing "${message}"${type ? ` with type "${type}"` : ""}. Notifications: ${JSON.stringify(bridge.ui.notifications)}`,
  };
}

/**
 * Assert that storage was updated with a value
 */
export function toHaveStoredValue(
  bridge: MockBridge,
  key: string,
  value?: unknown
): MatcherResult {
  const stored = bridge.storage.data.get(key);
  const hasKey = bridge.storage.data.has(key);

  if (value === undefined) {
    return {
      pass: hasKey,
      message: () =>
        hasKey
          ? `Expected storage NOT to have key "${key}"`
          : `Expected storage to have key "${key}". Keys: ${Array.from(bridge.storage.data.keys()).join(", ") || "(none)"}`,
    };
  }

  const valueMatches = JSON.stringify(stored) === JSON.stringify(value);

  return {
    pass: hasKey && valueMatches,
    message: () =>
      hasKey && valueMatches
        ? `Expected storage NOT to have "${key}" = ${JSON.stringify(value)}`
        : `Expected storage["${key}"] = ${JSON.stringify(value)}. Actual: ${JSON.stringify(stored)}`,
  };
}

/**
 * Assert that inference was called
 */
export function toHaveCalledInference(
  bridge: MockBridge,
  promptContains?: string
): MatcherResult {
  const calls = bridge.inference.inference.calls;
  const called = calls.length > 0;

  if (promptContains === undefined) {
    return {
      pass: called,
      message: () =>
        called
          ? `Expected inference NOT to be called`
          : `Expected inference to be called`,
    };
  }

  const found = calls.find((call) => {
    const request = call[0] as Record<string, unknown>;
    const messages = request.messages as Array<{ content?: string }> | undefined;
    const prompt = request.prompt as string | undefined;

    // Check messages array
    if (messages) {
      return messages.some((m) => m.content?.includes(promptContains));
    }

    // Check prompt string
    if (prompt) {
      return prompt.includes(promptContains);
    }

    return false;
  });

  return {
    pass: !!found,
    message: () =>
      found
        ? `Expected inference NOT to be called with prompt containing "${promptContains}"`
        : `Expected inference to be called with prompt containing "${promptContains}"`,
  };
}

/**
 * Assert an error with specific code
 */
export function toHaveErrorCode(
  error: unknown,
  code: string
): MatcherResult {
  const err = error as { code?: string } | undefined;
  const actualCode = err?.code;

  return {
    pass: actualCode === code,
    message: () =>
      actualCode === code
        ? `Expected error NOT to have code "${code}"`
        : `Expected error code "${code}", got "${actualCode || "(no code)"}"`,
  };
}

// ═══ VITEST/JEST EXTENSION ═══

/**
 * Extend expect with Agentlet matchers
 *
 * @example
 * ```typescript
 * import { expect } from 'vitest';
 * import { extendExpect } from '@agentlet/testing';
 *
 * extendExpect(expect);
 *
 * // Now you can use:
 * expect(bridge).toHaveRequested('inference');
 * expect(bridge).toHaveNotified('Success');
 * ```
 */
export function extendExpect(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect: { extend: (matchers: Record<string, unknown>) => void }
): void {
  expect.extend({
    toHaveRequested(received: MockBridge, method: string) {
      const result = toHaveRequested(received, method);
      return {
        pass: result.pass,
        message: result.message,
      };
    },

    toHaveNotified(received: MockBridge, message: string, type?: string) {
      const result = toHaveNotified(received, message, type);
      return {
        pass: result.pass,
        message: result.message,
      };
    },

    toHaveStoredValue(received: MockBridge, key: string, value?: unknown) {
      const result = toHaveStoredValue(received, key, value);
      return {
        pass: result.pass,
        message: result.message,
      };
    },

    toHaveCalledInference(received: MockBridge, promptContains?: string) {
      const result = toHaveCalledInference(received, promptContains);
      return {
        pass: result.pass,
        message: result.message,
      };
    },

    toHaveErrorCode(received: unknown, code: string) {
      const result = toHaveErrorCode(received, code);
      return {
        pass: result.pass,
        message: result.message,
      };
    },
  });
}

// ═══ TYPE AUGMENTATION ═══

/**
 * TypeScript declaration for extended matchers
 *
 * Import this in your test setup for proper type inference:
 *
 * ```typescript
 * import '@agentlet/testing/matchers';
 * ```
 */
declare global {
  namespace Vi {
    interface Assertion {
      toHaveRequested(method: string): void;
      toHaveNotified(message: string, type?: string): void;
      toHaveStoredValue(key: string, value?: unknown): void;
      toHaveCalledInference(promptContains?: string): void;
      toHaveErrorCode(code: string): void;
    }
  }

  namespace jest {
    interface Matchers<R> {
      toHaveRequested(method: string): R;
      toHaveNotified(message: string, type?: string): R;
      toHaveStoredValue(key: string, value?: unknown): R;
      toHaveCalledInference(promptContains?: string): R;
      toHaveErrorCode(code: string): R;
    }
  }
}
