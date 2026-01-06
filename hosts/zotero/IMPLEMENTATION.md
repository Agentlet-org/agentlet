# ZotAgentlet Implementation Guide

A Zotero 8 plugin that implements the **Agentlet v0.1** specification, enabling AI agents to run within Zotero.

## Spec Version

This implementation uses **Agentlet v0.1** which features:
- HTML-based `.agentlet` files (single file containing manifest + code)
- `<meta name="agentlet:*">` tags for manifest data
- Four portability types: host-specific, host-family, universal, adaptive
- `bridge.perceive()` and `bridge.act()` APIs for adaptive agents
- Standard intents (add-tags, remove-tags, move-to, search, etc.)
- `bridge.action('name', handler)` pattern for registering action handlers
- DOMParser for safe manifest extraction (no code execution during parsing)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         ZOTERO 8                                 │
├─────────────────────────────────────────────────────────────────┤
│  ZotAgentlet Plugin                                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  AgentManager                                            │    │
│  │  - Install agents from .agentlet file URLs              │    │
│  │  - Extract manifest from HTML via DOMParser             │    │
│  │  - Store in SQLite (agents + agent_html)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  AgentRuntime (per agent execution)                      │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │IframeSandbox│  │BridgeHandler│  │  UIHandler  │      │    │
│  │  │(.agentlet)  │◄─┤ (permissions│  │  (dialogs,  │      │    │
│  │  │             │  │  routing)   │  │   panels)   │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  │         │                │                               │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │    │
│  │  │  Context    │  │  Inference  │  │   Storage   │      │    │
│  │  │  Adapter    │  │  Provider   │  │   Adapter   │      │    │
│  │  │(Zotero API) │  │(placeholder)│  │  (SQLite)   │      │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Module Reference

### Core Modules

| Module | File | Purpose |
|--------|------|---------|
| AgentManager | `src/modules/agent-manager.ts` | Install, uninstall, list agents |
| AgentRuntime | `src/modules/agent-runtime.ts` | Execute agents, manage sandboxes |
| IframeSandbox | `src/modules/iframe-sandbox.ts` | Isolated execution environment, manifest extraction |
| ZoteroBridgeHandler | `src/modules/bridge-handler.ts` | Extends `BridgeHandlerBase` from SDK with Zotero-specific overrides |
| ZoteroIntentHandler | `src/modules/adapters/intent-handler.ts` | Implements `IIntentHandler` for act() intents |
| StorageAdapter | `src/modules/storage-adapter.ts` | Per-agent key-value storage, DB init |
| UIHandler | `src/modules/ui-handler.ts` | Handle UI requests from agents |
| InferenceProvider | `src/modules/inference-provider.ts` | OpenAI and Ollama LLM inference |

### Entry Points

| File | Purpose |
|------|---------|
| `addon/bootstrap.js` | Zotero plugin lifecycle entry |
| `src/index.ts` | Plugin initialization, attach to Zotero global |
| `src/addon.ts` | Addon class with data and hooks |
| `src/hooks.ts` | Lifecycle implementations, UI registration |

### UI Components

| File | Purpose |
|------|---------|
| `addon/content/agent-manager.xhtml` | Main agent management window |
| `addon/content/styles/agent-manager.css` | Tree view and activity panel styles |
| `addon/content/icons/icon-toolbar.svg` | Toolbar button icon |

## v0.1 Agent File Format

Agents are single HTML files with `.agentlet` extension (MIME type: `application/x-agentlet+html`):

### Host-Specific Agent (Zotero-only)

```html
<!DOCTYPE html>
<title>Tag Helper</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="tag-helper">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:description" content="Manage tags on your Zotero items">
<meta name="agentlet:portability" content="host-specific">
<meta name="agentlet:host" content="zotero:>=7.0.0">

<!-- Capabilities -->
<meta name="agentlet:capability" content="context:bibliographic:read">
<meta name="agentlet:capability" content="context:bibliographic:write">
<meta name="agentlet:capability" content="ui:notify">

<!-- Actions -->
<meta name="agentlet:action" content="add-tag" data-label="Add Tag">
<meta name="agentlet:default-action" content="add-tag">

<script type="module">
const { bridge } = window;

bridge.action('add-tag', async () => {
  const items = await bridge.context.query('bibliographic');
  // ...host-specific code
});
</script>
```

### Adaptive Agent (Works Anywhere)

```html
<!DOCTYPE html>
<title>Smart Organizer</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="smart-organizer">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:description" content="AI-powered organization">
<meta name="agentlet:portability" content="adaptive">

<!-- Required capabilities -->
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">

<!-- Optional capabilities (uses if available) -->
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:optional" content="collections">

<!-- Intents this agent uses -->
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:intent" content="move-to">

<meta name="agentlet:action" content="organize" data-label="Organize Items">

<script type="module">
const { bridge } = window;

bridge.action('organize', async () => {
  // Perceive context from any host
  const ctx = await bridge.perceive({ scope: 'selection', understand: true });

  // Act using standard intents
  if (ctx.capabilities.includes('tags')) {
    await bridge.act({
      intent: 'add-tags',
      items: ctx.items,
      tags: ['processed']
    });
  }
});
</script>
```

## New Manifest Tags in v0.1

| Tag | Description |
|-----|-------------|
| `agentlet:portability` | Type: `host-specific`, `host-family`, `universal`, `adaptive` |
| `agentlet:host` | Host compatibility (e.g., `zotero:>=7.0.0`) |
| `agentlet:requires` | Required capabilities for adaptive agents |
| `agentlet:optional` | Optional capabilities (graceful degradation) |
| `agentlet:intent` | Standard intents the agent uses |

## Perceive/Act APIs

### bridge.perceive(options?)

Returns a Perception object with host context:

```javascript
const ctx = await bridge.perceive({
  scope: 'selection',  // 'selection', 'all', or 'query'
  query: 'neural networks',  // if scope is 'query'
  understand: true,  // get AI interpretation
  limit: 100
});

// Returns:
{
  host: 'zotero',
  hostVersion: '8.0',
  items: [...],
  understanding: 'Five papers about machine learning...',
  capabilities: ['tags', 'collections', 'search', 'attachments', 'pdf'],
  schema: { itemFields: [...], creatorFields: [...] }
}
```

### bridge.act(action)

Execute a standard intent:

```javascript
await bridge.act({
  intent: 'add-tags',
  items: ctx.items,
  tags: ['important', 'to-review']
});

// Returns:
{ success: true, affected: 5 }
```

### Standard Intents (Zotero)

| Intent | Description | Parameters |
|--------|-------------|------------|
| `add-tags` | Add tags to items | `items`, `tags: string[]` |
| `remove-tags` | Remove tags from items | `items`, `tags: string[]` |
| `move-to` | Move to collection | `items`, `destination: string` |
| `create` | Create new item | `type`, `data: object` |
| `update` | Update item fields | `items`, `fields: object` |
| `delete` | Delete items | `items` |
| `search` | Search for items | `query: string` |
| `open` | Open/focus item | `items` |

### Zotero Host Capabilities

```javascript
const ZOTERO_CAPABILITIES = [
  'content', 'tags', 'collections', 'metadata',
  'metadata:custom', 'dates', 'authors', 'search',
  'batch', 'attachments', 'pdf', 'references'
];
```

## Key Functions in iframe-sandbox.ts

### `extractManifestFromHtml(agentHtml: string): ExtractedManifest`
Parses agent HTML using DOMParser to extract manifest from meta tags. Now parses v0.1 tags including portability, requires, optional, and intent.

### `injectBridgeIntoHtml(agentHtml: string, networkDomains: string[]): string`
Injects the bridge client code before the first `<script type="module">` tag.

### Bridge Client Features (v0.1)
- `bridge.perceive(options)` - Perceive API for adaptive agents
- `bridge.act(action)` - Act API using standard intents
- `bridge.hasCapability(cap)` - Check if host has capability
- `bridge.action(name, handler)` - Register action handlers
- `bridge.context.*` - Direct context access (host-specific)
- `bridge.ui.*` - UI interactions
- `bridge.storage.*` - Per-agent storage

## Database Schema

SQLite database: `zotero-data/zotagentlet.sqlite`

```sql
-- Installed agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,           -- agentlet:name
  url TEXT NOT NULL,             -- source URL
  manifest TEXT NOT NULL,        -- JSON manifest
  agent_html TEXT,               -- Original HTML content
  extracted_manifest TEXT,       -- JSON (v0.1 ExtractedManifest)
  permissions TEXT,              -- Granted permissions JSON
  installed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Per-agent key-value storage
CREATE TABLE agent_storage (
  agent_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT,                    -- JSON serialized
  PRIMARY KEY (agent_id, key)
);
```

## Error Codes (v0.1)

| Code | Name | Description |
|------|------|-------------|
| E1001 | INTENT_NOT_SUPPORTED | Intent not supported by host |
| E1002 | PERCEIVE_FAILED | Perceive operation failed |
| E1003 | ACT_FAILED | Act operation failed |

## Development Commands

```bash
# Build
npm run build

# Restart Zotero with cache clear (required for changes to take effect)
npm run build && osascript -e 'quit app "Zotero"' 2>/dev/null; sleep 2 && open -a Zotero --args -purgecaches -jsconsole

# Serve test fixtures
cd fixtures && python3 -m http.server 8888

# Install test agent
# In Zotero: Click + button, enter http://localhost:8888/zotero-counter.agentlet
```

## Key Lessons Learned

1. **Zotero Restart**: `open -a Zotero` alone doesn't restart - need `osascript -e 'quit app "Zotero"'` first
2. **Sandbox Communication**: `allow-same-origin` required for postMessage to work
3. **Bridge Ready Signal**: Wait for `bridge-loaded` message before sending init
4. **v0.1 Manifest**: Use DOMParser for safe HTML parsing without code execution
5. **Toolbar Button**: Clone existing button (`#zotero-tb-lookup`) for proper styling
6. **XUL Injection**: Use `doc.createXULElement()` for menus, not ztoolkit helpers
7. **Debug Logging**: Use `Zotero.debug()` not `console.log()`

## Related Files

- **Spec**: `../../SPEC.md`
- **Examples**: `../../examples/`
- **SDK**: `../../packages/host-sdk/`

## Panel UI

Agents can create floating panel windows via `bridge.ui.panel()`. Panels display HTML content and support bidirectional messaging.

### Architecture

```
┌─────────────────┐      ┌─────────────────────────────────────┐
│  Agentlet       │      │  Panel Window (agentlet-panel.xhtml) │
│  Sandbox        │◄────►│  ┌─────────────────────────────────┐ │
│  (iframe)       │      │  │  Content iframe (srcdoc)        │ │
└────────┬────────┘      │  │  - HTML from bridge.ui.panel()  │ │
         │               │  │  - Button clicks → postMessage  │ │
         │               │  └─────────────────────────────────┘ │
    postMessage          └─────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│  UIHandler                                                   │
│  - panels Map (id → config with title)                      │
│  - panelWindows Map (id → XUL window)                       │
│  - globalPanelMessageForwarder → sandbox.postMessage()      │
└─────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `addon/content/agentlet-panel.xhtml` | XUL window template |
| `src/modules/ui-handler.ts` | Window management, message routing |
| `src/modules/agent-runtime.ts` | Sandbox lifecycle tied to panels |

### Implementation Details

**Window Reuse:** Panels with the same title reuse existing windows. Title matching uses stored config (not `document.title` which isn't set until window loads).

**Message Flow:**
1. Panel iframe button click → `window.parent.postMessage()`
2. Panel window captures via `message` event → calls `onMessage` callback
3. UIHandler forwards to `globalPanelMessageForwarder`
4. AgentRuntime injects into sandbox via `sandbox.postMessage({ type: 'panel-message', message })`
5. Bridge client dispatches synthetic `MessageEvent` to agentlet's listener

**Sandbox Lifecycle:** After action completes, runtime checks `uiHandler.hasOpenPanels()`. If panels exist, waits for `waitForPanelsToClose()` before destroying sandbox.

### XUL Quirks

- **Unload fires during load:** XUL windows fire `unload` when the initial blank document unloads before content loads. Solution: Wait for `load` event before adding `unload` listener.
- **srcdoc for security:** Use iframe `srcdoc` attribute instead of `contentDocument.write()` to avoid `DOMException: The operation is insecure`.

---

## Future Work

See `IMPROVEMENTS.md` for planned enhancements:
- Agent update checking
- Better permission UI
- Reader toolbar button for PDF context
- Local inference via Transformers.js (currently using OpenAI/Ollama)
