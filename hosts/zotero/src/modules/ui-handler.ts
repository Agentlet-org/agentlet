/**
 * UI Handler - Handles agent UI requests in Zotero
 *
 * Implements the Agentlet UI API for notifications, dialogs, forms, and panels.
 *
 * HOST-SPECIFIC: 0% reusable
 * - All UI implementations use Zotero-specific APIs
 * - Interface (IUIHandler) is reusable, implementation is not
 */

import logger from "../utils/logger";
import { getString } from "../utils/locale";
import { IUIHandler } from "./bridge-handler";

export interface FormField {
  id: string;
  type: "text" | "textarea" | "number" | "checkbox" | "select" | "password";
  label: string;
  value?: any;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
}

export interface FormConfig {
  title: string;
  fields: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
}

export interface SelectConfig {
  title: string;
  items: Array<{ id: string; label: string; description?: string }>;
  multiple?: boolean;
  searchable?: boolean;
}

export interface PanelConfig {
  id?: string;
  title: string;
  content?: string;
  width?: number;
  height?: number;
  onMessage?: (message: any) => void;
}

export interface ActivityState {
  running: boolean;
  message: string;
  currentStep: number;
  totalSteps: number;
  logs: Array<{ timestamp: number; message: string; level: string }>;
}

// Declare Zotero global
declare const Zotero: any;
declare const addon: any;

/**
 * UIHandler implements the IUIHandler interface for Zotero
 */
export class UIHandler implements IUIHandler {
  private panels = new Map<string, any>();
  private panelWindows = new Map<string, any>();
  private panelMessageCallbacks = new Map<string, (message: any) => void>();
  private globalPanelMessageForwarder: ((message: any) => void) | null = null;
  private activityState: ActivityState = {
    running: false,
    message: "",
    currentStep: 0,
    totalSteps: 0,
    logs: [],
  };
  private activityPanel: any = null;
  private panelCounter = 0;

  /**
   * Show a notification to the user
   */
  async notify(message: string, type: string = "info"): Promise<void> {
    logger.info(`[UI Notify] ${type}: ${message}`);

    const pw = new Zotero.ProgressWindow({ closeOnClick: true });
    pw.changeHeadline("ZotAgentlet");

    // Set icon based on type
    const iconPath = this._getIconForType(type);
    if (iconPath) {
      pw.addLines([{ type: "default", icon: iconPath, text: message }]);
    } else {
      pw.addDescription(message);
    }

    pw.show();
    pw.startCloseTimer(type === "error" ? 8000 : 4000);
  }

  /**
   * Show a confirmation dialog
   */
  async confirm(message: string): Promise<boolean> {
    logger.debug(`[UI Confirm] ${message}`);

    const ps = Services.prompt;
    return ps.confirm(null, "ZotAgentlet", message);
  }

  /**
   * Show a prompt dialog for text input
   */
  async prompt(message: string, defaultValue: string = ""): Promise<string | null> {
    logger.debug(`[UI Prompt] ${message}`);

    const ps = Services.prompt;
    const result = { value: defaultValue };
    const ok = ps.prompt(null, "ZotAgentlet", message, result, null, {});

    return ok ? result.value : null;
  }

  /**
   * Show a form dialog
   */
  async form(config: FormConfig): Promise<any> {
    logger.debug(`[UI Form] ${config.title}`);

    // For complex forms, we'd need a custom XUL dialog
    // For now, use a simple approach with sequential prompts
    const result: Record<string, any> = {};

    for (const field of config.fields) {
      if (field.type === "checkbox") {
        const confirmed = await this.confirm(`${field.label}?`);
        result[field.id] = confirmed;
      } else if (field.type === "select" && field.options) {
        const options = field.options.map((o) => o.label).join("\n");
        const selected = await this.prompt(
          `${field.label}:\n${options}\n\nEnter your choice:`,
          field.options[0]?.value || ""
        );
        result[field.id] = selected;
      } else {
        const value = await this.prompt(
          field.label,
          String(field.value || field.placeholder || "")
        );
        if (value === null && field.required) {
          // User cancelled
          return null;
        }
        result[field.id] = field.type === "number" ? Number(value) : value;
      }
    }

    return result;
  }

  /**
   * Show a selection dialog
   */
  async select(config: SelectConfig): Promise<any> {
    logger.debug(`[UI Select] ${config.title}`);

    // Build options list
    const items = config.items;
    const labels = items.map((item, i) => `${i + 1}. ${item.label}`).join("\n");

    const message = `${config.title}\n\n${labels}\n\nEnter number(s) separated by commas:`;
    const input = await this.prompt(message, "1");

    if (!input) return config.multiple ? [] : null;

    const indices = input
      .split(",")
      .map((s) => parseInt(s.trim(), 10) - 1)
      .filter((i) => i >= 0 && i < items.length);

    if (config.multiple) {
      return indices.map((i) => items[i].id);
    } else {
      return indices.length > 0 ? items[indices[0]].id : null;
    }
  }

  /**
   * Create a panel (side panel or floating window)
   * Panels with the same title reuse existing windows
   */
  async panel(config: PanelConfig): Promise<string> {
    logger.debug(`[UI Panel] panel() called with title="${config.title}", panels in map: ${Array.from(this.panels.keys()).join(', ') || 'none'}`);

    // Reuse existing window with same title if available
    // Check against stored panel config title (not document.title which may not be set yet)
    for (const [existingId, panelConfig] of this.panels) {
      if (panelConfig.title === config.title) {
        const existingWindow = this.panelWindows.get(existingId);
        logger.debug(`[UI Panel] Checking ${existingId}: hasWindow=${!!existingWindow}, closed=${existingWindow?.closed}`);

        if (existingWindow && !existingWindow.closed) {
          logger.debug(`[UI Panel] Reusing existing ${existingId}: ${config.title}`);
          this._updatePanelWindow(existingWindow, config);
          // Update stored config
          this.panels.set(existingId, {
            id: existingId,
            title: config.title,
            content: config.content || "",
            created: panelConfig.created || Date.now(),
          });
          return existingId;
        } else if (existingWindow) {
          // Window exists but is closed, clean up
          logger.debug(`[UI Panel] Panel ${existingId} window is closed, cleaning up`);
          this.panels.delete(existingId);
          this.panelWindows.delete(existingId);
        }
      }
    }

    // No existing panel found, create new one
    const id = config.id || `panel-${++this.panelCounter}`;
    logger.debug(`[UI Panel] Creating new ${id}: ${config.title}`);

    // Store panel config BEFORE creating window
    this.panels.set(id, {
      id,
      title: config.title,
      content: config.content || "",
      created: Date.now(),
    });

    // Store message callback if provided
    if (config.onMessage) {
      this.panelMessageCallbacks.set(id, config.onMessage);
    }

    // Check if panel window already exists by id
    const existingWindow = this.panelWindows.get(id);
    if (existingWindow && !existingWindow.closed) {
      // Update existing panel content
      this._updatePanelWindow(existingWindow, config);
      return id;
    }

    // Open new panel window
    try {
      const win = Zotero.getMainWindow();
      const panelWindow = win.openDialog(
        "chrome://zotagentlet/content/agentlet-panel.xhtml",
        `zotagentlet-panel-${id}`,
        "chrome,centerscreen,resizable,dialog=no",
        {
          id,
          title: config.title,
          content: config.content || "",
          width: config.width || 400,
          height: config.height || 500,
          onMessage: (msg: any) => this._handlePanelMessage(id, msg),
        }
      );

      this.panelWindows.set(id, panelWindow);

      // Listen for window close - but wait for load first!
      // XUL windows fire 'unload' during initial load as the blank document unloads.
      // We need to wait for 'load' before adding the 'unload' listener.
      panelWindow.addEventListener("load", () => {
        logger.debug(`[UI Panel] Window ${id} fully loaded, adding close listener`);
        panelWindow.addEventListener("unload", () => {
          logger.debug(`[UI Panel] Window ${id} closed, cleaning up`);
          this.panels.delete(id);
          this.panelWindows.delete(id);
          this.panelMessageCallbacks.delete(id);
        });
      }, { once: true });

      logger.debug(`[UI Panel] Window opened for ${id}`);
    } catch (e) {
      logger.error(`[UI Panel] Failed to open window: ${(e as Error).message}`);
      // Fallback to notification
      await this.notify(`Panel "${config.title}" created (window failed)`, "info");
    }

    return id;
  }

  /**
   * Handle messages from panel window
   */
  private _handlePanelMessage(panelId: string, message: any): void {
    logger.debug(`[UI Panel] Message from ${panelId}: ${JSON.stringify(message)}`);

    // Forward to specific callback if registered
    const callback = this.panelMessageCallbacks.get(panelId);
    if (callback) {
      try {
        callback(message);
      } catch (e) {
        logger.error(`[UI Panel] Callback error: ${(e as Error).message}`);
      }
    }

    // Forward to global forwarder (for sandbox message injection)
    if (this.globalPanelMessageForwarder) {
      try {
        this.globalPanelMessageForwarder(message);
      } catch (e) {
        logger.error(`[UI Panel] Forwarder error: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Set a global message forwarder for panel messages
   * This is used by the bridge handler to forward messages to the sandbox
   */
  setPanelMessageForwarder(forwarder: ((message: any) => void) | null): void {
    this.globalPanelMessageForwarder = forwarder;
  }

  /**
   * Clear the panel message forwarder
   */
  clearPanelMessageForwarder(): void {
    this.globalPanelMessageForwarder = null;
  }

  /**
   * Check if there are any open panels
   */
  hasOpenPanels(): boolean {
    for (const [id, panelWindow] of this.panelWindows) {
      if (panelWindow && !panelWindow.closed) {
        return true;
      }
    }
    return false;
  }

  /**
   * Wait for all panels to close
   * Returns immediately if no panels are open
   */
  waitForPanelsToClose(): Promise<void> {
    return new Promise((resolve) => {
      // Check if any panels are open
      const openPanels: string[] = [];
      for (const [id, panelWindow] of this.panelWindows) {
        if (panelWindow && !panelWindow.closed) {
          openPanels.push(id);
        }
      }

      if (openPanels.length === 0) {
        resolve();
        return;
      }

      logger.debug(`[UI] Waiting for ${openPanels.length} panels to close`);

      // Set up listeners for each open panel
      let remaining = openPanels.length;
      const checkDone = () => {
        remaining--;
        if (remaining === 0) {
          logger.debug(`[UI] All panels closed`);
          resolve();
        }
      };

      for (const id of openPanels) {
        const panelWindow = this.panelWindows.get(id);
        if (panelWindow && !panelWindow.closed) {
          panelWindow.addEventListener('unload', checkDone, { once: true });
        } else {
          // Panel already closed
          checkDone();
        }
      }
    });
  }

  /**
   * Update an existing panel window
   */
  private _updatePanelWindow(panelWindow: any, config: PanelConfig): void {
    try {
      // Dispatch update event to panel window
      const event = new panelWindow.CustomEvent("agentlet-panel-update", {
        detail: {
          content: config.content,
          title: config.title,
        },
      });
      panelWindow.dispatchEvent(event);
    } catch (e) {
      logger.error(`[UI Panel] Update failed: ${(e as Error).message}`);
    }
  }

  /**
   * Update a panel's content
   */
  async updatePanel(id: string, updates: any): Promise<void> {
    logger.debug(`[UI UpdatePanel] ${id}`);

    const panel = this.panels.get(id);
    if (!panel) {
      logger.warn(`Panel ${id} not found`);
      return;
    }

    if (updates.content !== undefined) {
      panel.content = updates.content;
    }
    if (updates.title !== undefined) {
      panel.title = updates.title;
    }

    // Update the window if it exists
    const panelWindow = this.panelWindows.get(id);
    if (panelWindow && !panelWindow.closed) {
      this._updatePanelWindow(panelWindow, {
        title: panel.title,
        content: panel.content,
      });
    }
  }

  /**
   * Close a panel
   */
  async closePanel(id: string): Promise<void> {
    logger.debug(`[UI ClosePanel] ${id}`);

    // Close the window if it exists
    const panelWindow = this.panelWindows.get(id);
    if (panelWindow && !panelWindow.closed) {
      try {
        panelWindow.close();
      } catch (e) {
        // Ignore errors
      }
    }

    this.panels.delete(id);
    this.panelWindows.delete(id);
    this.panelMessageCallbacks.delete(id);
  }

  /**
   * Start activity tracking
   */
  async activityStart(message: string): Promise<void> {
    logger.info(`[Activity] Start: ${message}`);

    this.activityState = {
      running: true,
      message,
      currentStep: 0,
      totalSteps: 0,
      logs: [{ timestamp: Date.now(), message: `Started: ${message}`, level: "info" }],
    };

    // Show activity panel
    this._showActivityPanel();
  }

  /**
   * Update activity step
   */
  async activityStep(message: string): Promise<void> {
    logger.info(`[Activity] Step: ${message}`);

    this.activityState.message = message;
    this.activityState.currentStep++;
    this.activityState.logs.push({
      timestamp: Date.now(),
      message,
      level: "info",
    });

    this._updateActivityPanel();
  }

  /**
   * Update activity progress
   */
  async activityProgress(
    current: number,
    total: number,
    message: string = ""
  ): Promise<void> {
    logger.info(`[Activity] Progress: ${current}/${total} ${message}`);

    this.activityState.currentStep = current;
    this.activityState.totalSteps = total;
    if (message) {
      this.activityState.message = message;
    }

    this._updateActivityPanel();
  }

  /**
   * Log activity message
   */
  async activityLog(message: string, level: string = "info"): Promise<void> {
    logger.info(`[Activity] ${level}: ${message}`);

    this.activityState.logs.push({
      timestamp: Date.now(),
      message,
      level,
    });

    this._updateActivityPanel();
  }

  /**
   * Mark activity complete
   */
  async activityComplete(message: string): Promise<void> {
    logger.info(`[Activity] Complete: ${message}`);

    this.activityState.running = false;
    this.activityState.message = message;
    this.activityState.logs.push({
      timestamp: Date.now(),
      message: `Complete: ${message}`,
      level: "success",
    });

    // Close existing panel and show completion panel (user must click to dismiss)
    this._showCompletionPanel(message, "success");
  }

  /**
   * Mark activity as error
   */
  async activityError(message: string): Promise<void> {
    logger.error(`[Activity] Error: ${message}`);

    this.activityState.running = false;
    this.activityState.message = message;
    this.activityState.logs.push({
      timestamp: Date.now(),
      message: `Error: ${message}`,
      level: "error",
    });

    // Close existing panel and show error panel (user must click to dismiss)
    this._showCompletionPanel(message, "error");
  }

  /**
   * Get activity state
   */
  getActivityState(): ActivityState {
    return { ...this.activityState };
  }

  // ============================================
  // Private helpers
  // ============================================

  private _getIconForType(type: string): string | null {
    // Map notification types to Zotero icons
    switch (type) {
      case "success":
        return "chrome://zotero/skin/tick.png";
      case "error":
        return "chrome://zotero/skin/cross.png";
      case "warning":
        return "chrome://zotero/skin/warning.png";
      default:
        return null;
    }
  }

  private _showActivityPanel(): void {
    // Use ProgressWindow for activity display
    // closeOnClick: true allows user to dismiss by clicking
    this.activityPanel = new Zotero.ProgressWindow({ closeOnClick: true });
    this.activityPanel.changeHeadline("ZotAgentlet - Running Agent");
    this.activityPanel.addDescription(this.activityState.message);
    this.activityPanel.show();
  }

  private _updateActivityPanel(): void {
    if (!this.activityPanel) return;

    // Update the progress window
    // Note: ProgressWindow has limited update capabilities
    // For better UX, we'd need a custom panel
    try {
      this.activityPanel.changeHeadline(
        this.activityState.running
          ? "ZotAgentlet - Running Agent"
          : "ZotAgentlet - Complete"
      );

      // Build progress text
      let progressText = this.activityState.message;
      if (this.activityState.totalSteps > 0) {
        progressText += ` (${this.activityState.currentStep}/${this.activityState.totalSteps})`;
      }

      // We can't easily update description, so we recreate
      // This is a limitation of ProgressWindow
    } catch (e) {
      // Ignore errors in panel update
    }
  }

  private _closeActivityPanelDelayed(): void {
    // Don't auto-close - user must click to dismiss (closeOnClick: true)
    // Just clear our reference so we don't try to update a completed panel
    this.activityPanel = null;
  }

  /**
   * Show completion/error notification that auto-closes
   */
  private _showCompletionPanel(message: string, type: "success" | "error"): void {
    // Close existing activity panel first
    if (this.activityPanel) {
      try {
        this.activityPanel.close();
      } catch (e) {
        // Ignore errors
      }
      this.activityPanel = null;
    }

    // Create notification with auto-close
    const pw = new Zotero.ProgressWindow({ closeOnClick: true });
    pw.changeHeadline(type === "success" ? "ZotAgentlet - Complete" : "ZotAgentlet - Error");

    // Add icon based on type
    const iconPath = this._getIconForType(type);
    if (iconPath) {
      pw.addLines([{ type: "default", icon: iconPath, text: message }]);
    } else {
      pw.addDescription(message);
    }

    pw.show();
    // Auto-close: 4 seconds for success, 8 seconds for errors
    pw.startCloseTimer(type === "error" ? 8000 : 4000);
  }
}

// Singleton instance
let uiHandler: UIHandler | null = null;

/**
 * Get the singleton UI handler
 */
export function getUIHandler(): UIHandler {
  if (!uiHandler) {
    uiHandler = new UIHandler();
  }
  return uiHandler;
}
