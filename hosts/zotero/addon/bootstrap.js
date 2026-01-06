/**
 * ZotAgentlet - Zotero plugin for running Agentlet AI agents
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  Zotero.debug("[ZotAgentlet Bootstrap] Waiting for initialization...");
  await Zotero.initializationPromise;
  Zotero.debug("[ZotAgentlet Bootstrap] Zotero initialized");

  // Register chrome content and locale
  Zotero.debug("[ZotAgentlet Bootstrap] Registering chrome content...");
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
    ["locale", "__addonRef__", "en-US", rootURI + "locale/en-US/"],
  ]);
  Zotero.debug("[ZotAgentlet Bootstrap] Chrome content and locale registered");

  // Create context for the plugin script
  const ctx = {
    rootURI,
    Zotero,
    document: Zotero.getMainWindow()?.document,
  };
  ctx._globalThis = ctx;

  // Load the main script
  Zotero.debug("[ZotAgentlet Bootstrap] Loading main script...");
  try {
    Services.scriptloader.loadSubScript(
      `${rootURI}content/scripts/__addonRef__.js`,
      ctx
    );
    Zotero.debug("[ZotAgentlet Bootstrap] Main script loaded");
  } catch (e) {
    Zotero.debug("[ZotAgentlet Bootstrap] ERROR loading script: " + e);
    Zotero.logError(e);
    return;
  }

  // The script attaches itself to Zotero.__addonInstance__
  if (Zotero.__addonInstance__) {
    Zotero.debug("[ZotAgentlet Bootstrap] Calling onStartup...");
    Zotero.__addonInstance__.setInfo({ id, version, rootURI });
    await Zotero.__addonInstance__.hooks.onStartup();
    Zotero.debug("[ZotAgentlet Bootstrap] Startup complete");
  } else {
    Zotero.debug("[ZotAgentlet Bootstrap] ERROR: Zotero.__addonInstance__ not found!");
  }
}

function onMainWindowLoad({ window: win }) {
  Zotero.__addonInstance__?.hooks.onMainWindowLoad(win);
}

function onMainWindowUnload({ window: win }) {
  Zotero.__addonInstance__?.hooks.onMainWindowUnload(win);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

async function uninstall(data, reason) {
  Zotero.debug("[ZotAgentlet Bootstrap] Uninstalling...");

  try {
    // Delete the zotagentlet.sqlite database
    const dbPath = PathUtils.join(Zotero.DataDirectory.dir, "zotagentlet.sqlite");
    Zotero.debug("[ZotAgentlet Bootstrap] Deleting database: " + dbPath);

    // Try to detach database first
    if (Zotero.DB) {
      try {
        await Zotero.DB.queryAsync("DETACH DATABASE zotagentlet");
        Zotero.debug("[ZotAgentlet Bootstrap] Database detached");
      } catch (e) {
        Zotero.debug("[ZotAgentlet Bootstrap] Database not attached (ok): " + e);
      }
    }

    // Delete the database file
    await IOUtils.remove(dbPath, { ignoreAbsent: true });
    Zotero.debug("[ZotAgentlet Bootstrap] Database file deleted");

    // Clear preferences
    const prefBranch = Services.prefs.getBranch("extensions.zotero.zotagentlet.");
    try {
      prefBranch.deleteBranch("");
      Zotero.debug("[ZotAgentlet Bootstrap] Preferences cleared");
    } catch (e) {
      Zotero.debug("[ZotAgentlet Bootstrap] Could not clear preferences: " + e);
    }

    Zotero.debug("[ZotAgentlet Bootstrap] Uninstall cleanup complete");
  } catch (e) {
    Zotero.debug("[ZotAgentlet Bootstrap] Uninstall error: " + e);
    Zotero.logError(e);
  }
}
