/**
 * Manifest Parsing Module
 *
 * Provides environment-aware manifest parsing:
 * - Browser: Uses DOMParser (fast, accurate)
 * - Node.js: Uses regex parsing (no DOM dependency)
 *
 * The extractManifest() function automatically selects the appropriate parser.
 */

import { ExtractedManifest, ConstrainedCapability } from "../types";
import { extractManifestRegex } from "./regex";

// Re-export the regex parser for explicit use
export { extractManifestRegex } from "./regex";

/**
 * Check if DOMParser is available (browser environment)
 */
function hasDOMParser(): boolean {
  return typeof DOMParser !== "undefined";
}

/**
 * DOM-based manifest extraction (browser only)
 * This is a wrapper that calls the original extractManifestFromHtml
 */
function extractManifestDOM(html: string): ExtractedManifest {
  // Import dynamically to avoid issues in Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractManifestFromHtml } = require("../manifest");
  return extractManifestFromHtml(html);
}

/**
 * Extract manifest from agent HTML with automatic environment detection
 *
 * This function automatically selects the appropriate parser:
 * - In browser environments: Uses DOMParser for fast, accurate parsing
 * - In Node.js environments: Uses regex-based parsing
 *
 * Both parsers produce identical output.
 *
 * @param html The agent HTML content
 * @returns Extracted manifest object
 * @throws Error if required fields are missing or version is unsupported
 *
 * @example
 * ```typescript
 * import { extractManifest } from '@agentlet/host-sdk';
 *
 * const manifest = extractManifest(agentHtml);
 * console.log(manifest.name, manifest.version);
 * ```
 */
export function extractManifest(html: string): ExtractedManifest {
  if (hasDOMParser()) {
    return extractManifestDOM(html);
  }
  return extractManifestRegex(html);
}

/**
 * Parse capabilities from manifest into structured form
 *
 * @param capabilities Array of capability objects or strings
 * @returns Object with parsed permissions
 */
export function parseCapabilities(
  capabilities: ConstrainedCapability[] | string[]
): {
  context: string[];
  network: string[];
  inference: boolean;
  storage: boolean;
} {
  const result = {
    context: [] as string[],
    network: [] as string[],
    inference: false,
    storage: false,
  };

  for (const cap of capabilities) {
    const capName = typeof cap === "string" ? cap : cap.name;

    if (capName === "inference" || capName.startsWith("inference:")) {
      result.inference = true;
    } else if (capName === "storage") {
      result.storage = true;
    } else if (capName.startsWith("network:")) {
      result.network.push(capName.replace("network:", ""));
    } else {
      result.context.push(capName);
    }
  }

  return result;
}

/**
 * Extract just the capability names from ConstrainedCapability array
 *
 * @param capabilities Array of constrained capabilities
 * @returns Array of capability name strings
 */
export function getCapabilityNames(
  capabilities: ConstrainedCapability[]
): string[] {
  return capabilities.map((c) => c.name);
}
