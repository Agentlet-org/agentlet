/**
 * AgentManager - Install, list, and manage agents
 *
 * Handles agent installation from URLs, storage, and lifecycle
 */

import * as vscode from "vscode";
import { extractManifest, getCapabilityNames } from "@agentlet/host-sdk";
import type {
  ExtractedManifest,
  InstalledAgent,
  GrantedPermissions,
} from "../types/agentlet";

/**
 * Storage key for installed agents
 */
const AGENTS_STORAGE_KEY = "agentlet.installedAgents";

/**
 * Manages installed agents - installation, listing, removal
 */
export class AgentManager {
  private agents: Map<string, InstalledAgent> = new Map();
  private loaded = false;
  private onChangeCallbacks: Array<() => void> = [];

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Register a callback to be called when agents change
   */
  onChange(callback: () => void): vscode.Disposable {
    this.onChangeCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const index = this.onChangeCallbacks.indexOf(callback);
      if (index >= 0) {
        this.onChangeCallbacks.splice(index, 1);
      }
    });
  }

  private notifyChange(): void {
    for (const callback of this.onChangeCallbacks) {
      callback();
    }
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const agents = this.context.globalState.get<Record<string, InstalledAgent>>(
      AGENTS_STORAGE_KEY,
      {}
    );

    for (const [id, agent] of Object.entries(agents)) {
      this.agents.set(id, agent);
    }
    this.loaded = true;
  }

  private async saveAgents(): Promise<void> {
    await this.context.globalState.update(
      AGENTS_STORAGE_KEY,
      Object.fromEntries(this.agents)
    );
    this.notifyChange();
  }

  /**
   * Install an agent from a URL or local file path
   */
  async installFromUrl(url: string): Promise<InstalledAgent> {
    console.log("[Agentlet] Installing agent from URL:", url);

    let html: string;

    // Handle local file paths
    if (url.startsWith("file://") || url.startsWith("/")) {
      const filePath = url.startsWith("file://")
        ? vscode.Uri.parse(url).fsPath
        : url;
      console.log("[Agentlet] Reading local file:", filePath);
      const fileUri = vscode.Uri.file(filePath);
      const fileContent = await vscode.workspace.fs.readFile(fileUri);
      html = new TextDecoder().decode(fileContent);
    } else {
      // Fetch agent HTML from URL
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.status}`);
      }
      html = await response.text();
    }
    console.log("[Agentlet] Fetched HTML, length:", html.length);

    // Extract manifest
    const manifest = extractManifest(html);
    console.log("[Agentlet] Extracted manifest:", JSON.stringify(manifest, null, 2));

    // Check compatibility
    this.checkCompatibility(manifest);

    // Create agent record
    const agent: InstalledAgent = {
      id: manifest.name,
      url,
      manifest,
      html,
      permissions: this.computePermissions(manifest),
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.agents.set(agent.id, agent);
    await this.saveAgents();

    return agent;
  }

  private checkCompatibility(manifest: ExtractedManifest): void {
    if (manifest.portability === "host-specific") {
      const hasVSCode = manifest.hosts?.some(
        (h) => h.startsWith("vscode") || h.startsWith("cursor")
      );
      if (!hasVSCode) {
        throw new Error(
          `This agent is designed for ${manifest.hosts?.join(", ") || "unknown host"}, not VS Code`
        );
      }
    }

    if (manifest.portability === "host-family") {
      const hasVSCode = manifest.hosts?.some(
        (h) => h.startsWith("vscode") || h.startsWith("cursor")
      );
      if (!hasVSCode) {
        console.warn(
          "[Agentlet] Agent may have limited functionality in VS Code (not in declared host family)"
        );
      }
    }

    // Adaptive and universal agents should always work
  }

  /**
   * Compute permissions from manifest capabilities
   */
  private computePermissions(manifest: ExtractedManifest): GrantedPermissions {
    const permissions: GrantedPermissions = {
      context: [],
      network: [],
      inference: false,
      storage: false,
      ui: {},
    };

    // Extract capability names from ConstrainedCapability arrays
    const allCapabilities = [
      ...getCapabilityNames(manifest.capabilities || []),
      ...getCapabilityNames(manifest.requires || []),
      ...getCapabilityNames(manifest.optional || []),
    ];

    console.log("[Agentlet] Computing permissions from capabilities:", allCapabilities);

    for (const cap of allCapabilities) {
      if (cap.startsWith("context:")) {
        permissions.context!.push(cap.replace("context:", ""));
      } else if (cap.startsWith("network:")) {
        permissions.network!.push(cap.replace("network:", ""));
      } else if (cap.startsWith("inference")) {
        permissions.inference = cap;
      } else if (cap === "storage") {
        permissions.storage = true;
      } else if (cap.startsWith("ui:")) {
        const uiPerm = cap.replace("ui:", "") as keyof NonNullable<
          GrantedPermissions["ui"]
        >;
        permissions.ui![uiPerm] = true;
        console.log(`[Agentlet] Granted UI permission: ${uiPerm}`);
      } else if (cap === "perceive" || cap === "act") {
        // Adaptive capabilities - grant context read by default
        if (!permissions.context!.includes("file:read")) {
          permissions.context!.push("file:read");
        }
      }
    }

    console.log("[Agentlet] Final permissions:", JSON.stringify(permissions, null, 2));
    return permissions;
  }

  /**
   * Get an agent by ID
   */
  getAgent(id: string): InstalledAgent | undefined {
    return this.agents.get(id);
  }

  /**
   * List all installed agents
   */
  listAgents(): InstalledAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Uninstall an agent
   */
  async uninstallAgent(id: string): Promise<void> {
    this.agents.delete(id);
    await this.saveAgents();
  }

  /**
   * Update an agent from its original URL
   */
  async updateAgent(id: string): Promise<InstalledAgent | null> {
    const existing = this.agents.get(id);
    if (!existing) return null;

    // Re-fetch from original URL
    const updated = await this.installFromUrl(existing.url);
    updated.installedAt = existing.installedAt;

    return updated;
  }
}
