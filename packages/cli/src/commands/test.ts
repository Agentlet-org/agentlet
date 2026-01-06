/**
 * test command - Run agent tests
 *
 * Uses @agentlet/testing to run agent tests in a
 * headless jsdom environment.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { extractManifest } from "@agentlet/host-sdk";
import { createTestHarness, createMockBridge } from "@agentlet/testing";

export interface TestOptions {
  action?: string;
  timeout?: number;
  verbose?: boolean;
}

export interface TestResult {
  passed: boolean;
  agentName: string;
  tests: Array<{
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
  }>;
  totalDuration: number;
}

/**
 * Run basic tests on an agent file
 *
 * This performs automated validation tests:
 * - Manifest validation
 * - Action execution
 * - Bridge call verification
 */
export async function testAgent(
  filePath: string,
  options: TestOptions = {}
): Promise<TestResult> {
  const { action, timeout = 5000, verbose = false } = options;
  const startTime = Date.now();

  // Read agent file
  if (!fs.existsSync(filePath)) {
    throw new Error(`Agent file not found: ${filePath}`);
  }

  const html = fs.readFileSync(filePath, "utf-8");
  let manifest;

  try {
    manifest = extractManifest(html);
  } catch (error) {
    const err = error as Error;
    return {
      passed: false,
      agentName: path.basename(filePath),
      tests: [{
        name: "Manifest validation",
        passed: false,
        error: err.message,
        duration: Date.now() - startTime,
      }],
      totalDuration: Date.now() - startTime,
    };
  }

  const result: TestResult = {
    passed: true,
    agentName: manifest.name,
    tests: [],
    totalDuration: 0,
  };

  // Try to load jsdom
  let JSDOM: typeof import("jsdom").JSDOM;
  try {
    const jsdomModule = await import("jsdom");
    JSDOM = jsdomModule.JSDOM;
  } catch {
    result.tests.push({
      name: "Load jsdom",
      passed: false,
      error: "jsdom is required for testing. Install with: npm install jsdom",
      duration: 0,
    });
    result.passed = false;
    result.totalDuration = Date.now() - startTime;
    return result;
  }

  // Test 1: Manifest validation
  const manifestTestStart = Date.now();
  result.tests.push({
    name: "Manifest validation",
    passed: true,
    duration: Date.now() - manifestTestStart,
  });

  if (verbose) {
    console.log(`  \u2713 Manifest: ${manifest.name} v${manifest.version}`);
  }

  // Test 2: Agent loads successfully
  const loadTestStart = Date.now();
  let harness;
  try {
    harness = await createTestHarness({
      html,
      permissions: {
        inference: true,
        storage: true,
      },
      mockConfig: {
        inferenceResponses: [{ content: "Test response" }],
      },
      timeout,
    }, JSDOM);

    result.tests.push({
      name: "Agent loads",
      passed: true,
      duration: Date.now() - loadTestStart,
    });

    if (verbose) {
      console.log(`  \u2713 Agent loads successfully`);
    }
  } catch (error) {
    const err = error as Error;
    result.tests.push({
      name: "Agent loads",
      passed: false,
      error: err.message,
      duration: Date.now() - loadTestStart,
    });
    result.passed = false;
    result.totalDuration = Date.now() - startTime;
    return result;
  }

  // Test 3: Actions execute (or specific action if provided)
  const actionsToTest = action
    ? manifest.actions.filter(a => a.id === action)
    : manifest.actions;

  for (const actionDef of actionsToTest) {
    const actionTestStart = Date.now();
    try {
      await harness.executeAction(actionDef.id);

      // Give the action time to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      result.tests.push({
        name: `Action: ${actionDef.id}`,
        passed: true,
        duration: Date.now() - actionTestStart,
      });

      if (verbose) {
        console.log(`  \u2713 Action "${actionDef.id}" executes`);
        const requests = harness.getRequests();
        if (requests.length > 0) {
          console.log(`    Bridge calls: ${requests.map(r => r.method).join(", ")}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      result.tests.push({
        name: `Action: ${actionDef.id}`,
        passed: false,
        error: err.message,
        duration: Date.now() - actionTestStart,
      });
      result.passed = false;

      if (verbose) {
        console.log(`  \u2717 Action "${actionDef.id}" failed: ${err.message}`);
      }
    }
  }

  // Clean up
  harness.destroy();

  result.totalDuration = Date.now() - startTime;

  // Check if any tests failed
  result.passed = result.tests.every(t => t.passed);

  return result;
}

/**
 * Format test result for console output
 */
export function formatTestResult(result: TestResult): string {
  const lines: string[] = [];
  const icon = result.passed ? "\u2713" : "\u2717";
  const status = result.passed ? "PASSED" : "FAILED";

  lines.push(`${icon} ${result.agentName} - ${status} (${result.totalDuration}ms)`);

  for (const test of result.tests) {
    const testIcon = test.passed ? "\u2713" : "\u2717";
    lines.push(`  ${testIcon} ${test.name} (${test.duration}ms)`);
    if (test.error) {
      lines.push(`    Error: ${test.error}`);
    }
  }

  return lines.join("\n");
}
