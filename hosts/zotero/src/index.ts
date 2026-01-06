/**
 * ZotAgentlet - Entry point
 *
 * Attaches the plugin to the Zotero global object.
 */

import Addon from "./addon";
import { config } from "../package.json";

// Declare globals provided by bootstrap context
declare const _globalThis: any;
declare const Zotero: any;

// Create addon instance if not already created
if (!Zotero[config.addonInstance]) {
  const addon = new Addon();

  // Attach to _globalThis for internal access
  _globalThis.addon = addon;

  // Attach to Zotero for bootstrap.js access
  Zotero[config.addonInstance] = addon;

  // Make ztoolkit available globally
  Object.defineProperty(_globalThis, "ztoolkit", {
    get() {
      return addon.data.ztoolkit;
    },
  });

  // Make rootURI available globally
  Object.defineProperty(_globalThis, "rootURI", {
    get() {
      return addon.data.rootURI;
    },
  });
}
