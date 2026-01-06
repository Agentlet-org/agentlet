# ZotAgentlet Development Guide

Lessons learned from developing a Zotero 8 plugin.

## Development Setup

### Extension Proxy File (for development)

Instead of installing an XPI, create a proxy file that points to your build directory:

```bash
# 1. Find your Zotero profile
ls ~/Library/Application\ Support/Zotero/Profiles/

# 2. Create proxy file (filename = extension ID from manifest.json)
echo '/path/to/your/project/.scaffold/build/addon' > \
  ~/Library/Application\ Support/Zotero/Profiles/XXXXXXXX.default/extensions/zotagentlet@agentlet.org
```

**Important**: The proxy file MUST have a trailing newline (use `echo` which adds one automatically).

### Force Zotero to Re-read Extensions

After creating/modifying the proxy file:

1. Quit Zotero
2. Edit `prefs.js` in your profile directory and delete these lines:
   ```
   user_pref("extensions.lastAppBuildId", "...");
   user_pref("extensions.lastAppVersion", "...");
   user_pref("extensions.lastPlatformVersion", "...");
   ```
3. Start Zotero with cache purge:
   ```bash
   open -a Zotero --args -purgecaches -ZoteroDebugText -jsconsole
   ```

### Debug Flags

```bash
# Full debug mode
open -a Zotero --args -purgecaches -ZoteroDebugText -jsconsole

# Just purge caches (faster reload)
open -a Zotero --args -purgecaches
```

- `-purgecaches` - Clear cached files, reload plugin code
- `-ZoteroDebugText` - Enable debug output
- `-jsconsole` - Open the JavaScript console

## Key Lessons Learned

### 1. No `console` in Plugin Context

**Problem**: `console is not defined` error during startup.

**Solution**: Use `Zotero.debug()` instead of `console.log()`:

```typescript
// BAD - will crash
console.log("Hello");

// GOOD
Zotero.debug("[MyPlugin] Hello");
```

### 2. Bootstrap.js Must Wait for Initialization

**Problem**: Plugin code runs before Zotero is ready.

**Solution**: Always await `Zotero.initializationPromise` in bootstrap.js:

```javascript
async function startup({ id, version, rootURI }, reason) {
  // CRITICAL: Wait for Zotero to be ready
  await Zotero.initializationPromise;

  // Now safe to use Zotero APIs
  // ...
}
```

### 3. Context for loadSubScript

**Problem**: Plugin script can't access Zotero or document.

**Solution**: Pass them explicitly in the context:

```javascript
const ctx = {
  rootURI,
  Zotero,
  document: Zotero.getMainWindow()?.document,
};
ctx._globalThis = ctx;

Services.scriptloader.loadSubScript(
  `${rootURI}content/scripts/myplugin.js`,
  ctx
);
```

### 4. Addon Needs setInfo() Method

**Problem**: Plugin doesn't know its rootURI for loading resources.

**Solution**: Add `setInfo()` method to your addon class:

```typescript
class Addon {
  public data: {
    rootURI?: string;
    // ...
  };

  public setInfo(info: { id: string; version: string; rootURI: string }): void {
    this.data.rootURI = info.rootURI;
  }
}
```

Then call from bootstrap.js:
```javascript
Zotero.MyPlugin.setInfo({ id, version, rootURI });
```

### 5. MenuManager API Requires l10nID (FTL Localization)

**Problem**: Menu items appear with blank labels when using `label` property.

**Reason**: Zotero 8's `MenuManager.registerMenu()` requires `l10nID` which references Fluent (FTL) localization strings, not plain text labels.

**Solution**: Use XUL injection instead (like ZotSeek does):

```typescript
function registerToolsMenu(win: any) {
  const doc = win.document;
  const toolsMenu = doc.getElementById("menu_ToolsPopup");

  // Create menu item with XUL
  const menuItem = doc.createXULElement("menuitem");
  menuItem.id = "myplugin-menu-item";
  menuItem.setAttribute("label", "My Menu Item");  // Plain text works!
  menuItem.addEventListener("command", () => myHandler());

  toolsMenu.appendChild(menuItem);
}
```

### 6. MenuManager Target Values

If you do use MenuManager, valid targets are:
- `main/menubar/file`
- `main/menubar/edit`
- `main/menubar/view`
- `main/menubar/go`
- `main/menubar/tools`
- `main/menubar/help`
- `main/library/item` (NOT just "item")
- `main/library/collection`
- And more...

### 7. MenuManager Submenu Property

**Problem**: `Invalid submenu: menus[1] missing 'menus' property`

**Solution**: Use `menus` not `submenus` for nested items:

```javascript
// BAD
{
  menuType: "submenu",
  label: "My Submenu",
  submenus: [...]  // WRONG
}

// GOOD
{
  menuType: "submenu",
  label: "My Submenu",
  menus: [...]  // CORRECT
}
```

## XUL Menu Structure

For context menus and Tools menu, use this pattern:

```typescript
// For item context menu
const itemMenu = doc.getElementById("zotero-itemmenu");

// For Tools menu
const toolsMenu = doc.getElementById("menu_ToolsPopup");

// Create a submenu with items
const submenu = doc.createXULElement("menu");
submenu.setAttribute("label", "My Plugin");

const menupopup = doc.createXULElement("menupopup");

const menuitem = doc.createXULElement("menuitem");
menuitem.setAttribute("label", "My Action");
menuitem.addEventListener("command", () => myHandler());

menupopup.appendChild(menuitem);
submenu.appendChild(menupopup);
toolsMenu.appendChild(submenu);
```

## File Structure

```
hosts/zotero/
├── addon/
│   ├── bootstrap.js          # Entry point, lifecycle hooks
│   ├── manifest.json         # Plugin metadata
│   ├── prefs.js              # Default preferences
│   └── content/
│       ├── icons/            # Plugin icons (16, 48, 96px)
│       └── preferences.xhtml # Preferences pane
├── src/
│   ├── index.ts              # Attaches addon to Zotero global
│   ├── addon.ts              # Addon class with data/hooks
│   ├── hooks.ts              # Lifecycle implementations
│   └── modules/              # Feature modules
├── locale/
│   └── en-US/
│       └── *.ftl             # Fluent localization files
└── .scaffold/build/addon/    # Build output (proxy file points here)
```

## References

- [Zotero 8 for Developers](https://www.zotero.org/support/dev/zotero_8_for_developers)
- [Zotero Plugin Development](https://www.zotero.org/support/dev/client_coding/plugin_development)
- [ZotSeek Source](https://github.com/introfini/zotseek) - Good reference implementation
- [zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template)
