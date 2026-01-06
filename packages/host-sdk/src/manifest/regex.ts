/**
 * Regex-based Manifest Parser for Node.js environments
 *
 * This parser extracts manifest data from agent HTML using regex patterns.
 * It's used in environments without DOMParser (Node.js, CLI tools).
 *
 * The parser produces identical output to the DOM-based parser.
 */

import {
  ExtractedManifest,
  AgentPreferenceMeta,
  ConstrainedCapability,
  AgentActionMeta,
  ManifestTrigger,
} from "../types";

/**
 * Extract a single meta tag's content by name
 */
function getMeta(html: string, name: string): string | undefined {
  const pattern = new RegExp(
    `<meta\\s+[^>]*name\\s*=\\s*["']agentlet:${name}["'][^>]*>`,
    "gi"
  );
  const match = html.match(pattern);
  if (!match) return undefined;

  const contentMatch = match[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1] : undefined;
}

/**
 * Extract all meta tags with a given name
 */
function getMetaAll(html: string, name: string): string[] {
  const pattern = new RegExp(
    `<meta\\s+[^>]*name\\s*=\\s*["']agentlet:${name}["'][^>]*>`,
    "gi"
  );
  const matches = html.matchAll(pattern);
  const values: string[] = [];

  for (const match of matches) {
    const contentMatch = match[0].match(/content\s*=\s*["']([^"']*)["']/i);
    if (contentMatch) {
      values.push(contentMatch[1]);
    }
  }

  return values;
}

/**
 * Extract an attribute from a meta tag string
 */
function getAttribute(metaTag: string, attrName: string): string | undefined {
  // Handle both data-attr and regular attr patterns
  const pattern = new RegExp(`${attrName}\\s*=\\s*["']([^"']*)["']`, "i");
  const match = metaTag.match(pattern);
  return match ? match[1] : undefined;
}

/**
 * Extract capabilities/requirements with optional version constraints
 */
function getConstrainedCapabilities(
  html: string,
  name: string
): ConstrainedCapability[] {
  const pattern = new RegExp(
    `<meta\\s+[^>]*name\\s*=\\s*["']agentlet:${name}["'][^>]*>`,
    "gi"
  );
  const matches = html.matchAll(pattern);
  const result: ConstrainedCapability[] = [];

  for (const match of matches) {
    const content = getAttribute(match[0], "content");
    if (content) {
      const minSpec = getAttribute(match[0], "data-min-spec");
      const maxSpec = getAttribute(match[0], "data-max-spec");
      const cap: ConstrainedCapability = { name: content };
      if (minSpec || maxSpec) {
        cap.constraint = { minSpec, maxSpec };
      }
      result.push(cap);
    }
  }

  return result;
}

/**
 * Extract actions from HTML
 */
function extractActions(html: string): AgentActionMeta[] {
  const pattern = /<meta\s+[^>]*name\s*=\s*["']agentlet:action["'][^>]*>/gi;
  const matches = html.matchAll(pattern);
  const actions: AgentActionMeta[] = [];

  for (const match of matches) {
    const id = getAttribute(match[0], "content");
    if (id) {
      actions.push({
        id,
        label: getAttribute(match[0], "data-label"),
        description: getAttribute(match[0], "data-description"),
        confirm: getAttribute(match[0], "data-confirm") === "true",
        deprecated: getAttribute(match[0], "data-deprecated") === "true",
        deprecatedMessage: getAttribute(match[0], "data-deprecated-message"),
        removeIn: getAttribute(match[0], "data-remove-in"),
      });
    }
  }

  return actions;
}

/**
 * Extract preferences from HTML
 */
function extractPreferences(html: string): AgentPreferenceMeta[] {
  const pattern =
    /<meta\s+[^>]*name\s*=\s*["']agentlet:preference["'][^>]*>/gi;
  const matches = html.matchAll(pattern);
  const preferences: AgentPreferenceMeta[] = [];

  for (const match of matches) {
    const key = getAttribute(match[0], "content");
    if (key) {
      const pref: AgentPreferenceMeta = {
        key,
        type: getAttribute(match[0], "data-type") || "string",
        label: getAttribute(match[0], "data-label") || key,
        default: getAttribute(match[0], "data-default"),
      };

      // Parse options for select type
      if (pref.type === "select") {
        pref.options = [];
        const optPattern = new RegExp(
          `<meta\\s+[^>]*name\\s*=\\s*["']agentlet:preference:option["'][^>]*content\\s*=\\s*["']${key}:([^"']*)["'][^>]*>`,
          "gi"
        );
        const optMatches = html.matchAll(optPattern);
        for (const optMatch of optMatches) {
          const value = optMatch[1];
          const label = getAttribute(optMatch[0], "data-label") || value;
          pref.options.push({ value, label });
        }
      }

      preferences.push(pref);
    }
  }

  return preferences;
}

/**
 * Extract triggers from HTML
 */
function extractTriggers(html: string): ManifestTrigger[] {
  const pattern = /<meta\s+[^>]*name\s*=\s*["']agentlet:trigger["'][^>]*>/gi;
  const matches = html.matchAll(pattern);
  const triggers: ManifestTrigger[] = [];

  for (const match of matches) {
    const event = getAttribute(match[0], "content");
    const action = getAttribute(match[0], "data-action");
    if (event && action) {
      const filterStr = getAttribute(match[0], "data-filter");
      triggers.push({
        event,
        action,
        filter: filterStr ? JSON.parse(filterStr) : undefined,
      });
    }
  }

  return triggers;
}

/**
 * Extract manifest from v0.1 agent HTML using regex
 *
 * This is the Node.js-compatible alternative to extractManifestFromHtml.
 * It produces identical output but uses regex instead of DOMParser.
 *
 * @param html The agent HTML content
 * @returns Extracted manifest object
 * @throws Error if required fields are missing or version is unsupported
 */
export function extractManifestRegex(html: string): ExtractedManifest {
  // Check spec version - support 0.1.x and 0.2.x
  const specVersionPattern =
    /<meta\s+[^>]*name\s*=\s*["']agentlet["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i;
  const specVersionMatch = html.match(specVersionPattern);
  const specVersion = specVersionMatch ? specVersionMatch[1] : "";

  if (!specVersion.startsWith("0.1") && !specVersion.startsWith("0.2")) {
    throw new Error(
      `Unsupported Agentlet spec version: ${specVersion || "missing"}`
    );
  }

  const name = getMeta(html, "name");
  const version = getMeta(html, "version");

  if (!name) throw new Error("Missing required: agentlet:name");
  if (!version) throw new Error("Missing required: agentlet:version");

  const actions = extractActions(html);
  const preferences = extractPreferences(html);
  const triggers = extractTriggers(html);

  return {
    specVersion,
    name,
    version,
    description: getMeta(html, "description"),
    author: getMeta(html, "author"),
    license: getMeta(html, "license"),
    homepage: getMeta(html, "homepage"),
    icon: getMeta(html, "icon"),
    portability: getMeta(html, "portability") as ExtractedManifest["portability"],
    hosts: getMetaAll(html, "host"),
    requires: getConstrainedCapabilities(html, "requires"),
    optional: getConstrainedCapabilities(html, "optional"),
    intents: getMetaAll(html, "intent"),
    capabilities: getConstrainedCapabilities(html, "capability"),
    actions,
    defaultAction: getMeta(html, "default-action"),
    preferences: preferences.length > 0 ? preferences : undefined,
    triggers: triggers.length > 0 ? triggers : undefined,
  };
}
