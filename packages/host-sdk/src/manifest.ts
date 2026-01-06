/**
 * Manifest Parser - Extract manifest from Agentlet v0.1 HTML
 *
 * Uses DOMParser for safe HTML parsing (no script execution).
 * This is identical across all host implementations.
 */

import { ExtractedManifest, AgentPreferenceMeta, ConstrainedCapability } from "./types";

/**
 * Extract manifest from v0.1 agent HTML using DOMParser
 * This is safe - no code execution, just HTML parsing
 *
 * @param html The agent HTML content
 * @returns Extracted manifest object
 * @throws Error if required fields are missing or version is unsupported
 */
export function extractManifestFromHtml(html: string): ExtractedManifest {
  // Use DOMParser for safe HTML parsing (no script execution)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Check spec version - support 0.1.x
  const specVersionMeta = doc.querySelector('meta[name="agentlet"]');
  const specVersion = specVersionMeta?.getAttribute("content") || "";
  if (!specVersion.startsWith("0.1")) {
    throw new Error(
      `Unsupported Agentlet spec version: ${specVersion || "missing"}`
    );
  }

  // Extract basic metadata
  const getMeta = (name: string): string | undefined => {
    const meta = doc.querySelector(`meta[name="agentlet:${name}"]`);
    return meta?.getAttribute("content") || undefined;
  };

  // Extract multiple values for a meta tag name
  const getMetaAll = (name: string): string[] => {
    const metas = doc.querySelectorAll(`meta[name="agentlet:${name}"]`);
    const values: string[] = [];
    metas.forEach((meta) => {
      const content = meta.getAttribute("content");
      if (content) values.push(content);
    });
    return values;
  };

  // Extract capabilities/requirements with optional version constraints
  const getConstrainedCapabilities = (name: string): ConstrainedCapability[] => {
    const metas = doc.querySelectorAll(`meta[name="agentlet:${name}"]`);
    const result: ConstrainedCapability[] = [];
    metas.forEach((meta) => {
      const content = meta.getAttribute("content");
      if (content) {
        const minSpec = meta.getAttribute("data-min-spec") || undefined;
        const maxSpec = meta.getAttribute("data-max-spec") || undefined;
        const cap: ConstrainedCapability = { name: content };
        if (minSpec || maxSpec) {
          cap.constraint = { minSpec, maxSpec };
        }
        result.push(cap);
      }
    });
    return result;
  };

  const name = getMeta("name");
  const version = getMeta("version");

  if (!name) throw new Error("Missing required: agentlet:name");
  if (!version) throw new Error("Missing required: agentlet:version");

  // Extract actions with their attributes
  const actions: ExtractedManifest["actions"] = [];
  const actionMetas = doc.querySelectorAll('meta[name="agentlet:action"]');
  actionMetas.forEach((meta) => {
    const id = meta.getAttribute("content");
    if (id) {
      actions.push({
        id,
        label: meta.getAttribute("data-label") || undefined,
        description: meta.getAttribute("data-description") || undefined,
        confirm: meta.getAttribute("data-confirm") === "true",
        deprecated: meta.getAttribute("data-deprecated") === "true",
        deprecatedMessage: meta.getAttribute("data-deprecated-message") || undefined,
        removeIn: meta.getAttribute("data-remove-in") || undefined,
      });
    }
  });

  // Extract preferences
  const preferences: AgentPreferenceMeta[] = [];
  const prefMetas = doc.querySelectorAll('meta[name="agentlet:preference"]');
  prefMetas.forEach((meta) => {
    const key = meta.getAttribute("content");
    if (key) {
      const pref: AgentPreferenceMeta = {
        key,
        type: meta.getAttribute("data-type") || "string",
        label: meta.getAttribute("data-label") || key,
        default: meta.getAttribute("data-default"),
      };

      // Parse options for select type
      if (pref.type === "select") {
        pref.options = [];
        const optionMetas = doc.querySelectorAll(
          `meta[name="agentlet:preference:option"][content^="${key}:"]`
        );
        optionMetas.forEach((optMeta) => {
          const content = optMeta.getAttribute("content");
          if (content) {
            const value = content.replace(`${key}:`, "");
            pref.options!.push({
              value,
              label: optMeta.getAttribute("data-label") || value,
            });
          }
        });
      }

      preferences.push(pref);
    }
  });

  // Extract triggers
  const triggers: ExtractedManifest["triggers"] = [];
  const triggerMetas = doc.querySelectorAll('meta[name="agentlet:trigger"]');
  triggerMetas.forEach((meta) => {
    const event = meta.getAttribute("content");
    const action = meta.getAttribute("data-action");
    if (event && action) {
      const filterStr = meta.getAttribute("data-filter");
      triggers.push({
        event,
        action,
        filter: filterStr ? JSON.parse(filterStr) : undefined,
      });
    }
  });

  return {
    specVersion,
    name,
    version,
    description: getMeta("description"),
    author: getMeta("author"),
    license: getMeta("license"),
    homepage: getMeta("homepage"),
    icon: getMeta("icon"),
    portability: getMeta("portability") as ExtractedManifest["portability"],
    hosts: getMetaAll("host"),
    requires: getConstrainedCapabilities("requires"),
    optional: getConstrainedCapabilities("optional"),
    intents: getMetaAll("intent"),
    capabilities: getConstrainedCapabilities("capability"),
    actions,
    defaultAction: getMeta("default-action"),
    preferences: preferences.length > 0 ? preferences : undefined,
    triggers: triggers.length > 0 ? triggers : undefined,
  };
}

/**
 * Parse capabilities from manifest into structured form
 *
 * @param capabilities Array of capability objects or strings
 * @returns Object with parsed permissions
 */
export function parseCapabilities(capabilities: ConstrainedCapability[] | string[]): {
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
    // Support both string and ConstrainedCapability
    const capName = typeof cap === "string" ? cap : cap.name;

    if (capName === "inference" || capName.startsWith("inference:")) {
      result.inference = true;
    } else if (capName === "storage") {
      result.storage = true;
    } else if (capName.startsWith("network:")) {
      result.network.push(capName.replace("network:", ""));
    } else {
      // Treat as context capability
      result.context.push(capName);
    }
  }

  return result;
}

/**
 * Extract just the capability names from ConstrainedCapability array
 * Useful when you only need the names without version constraints
 *
 * @param capabilities Array of constrained capabilities
 * @returns Array of capability name strings
 */
export function getCapabilityNames(capabilities: ConstrainedCapability[]): string[] {
  return capabilities.map((c) => c.name);
}
