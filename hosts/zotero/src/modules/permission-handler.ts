/**
 * Permission Handler - Manages agent permissions
 *
 * Parses manifest capabilities, shows permission dialogs,
 * and stores granted permissions.
 *
 * SDK-CANDIDATE: 90% reusable
 * - ParsedPermissions interface: 100% reusable
 * - Permission parsing logic: 90% reusable
 * - HOST-SPECIFIC: Zotero dialog UI, localization
 */

import logger from "../utils/logger";
import { getString } from "../utils/locale";

export interface ParsedPermissions {
  context: string[];
  network: string[];
  inference: string | boolean;
  storage: boolean;
  ui: {
    notify: boolean;
    confirm: boolean;
    prompt: boolean;
    form: boolean;
    panel: boolean;
  };
}

export interface PermissionRequest {
  category: string;
  permission: string;
  description: string;
  granted: boolean;
}

/**
 * Parse capabilities from agent manifest into permissions structure
 */
export function parseCapabilities(
  capabilities: Agentlet.ManifestCapabilities | undefined
): ParsedPermissions {
  const caps = capabilities || {};

  return {
    context: caps.context || [],
    network: caps.network || [],
    inference: caps.inference || false,
    storage: caps.storage !== false, // Default to true
    ui: {
      notify: true, // Always granted
      confirm: caps.ui?.confirm || false,
      prompt: caps.ui?.prompt || false,
      form: caps.ui?.form || false,
      panel: caps.ui?.panel || false,
    },
  };
}

/**
 * Build a list of permission requests for display
 */
export function buildPermissionRequests(
  manifest: Agentlet.Manifest
): PermissionRequest[] {
  const caps = manifest.capabilities || {};
  const requests: PermissionRequest[] = [];

  // Context permissions
  if (caps.context?.length) {
    for (const perm of caps.context) {
      const [type, access] = perm.split(":");
      requests.push({
        category: "Data Access",
        permission: perm,
        description: getContextPermissionDescription(type, access),
        granted: false,
      });
    }
  }

  // Network permissions
  if (caps.network?.length) {
    for (const domain of caps.network) {
      requests.push({
        category: "Network",
        permission: `network:${domain}`,
        description: `Access to ${domain}`,
        granted: false,
      });
    }
  }

  // Inference permission
  if (caps.inference) {
    const level =
      typeof caps.inference === "string" ? caps.inference : "basic";
    requests.push({
      category: "AI Inference",
      permission: `inference:${level}`,
      description: getInferencePermissionDescription(level),
      granted: false,
    });
  }

  // Storage permission
  if (caps.storage !== false) {
    requests.push({
      category: "Storage",
      permission: "storage",
      description: "Store data locally between runs",
      granted: false,
    });
  }

  // UI permissions
  if (caps.ui) {
    if (caps.ui.confirm) {
      requests.push({
        category: "UI",
        permission: "ui:confirm",
        description: "Show confirmation dialogs",
        granted: false,
      });
    }
    if (caps.ui.prompt) {
      requests.push({
        category: "UI",
        permission: "ui:prompt",
        description: "Ask for text input",
        granted: false,
      });
    }
    if (caps.ui.form) {
      requests.push({
        category: "UI",
        permission: "ui:form",
        description: "Display custom forms",
        granted: false,
      });
    }
    if (caps.ui.panel) {
      requests.push({
        category: "UI",
        permission: "ui:panel",
        description: "Create side panels",
        granted: false,
      });
    }
  }

  return requests;
}

/**
 * Get human-readable description for context permissions
 */
function getContextPermissionDescription(
  type: string,
  access: string
): string {
  const typeNames: Record<string, string> = {
    bibliographic: "library items",
    collection: "collections",
    selection: "selected items",
    files: "attachment files",
    "*": "all data",
  };

  const accessNames: Record<string, string> = {
    read: "Read",
    write: "Read and modify",
  };

  const typeName = typeNames[type] || type;
  const accessName = accessNames[access] || access;

  return `${accessName} ${typeName}`;
}

/**
 * Get human-readable description for inference permissions
 */
function getInferencePermissionDescription(level: string): string {
  const descriptions: Record<string, string> = {
    basic: "Run AI prompts (basic)",
    streaming: "Run AI prompts with streaming output",
    conversation: "Run multi-turn AI conversations",
    tools: "Run AI with tool calling",
  };

  return descriptions[level] || `AI inference (${level})`;
}

/**
 * Show permission dialog and get user approval
 */
export async function showPermissionDialog(
  manifest: Agentlet.Manifest
): Promise<ParsedPermissions | null> {
  const requests = buildPermissionRequests(manifest);

  if (requests.length === 0) {
    // No special permissions needed
    return parseCapabilities(manifest.capabilities);
  }

  // Build permission summary
  const categories = new Map<string, string[]>();
  for (const req of requests) {
    if (!categories.has(req.category)) {
      categories.set(req.category, []);
    }
    categories.get(req.category)!.push(req.description);
  }

  // Format message
  let message = `The agent "${manifest.name}" is requesting the following permissions:\n\n`;

  for (const [category, perms] of categories) {
    message += `${category}:\n`;
    for (const perm of perms) {
      message += `  • ${perm}\n`;
    }
    message += "\n";
  }

  message += "Do you want to allow these permissions?";

  // Show confirmation dialog
  const ps = Services.prompt;
  const result = ps.confirmEx(
    null,
    "ZotAgentlet - Permission Request",
    message,
    ps.BUTTON_POS_0 * ps.BUTTON_TITLE_IS_STRING +
      ps.BUTTON_POS_1 * ps.BUTTON_TITLE_CANCEL,
    "Allow",
    null,
    null,
    null,
    {}
  );

  if (result === 0) {
    // User approved
    logger.info(`Permissions granted for agent: ${manifest.name}`);
    return parseCapabilities(manifest.capabilities);
  } else {
    // User denied
    logger.info(`Permissions denied for agent: ${manifest.name}`);
    return null;
  }
}

/**
 * Check if a specific permission is granted
 */
export function hasPermission(
  permissions: ParsedPermissions,
  type: string,
  action?: string
): boolean {
  switch (type) {
    case "context":
      if (!action) return permissions.context.length > 0;
      return permissions.context.some((p) => {
        const [pType, pAccess] = p.split(":");
        const [reqType, reqAccess] = action.split(":");
        // Check type matches (or wildcard)
        if (pType !== reqType && pType !== "*") return false;
        // Check access level (write includes read)
        if (reqAccess === "read") return pAccess === "read" || pAccess === "write";
        if (reqAccess === "write") return pAccess === "write";
        return true;
      });

    case "network":
      if (!action) return permissions.network.length > 0;
      return permissions.network.some(
        (domain) => action.includes(domain) || domain === "*"
      );

    case "inference":
      return !!permissions.inference;

    case "storage":
      return permissions.storage;

    case "ui":
      if (!action) return true; // notify is always allowed
      const uiPerm = action.replace("ui:", "") as keyof typeof permissions.ui;
      return permissions.ui[uiPerm] || false;

    default:
      return false;
  }
}

/**
 * Serialize permissions for storage
 */
export function serializePermissions(permissions: ParsedPermissions): string {
  return JSON.stringify(permissions);
}

/**
 * Deserialize permissions from storage
 */
export function deserializePermissions(json: string): ParsedPermissions {
  try {
    return JSON.parse(json);
  } catch {
    // Return minimal permissions on parse error
    return {
      context: [],
      network: [],
      inference: false,
      storage: false,
      ui: {
        notify: true,
        confirm: false,
        prompt: false,
        form: false,
        panel: false,
      },
    };
  }
}
