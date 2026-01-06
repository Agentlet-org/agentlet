/**
 * Agent Manager - Handles agent installation, uninstallation, and listing
 * Implements the Agentlet v0.5 specification
 *
 * SDK-CANDIDATE: 50% reusable
 * - InstalledAgent interface: 90% reusable
 * - Install/uninstall flow: 80% reusable
 * - HOST-SPECIFIC: SQLite storage, Zotero.DB queries
 */

import logger, { ztLog } from "../utils/logger";
import {
  showPermissionDialog,
  serializePermissions,
  deserializePermissions,
  ParsedPermissions,
} from "./permission-handler";
import {
  fetchAgentHtml,
  extractManifestFromHtml,
  parseManifestCapabilities,
  ExtractedManifest,
} from "./iframe-sandbox";

declare const Zotero: any;

export interface InstalledAgent {
  id: string;
  url: string;
  manifest: Agentlet.Manifest;
  /** Original HTML content of the agent */
  agentHtml: string;
  /** Extracted manifest from HTML */
  extractedManifest: ExtractedManifest;
  permissions: ParsedPermissions;
  installedAt: string;
  updatedAt: string;
}

export class AgentManager {
  /**
   * Load installed agents from database
   */
  static async loadInstalledAgents(): Promise<void> {
    try {
      const db = addon.data.db;
      if (!db) {
        logger.warn("Database not initialized, skipping agent load");
        return;
      }

      const rows = await Zotero.DB.queryAsync(
        "SELECT * FROM zotagentlet.agents"
      );

      for (const row of rows) {
        const agent: InstalledAgent = {
          id: row.id,
          url: row.url,
          manifest: JSON.parse(row.manifest),
          agentHtml: row.agent_html || "",
          extractedManifest: row.extracted_manifest ? JSON.parse(row.extracted_manifest) : null,
          permissions: deserializePermissions(row.permissions || "{}"),
          installedAt: row.installed_at,
          updatedAt: row.updated_at,
        };
        addon.data.agents.installed.set(agent.id, agent);
      }

      logger.info(`Loaded ${addon.data.agents.installed.size} agents\n`);
    } catch (error) {
      logger.error("Failed to load agents:", error);
    }
  }

  /**
   * Install an agent from URL
   * URL must point to a .agent file (Agentlet v0.5 format)
   */
  static async install(url: string): Promise<InstalledAgent> {
    ztLog(`[ZotAgentlet] Installing agent from: ${url}\n`);

    // Fetch agent HTML
    const agentHtml = await fetchAgentHtml(url);

    // Extract manifest from HTML (safe, no code execution)
    const extractedManifest = extractManifestFromHtml(agentHtml);
    ztLog(`[ZotAgentlet] Extracted manifest: ${extractedManifest.name} v${extractedManifest.version}\n`);

    // Convert to internal manifest format
    const manifest = this._buildManifest(extractedManifest);

    // Validate
    this._validateManifest(manifest);
    ztLog(`[ZotAgentlet] Manifest validated\n`);

    // Check for existing agent
    if (addon.data.agents.installed.has(extractedManifest.name)) {
      throw new Error(`Agent "${extractedManifest.name}" is already installed\n`);
    }

    // Show permission dialog
    ztLog(`[ZotAgentlet] Showing permission dialog...\n`);
    const permissions = await showPermissionDialog(manifest);
    if (!permissions) {
      throw new Error("Permission denied by user");
    }
    ztLog(`[ZotAgentlet] Permissions granted\n`);

    // Create agent record
    const agent: InstalledAgent = {
      id: extractedManifest.name,
      url,
      manifest,
      agentHtml,
      extractedManifest,
      permissions,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to database
    await Zotero.DB.queryAsync(
      `INSERT INTO zotagentlet.agents (id, url, manifest, agent_html, extracted_manifest, permissions, installed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        agent.id,
        agent.url,
        JSON.stringify(manifest),
        agentHtml,
        JSON.stringify(extractedManifest),
        serializePermissions(permissions),
        agent.installedAt,
        agent.updatedAt,
      ]
    );

    // Add to memory
    addon.data.agents.installed.set(agent.id, agent);

    logger.info(`Agent "${extractedManifest.name}" installed successfully\n`);
    return agent;
  }

  /**
   * Build internal manifest from extracted manifest
   */
  private static _buildManifest(extracted: ExtractedManifest): Agentlet.Manifest {
    // Parse capabilities from requires + capabilities arrays
    ztLog(`[ZotAgentlet] Install - Building manifest from extracted: ${JSON.stringify(extracted)}\n`);
    const capabilities = parseManifestCapabilities(extracted);
    ztLog(`[ZotAgentlet] Install - Parsed capabilities: ${JSON.stringify(capabilities)}\n`);

    // Convert actions array to object
    const actions: Record<string, any> = {};
    for (const action of extracted.actions) {
      actions[action.id] = {
        label: action.label || action.id,
        description: action.description,
        confirm: action.confirm,
        input: action.input,
      };
    }

    const manifest = {
      manifest_version: extracted.specVersion,
      name: extracted.name,
      version: extracted.version,
      description: extracted.description || "",
      author: extracted.author,
      license: extracted.license,
      homepage: extracted.homepage,
      capabilities,
      actions,
      default_action: extracted.defaultAction,
    };

    ztLog(`[ZotAgentlet] Install - Built manifest: ${JSON.stringify(manifest)}\n`);

    return manifest;
  }

  /**
   * Uninstall an agent
   */
  static async uninstall(id: string): Promise<void> {
    logger.info(`Uninstalling agent: ${id}\n`);

    const agent = addon.data.agents.installed.get(id);
    if (!agent) {
      throw new Error(`Agent "${id}" not found\n`);
    }

    // Remove from database
    await Zotero.DB.queryAsync("DELETE FROM zotagentlet.agents WHERE id = ?", [
      id,
    ]);

    // Remove agent storage
    await Zotero.DB.queryAsync(
      "DELETE FROM zotagentlet.agent_storage WHERE agent_id = ?",
      [id]
    );

    // Remove from memory
    addon.data.agents.installed.delete(id);

    logger.info(`Agent "${id}" uninstalled successfully\n`);
  }

  /**
   * Get an installed agent
   */
  static get(id: string): InstalledAgent | undefined {
    return addon.data.agents.installed.get(id);
  }

  /**
   * List all installed agents
   */
  static list(): InstalledAgent[] {
    return Array.from(addon.data.agents.installed.values());
  }

  /**
   * Validate manifest schema
   */
  private static _validateManifest(manifest: any): void {
    if (!manifest.manifest_version) {
      throw new Error("Missing manifest_version");
    }
    if (!manifest.name) {
      throw new Error("Missing name");
    }
    if (!manifest.version) {
      throw new Error("Missing version");
    }
    if (!manifest.capabilities) {
      throw new Error("Missing capabilities");
    }
    if (!manifest.actions || Object.keys(manifest.actions).length === 0) {
      throw new Error("Missing actions");
    }
  }
}
