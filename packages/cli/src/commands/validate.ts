/**
 * validate command - Validate agent manifest and structure
 *
 * Uses the SDK's extractManifest() to parse and validate
 * agent HTML files.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { extractManifest, parseCapabilities, ErrorCodes, AgentletError } from "@agentlet/host-sdk";

export interface ValidateOptions {
  verbose?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  file: string;
  manifest?: {
    name: string;
    version: string;
    specVersion: string;
    description?: string;
    portability?: string;
    capabilities: string[];
    actions: string[];
  };
  errors: Array<{
    code: string;
    message: string;
    line?: number;
  }>;
  warnings: Array<{
    message: string;
    line?: number;
  }>;
}

/**
 * Validate an agent file
 */
export async function validateAgent(
  filePath: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: false,
    file: filePath,
    errors: [],
    warnings: [],
  };

  // Check file exists
  if (!fs.existsSync(filePath)) {
    result.errors.push({
      code: ErrorCodes.AGENT_INVALID,
      message: `File not found: ${filePath}`,
    });
    return result;
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== ".agentlet" && ext !== ".html") {
    result.warnings.push({
      message: `Non-standard extension "${ext}". Expected .agentlet or .html`,
    });
  }

  // Read file
  let html: string;
  try {
    html = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    const err = error as Error;
    result.errors.push({
      code: ErrorCodes.AGENT_INVALID,
      message: `Failed to read file: ${err.message}`,
    });
    return result;
  }

  // Check basic HTML structure
  if (!html.includes("<!DOCTYPE html>") && !html.includes("<!doctype html>")) {
    result.warnings.push({
      message: "Missing DOCTYPE declaration",
      line: 1,
    });
  }

  if (!html.includes("<html")) {
    result.errors.push({
      code: ErrorCodes.AGENT_INVALID,
      message: "Missing <html> tag",
    });
    return result;
  }

  // Extract manifest
  try {
    const manifest = extractManifest(html);

    // Store manifest info
    result.manifest = {
      name: manifest.name,
      version: manifest.version,
      specVersion: manifest.specVersion,
      description: manifest.description,
      portability: manifest.portability,
      capabilities: manifest.capabilities.map((c) => c.name),
      actions: manifest.actions.map((a) => a.id),
    };

    // Validate spec version
    if (!manifest.specVersion.startsWith("0.1") && !manifest.specVersion.startsWith("0.2")) {
      result.warnings.push({
        message: `Spec version ${manifest.specVersion} may not be fully supported`,
      });
    }

    // Check for actions
    if (manifest.actions.length === 0) {
      result.warnings.push({
        message: "No actions defined. Agent will only respond to triggers.",
      });
    }

    // Check for deprecated actions
    for (const action of manifest.actions) {
      if (action.deprecated) {
        result.warnings.push({
          message: `Action "${action.id}" is deprecated${action.deprecatedMessage ? `: ${action.deprecatedMessage}` : ""}`,
        });
      }
    }

    // Parse capabilities
    const caps = parseCapabilities(manifest.capabilities);

    // Check for inference without network (common mistake)
    if (caps.inference && caps.network.length === 0) {
      // This is fine for local inference, but worth noting
      if (options.verbose) {
        result.warnings.push({
          message: "Agent requests inference but no network domains. Ensure local inference is available.",
        });
      }
    }

    // Check for storage capability
    if (caps.storage && !manifest.preferences) {
      if (options.verbose) {
        result.warnings.push({
          message: "Agent requests storage but defines no preferences. Consider adding preferences for user configuration.",
        });
      }
    }

    // Check portability type
    if (!manifest.portability) {
      result.warnings.push({
        message: "No portability type specified. Consider adding agentlet:portability meta tag.",
      });
    }

    // Mark as valid if no errors
    result.valid = result.errors.length === 0;
  } catch (error) {
    const err = error as Error;
    result.errors.push({
      code: ErrorCodes.AGENT_INVALID,
      message: err.message,
    });
  }

  return result;
}

/**
 * Format validation result for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  if (result.valid) {
    lines.push(`\u2713 ${result.file}`);
    if (result.manifest) {
      lines.push(`  Name: ${result.manifest.name} v${result.manifest.version}`);
      lines.push(`  Spec: ${result.manifest.specVersion}`);
      if (result.manifest.description) {
        lines.push(`  ${result.manifest.description}`);
      }
      if (result.manifest.capabilities.length > 0) {
        lines.push(`  Capabilities: ${result.manifest.capabilities.join(", ")}`);
      }
      if (result.manifest.actions.length > 0) {
        lines.push(`  Actions: ${result.manifest.actions.join(", ")}`);
      }
    }
  } else {
    lines.push(`\u2717 ${result.file}`);
  }

  for (const error of result.errors) {
    lines.push(`  ERROR [${error.code}]: ${error.message}${error.line ? ` (line ${error.line})` : ""}`);
  }

  for (const warning of result.warnings) {
    lines.push(`  WARN: ${warning.message}${warning.line ? ` (line ${warning.line})` : ""}`);
  }

  return lines.join("\n");
}
