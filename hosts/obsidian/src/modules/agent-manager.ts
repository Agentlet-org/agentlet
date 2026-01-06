/**
 * AgentManager - Install, list, and manage agents
 *
 * Handles agent installation from URLs, storage, and lifecycle
 */

import { Plugin, requestUrl } from "obsidian";
import { extractManifest, getCapabilityNames } from "@agentlet/host-sdk";
import { ExtractedManifest, InstalledAgent, GrantedPermissions } from "../types/agentlet";

/**
 * Manages installed agents - installation, listing, removal
 */
export class AgentManager {
  private agents: Map<string, InstalledAgent> = new Map();
  private loaded = false;

  constructor(private plugin: Plugin) {}

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;

    const data = await this.plugin.loadData();
    const agents = data?.agents || {};
    for (const [id, agent] of Object.entries(agents)) {
      this.agents.set(id, agent as InstalledAgent);
    }
    this.loaded = true;
  }

  private async saveAgents(): Promise<void> {
    const data = (await this.plugin.loadData()) || {};
    data.agents = Object.fromEntries(this.agents);
    await this.plugin.saveData(data);
  }

  async installFromUrl(url: string): Promise<InstalledAgent> {
    // Fetch agent HTML
    const response = await requestUrl({ url });
    if (response.status !== 200) {
      throw new Error(`Failed to fetch agent: ${response.status}`);
    }
    const html = response.text;

    // Extract manifest
    const manifest = extractManifest(html);

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
      const hasObsidian = manifest.hosts?.some((h) => h.startsWith("obsidian"));
      if (!hasObsidian) {
        throw new Error(
          `This agent is designed for ${manifest.hosts?.join(", ") || "unknown host"}, not Obsidian`
        );
      }
    }

    if (manifest.portability === "host-family") {
      const hasObsidian = manifest.hosts?.some((h) => h.startsWith("obsidian"));
      if (!hasObsidian) {
        console.warn(
          "[Agentlet] Agent may have limited functionality in Obsidian (not in declared host family)"
        );
      }
    }

    // Adaptive agents should always work - they detect capabilities at runtime
  }

  // SDK-CANDIDATE: Permission computation logic might be reusable
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
    ];

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
        const uiPerm = cap.replace("ui:", "") as keyof NonNullable<GrantedPermissions["ui"]>;
        permissions.ui![uiPerm] = true;
      } else if (cap === "perceive" || cap === "act") {
        // Adaptive capabilities - grant context read by default
        if (!permissions.context!.includes("note:read")) {
          permissions.context!.push("note:read");
        }
      }
    }

    return permissions;
  }

  getAgent(id: string): InstalledAgent | undefined {
    return this.agents.get(id);
  }

  listAgents(): InstalledAgent[] {
    return Array.from(this.agents.values());
  }

  async uninstallAgent(id: string): Promise<void> {
    this.agents.delete(id);
    await this.saveAgents();
  }

  async updateAgent(id: string): Promise<InstalledAgent | null> {
    const existing = this.agents.get(id);
    if (!existing) return null;

    // Re-fetch from original URL
    const updated = await this.installFromUrl(existing.url);
    updated.installedAt = existing.installedAt;

    return updated;
  }
}
