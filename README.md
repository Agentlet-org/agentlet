# Agentlet

**The Open Standard for Portable AI Agents**

> ⚠️ **Status: Preview (v0.1.0)** — The spec is usable but evolving. Breaking changes expected before v1.0. [See roadmap →](./ROADMAP.md)

---

## What is Agentlet?

Agentlet is an open standard for packaging, distributing, and running AI-powered agents. Write an agent once as a simple `.agentlet` file, and run it in Zotero, Obsidian, VS Code, or any application that supports the spec.

```html
<!DOCTYPE html>
<title>Smart Tagger</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:action" content="tag" data-label="Auto-Tag">

<script type="module">
bridge.action('tag', async () => {
  const context = await bridge.perceive({ scope: 'selection', understand: true });
  
  const tags = await bridge.inference({
    prompt: `Suggest 3 tags for: ${context.understanding}`
  });
  
  if (context.capabilities.includes('tags')) {
    await bridge.act({ intent: 'add-tags', items: context.items, tags: tags.split(',') });
  }
  
  await bridge.ui.notify(`Tagged ${context.items.length} items`, 'success');
});
</script>
```

**That's a complete agent that works in any host.**

---

## Why Agentlet?

| Problem | Agentlet Solution |
|---------|-------------------|
| AI agents locked to one platform | **Portable** — same agent runs in multiple apps |
| Agents require cloud services | **Local-first** — runs in your app, not the cloud |
| Complex SDKs and build tools | **Simple** — single HTML file, no dependencies |
| Black-box agent behavior | **Transparent** — users see what agents can do |
| Plugin ecosystems are fragmented | **Universal format** — one spec, many hosts |

---

## The Portability Spectrum

Not all agents need to work everywhere. Agentlet supports a spectrum of portability:

```
+--------------------------------------------------------------------------+
|                                                                          |
|  Host-Specific     Host-Family       Universal         Adaptive          |
|       |                 |                |                 |             |
|       v                 v                v                 v             |
|  +---------+       +---------+      +---------+       +---------+        |
|  |  Full   |       | Shared  |      |  Zero   |       |   AI    |        |
|  |  Host   |       |  Logic  |      | Context |       | Bridges |        |
|  |  Power  |       |    +    |      |  Needs  |       |   Gap   |        |
|  |         |       | Adapts  |      |         |       |         |        |
|  +---------+       +---------+      +---------+       +---------+        |
|                                                                          |
|  Zotero DOI         Note app        AI writing         Research          |
|  validator          linker          assistant          organizer         |
|                                                                          |
+--------------------------------------------------------------------------+
```

| Type | Description | Best For |
|------|-------------|----------|
| **Host-Specific** | Uses full power of one host | Deep integrations, domain-specific tools |
| **Host-Family** | Works across similar apps | Note apps, IDEs, task managers |
| **Universal** | No host context needed | AI utilities, text processing |
| **Adaptive** | AI figures out any host | Smart assistants, general-purpose tools |

See [AGENT-TYPES.md](./AGENT-TYPES.md) for detailed examples of each type.

---

## Key Features

### 🤖 AI-Native

Every agent has built-in access to AI inference — no API keys, no provider configuration.

```javascript
const summary = await bridge.inference({
  prompt: `Summarize: ${text}`,
  max_tokens: 200
});
```

**Today:** Hosts route to cloud APIs, local models, or native platform AI (Chrome built-in AI, Apple Intelligence, Windows Copilot). 

**Tomorrow:** As platform AI becomes ubiquitous, the same agent code works everywhere without changes.

### 📦 Single-File Distribution
One `.agentlet` file contains everything — manifest, code, UI templates, styles. Share via URL.

### 🔒 Privacy by Design
Agents run in a sandboxed WebView inside your app. Your data never leaves your device unless explicitly allowed.

### 👁️ User Transparency
Agents declare their capabilities upfront. Users see exactly what permissions an agent requests before installing.

### 🔧 Developer Friendly
If you can write HTML and JavaScript, you can write an agent. No special tools, no build step, no SDK.

---

## Quick Start

### 1. Choose Your Agent Type

**Universal** (simplest) — works anywhere, uses only AI + UI:

```html
<!DOCTYPE html>
<title>Text Improver</title>
<meta name="agentlet" content="0.1">
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

**Adaptive** (most powerful) — works anywhere, uses host data:

```html
<!DOCTYPE html>
<title>Smart Organizer</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:action" content="organize" data-label="Organize Selection">

<script type="module">
bridge.action('organize', async () => {
  // Perceive: understand what we're working with
  const context = await bridge.perceive({
    scope: 'selection',
    understand: true
  });
  
  // Reason: figure out how to organize
  const plan = await bridge.inference({
    prompt: `Suggest tags for: ${context.understanding}`
  });
  
  // Act: apply using available capabilities
  if (context.capabilities.includes('tags')) {
    await bridge.act({
      intent: 'add-tags',
      items: context.items,
      tags: plan.split(',').map(t => t.trim())
    });
  }
  
  await bridge.ui.notify('Organized!', 'success');
});
</script>
```

### 2. Test in Browser

Open the `.agentlet` file directly in your browser to inspect it.

### 3. Install in a Host App

Host applications provide the runtime. Check if your favorite app supports Agentlet, or [help us build an integration](#host-integrations).

---

## How It Works

```
+-----------------------------------------------------------+
|                    Host Application                       |
|       (Zotero, Obsidian, VS Code, Electron, etc.)         |
|                                                           |
|  +-----------------------------------------------------+  |
|  |                   Agent Runtime                     |  |
|  |  +----------+  +----------+  +----------+           |  |
|  |  | Context  |  |Inference |  |    UI    |           |  |
|  |  | Adapter  |  | Provider |  | Handler  |           |  |
|  |  +----------+  +----------+  +----------+           |  |
|  |                      |                              |  |
|  |                Bridge Handler                       |  |
|  |            (permission enforcement)                 |  |
|  +----------------------|------------------------------+  |
|                         |                                 |
|  +----------------------|------------------------------+  |
|  |           WebView Sandbox (iframe)                  |  |
|  |                      |                              |  |
|  |  +-------------------v---------------------------+  |  |
|  |  |           your-agent.agentlet                 |  |  |
|  |  |                                               |  |  |
|  |  |  bridge.perceive()  -> Understand host        |  |  |
|  |  |  bridge.inference() -> AI reasoning           |  |  |
|  |  |  bridge.act()       -> Take action            |  |  |
|  |  |  bridge.ui.*        -> Show results           |  |  |
|  |  +-----------------------------------------------+  |  |
|  +-----------------------------------------------------+  |
+-----------------------------------------------------------+
```

1. **Host application** loads the `.agentlet` file
2. **Agent runtime** creates a sandboxed WebView
3. **Agent code** runs inside the sandbox
4. **Bridge API** mediates between agent and host
5. **Capabilities** are checked before any action

---

## Bridge API Overview

### Universal APIs (Work Everywhere)

```javascript
// AI Inference
const response = await bridge.inference({ prompt: '...' });

// Storage
await bridge.storage.set('key', value);
const data = await bridge.storage.get('key');

// User Interface
await bridge.ui.notify('Done!', 'success');
const confirmed = await bridge.ui.confirm('Proceed?');
await bridge.ui.panel({ title: 'Results', content: html });
```

### Adaptive APIs (For Portable Agents)

```javascript
// Perceive: understand what's available
const context = await bridge.perceive({
  scope: 'selection',    // 'selection' | 'all' | 'query'
  understand: true       // AI interprets the data
});
// Returns: { host, items, understanding, capabilities, schema }

// Act: express intent, host figures out how
await bridge.act({
  intent: 'add-tags',    // Standard intent
  items: context.items,
  tags: ['important', 'review']
});

// Capabilities: check what's available
if (context.capabilities.includes('search')) {
  await bridge.act({ intent: 'search', query: 'machine learning' });
}
```

### Host-Specific APIs (For Deep Integration)

```javascript
// Direct context access (varies by host)
const items = await bridge.context.query('bibliographic', {
  itemType: 'journalArticle'
});

await bridge.context.update('bibliographic', item.id, {
  tags: ['processed']
});
```

---

## Agent Types at a Glance

### Host-Specific

```html
<meta name="agentlet:portability" content="host-specific">
<meta name="agentlet:host" content="zotero:>=7.0.0">
```

Uses full host API. Maximum power, single platform.

### Host-Family

```html
<meta name="agentlet:portability" content="host-family">
<meta name="agentlet:host" content="obsidian:>=1.0.0">
<meta name="agentlet:host" content="logseq:>=0.9.0">
```

Shared logic with per-host adapters. Works across similar apps.

### Universal

```html
<meta name="agentlet:portability" content="universal">
```

No host context. Uses only inference, storage, UI. Works anywhere.

### Adaptive

```html
<meta name="agentlet:portability" content="adaptive">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">
<meta name="agentlet:optional" content="tags">
```

AI interprets any host. Maximum portability with full power.

**[See AGENT-TYPES.md for complete examples →](./AGENT-TYPES.md)**

---

## Standard Intents

Adaptive agents use intents to express what they want to do:

| Intent | Description | Parameters |
|--------|-------------|------------|
| `add-tags` | Tag items | `items`, `tags: string[]` |
| `remove-tags` | Remove tags | `items`, `tags: string[]` |
| `move-to` | Move to location | `items`, `destination` |
| `search` | Find items | `query: string` |
| `create` | Create item | `type`, `data` |
| `update` | Update fields | `items`, `fields` |
| `delete` | Remove items | `items` |

Hosts implement the intents that make sense for them.

---

## Standard Capabilities

```javascript
// Check what's available
const caps = context.capabilities;

// Content
'content'         // Items have text content
'content:rich'    // Rich text / HTML
'content:markdown'// Markdown

// Organization
'tags'            // Tagging support
'collections'     // Hierarchical collections
'folders'         // File-system folders

// Relationships
'links'           // Items can link
'backlinks'       // Bidirectional links

// Operations
'search'          // Full-text search
'search:semantic' // Vector search
```

---

## Current Status

### What Works Today (v0.1)

| Feature | Status |
|---------|--------|
| `.agentlet` file format | ✅ Working |
| Meta tag manifest | ✅ Working |
| Sandbox execution | ✅ Working |
| Universal APIs (inference, storage, ui) | ✅ Working |
| Host detection | ✅ Working |
| Perceive/Act APIs | ✅ Working |
| Standard intents | ✅ Working |

### What's Coming

| Version | Theme |
|---------|-------|
| v0.2 | Developer Experience — CLI tools, testing library |
| v0.3 | Discovery & Trust — Registry, author verification |
| v1.0 | Stable — Spec freeze, stability guarantees |

See the [full roadmap →](./ROADMAP.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [SPEC.md](./SPEC.md) | Full specification |
| [AGENT-TYPES.md](./AGENT-TYPES.md) | Agent types guide with examples |
| [ROADMAP.md](./ROADMAP.md) | Version roadmap |
| [CHANGELOG.md](./CHANGELOG.md) | Version history |

---

## Examples

### Minimal Agent (Universal)

```html
<!DOCTYPE html>
<title>Hello World</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="universal">
<meta name="agentlet:capability" content="ui:notify">
<meta name="agentlet:action" content="greet" data-label="Say Hello">

<script type="module">
bridge.action('greet', async () => {
  await bridge.ui.notify('Hello from Agentlet! 👋', 'success');
});
</script>
```

### AI Summarizer (Universal)

```html
<!DOCTYPE html>
<title>Summarizer</title>
<meta name="agentlet" content="0.1">
<meta name="agentlet:portability" content="universal">
<meta name="agentlet:capability" content="inference:basic">
<meta name="agentlet:capability" content="ui:prompt">
<meta name="agentlet:capability" content="ui:panel">
<meta name="agentlet:action" content="summarize" data-label="Summarize Text">

<script type="module">
bridge.action('summarize', async () => {
  const text = await bridge.ui.prompt('Paste text to summarize:');
  if (!text) return;
  
  const summary = await bridge.inference({
    prompt: `Summarize concisely:\n\n${text}`,
    max_tokens: 200
  });
  
  await bridge.ui.panel({
    title: 'Summary',
    content: `<p style="padding:1rem">${summary}</p>`
  });
});
</script>
```

### Smart Organizer (Adaptive)

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
  
  if (ctx.items.length === 0) {
    await bridge.ui.notify('Select items first', 'warning');
    return;
  }
  
  const analysis = await bridge.inference({
    prompt: `Suggest organization for: ${ctx.understanding}\n\nReturn JSON: { tags: [], summary: "" }`
  });
  
  const plan = JSON.parse(analysis);
  
  if (ctx.capabilities.includes('tags') && plan.tags.length) {
    await bridge.act({ intent: 'add-tags', items: ctx.items, tags: plan.tags });
  }
  
  await bridge.ui.panel({
    title: 'Organized',
    content: `<div style="padding:1rem">
      <p>${plan.summary}</p>
      <p>Tags: ${plan.tags.join(', ')}</p>
    </div>`
  });
});
</script>
```

More examples in [AGENT-TYPES.md](./AGENT-TYPES.md).

---

## Host Integrations

### Currently Exploring

| Host | Status | Notes |
|------|--------|-------|
| Zotero | 🔬 Research | Reference manager |
| Obsidian | 🔬 Research | Note-taking |
| VS Code | 🔬 Research | Code editor |

### Want to Add Support?

See the [Host Implementation Guide](./SPEC.md#13-host-implementation) in the spec.

A minimal host needs:
- WebView/iframe container
- Bridge message handler
- Context adapter for your data model
- UI handler for notifications/dialogs

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

### Ways to Help

- **Try it:** Build an agent, report what's confusing
- **Feedback:** Open issues, join discussions
- **Code:** Runtime improvements, host adapters
- **Docs:** Examples, tutorials, translations

---

## FAQ

### How is this different from ChatGPT Plugins / GPTs?

| | Agentlet | ChatGPT Plugins |
|--|----------|-----------------|
| Runs in | Any app | ChatGPT only |
| Data | Stays local | Sent to OpenAI |
| Distribution | Any URL | OpenAI store |
| Lock-in | Open standard | Proprietary |

### How is this different from browser extensions?

Browser extensions only work in browsers. Agentlet agents work in any application with a WebView — desktop apps, mobile apps, browser extensions, or the OS itself.

### Is my data safe?

Agents run in a sandboxed WebView and can only access what they declare in their manifest. Network access is restricted to declared domains. Inference can use local models (Ollama) if configured.

### What AI models can agents use?

Any model the host provides. The spec is model-agnostic. Common setups: OpenAI, Anthropic, Ollama (local).

### Can I write a host-specific agent?

Yes! Not all agents need to be portable. Host-specific agents use the full power of one platform. See [AGENT-TYPES.md](./AGENT-TYPES.md).

---

## About

**Agentlet** is an open specification for portable AI agents. It grew from research into human-AI collaboration — specifically how AI systems can augment human capabilities while maintaining user agency and transparency.

The "user in control" principle isn't just design philosophy — it's informed by ongoing research into how humans and AI systems can work together effectively.

---

## License

MIT — see [LICENSE](./LICENSE)

---

## Links

- **Spec:** [SPEC.md](./SPEC.md)
- **Agent Types:** [AGENT-TYPES.md](./AGENT-TYPES.md)
- **Roadmap:** [ROADMAP.md](./ROADMAP.md)
- **GitHub:** [github.com/Agentlet-org/agentlet](https://github.com/Agentlet-org/agentlet)

---

## Author

Created by [José Fernandes](https://github.com/introfini) ([ResearchGate](https://www.researchgate.net/profile/Jose-Fernandes-46)), PhD researcher at University of Minho studying human-AI collaboration. Agentlet grew from research into how AI agents can augment human capabilities while keeping users in control.

---

<p align="center">
  <strong>Portable AI Agents for Any App</strong><br>
  From host-specific specialists to adaptive agents that work anywhere.
</p>
