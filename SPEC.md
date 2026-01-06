# Agentlet Specification

**Version:** 0.1.0
**Status:** Preview
**Author:** José Fernandes

---

## Quick Start

### Your First Agent (30 seconds)

Save this as `hello.agentlet`:

```html
<!DOCTYPE html>
<title>Hello World</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="hello-world">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="universal">
<meta name="agentlet:capability" content="ui:notify">
<meta name="agentlet:action" content="greet" data-label="Say Hello">

<script type="module">
bridge.action('greet', async () => {
  await bridge.ui.notify("Hello from Agentlet!", "success");
});
</script>
```

Install in any host (Zotero, Obsidian, VS Code) → Click "Say Hello" → Done.

### What Just Happened?

| Line | Purpose |
|------|---------|
| `<meta name="agentlet" content="0.1">` | Declares spec version |
| `<meta name="agentlet:portability" content="universal">` | Works in any host |
| `<meta name="agentlet:capability" content="ui:notify">` | Requests notification permission |
| `<meta name="agentlet:action" ...>` | Declares a user-triggerable action |
| `bridge.action('greet', ...)` | Implements the action |
| `bridge.ui.notify(...)` | Shows a notification |

### Core Concepts

1. **Single HTML file** - Everything in one `.agentlet` file
2. **Manifest in meta tags** - Parseable without execution
3. **Bridge API** - `bridge.*` is your interface to the host
4. **Portability spectrum** - From host-specific to fully adaptive

### Next Steps

| Goal | Read |
|------|------|
| Understand portability types | [Section 2: Portability](#2-portability) |
| See the full manifest options | [Section 5: Manifest Reference](#5-manifest-reference) |
| Learn the bridge API | [Section 6: Bridge API](#6-bridge-api) |
| Build adaptive agents | [Section 6.3: Perceive API](#63-perceive-api-adaptive) |
| See complete examples | [Section 17: Examples](#17-examples) |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Portability](#2-portability)
3. [Architecture](#3-architecture)
4. [Agent Format](#4-agent-format)
5. [Manifest Reference](#5-manifest-reference)
6. [Bridge API](#6-bridge-api)
7. [Lifecycle](#7-lifecycle)
8. [Actions](#8-actions)
9. [Capabilities](#9-capabilities)
10. [Standard Intents](#10-standard-intents)
11. [Standard Host Capabilities](#11-standard-host-capabilities)
12. [Preferences](#12-preferences)
13. [Error Handling](#13-error-handling)
14. [Installation & Distribution](#14-installation--distribution)
15. [Security](#15-security)
16. [Host Implementation](#16-host-implementation)
17. [Examples](#17-examples)

---

## 1. Overview

Agentlets are lightweight, portable AI agents distributed as self-contained HTML files (`.agentlet`). They run inside WebView sandboxes and can be embedded in any application - desktop apps, mobile apps, browser extensions, or the OS itself.

### 1.1 Design Principles

1. **AI-native** - every agent has built-in access to AI inference
2. **Browser-native** - if the browser can do it, use that
3. **Single-file** - one `.agentlet` file contains everything
4. **Self-describing** - manifest in meta tags, parseable without execution
5. **URL-first** - agents are loaded from URLs, like web pages
6. **Minimal bridge** - host exposes capabilities via simple message passing
7. **Declarative capabilities** - agents declare what they need upfront
8. **Portability spectrum** - from host-specific to fully adaptive
9. **Progressive enhancement** - simple agents are simple; complex is possible
10. **Transparent by default** - users see what agents do
11. **User in control** - agents assist, users decide

### 1.2 Why HTML?

| Aspect | Benefit |
|--------|---------|
| **Parsing** | DOMParser extracts manifest - no regex, no AST, no execution |
| **Security** | Manifest in markup, code in script - clearly separated |
| **Viewing** | Open in browser to inspect before installing |
| **Editing** | Any text editor, no build tools needed |
| **Hosting** | Any static host, GitHub Pages, S3, anywhere |
| **Running** | Load directly into iframe - no transformation needed |
| **UI** | Include `<template>` and `<style>` for custom panels |
| **Familiar** | Every web developer knows HTML |

### 1.3 File Extension

Agents use the `.agentlet` extension:

```
smart-organizer.agentlet
hello-world.agentlet
citation-validator.agentlet
```

- **MIME type:** `application/x-agentlet+html`
- **Content:** Valid HTML5
- **Editor support:** Configure editors to treat `.agentlet` as HTML

---

## 2. Portability

Not all agents need to work everywhere. Agentlet supports a spectrum of portability, from host-specific specialists to fully adaptive agents.

### 2.1 The Portability Spectrum

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Host-Specific      Host-Family         Universal          Adaptive        │
│        │                  │                  │                  │           │
│        ▼                  ▼                  ▼                  ▼           │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐     │
│   │  Full   │        │ Shared  │        │ Zero    │        │   AI    │     │
│   │  Host   │        │  Logic  │        │ Context │        │ Bridges │     │
│   │  Power  │        │   +     │        │  Needs  │        │   Gap   │     │
│   │         │        │ Adapts  │        │         │        │         │     │
│   └─────────┘        └─────────┘        └─────────┘        └─────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Portability Types

| Type | Description | API Access | Best For |
|------|-------------|------------|----------|
| **Host-Specific** | Uses full power of one host | `bridge.context.*` (host-specific) | Deep integrations |
| **Host-Family** | Works across similar apps | `bridge.context.*` + host detection | Note apps, IDEs |
| **Universal** | No host context needed | `bridge.inference`, `bridge.ui`, `bridge.storage` | AI utilities |
| **Adaptive** | AI figures out any host | `bridge.perceive()`, `bridge.act()` | Smart assistants |

### 2.3 Host-Specific Agents

Host-specific agents use the full capabilities of one host application.

```html
<meta name="agentlet:portability" content="host-specific">
<meta name="agentlet:host" content="zotero:>=7.0.0">

<!-- Uses host-specific context -->
<meta name="agentlet:capability" content="context:bibliographic:read">
<meta name="agentlet:capability" content="context:bibliographic:write">
```

**Characteristics:**
- Maximum power and integration depth
- Direct access to host-specific APIs
- No portability - works only on declared host
- Must update when host API changes

### 2.4 Host-Family Agents

Host-family agents work across applications that share a common purpose.

```html
<meta name="agentlet:portability" content="host-family">
<meta name="agentlet:host" content="obsidian:>=1.0.0">
<meta name="agentlet:host" content="logseq:>=0.9.0">
<meta name="agentlet:host" content="notion:>=2.0.0">

<!-- Uses context with host detection -->
<meta name="agentlet:capability" content="context:note:read">
<meta name="agentlet:capability" content="context:note:write">
```

**Characteristics:**
- Shared core logic across similar apps
- Per-host adapters for API differences
- Uses `bridge.host.name` for detection
- Works across declared host family

### 2.5 Universal Agents

Universal agents use only APIs guaranteed to exist everywhere.

```html
<meta name="agentlet:portability" content="universal">

<!-- Only universal capabilities -->
<meta name="agentlet:capability" content="inference:basic">
<meta name="agentlet:capability" content="storage">
<meta name="agentlet:capability" content="ui:panel">
```

**Characteristics:**
- Works in any host
- No access to host-specific data
- Uses inference, storage, UI, MCP only
- Maximum distribution, minimal maintenance

### 2.6 Adaptive Agents

Adaptive agents use `bridge.perceive()` and `bridge.act()` to work with any host.

```html
<meta name="agentlet:portability" content="adaptive">

<!-- Required capabilities -->
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">

<!-- Optional capabilities (uses if available) -->
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:optional" content="collections">
<meta name="agentlet:optional" content="search">

<!-- Intents this agent uses -->
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:intent" content="move-to">
```

**Characteristics:**
- AI interprets host data structures
- Uses perceive/act pattern
- Graceful degradation based on capabilities
- Maximum portability with full power

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       HOST APPLICATION                              │
│    (Zotero, Obsidian, VS Code, Electron, Tauri, Mobile, Browser)   │
│                                                                     │
│   ┌───────────────────────────────────────────────────────────────┐ │
│   │                     Agent Runtime                             │ │
│   │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌───────────┐  │ │
│   │  │  Context   │ │  Inference │ │     UI     │ │    MCP    │  │ │
│   │  │  Adapter   │ │   Router   │ │  Handler   │ │   Router  │  │ │
│   │  └────────────┘ └────────────┘ └────────────┘ └───────────┘  │ │
│   │                         │                                     │ │
│   │                   Bridge Handler                              │ │
│   │              (permission enforcement)                         │ │
│   │                         │                                     │ │
│   └─────────────────────────┼─────────────────────────────────────┘ │
│                             │                                       │
│   ┌─────────────────────────┼─────────────────────────────────────┐ │
│   │                    WebView Sandbox                            │ │
│   │                         │                                     │ │
│   │                   postMessage()                               │ │
│   │                         │                                     │ │
│   │   ┌─────────────────────▼───────────────────────────────────┐ │ │
│   │   │                  agent.agentlet                         │ │ │
│   │   │                                                         │ │ │
│   │   │   <meta name="agentlet:*">     <- Manifest (meta tags)  │ │ │
│   │   │   <script type="module">       <- Code                  │ │ │
│   │   │   <template>                   <- UI templates          │ │ │
│   │   │   <style>                      <- Styles                │ │ │
│   │   └─────────────────────────────────────────────────────────┘ │ │
│   └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.1 Components

| Component | Responsibility |
|-----------|----------------|
| **Host Application** | Zotero, Obsidian, VS Code, etc. |
| **Agent Runtime** | Manages agent lifecycle, sandboxes, and bridge |
| **Context Adapter** | Maps host data to Agentlet context API |
| **Inference Router** | Routes inference requests to providers |
| **UI Handler** | Renders notifications, dialogs, panels |
| **MCP Router** | Connects to MCP servers |
| **Bridge Handler** | Routes messages, enforces permissions |
| **WebView Sandbox** | Isolated execution environment (iframe) |
| **Agent (.agentlet file)** | The agent itself - manifest + code + assets |

### 3.2 Communication Flow

```
Agent                    Bridge                    Host
  │                        │                        │
  │  bridge.perceive()     │                        │
  ├───────────────────────►│                        │
  │                        │  Check permission      │
  │                        │  Gather context        │
  │                        ├───────────────────────►│
  │                        │                        │  Get items, schema
  │                        │◄───────────────────────┤
  │                        │  AI interpretation     │
  │◄───────────────────────┤                        │
  │  { items, understanding, capabilities }        │
```

---

## 4. Agent Format

An agent is a single HTML file with:
1. **Meta tags** - Machine-readable manifest
2. **Script** - Agent code
3. **Templates** - Optional UI components
4. **Styles** - Optional CSS
5. **Noscript** - Optional browser preview

### 4.1 Minimal Agent (Universal)

```html
<!DOCTYPE html>
<title>Hello World</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="universal">
<meta name="agentlet:capability" content="ui:notify">
<meta name="agentlet:action" content="greet" data-label="Say Hello">

<script type="module">
bridge.action('greet', async () => {
  await bridge.ui.notify("Hello from Agentlet!", "success");
});
</script>
```

### 4.2 Adaptive Agent

```html
<!DOCTYPE html>
<title>Smart Organizer</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:action" content="organize" data-label="Organize">

<script type="module">
bridge.action('organize', async () => {
  const ctx = await bridge.perceive({ scope: 'selection', understand: true });
  
  const tags = await bridge.inference({
    prompt: `Suggest 3 tags for: ${ctx.understanding}`
  });
  
  if (ctx.capabilities.includes('tags')) {
    await bridge.act({ intent: 'add-tags', items: ctx.items, tags: tags.split(',') });
  }
  
  await bridge.ui.notify('Organized!', 'success');
});
</script>
```

### 4.3 Complete Agent Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Agent Display Name</title>
  
  <!-- ════════════════════════════════════════════════════════════ -->
  <!-- MANIFEST (meta tags)                                        -->
  <!-- ════════════════════════════════════════════════════════════ -->
  
  <!-- Required: Spec version -->
  <meta name="agentlet" content="0.1">
  
  <!-- Required: Identity -->
  <meta name="agentlet:name" content="agent-id">
  <meta name="agentlet:version" content="1.0.0">
  
  <!-- Required: Portability type -->
  <meta name="agentlet:portability" content="adaptive">
  
  <!-- Optional: Metadata -->
  <meta name="agentlet:description" content="What the agent does">
  <meta name="agentlet:author" content="Author Name">
  <meta name="agentlet:author:url" content="https://author.example">
  <meta name="agentlet:license" content="MIT">
  <meta name="agentlet:homepage" content="https://github.com/author/agent">
  <meta name="agentlet:icon" content="#icon-id">
  
  <!-- For host-specific/host-family: Host compatibility -->
  <meta name="agentlet:host" content="zotero:>=7.0.0">
  <meta name="agentlet:host" content="obsidian:>=1.5.0">
  
  <!-- For adaptive: Required capabilities -->
  <meta name="agentlet:requires" content="inference:basic">
  <meta name="agentlet:requires" content="perceive">
  <meta name="agentlet:requires" content="act">
  
  <!-- For adaptive: Optional capabilities -->
  <meta name="agentlet:optional" content="tags">
  <meta name="agentlet:optional" content="collections">
  <meta name="agentlet:optional" content="search">
  
  <!-- For adaptive: Intents used -->
  <meta name="agentlet:intent" content="add-tags">
  <meta name="agentlet:intent" content="move-to">
  
  <!-- For all: Standard capabilities -->
  <meta name="agentlet:capability" content="ui:panel">
  <meta name="agentlet:capability" content="ui:notify">
  <meta name="agentlet:capability" content="storage">
  
  <!-- For host-specific/host-family: Context capabilities -->
  <meta name="agentlet:capability" content="context:bibliographic:read">
  <meta name="agentlet:capability" content="network:api.example.com">
  
  <!-- Discovery -->
  <meta name="agentlet:category" content="productivity">
  <meta name="agentlet:tag" content="organization">
  
  <!-- Resource limits -->
  <meta name="agentlet:limit" content="maxExecutionTime:300000">
  
  <!-- Actions -->
  <meta name="agentlet:action" content="action-id" 
        data-label="Display Label"
        data-input="selection"
        data-confirm="true">
  
  <meta name="agentlet:default-action" content="action-id">
  
  <!-- Preferences -->
  <meta name="agentlet:preference" content="pref-id" 
        data-type="boolean"
        data-label="Enable feature"
        data-default="true">
</head>
<body>

<!-- Optional: Inline SVG icon -->
<svg id="icon-id" viewBox="0 0 24 24" hidden>
  <!-- SVG content -->
</svg>

<!-- Optional: Browser preview -->
<noscript>
  <h1>Agent Display Name</h1>
  <p>This is an Agentlet. Install it in a compatible host application.</p>
</noscript>

<!-- Required: Agent code -->
<script type="module">
const { bridge } = window;

// Lifecycle hooks
bridge.onInstall(async ({ previousVersion }) => { });
bridge.onActivate(async () => { });
bridge.onDeactivate(async () => { });
bridge.onUninstall(async () => { });

// Actions
bridge.action('action-id', async (input) => {
  // Implementation
});
</script>

<!-- Optional: UI templates -->
<template id="panel-template">
  <!-- Panel HTML -->
</template>

<!-- Optional: Styles -->
<style>
  /* Panel styles */
</style>

</body>
</html>
```

---

## 5. Manifest Reference

The manifest is declared via `<meta>` tags with names prefixed by `agentlet:`.

### 5.1 Identity

| Meta Name | Required | Description |
|-----------|----------|-------------|
| `agentlet` | Yes | Spec version (e.g., "0.1") |
| `agentlet:name` | Yes | Machine ID (lowercase, hyphens) |
| `agentlet:version` | Yes | Semver version (e.g., "1.0.0") |
| `<title>` | Yes | Human-readable display name |
| `agentlet:description` | No | Short description |
| `agentlet:author` | No | Author name |
| `agentlet:author:url` | No | Author URL |
| `agentlet:author:email` | No | Author email |
| `agentlet:license` | No | License identifier (e.g., "MIT") |
| `agentlet:homepage` | No | Project homepage URL |
| `agentlet:icon` | No | Icon reference (see 5.2) |

### 5.2 Icon Formats

```html
<!-- 1. Reference to inline SVG (preferred) -->
<meta name="agentlet:icon" content="#icon-id">
<svg id="icon-id" viewBox="0 0 24 24" hidden>...</svg>

<!-- 2. Data URI -->
<meta name="agentlet:icon" content="data:image/svg+xml,...">
<meta name="agentlet:icon" content="data:image/png;base64,...">

<!-- 3. External URL (requires network) -->
<meta name="agentlet:icon" content="https://example.com/icon.png">
```

### 5.3 Portability

| Meta Name | Required | Description |
|-----------|----------|-------------|
| `agentlet:portability` | Yes | Type: `host-specific`, `host-family`, `universal`, `adaptive` |
| `agentlet:host` | Conditional | Required for host-specific, optional for host-family |
| `agentlet:requires` | Conditional | Required capabilities for adaptive agents |
| `agentlet:optional` | No | Optional capabilities for adaptive agents |
| `agentlet:intent` | No | Intents used by adaptive agents |

```html
<!-- Host-specific -->
<meta name="agentlet:portability" content="host-specific">
<meta name="agentlet:host" content="zotero:>=7.0.0">

<!-- Host-family -->
<meta name="agentlet:portability" content="host-family">
<meta name="agentlet:host" content="obsidian:>=1.0.0">
<meta name="agentlet:host" content="logseq:>=0.9.0">

<!-- Universal -->
<meta name="agentlet:portability" content="universal">

<!-- Adaptive -->
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:optional" content="search">
<meta name="agentlet:intent" content="add-tags">
```

#### Version Constraints

Capabilities and requirements can specify spec version constraints:

```html
<!-- Require perceive API from spec 0.2+ -->
<meta name="agentlet:requires" content="perceive" data-min-spec="0.2">

<!-- Feature available until spec 0.5 -->
<meta name="agentlet:capability" content="context:legacy" data-max-spec="0.5">

<!-- Feature available in specific range -->
<meta name="agentlet:requires" content="act" data-min-spec="0.1" data-max-spec="1.0">
```

| Attribute | Description |
|-----------|-------------|
| `data-min-spec` | Minimum spec version required (e.g., "0.2") |
| `data-max-spec` | Maximum spec version supported (e.g., "0.5") |

Hosts SHOULD warn if an agent's version constraints don't match the current spec version.

### 5.4 Capabilities

Capabilities declare what permissions the agent needs:

```html
<!-- Context access (host-specific/host-family only) -->
<meta name="agentlet:capability" content="context:bibliographic:read">
<meta name="agentlet:capability" content="context:bibliographic:write">
<meta name="agentlet:capability" content="context:selection:read">

<!-- Network access -->
<meta name="agentlet:capability" content="network:api.crossref.org">
<meta name="agentlet:capability" content="network:*.example.com">

<!-- Inference -->
<meta name="agentlet:capability" content="inference:basic">
<meta name="agentlet:capability" content="inference:reasoning">
<meta name="agentlet:capability" content="inference:vision">
<meta name="agentlet:capability" content="inference:embedding">

<!-- Storage -->
<meta name="agentlet:capability" content="storage">

<!-- UI -->
<meta name="agentlet:capability" content="ui:notify">
<meta name="agentlet:capability" content="ui:confirm">
<meta name="agentlet:capability" content="ui:prompt">
<meta name="agentlet:capability" content="ui:form">
<meta name="agentlet:capability" content="ui:select">
<meta name="agentlet:capability" content="ui:panel">

<!-- MCP -->
<meta name="agentlet:capability" content="mcp:filesystem">
<meta name="agentlet:capability" content="mcp:github">
```

### 5.5 Actions

```html
<meta name="agentlet:action" content="action-id"
      data-label="Display Label"
      data-description="Longer description"
      data-input="selection|file|none"
      data-output="update|report|none"
      data-confirm="true|false">
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `content` | Yes | Action ID (used in code) |
| `data-label` | No | Display label (defaults to ID) |
| `data-description` | No | Longer description |
| `data-input` | No | Expected input type |
| `data-output` | No | Output type |
| `data-confirm` | No | Require user confirmation |
| `data-deprecated` | No | Mark action as deprecated ("true") |
| `data-deprecated-message` | No | Message shown to users |
| `data-remove-in` | No | Version when action will be removed |

#### Deprecated Actions

Actions can be marked as deprecated to warn users:

```html
<meta name="agentlet:action" content="old-action"
      data-label="Old Action"
      data-deprecated="true"
      data-deprecated-message="Use 'new-action' instead"
      data-remove-in="2.0.0">

<meta name="agentlet:action" content="new-action"
      data-label="New Action">
```

Deprecated actions still execute but hosts SHOULD show a warning in the UI or console.

### 5.6 Preferences

```html
<!-- Boolean -->
<meta name="agentlet:preference" content="enableFeature"
      data-type="boolean"
      data-label="Enable feature"
      data-default="true">

<!-- String -->
<meta name="agentlet:preference" content="apiKey"
      data-type="string"
      data-label="API Key"
      data-placeholder="Enter your key">

<!-- Number -->
<meta name="agentlet:preference" content="threshold"
      data-type="number"
      data-label="Confidence threshold"
      data-default="80"
      data-min="0"
      data-max="100">

<!-- Select -->
<meta name="agentlet:preference" content="source"
      data-type="select"
      data-label="Data source"
      data-default="crossref">
<meta name="agentlet:preference:option" content="source:crossref" data-label="CrossRef">
<meta name="agentlet:preference:option" content="source:openalex" data-label="OpenAlex">
```

### 5.7 Resource Limits

```html
<meta name="agentlet:limit" content="maxExecutionTime:300000">
<meta name="agentlet:limit" content="maxInferenceCalls:50">
<meta name="agentlet:limit" content="maxNetworkRequests:100">
<meta name="agentlet:limit" content="maxStorageBytes:5242880">
```

### 5.8 Discovery & Updates

```html
<!-- Categories and tags -->
<meta name="agentlet:category" content="bibliography">
<meta name="agentlet:tag" content="metadata">

<!-- Update URL -->
<meta name="agentlet:update-url" content="https://example.com/releases/latest/agent.agentlet">

<!-- Content integrity hash -->
<meta name="agentlet:integrity" content="sha384-oqVuAfXRKap7fdgcCY...">
```

---

## 6. Bridge API

The bridge is the agent's interface to host capabilities. It's available as `window.bridge` in agent code.

### 6.1 API Tiers

| Tier | APIs | Available In |
|------|------|--------------|
| **Universal** | inference, storage, ui, mcp, utils, activity | All agent types |
| **Host Detection** | host.name, host.version, capabilities | Host-family, Adaptive |
| **Host Context** | context.* | Host-specific, Host-family |
| **Adaptive** | perceive(), act() | Adaptive |

### 6.2 Host API

```javascript
// Host identification
bridge.host.name        // 'zotero', 'obsidian', 'vscode', etc.
bridge.host.version     // '7.0.0'

// Available host capabilities
bridge.capabilities     // ['tags', 'collections', 'search', ...]

// Check specific capability
bridge.hasCapability('tags')  // true/false
```

### 6.3 Perceive API (Adaptive)

The perceive API allows adaptive agents to understand the host environment.

```javascript
const context = await bridge.perceive(options?);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scope` | string | `'selection'` | `'selection'`, `'all'`, or `'query'` |
| `query` | string | - | Search query (when scope is `'query'`) |
| `understand` | boolean | `false` | Use AI to interpret the data |
| `limit` | number | 100 | Maximum items to return |

**Returns: `Perception`**

```typescript
interface Perception {
  host: string;              // Host name
  hostVersion: string;       // Host version
  items: any[];              // Raw items from host
  understanding?: string;    // AI interpretation (if understand: true)
  capabilities: string[];    // Available host capabilities
  schema?: object;           // Data structure information
}
```

**Example:**

```javascript
// Get selected items with AI interpretation
const ctx = await bridge.perceive({
  scope: 'selection',
  understand: true
});

console.log(ctx.host);           // 'zotero'
console.log(ctx.items.length);   // 5
console.log(ctx.understanding);  // 'Five academic papers about machine learning...'
console.log(ctx.capabilities);   // ['tags', 'collections', 'search', 'attachments']

// Search for items
const results = await bridge.perceive({
  scope: 'query',
  query: 'machine learning',
  limit: 20
});
```

### 6.4 Act API (Adaptive)

The act API allows adaptive agents to perform actions using standard intents.

```javascript
const result = await bridge.act(action);
```

**Action Object:**

```typescript
interface Action {
  intent: string;           // Standard intent name
  items?: any[];            // Items to act on
  [key: string]: any;       // Intent-specific parameters
}
```

**Returns: `ActionResult`**

```typescript
interface ActionResult {
  success: boolean;
  affected?: number;        // Number of items affected
  result?: any;             // Intent-specific result
  error?: AgentletError;
}
```

**Example:**

```javascript
// Add tags
await bridge.act({
  intent: 'add-tags',
  items: ctx.items,
  tags: ['important', 'to-review']
});

// Move to collection
await bridge.act({
  intent: 'move-to',
  items: ctx.items,
  destination: 'Research/ML Papers'
});

// Search
const searchResult = await bridge.act({
  intent: 'search',
  query: 'neural networks'
});
console.log(searchResult.result);  // Array of matching items

// Check if intent is supported before using
if (ctx.capabilities.includes('tags')) {
  await bridge.act({ intent: 'add-tags', items, tags });
}
```

### 6.5 Context API (Host-Specific/Host-Family)

For host-specific and host-family agents, direct context access is available.

```javascript
// Query items
const items = await bridge.context.query('bibliographic', {
  itemType: 'journalArticle',
  tag: 'unread'
});

// Get single item
const item = await bridge.context.get('bibliographic', itemId);

// Update item
await bridge.context.update('bibliographic', itemId, {
  title: 'Corrected Title',
  tags: ['processed']
});

// Create item
const newItem = await bridge.context.create('bibliographic', {
  itemType: 'journalArticle',
  title: 'New Paper'
});

// Delete item
await bridge.context.delete('bibliographic', itemId);

// Batch operations
const results = await bridge.context.batch([
  { operation: 'update', type: 'bibliographic', id: id1, data: { ... } },
  { operation: 'update', type: 'bibliographic', id: id2, data: { ... } }
]);

// Get current selection
const selected = await bridge.context.selection.get();
```

Context types are host-specific:

| Host | Context Types |
|------|---------------|
| Zotero | `bibliographic`, `collection`, `tag`, `attachment` |
| Obsidian | `note`, `folder`, `tag`, `frontmatter` |
| VS Code | `file`, `workspace`, `editor` |

### 6.6 Inference API

```javascript
// Simple completion
const response = await bridge.inference({
  prompt: "Summarize this abstract: ...",
  max_tokens: 500
});

// Chat-style with messages
const response = await bridge.inference({
  messages: [
    { role: 'system', content: 'You are a research assistant.' },
    { role: 'user', content: 'Analyze this paper...' }
  ],
  max_tokens: 1000,
  temperature: 0.7
});

// Streaming
const fullText = await bridge.inference({
  prompt: "Generate a summary...",
  stream: true,
  onToken: (token) => {
    console.log('Token:', token);
  }
});

// Tool calling
const response = await bridge.inference({
  messages: [...],
  tools: [
    {
      name: 'search_papers',
      description: 'Search for academic papers',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' }
        }
      }
    }
  ],
  onToolCall: async (name, params) => {
    if (name === 'search_papers') {
      return await searchPapers(params.query);
    }
  }
});
```

#### Inference Model

Agents have built-in access to AI inference through the host application. This abstraction is a core design principle.

**How it works:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENT                                          │
│                                                                          │
│   await bridge.inference({ prompt: "..." })                              │
│                         │                                                │
└─────────────────────────┼────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      HOST RUNTIME                                        │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    Inference Router                              │   │
│   │                                                                  │   │
│   │   • Validates capability (inference:basic, inference:reasoning)  │   │
│   │   • Enforces rate limits                                         │   │
│   │   • Routes to configured provider                                │   │
│   │   • Tracks usage/costs                                           │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                          │                                               │
└──────────────────────────┼───────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
      ┌─────────┐    ┌─────────┐    ┌─────────┐
      │ Ollama  │    │ OpenAI  │    │  OS AI  │
      │ (local) │    │  (API)  │    │  (future)│
      └─────────┘    └─────────┘    └─────────┘
```

**Agent perspective:**
- Just call `bridge.inference()` — no API keys, no provider selection
- Declare capability tier needed: `inference:basic`, `inference:reasoning`, `inference:vision`
- Same code works regardless of backend

**Host responsibility:**
- Configure LLM providers (Ollama, OpenAI, Anthropic, local models)
- Manage API keys and authentication
- Enforce rate limits and quotas
- Track costs and usage
- Present provider selection to users

**Why this matters:**

The inference API is designed to be future-proof. Today, hosts route to cloud APIs or local models. Tomorrow, inference will be a platform primitive:

| Era | Inference Provider |
|-----|-------------------|
| 2025 | Cloud APIs (OpenAI, Anthropic, Google, etc.) |
| 2025 | Local models (Ollama, llama.cpp, MLX) |
| 2025 | Browser APIs (`window.ai`, Chrome built-in AI) |
| 2025 | OS APIs (Apple Intelligence, Windows Copilot Runtime) |
| 2026+ | WebView-native inference as standard |

Just as browsers evolved to provide native APIs for geolocation, notifications, and payments, they will provide native inference. Agentlet agents are ready — they already treat inference as an abstract capability, not a specific provider.

```javascript
// This agent code works today with Ollama...
// ...and will work tomorrow with navigator.ai
// ...without any changes
const summary = await bridge.inference({
  prompt: "Summarize this document",
  max_tokens: 200
});
```

### 6.7 Storage API

```javascript
// Get value
const value = await bridge.storage.get('key');

// Set value (JSON-serializable)
await bridge.storage.set('key', { data: 'value' });

// Remove value
await bridge.storage.remove('key');

// Clear all storage for this agent
await bridge.storage.clear();

// List all keys
const keys = await bridge.storage.keys();
```

### 6.8 UI API

```javascript
// Notification
await bridge.ui.notify("Operation complete!", "success");
await bridge.ui.notify("Something went wrong", "error");
await bridge.ui.notify("Please review changes", "warning");
await bridge.ui.notify("Processing...", "info");

// Confirmation dialog
const confirmed = await bridge.ui.confirm("Apply changes to 50 items?");

// Text prompt
const input = await bridge.ui.prompt("Enter DOI:", "10.1234/");

// Form dialog
const data = await bridge.ui.form({
  title: "Configure Export",
  fields: [
    { id: 'format', type: 'select', label: 'Format', 
      options: [{value: 'json', label: 'JSON'}, {value: 'csv', label: 'CSV'}] },
    { id: 'includeAbstract', type: 'checkbox', label: 'Include abstracts' }
  ]
});

// Selection dialog
const selected = await bridge.ui.select({
  title: "Select items to process",
  items: items.map(i => ({ id: i.id, label: i.title })),
  multiple: true
});

// Panel
const panelId = await bridge.ui.panel({
  title: "Dashboard",
  content: document.getElementById('panel-template').innerHTML,
  width: 400
});

// Update panel
await bridge.ui.updatePanel(panelId, {
  content: newContent
});

// Close panel
await bridge.ui.closePanel(panelId);
```

### 6.9 Activity API

```javascript
// Start activity tracking
await bridge.activity.start("Processing items");

// Update step
await bridge.activity.step("Fetching metadata");

// Progress with count
await bridge.activity.progress(5, 100, "Processing item 5 of 100");

// Log message
await bridge.activity.log("Found 3 missing DOIs", "warning");

// Complete
await bridge.activity.complete("Processed 100 items successfully");

// Error
await bridge.activity.error("Failed to connect to API");
```

### 6.10 MCP API

```javascript
// List available MCP servers
const servers = await bridge.mcp.list();

// Check if specific server is available
const hasGitHub = await bridge.mcp.isAvailable('github');

// Get tools from server
const tools = await bridge.mcp.getTools('github');

// Call a tool
const result = await bridge.mcp.call('github', 'create_issue', {
  title: 'Bug report',
  body: 'Description...'
});

// Read a resource
const content = await bridge.mcp.read('filesystem', 'file:///path/to/file');
```

### 6.11 Preferences API

```javascript
// Get all preferences
const prefs = await bridge.preferences.get();
console.log(prefs.apiSource); // "crossref"

// Get single preference
const useAI = await bridge.preferences.get('useAI');

// Watch for changes
bridge.preferences.onChange((newPrefs, changedKeys) => {
  if (changedKeys.includes('apiSource')) {
    console.log('API source changed to:', newPrefs.apiSource);
  }
});
```

### 6.12 Limits API

```javascript
// Get remaining resources
const remaining = await bridge.limits.remaining();
console.log(remaining.time);           // ms remaining
console.log(remaining.inferenceCalls); // calls remaining
```

### 6.13 Utilities

```javascript
// Sleep
await bridge.utils.sleep(1000);

// Retry with backoff
const result = await bridge.utils.retry(
  () => fetch('https://api.example.com/data'),
  {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000
  }
);

// Debounce
const debouncedSave = bridge.utils.debounce(save, 500);

// Throttle
const throttledUpdate = bridge.utils.throttle(update, 1000);
```

### 6.14 Cancellation

```javascript
// Check if cancelled
if (bridge.isCancelled()) {
  return;
}

// Throw if cancelled (for loops)
for (const item of items) {
  bridge.throwIfCancelled(); // Throws CancellationError
  await processItem(item);
}

// Handle cancellation
bridge.onCancel(() => {
  cleanup();
});
```

### 6.15 Versioning & Feature Detection

Agents can detect the spec version and available features for graceful degradation.

#### 6.15.1 Version Properties

| Property | Type | Description |
|----------|------|-------------|
| `bridge.specVersion` | string | Agentlet spec version (e.g., "0.1") |
| `bridge.host.version` | string | Host application version (e.g., "8.0.1") |

```javascript
// Check spec version
console.log(bridge.specVersion);  // "0.1"

// Check host version
console.log(bridge.host.version);  // "8.0.1"
```

#### 6.15.2 Feature Detection

Features represent **Bridge API availability**, distinct from host capabilities.

```javascript
bridge.supports(feature: string): boolean
bridge.features(): string[]
```

**Standard Features:**

| Feature | Description |
|---------|-------------|
| `perceive` | Adaptive perceive API |
| `act` | Adaptive act API with intents |
| `context` | Direct context access |
| `inference` | LLM inference |
| `inference:streaming` | Streaming inference |
| `inference:tools` | Tool-calling inference |
| `storage` | Persistent storage |
| `ui` | Notifications and dialogs |
| `ui:panel` | Custom panels |
| `ui:form` | Form dialogs |
| `mcp` | Model Context Protocol |
| `activity` | Progress tracking |
| `preferences` | User preferences |

**Note:** Features indicate API availability. Host capabilities (accessed via
`bridge.capabilities`) indicate data access (tags, collections, files, etc.).

```javascript
// Check feature support
if (bridge.supports('inference:streaming')) {
  await bridge.inference({ prompt, stream: true, onToken });
} else {
  const result = await bridge.inference({ prompt });
}

// List all features
console.log(bridge.features());
// ['context', 'storage', 'ui', 'inference', 'perceive', 'act', ...]
```

#### 6.15.3 Version Comparison

```javascript
bridge.compareVersion(a: string, b: string): number  // -1, 0, or 1
```

Returns:
- `1` if `a > b`
- `0` if `a == b`
- `-1` if `a < b`

```javascript
bridge.compareVersion('0.2.0', '0.1.5');  // 1  (a > b)
bridge.compareVersion('0.1.0', '0.1.0');  // 0  (a == b)
bridge.compareVersion('0.1.0', '0.2.0');  // -1 (a < b)

// Check minimum version
if (bridge.compareVersion(bridge.specVersion, '0.2') >= 0) {
  // Running on spec 0.2+
}
```

---

## 7. Lifecycle

### 7.1 Lifecycle Hooks

```javascript
// Called once when agent is first installed
bridge.onInstall(async ({ previousVersion }) => {
  await bridge.storage.set('installDate', Date.now());
  
  if (!previousVersion) {
    await bridge.ui.notify("Agent installed!", "success");
  } else {
    await migrateData(previousVersion);
  }
});

// Called each time agent is loaded/activated
bridge.onActivate(async () => {
  const prefs = await bridge.preferences.get();
  initializeWithPrefs(prefs);
});

// Called when agent is being unloaded
bridge.onDeactivate(async () => {
  await saveState();
});

// Called when app is suspending (mobile)
bridge.onSuspend(async () => {
  await bridge.storage.set('suspendedState', currentState);
});

// Called when app resumes
bridge.onResume(async () => {
  const state = await bridge.storage.get('suspendedState');
  if (state) restoreState(state);
});

// Called when agent is being uninstalled
bridge.onUninstall(async () => {
  await bridge.storage.clear();
});
```

### 7.2 Lifecycle Sequence

```
INSTALL:     onInstall({ previousVersion: null }) -> onActivate
UPDATE:      onDeactivate -> onInstall({ previousVersion }) -> onActivate
LOAD:        onActivate
UNLOAD:      onDeactivate
SUSPEND:     onSuspend
RESUME:      onResume
UNINSTALL:   onDeactivate -> onUninstall
```

### 7.3 Action Registration

```javascript
bridge.action('action-id', async (input) => {
  // input contains context based on action's data-input attribute
  const result = await doWork(input);
  return result;
});
```

---

## 8. Actions

Actions are the entry points for user-initiated operations.

### 8.1 Action Declaration

```html
<meta name="agentlet:action" content="fix-metadata"
      data-label="Fix Metadata"
      data-description="Repairs incomplete bibliographic metadata"
      data-input="selection"
      data-output="update"
      data-confirm="true">
```

### 8.2 Input Types

| Type | Description | Input Object |
|------|-------------|--------------|
| `selection` | Current user selection | `{ items: [...] }` |
| `file` | File/attachment | `{ file: { path, type, size } }` |
| `query` | Search results | `{ items: [...], query: '...' }` |
| `none` | No input | `{}` |

### 8.3 Action Implementation

```javascript
bridge.action('fix-metadata', async (input) => {
  await bridge.activity.start("Fixing metadata");
  
  const items = input.items || await bridge.context.selection.get();
  
  if (items.length === 0) {
    await bridge.ui.notify("No items selected", "warning");
    return { processed: 0 };
  }
  
  let processed = 0;
  
  for (let i = 0; i < items.length; i++) {
    bridge.throwIfCancelled();
    await bridge.activity.progress(i + 1, items.length);
    
    const fixed = await fixItem(items[i]);
    if (fixed) processed++;
  }
  
  await bridge.activity.complete(`Fixed ${processed} items`);
  return { processed };
});
```

---

## 9. Capabilities

### 9.1 Capability Categories

| Category | Capabilities |
|----------|-------------|
| **Context** | `context:{type}:read`, `context:{type}:write` |
| **Network** | `network:{domain}` |
| **Inference** | `inference:basic`, `inference:reasoning`, `inference:vision`, `inference:embedding` |
| **Storage** | `storage` |
| **UI** | `ui:notify`, `ui:confirm`, `ui:prompt`, `ui:form`, `ui:select`, `ui:panel` |
| **MCP** | `mcp:{server}` |
| **Adaptive** | `perceive`, `act` |

### 9.2 Network Capabilities

```html
<!-- Specific domains -->
<meta name="agentlet:capability" content="network:api.crossref.org">
<meta name="agentlet:capability" content="network:api.openalex.org">

<!-- Wildcard subdomains -->
<meta name="agentlet:capability" content="network:*.example.com">
```

**Rules:**
- HTTPS is required for all non-localhost domains
- HTTP is allowed only for `localhost` and `127.0.0.1`
- Hosts generate CSP from declared domains

### 9.3 Inference Capabilities

| Tier | Description |
|------|-------------|
| `inference:basic` | Simple completions, fast models |
| `inference:reasoning` | Complex reasoning, slower models |
| `inference:vision` | Image understanding |
| `inference:embedding` | Vector embeddings |

---

## 10. Standard Intents

Standard intents allow adaptive agents to express what they want to do without knowing host-specific APIs.

### 10.1 Intent Reference

| Intent | Description | Parameters |
|--------|-------------|------------|
| `add-tags` | Add tags to items | `items`, `tags: string[]` |
| `remove-tags` | Remove tags from items | `items`, `tags: string[]` |
| `move-to` | Move items to location | `items`, `destination: string` |
| `copy-to` | Copy items to location | `items`, `destination: string` |
| `link` | Create link between items | `from`, `to` |
| `unlink` | Remove link between items | `from`, `to` |
| `create` | Create new item | `type: string`, `data: object` |
| `update` | Update item fields | `items`, `fields: object` |
| `delete` | Delete items | `items` |
| `search` | Search for items | `query: string` |
| `open` | Open/focus item | `items` |
| `export` | Export items | `items`, `format: string` |
| `favorite` | Mark as favorite | `items` |
| `archive` | Archive items | `items` |

### 10.1 Intent Usage

```javascript
// Add tags
await bridge.act({
  intent: 'add-tags',
  items: context.items,
  tags: ['important', 'review-needed']
});

// Move to collection/folder
await bridge.act({
  intent: 'move-to',
  items: context.items,
  destination: 'Research/2025'
});

// Search
const result = await bridge.act({
  intent: 'search',
  query: 'machine learning transformers'
});

// Create new item
await bridge.act({
  intent: 'create',
  type: 'note',
  data: {
    title: 'Meeting Notes',
    content: '# Discussion Points\n...'
  }
});

// Update fields
await bridge.act({
  intent: 'update',
  items: context.items,
  fields: {
    status: 'reviewed',
    priority: 'high'
  }
});
```

### 10.3 Intent Availability

Hosts implement the intents that make sense for them:

| Intent | Zotero | Obsidian | VS Code |
|--------|--------|----------|---------|
| `add-tags` | Yes | Yes | No |
| `remove-tags` | Yes | Yes | No |
| `move-to` | Yes | Yes | Yes |
| `link` | No | Yes | No |
| `search` | Yes | Yes | Yes |
| `create` | Yes | Yes | Yes |
| `delete` | Yes | Yes | Yes |

Check availability before using:

```javascript
if (context.capabilities.includes('tags')) {
  await bridge.act({ intent: 'add-tags', items, tags });
} else {
  // Fallback behavior
  await bridge.ui.notify('Tags not supported in this host', 'warning');
}
```

---

## 11. Standard Host Capabilities

Standard capabilities allow agents to detect what features are available in the host.

### 11.1 Capability Reference

| Capability | Description |
|------------|-------------|
| `content` | Items have text content |
| `content:rich` | Rich text / HTML content |
| `content:markdown` | Markdown content |
| `tags` | Items can be tagged |
| `collections` | Hierarchical collections/folders |
| `folders` | File-system-like folders |
| `favorites` | Favorite/star feature |
| `links` | Items can link to each other |
| `backlinks` | Bidirectional link tracking |
| `references` | Citation/reference relationships |
| `metadata` | Rich metadata fields |
| `metadata:custom` | User-defined metadata |
| `dates` | Date fields |
| `authors` | Author/creator fields |
| `search` | Full-text search |
| `search:semantic` | Semantic/vector search |
| `batch` | Batch operations |
| `attachments` | File attachments |
| `images` | Image support |
| `pdf` | PDF handling |

### 11.2 Capability Detection

```javascript
// From perceive result
const ctx = await bridge.perceive({ scope: 'selection' });
if (ctx.capabilities.includes('tags')) {
  // Tags are available
}

// Direct check
if (bridge.hasCapability('search')) {
  // Search is available
}

// Multiple capabilities
const hasAdvanced = ['tags', 'collections', 'search']
  .every(cap => ctx.capabilities.includes(cap));
```

### 11.3 Host Capability Matrix

| Capability | Zotero | Obsidian | VS Code | Notion |
|------------|--------|----------|---------|--------|
| `content` | Yes | Yes | Yes | Yes |
| `content:markdown` | No | Yes | Yes | Yes |
| `tags` | Yes | Yes | No | Yes |
| `collections` | Yes | No | No | Yes |
| `folders` | No | Yes | Yes | No |
| `links` | No | Yes | No | Yes |
| `backlinks` | No | Yes | No | Yes |
| `search` | Yes | Yes | Yes | Yes |
| `attachments` | Yes | Yes | No | Yes |
| `pdf` | Yes | No | No | No |

---

## 12. Preferences

### 12.1 Preference Types

| Type | Attributes |
|------|------------|
| `boolean` | `data-default` |
| `string` | `data-default`, `data-placeholder`, `data-maxlength`, `data-pattern` |
| `number` | `data-default`, `data-min`, `data-max`, `data-step` |
| `select` | `data-default`, plus `preference:option` tags |

### 12.2 Accessing Preferences

```javascript
// Get all
const prefs = await bridge.preferences.get();

// Get one
const apiSource = await bridge.preferences.get('apiSource');

// Watch changes
bridge.preferences.onChange((prefs, changed) => {
  if (changed.includes('apiSource')) {
    reinitializeAPI(prefs.apiSource);
  }
});
```

---

## 13. Error Handling

### 13.1 Error Codes

| Code | Name | Description |
|------|------|-------------|
| **E1xx** | **Permission** | |
| E101 | PERMISSION_DENIED | Permission denied |
| E102 | CAPABILITY_NOT_GRANTED | Capability not in manifest |
| **E2xx** | **Context** | |
| E201 | CONTEXT_NOT_FOUND | Item not found |
| E202 | CONTEXT_TYPE_UNSUPPORTED | Context type not supported |
| E203 | CONTEXT_VALIDATION_FAILED | Data validation failed |
| **E3xx** | **Inference** | |
| E301 | INFERENCE_FAILED | Inference request failed |
| E302 | INFERENCE_TIMEOUT | Request timed out |
| E303 | INFERENCE_RATE_LIMITED | Rate limited |
| **E4xx** | **Network** | |
| E401 | NETWORK_ERROR | Network request failed |
| E402 | NETWORK_TIMEOUT | Request timed out |
| E403 | NETWORK_DOMAIN_NOT_ALLOWED | Domain not in allowlist |
| **E5xx** | **Resources** | |
| E501 | LIMIT_TIME_EXCEEDED | Execution time exceeded |
| E502 | LIMIT_INFERENCE_EXCEEDED | Inference calls exceeded |
| **E6xx** | **Agent** | |
| E601 | AGENT_INVALID | Invalid agent format |
| E602 | AGENT_ACTION_NOT_FOUND | Action not found |
| **E7xx** | **User** | |
| E701 | USER_CANCELLED | User cancelled operation |
| E702 | USER_DISMISSED | User dismissed dialog |
| **E8xx** | **Host** | |
| E801 | HOST_UNSUPPORTED | Host doesn't support feature |
| E802 | HOST_ERROR | Internal host error |
| E804 | SPEC_VERSION_TOO_LOW | Host spec version below agent's minimum |
| E805 | SPEC_VERSION_TOO_HIGH | Host spec version above agent's maximum |
| E806 | FEATURE_NOT_SUPPORTED | Required feature not available |
| **E9xx** | **MCP** | |
| E901 | MCP_SERVER_NOT_FOUND | MCP server not found |
| E902 | MCP_CONNECTION_FAILED | Failed to connect |
| **E10xx** | **Adaptive** | |
| E1001 | INTENT_NOT_SUPPORTED | Intent not supported by host |
| E1002 | PERCEIVE_FAILED | Perceive operation failed |
| E1003 | ACT_FAILED | Act operation failed |

### 13.2 Error Handling

```javascript
try {
  await bridge.act({ intent: 'add-tags', items, tags });
} catch (error) {
  switch (error.code) {
    case 'E1001':
      // Intent not supported, use fallback
      await bridge.ui.notify('Tags not supported here', 'warning');
      break;
    case 'E701':
      // User cancelled
      return;
    default:
      throw error;
  }
}
```

---

## 14. Installation & Distribution

### 14.1 Installation Sources

```
# Direct URL
https://example.com/my-agent.agentlet

# GitHub
https://github.com/user/repo/releases/download/v1.0.0/agent.agentlet

# Local development
http://localhost:8080/agent.agentlet
```

### 14.2 Installation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. FETCH - Host fetches the .agentlet file                         │
├─────────────────────────────────────────────────────────────────────┤
│  2. PARSE - Extract manifest using DOMParser (no execution)         │
├─────────────────────────────────────────────────────────────────────┤
│  3. VALIDATE - Check required fields and compatibility              │
├─────────────────────────────────────────────────────────────────────┤
│  4. COMPATIBILITY CHECK                                             │
│     - host-specific: Must match declared host                       │
│     - host-family: Warn if not in list                             │
│     - universal: Always compatible                                  │
│     - adaptive: Check required capabilities                         │
├─────────────────────────────────────────────────────────────────────┤
│  5. PERMISSION DIALOG - Show requested capabilities                 │
├─────────────────────────────────────────────────────────────────────┤
│  6. STORE - Save agent content and manifest                         │
├─────────────────────────────────────────────────────────────────────┤
│  7. ACTIVATE - Call onInstall, onActivate                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 14.3 Manifest Extraction

```javascript
function extractManifest(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  const meta = (name) => 
    doc.querySelector(`meta[name="${name}"]`)?.content;
  
  const metaAll = (name) => 
    [...doc.querySelectorAll(`meta[name="${name}"]`)]
      .map(el => el.content);
  
  return {
    manifestVersion: meta('agentlet'),
    name: meta('agentlet:name'),
    version: meta('agentlet:version'),
    title: doc.title,
    portability: meta('agentlet:portability') || 'universal',
    capabilities: metaAll('agentlet:capability'),
    requires: metaAll('agentlet:requires'),
    optional: metaAll('agentlet:optional'),
    intents: metaAll('agentlet:intent'),
    hosts: metaAll('agentlet:host'),
    // ... etc
  };
}
```

---

## 15. Security

### 15.1 Sandbox

Agents run in sandboxed iframes:

```html
<iframe 
  sandbox="allow-scripts allow-same-origin"
  srcdoc="...agentlet content..."
></iframe>
```

### 15.2 Content Security Policy

Hosts generate CSP from declared capabilities:

```javascript
function buildCSP(capabilities) {
  const networkCaps = capabilities
    .filter(c => c.startsWith('network:'))
    .map(c => c.replace('network:', ''));
  
  const connectSrc = networkCaps.length > 0
    ? networkCaps.map(d => `https://${d}`).join(' ')
    : "'none'";
  
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline' blob:",
    `connect-src ${connectSrc}`,
    "style-src 'unsafe-inline'",
    "img-src data: blob:"
  ].join('; ');
}
```

### 15.3 Permission Enforcement

All bridge calls are validated against manifest capabilities.

---

## 16. Host Implementation

### 16.1 Required Components

| Component | Responsibility |
|-----------|----------------|
| Agent Manager | Install, uninstall, list agents |
| Agent Runtime | Execute agents, manage sandboxes |
| Bridge Handler | Route messages, enforce permissions |
| Context Adapter | Map host data to Agentlet API |
| Intent Handler | Execute standard intents |
| UI Handler | Render notifications, dialogs, panels |
| Storage Adapter | Persist agent data |

### 16.2 Implementing Perceive

```javascript
async function handlePerceive(options, manifest) {
  // Get items based on scope
  let items;
  switch (options.scope) {
    case 'selection':
      items = await getSelectedItems();
      break;
    case 'all':
      items = await getAllItems();
      break;
    case 'query':
      items = await searchItems(options.query);
      break;
  }
  
  // Limit results
  items = items.slice(0, options.limit || 100);
  
  // Build response
  const response = {
    host: HOST_NAME,
    hostVersion: HOST_VERSION,
    items,
    capabilities: getHostCapabilities(),
    schema: getItemSchema()
  };
  
  // AI interpretation if requested
  if (options.understand) {
    response.understanding = await generateUnderstanding(items);
  }
  
  return response;
}

async function generateUnderstanding(items) {
  // Use host's inference provider
  return await inference({
    prompt: `Describe these ${items.length} items briefly: ${JSON.stringify(items.slice(0, 5))}`
  });
}
```

### 16.3 Implementing Act

```javascript
async function handleAct(action, manifest) {
  const { intent, items, ...params } = action;
  
  // Check if intent is supported
  if (!SUPPORTED_INTENTS.includes(intent)) {
    throw new AgentletError('E1001', `Intent not supported: ${intent}`);
  }
  
  // Execute intent
  switch (intent) {
    case 'add-tags':
      return await addTags(items, params.tags);
    case 'remove-tags':
      return await removeTags(items, params.tags);
    case 'move-to':
      return await moveItems(items, params.destination);
    case 'search':
      return { result: await searchItems(params.query) };
    // ... etc
  }
}
```

---

## 17. Examples

### 17.1 Universal Agent: Text Improver

```html
<!DOCTYPE html>
<title>Text Improver</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="text-improver">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="universal">
<meta name="agentlet:capability" content="inference:basic">
<meta name="agentlet:capability" content="ui:prompt">
<meta name="agentlet:capability" content="ui:panel">
<meta name="agentlet:action" content="improve" data-label="Improve Text">

<script type="module">
bridge.action('improve', async () => {
  const text = await bridge.ui.prompt('Paste text to improve:');
  if (!text) return;
  
  const improved = await bridge.inference({
    prompt: `Improve this text for clarity and flow:\n\n${text}`
  });
  
  await bridge.ui.panel({
    title: 'Improved Text',
    content: `<div style="padding:1rem;white-space:pre-wrap">${improved}</div>`
  });
});
</script>
```

### 17.2 Adaptive Agent: Smart Organizer

```html
<!DOCTYPE html>
<title>Smart Organizer</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="smart-organizer">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:optional" content="collections">
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:intent" content="move-to">
<meta name="agentlet:capability" content="ui:panel">
<meta name="agentlet:capability" content="ui:notify">
<meta name="agentlet:action" content="organize" data-label="Organize Selection">

<script type="module">
bridge.action('organize', async () => {
  // 1. Perceive
  const ctx = await bridge.perceive({
    scope: 'selection',
    understand: true
  });
  
  if (ctx.items.length === 0) {
    await bridge.ui.notify('Select items first', 'warning');
    return;
  }
  
  await bridge.activity.start(`Organizing ${ctx.items.length} items`);
  
  // 2. Reason
  const plan = await bridge.inference({
    prompt: `Based on: ${ctx.understanding}
    
Available capabilities: ${ctx.capabilities.join(', ')}

Suggest organization. Return JSON:
{
  "summary": "brief analysis",
  "tags": ["tag1", "tag2"] or null,
  "collection": "suggested location" or null
}`
  });
  
  let planData;
  try {
    planData = JSON.parse(plan);
  } catch {
    await bridge.ui.notify('Failed to create plan', 'error');
    return;
  }
  
  // 3. Act
  const results = [];
  
  if (ctx.capabilities.includes('tags') && planData.tags?.length) {
    try {
      await bridge.act({
        intent: 'add-tags',
        items: ctx.items,
        tags: planData.tags
      });
      results.push(`Added tags: ${planData.tags.join(', ')}`);
    } catch (e) {
      if (e.code !== 'E1001') throw e;
    }
  }
  
  if (ctx.capabilities.includes('collections') && planData.collection) {
    try {
      await bridge.act({
        intent: 'move-to',
        items: ctx.items,
        destination: planData.collection
      });
      results.push(`Moved to: ${planData.collection}`);
    } catch (e) {
      if (e.code !== 'E1001') throw e;
    }
  }
  
  await bridge.activity.complete('Done');
  
  // 4. Report
  await bridge.ui.panel({
    title: 'Organization Complete',
    content: `
      <div style="padding:1rem;font-family:system-ui">
        <h3>Analysis</h3>
        <p>${planData.summary}</p>
        <h3>Actions</h3>
        <ul>${results.map(r => `<li>${r}</li>`).join('') || '<li>No actions taken</li>'}</ul>
        <p style="color:#666;font-size:0.9rem">
          Host: ${ctx.host} | Capabilities: ${ctx.capabilities.join(', ')}
        </p>
      </div>
    `
  });
});
</script>
```

### 17.3 Host-Specific Agent: Zotero Citation Validator

See [AGENT-TYPES.md](./AGENT-TYPES.md) for complete example.

### 17.4 Host-Family Agent: Note Linker

See [AGENT-TYPES.md](./AGENT-TYPES.md) for complete example.

---

## Appendix A: Meta Tag Quick Reference

| Meta Name | Example | Required |
|-----------|---------|----------|
| `agentlet` | `0.1` | Yes |
| `agentlet:name` | `my-agent` | Yes |
| `agentlet:version` | `1.0.0` | Yes |
| `agentlet:portability` | `adaptive` | Yes |
| `agentlet:description` | `Does something` | No |
| `agentlet:author` | `Jane Doe` | No |
| `agentlet:license` | `MIT` | No |
| `agentlet:host` | `zotero:>=7.0.0` | Conditional |
| `agentlet:requires` | `perceive` | No |
| `agentlet:optional` | `tags` | No |
| `agentlet:intent` | `add-tags` | No |
| `agentlet:capability` | `inference:basic` | Yes (>=1) |
| `agentlet:action` | `action-id` | Yes (>=1) |
| `agentlet:preference` | `pref-id` | No |

---

## Appendix B: Bridge API Quick Reference

```javascript
// Host (all types)
bridge.host.name                    // string
bridge.host.version                 // string
bridge.capabilities                 // string[]
bridge.hasCapability(name)          // boolean

// Versioning (all types)
bridge.specVersion                  // string
bridge.features()                   // string[]
bridge.supports(feature)            // boolean
bridge.compareVersion(a, b)         // number (-1, 0, 1)

// Adaptive
bridge.perceive(options?)           // Promise<Perception>
bridge.act(action)                  // Promise<ActionResult>

// Context (host-specific/host-family)
bridge.context.query(type, filters) // Promise<any[]>
bridge.context.get(type, id)        // Promise<any>
bridge.context.create(type, data)   // Promise<any>
bridge.context.update(type, id, data) // Promise<void>
bridge.context.delete(type, id)     // Promise<void>
bridge.context.selection.get()      // Promise<any[]>

// Universal
bridge.inference(options)           // Promise<string>
bridge.storage.get(key)             // Promise<any>
bridge.storage.set(key, value)      // Promise<void>
bridge.storage.remove(key)          // Promise<void>
bridge.storage.clear()              // Promise<void>
bridge.storage.keys()               // Promise<string[]>
bridge.ui.notify(msg, type)         // Promise<void>
bridge.ui.confirm(msg)              // Promise<boolean>
bridge.ui.prompt(msg, default?)     // Promise<string|null>
bridge.ui.form(options)             // Promise<object|null>
bridge.ui.select(options)           // Promise<any|null>
bridge.ui.panel(options)            // Promise<string>
bridge.mcp.list()                   // Promise<Server[]>
bridge.mcp.call(server, tool, params) // Promise<any>
bridge.preferences.get()            // Promise<object>
bridge.limits.remaining()           // Promise<object>
bridge.activity.start(msg)          // Promise<void>
bridge.activity.progress(cur, total) // Promise<void>
bridge.activity.complete(msg)       // Promise<void>
bridge.utils.sleep(ms)              // Promise<void>
bridge.utils.retry(fn, options)     // Promise<any>
bridge.isCancelled()                // boolean
bridge.throwIfCancelled()           // void

// Lifecycle
bridge.onInstall(handler)
bridge.onActivate(handler)
bridge.onDeactivate(handler)
bridge.onUninstall(handler)
bridge.action(id, handler)
```

---

## Changelog

### v0.1.0 (Current)

- **New:** Portability types (host-specific, host-family, universal, adaptive)
- **New:** `bridge.perceive()` API for adaptive agents
- **New:** `bridge.act()` API with standard intents
- **New:** `bridge.host.*` for host detection
- **New:** `bridge.capabilities` for capability detection
- **New:** `bridge.specVersion` for spec version detection
- **New:** `bridge.features()` and `bridge.supports()` for feature detection
- **New:** `bridge.compareVersion()` for version comparison
- **New:** Version constraint attributes (`data-min-spec`, `data-max-spec`)
- **New:** Action deprecation attributes (`data-deprecated`, `data-deprecated-message`, `data-remove-in`)
- **New:** Error codes E804-E806 for version/feature errors
- **New:** Standard intents vocabulary
- **New:** Standard host capabilities vocabulary
- **New:** `agentlet:portability` manifest tag
- **New:** `agentlet:requires` and `agentlet:optional` manifest tags
- **New:** `agentlet:intent` manifest tag
- **Changed:** Updated version to 0.1

### v0.0.1

- Initial preview release
- HTML-based `.agentlet` file format
- Meta tag manifest
- Bridge API (context, inference, storage, ui, mcp)
- Lifecycle hooks
- Sandbox security
