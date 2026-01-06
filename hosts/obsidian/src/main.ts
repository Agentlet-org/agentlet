/**
 * Obsidian Agentlet Plugin - Main entry point
 *
 * Implements the Agentlet v0.1 specification for Obsidian,
 * enabling portable AI agents to run within the vault.
 */

import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  ButtonComponent,
  TextComponent,
} from "obsidian";
import { AgentManager } from "./modules/agent-manager";
import { AgentRuntime } from "./modules/agent-runtime";
import { ObsidianStorageAdapter } from "./modules/adapters/storage";
import { ObsidianInferenceProvider } from "./modules/adapters/inference";
import { AgentManagerView, VIEW_TYPE_AGENT_MANAGER } from "./ui/agent-manager-view";
import { InferenceSettings } from "./types/agentlet";

interface AgentletSettings extends InferenceSettings {
  // Additional plugin settings can be added here
}

const DEFAULT_SETTINGS: AgentletSettings = {
  ollamaUrl: "http://localhost:11434",
  ollamaModel: "llama2",
  openaiKey: "",
  openaiModel: "gpt-4",
};

export default class AgentletPlugin extends Plugin {
  settings: AgentletSettings = DEFAULT_SETTINGS;
  agentManager: AgentManager = null!;
  storageAdapter: ObsidianStorageAdapter = null!;
  inferenceProvider: ObsidianInferenceProvider = null!;

  async onload() {
    await this.loadSettings();

    // Initialize components
    this.agentManager = new AgentManager(this);
    this.storageAdapter = new ObsidianStorageAdapter(this);
    this.inferenceProvider = new ObsidianInferenceProvider(this.settings);

    // Load agents
    await this.agentManager.ensureLoaded();

    // Register view
    this.registerView(
      VIEW_TYPE_AGENT_MANAGER,
      (leaf) => new AgentManagerView(leaf, this)
    );

    // Add ribbon icon
    this.addRibbonIcon("bot", "Agentlet", () => {
      this.activateView();
    });

    // Add commands
    this.addCommand({
      id: "open-agent-manager",
      name: "Open Agent Manager",
      callback: () => this.activateView(),
    });

    this.addCommand({
      id: "install-agent",
      name: "Install Agent from URL",
      callback: () => this.promptInstallAgent(),
    });

    // Register agent action commands
    this.registerAgentCommands();

    // Add settings tab
    this.addSettingTab(new AgentletSettingTab(this.app, this));

    console.log("[Agentlet] Plugin loaded");
  }

  onunload() {
    console.log("[Agentlet] Plugin unloaded");
  }

  async activateView() {
    const { workspace } = this.app;

    let leaf = workspace.getLeavesOfType(VIEW_TYPE_AGENT_MANAGER)[0];

    if (!leaf) {
      const rightLeaf = workspace.getRightLeaf(false);
      if (rightLeaf) {
        leaf = rightLeaf;
        await leaf.setViewState({
          type: VIEW_TYPE_AGENT_MANAGER,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async promptInstallAgent() {
    const url = await this.showPrompt("Enter agent URL:");
    if (url) {
      await this.installAgent(url);
    }
  }

  async installAgent(url: string) {
    try {
      new Notice("Installing agent...");
      const agent = await this.agentManager.installFromUrl(url);
      new Notice(`Installed: ${agent.manifest.name}`);
      this.registerAgentCommands();

      // Refresh view if open
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_MANAGER);
      for (const leaf of leaves) {
        if (leaf.view instanceof AgentManagerView) {
          leaf.view.refresh();
        }
      }
    } catch (error: any) {
      new Notice(`Failed to install: ${error.message}`);
      console.error("[Agentlet] Install error:", error);
    }
  }

  registerAgentCommands() {
    // Register a command for each agent action
    for (const agent of this.agentManager.listAgents()) {
      for (const action of agent.manifest.actions) {
        const commandId = `agent-${agent.id}-${action.id}`;

        // Check if command already exists
        const existingCommand = (this.app as any).commands.commands[
          `${this.manifest.id}:${commandId}`
        ];
        if (existingCommand) continue;

        this.addCommand({
          id: commandId,
          name: `${agent.manifest.name}: ${action.label || action.id}`,
          callback: () => this.executeAgentAction(agent.id, action.id),
        });
      }
    }
  }

  async executeAgentAction(agentId: string, actionId: string) {
    const agent = this.agentManager.getAgent(agentId);
    if (!agent) {
      new Notice("Agent not found");
      return;
    }

    const runtime = new AgentRuntime(
      this.app,
      agent,
      this.storageAdapter,
      this.inferenceProvider
    );

    try {
      await runtime.executeAction(actionId);
    } catch (error: any) {
      new Notice(`Error: ${error.message}`);
      console.error("[Agentlet] Action error:", error);
    }
  }

  async showPrompt(message: string): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new PromptModal(this.app, message, "", resolve);
      modal.open();
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.inferenceProvider = new ObsidianInferenceProvider(this.settings);
  }
}

// Simple prompt modal
class PromptModal extends Modal {
  private inputValue: string;

  constructor(
    app: App,
    private message: string,
    private defaultValue: string,
    private resolve: (value: string | null) => void
  ) {
    super(app);
    this.inputValue = defaultValue;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("p", { text: this.message });

    const input = new TextComponent(contentEl);
    input.setValue(this.defaultValue);
    input.onChange((value) => (this.inputValue = value));
    input.inputEl.style.width = "100%";
    input.inputEl.focus();
    input.inputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.resolve(this.inputValue);
        this.close();
      }
    });

    const buttonContainer = contentEl.createDiv({ cls: "modal-button-container" });

    new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => {
      this.resolve(null);
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText("OK")
      .setCta()
      .onClick(() => {
        this.resolve(this.inputValue);
        this.close();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Settings tab
class AgentletSettingTab extends PluginSettingTab {
  plugin: AgentletPlugin;

  constructor(app: App, plugin: AgentletPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Agentlet Settings" });

    containerEl.createEl("h3", { text: "Inference Providers" });
    containerEl.createEl("p", {
      text: "Configure AI providers for agent inference. Ollama is tried first (local/private), then OpenAI.",
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName("Ollama URL")
      .setDesc("URL for local Ollama server (e.g., http://localhost:11434)")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:11434")
          .setValue(this.plugin.settings.ollamaUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Ollama Model")
      .setDesc("Model to use for Ollama inference")
      .addText((text) =>
        text
          .setPlaceholder("llama2")
          .setValue(this.plugin.settings.ollamaModel)
          .onChange(async (value) => {
            this.plugin.settings.ollamaModel = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("API key for OpenAI (fallback if Ollama unavailable)")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.openaiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiKey = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OpenAI Model")
      .setDesc("Model to use for OpenAI inference")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("gpt-4", "GPT-4")
          .addOption("gpt-4-turbo", "GPT-4 Turbo")
          .addOption("gpt-3.5-turbo", "GPT-3.5 Turbo")
          .setValue(this.plugin.settings.openaiModel)
          .onChange(async (value) => {
            this.plugin.settings.openaiModel = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
