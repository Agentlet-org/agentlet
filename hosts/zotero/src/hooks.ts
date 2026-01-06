import { getString, initLocale } from "./utils/locale";
import { createZToolkit } from "./utils/ztoolkit";
import { registerPrefsScripts } from "./modules/preferences";

// Declare globals
declare const Zotero: any;
declare const addon: any;
declare const ztoolkit: any;

/**
 * Called once when the plugin first loads
 */
async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // Initialize localization
  initLocale();

  // Initialize database for agent storage
  const { initDatabase } = await import("./modules/storage-adapter");
  await initDatabase();

  // Initialize agent runtime
  const { AgentRuntime } = await import("./modules/agent-runtime");
  await AgentRuntime.init();

  // Load installed agents from database
  const { AgentManager } = await import("./modules/agent-manager");
  await AgentManager.loadInstalledAgents();

  // Register preference pane
  if (Zotero.PreferencePanes) {
    Zotero.PreferencePanes.register({
      pluginID: addon.data.config.addonID,
      src: addon.data.rootURI + "content/preferences.xhtml",
      label: getString("prefs-title") || "ZotAgentlet",
      image: addon.data.rootURI + "content/icons/icon48.png",
    });
  }

  // Initialize for any existing windows
  await Promise.all(
    Zotero.getMainWindows().map((win: any) => onMainWindowLoad(win))
  );

  addon.data.initialized = true;
  Zotero.debug("[ZotAgentlet] Initialized");
}

/**
 * Called when a main window is opened
 */
async function onMainWindowLoad(win: any): Promise<void> {
  // Create ztoolkit for this window
  addon.data.ztoolkit = createZToolkit();

  // Register UI elements using XUL injection (like ZotSeek)
  registerContextMenu(win);
  registerToolsMenu(win);
  registerToolbarButton(win);

  Zotero.debug("[ZotAgentlet] UI registered for window");
}

/**
 * Called when a main window is closed
 */
async function onMainWindowUnload(win: Window): Promise<void> {
  removeMenuElements(win);
}

/**
 * Called when the plugin is shutting down
 */
function onShutdown(): void {
  // Remove menu elements from all windows
  for (const win of Zotero.getMainWindows()) {
    removeMenuElements(win);
  }

  // Shutdown agent runtime
  try {
    const { AgentRuntime } = require("./modules/agent-runtime");
    AgentRuntime.shutdown();
  } catch (e) {
    // Ignore errors during shutdown
  }

  // Shutdown inference worker
  try {
    const { shutdownInference } = require("./modules/inference-provider");
    shutdownInference();
  } catch (e) {
    // Ignore errors during shutdown
  }

  addon.data.alive = false;
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * Called when Zotero notifier fires an event
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any }
) {
  Zotero.debug(`[ZotAgentlet] notify: ${event} ${type}`);
}

/**
 * Called when preference window events occur
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    case "unload":
      // Cleanup if needed
      break;
    default:
      return;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI REGISTRATION - Using XUL injection (like ZotSeek)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Register context menu items using XUL injection
 */
function registerContextMenu(win: any) {
  const doc = win.document;
  const itemMenu = doc.getElementById("zotero-itemmenu");

  if (!itemMenu) {
    Zotero.debug("[ZotAgentlet] Could not find zotero-itemmenu");
    return;
  }

  // Check if already registered
  if (doc.getElementById("zotagentlet-menu-separator")) {
    Zotero.debug("[ZotAgentlet] Context menu already registered");
    return;
  }

  // Create separator
  const separator = doc.createXULElement("menuseparator");
  separator.id = "zotagentlet-menu-separator";

  // Create submenu
  const submenu = doc.createXULElement("menu");
  submenu.id = "zotagentlet-menu";
  submenu.setAttribute("label", "Run Agent");

  // Create menupopup for submenu items
  const menupopup = doc.createXULElement("menupopup");
  menupopup.id = "zotagentlet-menupopup";

  // Create "Manage Agents..." menu item
  const manageItem = doc.createXULElement("menuitem");
  manageItem.id = "zotagentlet-manage-agents";
  manageItem.setAttribute("label", "Manage Agents...");
  manageItem.addEventListener("command", () => openAgentManager());

  // Create separator in submenu
  const subSeparator = doc.createXULElement("menuseparator");
  subSeparator.id = "zotagentlet-submenu-separator";

  // Append items to menupopup
  menupopup.appendChild(manageItem);
  menupopup.appendChild(subSeparator);
  // Dynamic agent actions will be added here

  // Append menupopup to submenu
  submenu.appendChild(menupopup);

  // Append to item menu
  itemMenu.appendChild(separator);
  itemMenu.appendChild(submenu);

  // Add installed agent actions
  updateAgentMenuItems(win);

  Zotero.debug("[ZotAgentlet] Context menu registered");
}

/**
 * Register Tools menu items using XUL injection
 * Simple single menu item that opens the manager window
 */
function registerToolsMenu(win: any) {
  const doc = win.document;
  const toolsMenu = doc.getElementById("menu_ToolsPopup");

  if (!toolsMenu) {
    Zotero.debug("[ZotAgentlet] Could not find menu_ToolsPopup");
    return;
  }

  // Check if already registered
  if (doc.getElementById("zotagentlet-tools-separator")) {
    Zotero.debug("[ZotAgentlet] Tools menu already registered");
    return;
  }

  // Create separator
  const separator = doc.createXULElement("menuseparator");
  separator.id = "zotagentlet-tools-separator";

  // Create single menu item (no submenu needed)
  const menuItem = doc.createXULElement("menuitem");
  menuItem.id = "zotagentlet-tools-menu";
  menuItem.setAttribute("label", "Manage Agentlets...");
  menuItem.addEventListener("command", () => openAgentManager());

  // Append to tools menu
  toolsMenu.appendChild(separator);
  toolsMenu.appendChild(menuItem);

  Zotero.debug("[ZotAgentlet] Tools menu registered");
}

/**
 * Register toolbar button by cloning an existing button (like ZotSeek)
 */
function registerToolbarButton(win: any) {
  const doc = win.document;

  // Check if button already exists
  if (doc.getElementById("zotagentlet-toolbar-button")) {
    Zotero.debug("[ZotAgentlet] Toolbar button already exists");
    return;
  }

  // Find the items toolbar
  const toolbar = doc.querySelector("#zotero-items-toolbar");
  if (!toolbar) {
    Zotero.debug("[ZotAgentlet] Could not find zotero-items-toolbar");
    return;
  }

  // Clone an existing toolbar button to inherit proper styling
  const lookupNode = toolbar.querySelector("#zotero-tb-lookup");
  let button: any;

  if (lookupNode) {
    // Clone the lookup button to get proper styling
    button = lookupNode.cloneNode(true);
    button.setAttribute("id", "zotagentlet-toolbar-button");
    button.setAttribute("label", "");
    button.setAttribute("tooltiptext", "Manage Agentlets");
    button.setAttribute("command", "");
    button.setAttribute("oncommand", "");
    button.setAttribute("mousedown", "");
    button.setAttribute("onmousedown", "");
  } else {
    // Fallback: create button from scratch
    button = doc.createXULElement("toolbarbutton");
    button.id = "zotagentlet-toolbar-button";
    button.setAttribute("tooltiptext", "Manage Agentlets");
    button.setAttribute("class", "zotero-tb-button");
  }

  // Set the icon
  button.style.listStyleImage = 'url("chrome://zotagentlet/content/icons/icon-toolbar.svg")';

  // Add click handler
  button.addEventListener("click", () => {
    openAgentManager();
  });

  // Insert before the search box with a separator
  const searchBox = toolbar.querySelector("#zotero-tb-search");
  const separator = doc.createXULElement("toolbarseparator");
  separator.id = "zotagentlet-toolbar-separator";

  if (searchBox) {
    toolbar.insertBefore(separator, searchBox);
    toolbar.insertBefore(button, separator);
  } else {
    toolbar.appendChild(button);
    toolbar.appendChild(separator);
  }

  Zotero.debug("[ZotAgentlet] Toolbar button registered");
}

/**
 * Remove menu elements from window
 */
function removeMenuElements(win: any) {
  const doc = win.document;
  const ids = [
    "zotagentlet-menu-separator",
    "zotagentlet-menu",
    "zotagentlet-tools-separator",
    "zotagentlet-tools-menu",
    "zotagentlet-toolbar-button",
    "zotagentlet-toolbar-separator",
  ];

  for (const id of ids) {
    const element = doc.getElementById(id);
    if (element) {
      element.remove();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

function openAgentManager() {
  const win = Zotero.getMainWindow();
  win.openDialog(
    "chrome://zotagentlet/content/agent-manager.xhtml",
    "zotagentlet-agent-manager",
    "chrome,centerscreen,resizable,dialog=no"
  );
}

async function runAgentAction(agentId: string, actionId: string) {
  const win = Zotero.getMainWindow();
  Zotero.debug(`[ZotAgentlet] Running action: ${agentId}/${actionId}`);

  try {
    const result = await addon.api.runAgent(agentId, actionId);
    Zotero.debug(`[ZotAgentlet] Action completed: ${JSON.stringify(result)}`);
    // Success is silent - agents show their own UI feedback
  } catch (error: any) {
    Zotero.debug(`[ZotAgentlet] Action failed: ${error.message}`);
    win.alert(`Action failed: ${error.message}`);
  }
}

function refreshAgentMenus() {
  // Refresh menus in all windows
  for (const win of Zotero.getMainWindows()) {
    updateAgentMenuItems(win);
  }
}

function updateAgentMenuItems(win: any) {
  const doc = win.document;
  const menupopup = doc.getElementById("zotagentlet-menupopup");

  if (!menupopup) return;

  // Remove existing dynamic items (after the separator)
  const separator = doc.getElementById("zotagentlet-submenu-separator");
  if (separator) {
    while (separator.nextSibling) {
      separator.nextSibling.remove();
    }
  }

  // Add menu items for each agent's actions
  const agents = addon.api.listAgents();
  Zotero.debug(`[ZotAgentlet] Updating menus with ${agents.length} agents`);

  for (const agent of agents) {
    for (const [actionId, actionDef] of Object.entries(agent.manifest.actions || {})) {
      const menuitem = doc.createXULElement("menuitem");
      menuitem.setAttribute("label", `${agent.manifest.name}: ${actionId}`);
      menuitem.setAttribute("tooltiptext", (actionDef as any).description || "");
      menuitem.addEventListener("command", () => runAgentAction(agent.id, actionId));
      menupopup.appendChild(menuitem);
    }
  }
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
};
