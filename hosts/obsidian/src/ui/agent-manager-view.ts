/**
 * AgentManagerView - Sidebar view for managing agents
 *
 * Lists installed agents and provides UI for installing/running/removing
 */

import { ItemView, WorkspaceLeaf, ButtonComponent, Modal, App } from "obsidian";
import type AgentletPlugin from "../main";
import type { InstalledAgent } from "../types/agentlet";
import { getCapabilityNames } from "@agentlet/host-sdk";

export const VIEW_TYPE_AGENT_MANAGER = "agentlet-manager";

/**
 * Sidebar view showing installed agents
 */
export class AgentManagerView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private plugin: AgentletPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_AGENT_MANAGER;
  }

  getDisplayText(): string {
    return "Agentlet";
  }

  getIcon(): string {
    return "bot";
  }

  async onOpen() {
    await this.render();
  }

  async refresh() {
    await this.render();
  }

  private async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("agentlet-view");

    // Header
    const header = container.createDiv({ cls: "agentlet-header" });
    header.createEl("h4", { text: "Agentlets" });

    new ButtonComponent(header)
      .setIcon("plus")
      .setTooltip("Install agent")
      .onClick(() => this.plugin.promptInstallAgent());

    // Agent list
    const agents = this.plugin.agentManager.listAgents();

    if (agents.length === 0) {
      const empty = container.createDiv({ cls: "agentlet-empty" });
      empty.createEl("p", { text: "No agents installed" });
      empty.createEl("p", {
        text: "Click + to install an agent from URL",
        cls: "agentlet-hint",
      });
      return;
    }

    const list = container.createDiv({ cls: "agentlet-list" });

    for (const agent of agents) {
      const item = list.createDiv({ cls: "agentlet-item" });

      // Agent info
      const info = item.createDiv({ cls: "agentlet-info" });
      info.createEl("span", {
        text: agent.manifest.name,
        cls: "agentlet-name",
      });

      if (agent.manifest.description) {
        info.createEl("span", {
          text: agent.manifest.description,
          cls: "agentlet-description",
        });
      }

      // Portability badge
      if (agent.manifest.portability) {
        info.createEl("span", {
          text: agent.manifest.portability,
          cls: `agentlet-badge agentlet-badge-${agent.manifest.portability}`,
        });
      }

      // Actions
      const actions = item.createDiv({ cls: "agentlet-actions" });

      for (const action of agent.manifest.actions) {
        new ButtonComponent(actions)
          .setButtonText(action.label || action.id)
          .onClick(() => this.plugin.executeAgentAction(agent.id, action.id));
      }

      // View source button
      new ButtonComponent(actions)
        .setIcon("code")
        .setTooltip("View source")
        .onClick(() => {
          new SourceCodeModal(this.app, agent).open();
        });

      // Remove button
      new ButtonComponent(actions)
        .setIcon("trash")
        .setTooltip("Remove agent")
        .onClick(async () => {
          await this.plugin.agentManager.uninstallAgent(agent.id);
          this.refresh();
        });
    }
  }

  async onClose() {
    // Cleanup
  }
}

/**
 * Modal for viewing agent source code
 */
class SourceCodeModal extends Modal {
  constructor(app: App, private agent: InstalledAgent) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("agentlet-source-modal");

    // Header with agent info
    const header = contentEl.createDiv({ cls: "agentlet-source-header" });
    header.createEl("h3", { text: this.agent.manifest.name });

    const meta = header.createDiv({ cls: "agentlet-source-meta" });
    meta.createEl("span", { text: `v${this.agent.manifest.version}` });
    if (this.agent.manifest.author) {
      meta.createEl("span", { text: ` by ${this.agent.manifest.author}` });
    }
    if (this.agent.url) {
      meta.createEl("br");
      const link = meta.createEl("a", {
        text: this.agent.url,
        href: this.agent.url,
        cls: "agentlet-source-url"
      });
      link.setAttr("target", "_blank");
    }

    // Permissions summary
    const perms = contentEl.createDiv({ cls: "agentlet-source-permissions" });
    perms.createEl("h4", { text: "Permissions" });
    const permList = perms.createEl("ul");

    const caps = [
      ...getCapabilityNames(this.agent.manifest.capabilities || []),
      ...getCapabilityNames(this.agent.manifest.requires || []),
    ];

    if (caps.length === 0) {
      permList.createEl("li", { text: "None requested" });
    } else {
      for (const cap of caps) {
        permList.createEl("li", { text: cap });
      }
    }

    // Source code
    const sourceSection = contentEl.createDiv({ cls: "agentlet-source-code" });
    sourceSection.createEl("h4", { text: "Source Code" });

    const pre = sourceSection.createEl("pre");
    const code = pre.createEl("code");
    code.textContent = this.agent.html;
  }

  onClose() {
    this.contentEl.empty();
  }
}
