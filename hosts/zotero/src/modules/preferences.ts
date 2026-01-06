/**
 * Preferences module - Plugin and agent preferences
 */

import { getPref, setPref } from "../utils/prefs";
import logger from "../utils/logger";

declare const Zotero: any;

/**
 * Register preference scripts when pref window opens
 */
export function registerPrefsScripts(window: Window): void {
  logger.debug("Registering preference scripts");

  // Update stats display
  updateStatsDisplay(window);

  // Bind event listeners
  bindPrefsEvents(window);
}

/**
 * Update statistics display in preferences
 */
function updateStatsDisplay(window: Window): void {
  const doc = window.document;

  // Agent count
  const agentCount = addon.data.agents.installed.size;
  const agentCountEl = doc.getElementById("zotagentlet-agent-count");
  if (agentCountEl) {
    agentCountEl.textContent = String(agentCount);
  }
}

/**
 * Bind preference change events
 */
function bindPrefsEvents(window: Window): void {
  const doc = window.document;

  // === Provider Selector ===
  bindProviderSelector(doc);

  // === Ollama Settings ===
  bindTextInput(doc, "zotagentlet-pref-ollamaUrl", "ollama.url", "http://localhost:11434");
  bindTextInput(doc, "zotagentlet-pref-ollamaModel", "ollama.model", "llama3.2");

  // === OpenAI Settings ===
  bindTextInput(doc, "zotagentlet-pref-openaiKey", "openai.key", "");
  bindMenulist(doc, "zotagentlet-pref-openaiModel", "openai.model", "gpt-4o-mini");

  // === General Settings ===
  bindCheckbox(doc, "zotagentlet-pref-debug", "debug", false);

  // === Resource Limits ===
  bindNumberInput(doc, "zotagentlet-pref-maxExecutionTime", "limits.maxExecutionTime", 300000);
  bindNumberInput(doc, "zotagentlet-pref-maxInferenceCalls", "limits.maxInferenceCalls", 100);
  bindNumberInput(doc, "zotagentlet-pref-maxNetworkRequests", "limits.maxNetworkRequests", 50);
  bindNumberInput(doc, "zotagentlet-pref-maxStorageBytes", "limits.maxStorageBytes", 5242880);

  // === Manage Agents Button ===
  const manageBtn = doc.getElementById("zotagentlet-manage-agents-btn");
  if (manageBtn) {
    manageBtn.addEventListener("command", () => {
      openAgentManager();
    });
  }
}

/**
 * Bind provider selector and show/hide provider-specific settings
 */
function bindProviderSelector(doc: Document): void {
  const menulist = doc.getElementById("zotagentlet-pref-provider") as any;
  const ollamaSettings = doc.getElementById("zotagentlet-ollama-settings") as HTMLElement;
  const openaiSettings = doc.getElementById("zotagentlet-openai-settings") as HTMLElement;

  if (!menulist || !ollamaSettings || !openaiSettings) return;

  const updateVisibility = (provider: string) => {
    if (provider === "ollama") {
      ollamaSettings.style.display = "";
      openaiSettings.style.display = "none";
    } else {
      ollamaSettings.style.display = "none";
      openaiSettings.style.display = "";
    }
  };

  // Set initial value and visibility
  const currentProvider = getPref("inference.provider", "ollama") as string;
  const menupopup = menulist.querySelector("menupopup");
  if (menupopup) {
    const items = menupopup.querySelectorAll("menuitem");
    for (const item of items) {
      if (item.getAttribute("value") === currentProvider) {
        menulist.selectedItem = item;
        break;
      }
    }
  }
  updateVisibility(currentProvider);

  // Handle changes
  menulist.addEventListener("command", () => {
    const value = menulist.selectedItem?.value;
    if (value) {
      setPref("inference.provider", value);
      updateVisibility(value);
      logger.debug(`Set inference.provider = ${value}`);
    }
  });
}

/**
 * Bind a text input to a preference
 */
function bindTextInput(doc: Document, elementId: string, prefKey: string, defaultValue: string): void {
  const input = doc.getElementById(elementId) as HTMLInputElement;
  if (input) {
    input.value = getPref(prefKey, defaultValue);
    input.addEventListener("change", () => {
      setPref(prefKey, input.value);
      logger.debug(`Set ${prefKey} = ${input.value}`);
    });
  }
}

/**
 * Bind a number input to a preference
 */
function bindNumberInput(doc: Document, elementId: string, prefKey: string, defaultValue: number): void {
  const input = doc.getElementById(elementId) as HTMLInputElement;
  if (input) {
    input.value = String(getPref(prefKey, defaultValue));
    input.addEventListener("change", () => {
      const value = parseInt(input.value, 10);
      if (!isNaN(value)) {
        setPref(prefKey, value);
        logger.debug(`Set ${prefKey} = ${value}`);
      }
    });
  }
}

/**
 * Bind a checkbox to a preference
 */
function bindCheckbox(doc: Document, elementId: string, prefKey: string, defaultValue: boolean): void {
  const checkbox = doc.getElementById(elementId) as any;
  if (checkbox) {
    checkbox.checked = getPref(prefKey, defaultValue);
    checkbox.addEventListener("command", () => {
      setPref(prefKey, checkbox.checked);
      logger.debug(`Set ${prefKey} = ${checkbox.checked}`);
    });
  }
}

/**
 * Bind a menulist (dropdown) to a preference
 */
function bindMenulist(doc: Document, elementId: string, prefKey: string, defaultValue: string): void {
  const menulist = doc.getElementById(elementId) as any;
  if (menulist) {
    const currentValue = getPref(prefKey, defaultValue);
    // Set selected item
    const menupopup = menulist.querySelector("menupopup");
    if (menupopup) {
      const items = menupopup.querySelectorAll("menuitem");
      for (const item of items) {
        if (item.getAttribute("value") === currentValue) {
          menulist.selectedItem = item;
          break;
        }
      }
    }
    menulist.addEventListener("command", () => {
      const value = menulist.selectedItem?.value;
      if (value) {
        setPref(prefKey, value);
        logger.debug(`Set ${prefKey} = ${value}`);
      }
    });
  }
}

/**
 * Open the agent manager window
 */
function openAgentManager(): void {
  const mainWindow = Zotero.getMainWindow();
  mainWindow.openDialog(
    "chrome://zotagentlet/content/agent-manager.xhtml",
    "zotagentlet-agent-manager",
    "chrome,centerscreen,resizable"
  );
}

/**
 * Get all plugin preferences
 */
export function getPluginPrefs(): Record<string, any> {
  return {
    debug: getPref("debug", false),
    inference: {
      provider: getPref("inference.provider", "ollama"),
    },
    ollama: {
      url: getPref("ollama.url", "http://localhost:11434"),
      model: getPref("ollama.model", "llama3.2"),
    },
    openai: {
      key: getPref("openai.key", ""),
      model: getPref("openai.model", "gpt-4o-mini"),
    },
    limits: {
      maxExecutionTime: getPref("limits.maxExecutionTime", 300000),
      maxInferenceCalls: getPref("limits.maxInferenceCalls", 100),
      maxNetworkRequests: getPref("limits.maxNetworkRequests", 50),
      maxStorageBytes: getPref("limits.maxStorageBytes", 5242880),
    },
    autoUpdateAgents: getPref("autoUpdateAgents", false),
  };
}

/**
 * Get inference settings for the runtime
 */
export function getInferenceSettings(): {
  provider: "ollama" | "openai";
  ollamaUrl: string;
  ollamaModel: string;
  openaiKey: string;
  openaiModel: string;
} {
  return {
    provider: getPref("inference.provider", "ollama") as "ollama" | "openai",
    ollamaUrl: getPref("ollama.url", "http://localhost:11434"),
    ollamaModel: getPref("ollama.model", "llama3.2"),
    openaiKey: getPref("openai.key", ""),
    openaiModel: getPref("openai.model", "gpt-4o-mini"),
  };
}
