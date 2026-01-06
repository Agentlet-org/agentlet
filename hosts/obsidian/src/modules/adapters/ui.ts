/**
 * Obsidian UI Handler - Implements UI dialogs and notifications
 *
 * HOST-SPECIFIC: Uses Obsidian's Modal, Notice, and Setting components
 */

import {
  App,
  Modal,
  Notice,
  Setting,
  ButtonComponent,
} from "obsidian";
import { IUIHandler } from "../../types/agentlet";

/**
 * UI handler implementation for Obsidian
 */
export class ObsidianUIHandler implements IUIHandler {
  private currentActivity: Notice | null = null;
  private panels: Map<string, Modal> = new Map();

  constructor(private app: App) {}

  async notify(message: string, type: string = "info"): Promise<void> {
    const duration =
      type === "error" ? 10000 : type === "warning" ? 7000 : 4000;
    new Notice(message, duration);
  }

  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = new ConfirmModal(this.app, message, resolve);
      modal.open();
    });
  }

  async prompt(
    message: string,
    defaultValue: string = ""
  ): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = new PromptModal(this.app, message, defaultValue, resolve);
      modal.open();
    });
  }

  async form(config: any): Promise<any> {
    return new Promise((resolve) => {
      const modal = new FormModal(this.app, config, resolve);
      modal.open();
    });
  }

  async select(config: any): Promise<any> {
    return new Promise((resolve) => {
      const modal = new SelectModal(this.app, config, resolve);
      modal.open();
    });
  }

  async panel(config: any): Promise<string> {
    const panelId = `panel-${Date.now()}`;
    const modal = new PanelModal(this.app, config);
    this.panels.set(panelId, modal);
    modal.open();
    return panelId;
  }

  async updatePanel(id: string, updates: any): Promise<void> {
    const modal = this.panels.get(id);
    if (modal instanceof PanelModal) {
      modal.updateContent(updates.content);
    }
  }

  async closePanel(id: string): Promise<void> {
    const modal = this.panels.get(id);
    if (modal) {
      modal.close();
      this.panels.delete(id);
    }
  }

  async activityStart(message: string): Promise<void> {
    if (this.currentActivity) {
      this.currentActivity.hide();
    }
    this.currentActivity = new Notice(message, 0); // 0 = persistent
  }

  async activityStep(message: string): Promise<void> {
    if (this.currentActivity) {
      this.currentActivity.setMessage(message);
    } else {
      this.currentActivity = new Notice(message, 0);
    }
  }

  async activityProgress(
    current: number,
    total: number,
    message?: string
  ): Promise<void> {
    const text = message || `Processing ${current}/${total}`;
    const percent = Math.round((current / total) * 100);
    const fullMessage = `${text} (${percent}%)`;

    if (this.currentActivity) {
      this.currentActivity.setMessage(fullMessage);
    } else {
      this.currentActivity = new Notice(fullMessage, 0);
    }
  }

  async activityLog(message: string, level?: string): Promise<void> {
    console.log(`[Agentlet ${level || "info"}]`, message);
  }

  async activityComplete(message: string): Promise<void> {
    if (this.currentActivity) {
      this.currentActivity.hide();
      this.currentActivity = null;
    }
    new Notice(`Done: ${message}`, 4000);
  }

  async activityError(message: string): Promise<void> {
    if (this.currentActivity) {
      this.currentActivity.hide();
      this.currentActivity = null;
    }
    new Notice(`Error: ${message}`, 10000);
  }
}

// Modal implementations

class ConfirmModal extends Modal {
  constructor(
    app: App,
    private message: string,
    private resolve: (value: boolean) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("agentlet-modal");

    contentEl.createEl("p", { text: this.message });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

    new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => {
      this.resolve(false);
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText("Confirm")
      .setCta()
      .onClick(() => {
        this.resolve(true);
        this.close();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

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
    contentEl.addClass("agentlet-modal");

    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl).addText((text) => {
      text.setValue(this.defaultValue);
      text.onChange((value) => (this.inputValue = value));
      text.inputEl.focus();
      text.inputEl.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.resolve(this.inputValue);
          this.close();
        }
      });
    });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

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

class FormModal extends Modal {
  private formData: Record<string, any> = {};

  constructor(
    app: App,
    private config: any,
    private resolve: (value: any) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("agentlet-modal");

    if (this.config.title) {
      contentEl.createEl("h3", { text: this.config.title });
    }

    for (const field of this.config.fields || []) {
      this.formData[field.id] = field.default || "";

      const setting = new Setting(contentEl).setName(field.label || field.id);

      if (field.description) {
        setting.setDesc(field.description);
      }

      switch (field.type) {
        case "text":
        case "string":
          setting.addText((text) => {
            text.setValue(field.default || "");
            text.setPlaceholder(field.placeholder || "");
            text.onChange((value) => (this.formData[field.id] = value));
          });
          break;

        case "textarea":
          setting.addTextArea((text) => {
            text.setValue(field.default || "");
            text.setPlaceholder(field.placeholder || "");
            text.onChange((value) => (this.formData[field.id] = value));
          });
          break;

        case "number":
          setting.addText((text) => {
            text.setValue(String(field.default || ""));
            text.inputEl.type = "number";
            text.onChange((value) => (this.formData[field.id] = Number(value)));
          });
          break;

        case "checkbox":
        case "boolean":
          setting.addToggle((toggle) => {
            toggle.setValue(field.default || false);
            toggle.onChange((value) => (this.formData[field.id] = value));
          });
          break;

        case "select":
          setting.addDropdown((dropdown) => {
            for (const opt of field.options || []) {
              dropdown.addOption(opt.value, opt.label);
            }
            dropdown.setValue(field.default || "");
            dropdown.onChange((value) => (this.formData[field.id] = value));
          });
          break;
      }
    }

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

    new ButtonComponent(buttonContainer).setButtonText("Cancel").onClick(() => {
      this.resolve(null);
      this.close();
    });

    new ButtonComponent(buttonContainer)
      .setButtonText(this.config.submitLabel || "Submit")
      .setCta()
      .onClick(() => {
        this.resolve(this.formData);
        this.close();
      });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class SelectModal extends Modal {
  private selected: Set<string> = new Set();

  constructor(
    app: App,
    private config: any,
    private resolve: (value: any) => void
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("agentlet-modal");

    if (this.config.title) {
      contentEl.createEl("h3", { text: this.config.title });
    }

    const list = contentEl.createDiv({ cls: "agentlet-select-list" });

    for (const item of this.config.items || []) {
      const itemEl = list.createDiv({ cls: "agentlet-select-item" });

      if (this.config.multiple) {
        const checkbox = itemEl.createEl("input", { type: "checkbox" });
        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            this.selected.add(item.id);
          } else {
            this.selected.delete(item.id);
          }
        });
      }

      itemEl.createSpan({ text: item.label || item.id });

      if (!this.config.multiple) {
        itemEl.addEventListener("click", () => {
          this.resolve(item);
          this.close();
        });
      }
    }

    if (this.config.multiple) {
      const buttonContainer = contentEl.createDiv({
        cls: "modal-button-container",
      });

      new ButtonComponent(buttonContainer)
        .setButtonText("Cancel")
        .onClick(() => {
          this.resolve(null);
          this.close();
        });

      new ButtonComponent(buttonContainer)
        .setButtonText("Select")
        .setCta()
        .onClick(() => {
          const items = (this.config.items || []).filter((i: any) =>
            this.selected.has(i.id)
          );
          this.resolve(items);
          this.close();
        });
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

class PanelModal extends Modal {
  private contentContainer: HTMLElement | null = null;

  constructor(app: App, private config: any) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("agentlet-panel");

    if (this.config.title) {
      contentEl.createEl("h3", { text: this.config.title });
    }

    this.contentContainer = contentEl.createDiv({ cls: "agentlet-panel-content" });

    if (this.config.content) {
      // Use textContent for safety - HTML content would need sanitization
      this.contentContainer.textContent = this.config.content;
    }
  }

  updateContent(content: string) {
    if (this.contentContainer) {
      // Use textContent for safety - HTML content would need sanitization
      this.contentContainer.textContent = content;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
