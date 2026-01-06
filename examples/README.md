# Agentlet Examples

Example agents organized by portability type.

```
examples/
├── universal/          # Work in any host, no context needed
├── adaptive/           # AI adapts to any host via perceive/act
├── host-family/        # Work across similar apps (PKM, editors, etc.)
└── host-specific/      # Deep integration with one host
```

---

## Quick Start

The simplest possible agent (10 lines):

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

---

## Universal

**Works everywhere, no host context needed.**

| Agent | Description | Key APIs |
|-------|-------------|----------|
| [hello-world](./universal/hello-world.agentlet) | Minimal 10-line example | `ui.notify` |
| [text-improver](./universal/text-improver.agentlet) | AI text tools (improve, summarize, translate) | `inference`, `ui.prompt`, `storage` |

---

## Adaptive

**AI interprets any host via `perceive()` and `act()`.**

| Agent | Description | Key APIs |
|-------|-------------|----------|
| [smart-organizer](./adaptive/smart-organizer.agentlet) | AI-powered organization | `perceive`, `act`, `inference` |
| [code-explainer](./adaptive/code-explainer.agentlet) | Explains selected code | `perceive`, `inference`, `ui.panel` |
| [todo-collector](./adaptive/todo-collector.agentlet) | Finds TODOs/FIXMEs across files | `perceive`, `storage`, `inference` |
| [doc-drafter](./adaptive/doc-drafter.agentlet) | Generates docs from code or notes | `perceive`, `act`, `inference` |
| [link-suggester](./adaptive/link-suggester.agentlet) | Suggests connections between files | `perceive`, `inference`, `act` |
| [daily-summary](./adaptive/daily-summary.agentlet) | Summarizes recent work | `perceive`, `storage`, `inference` |

---

## Host-Family

**Works across similar applications.**

| Agent | Description | Target Hosts |
|-------|-------------|--------------|
| [note-linker](./host-family/note-linker.agentlet) | Links related notes | Obsidian, Logseq, Notion |
| [commit-message](./host-family/commit-message.agentlet) | Generates commit messages | VS Code, JetBrains, Terminal |
| [test-generator](./host-family/test-generator.agentlet) | Generates unit tests | VS Code, Cursor, JetBrains |
| [refactor-assistant](./host-family/refactor-assistant.agentlet) | AI refactoring with diffs | VS Code, Cursor |

---

## Host-Specific

**Maximum power for one platform.**

| Agent | Description | Target Host |
|-------|-------------|-------------|
| [zotero-citation-validator](./host-specific/zotero-citation-validator.agentlet) | Validates DOIs against CrossRef | Zotero 7+ |
| [multifile-refactorer](./host-specific/multifile-refactorer.agentlet) | Large-scale cross-file refactoring | VS Code |

---

## Community Agents

**Real-world agents built by the community.** These live in external repositories to demonstrate ecosystem adoption.

| Agent | Description | Target Host | Repository |
|-------|-------------|-------------|------------|
| Zotero Metadata Healer | Fixes missing DOI, abstract, volume/issue/pages via CrossRef/OpenAlex | Zotero 7+ | [zotero-metadata-healer](https://github.com/introfini/zotero-metadata-healer) |

> **Want your agent listed?** Open a PR adding it to this table. Requirements: working agent, README with install instructions, compatible with spec v0.1+.

---

## Portability Spectrum

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   Universal        Adaptive         Host-Family      Host-Specific         │
│       │               │                 │                 │                │
│       ▼               ▼                 ▼                 ▼                │
│  ┌─────────┐     ┌─────────┐       ┌─────────┐       ┌─────────┐          │
│  │  hello  │     │  smart  │       │  note   │       │ zotero  │          │
│  │  world  │     │organizer│       │ linker  │       │citation │          │
│  └─────────┘     └─────────┘       └─────────┘       └─────────┘          │
│                                                                             │
│  No context       AI adapts         Shared logic      Full host            │
│  needed           to any host       + adapters        integration          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Which Type Should I Use?

| If you want... | Use | Example |
|----------------|-----|---------|
| Simple utility that works everywhere | Universal | text-improver |
| Smart agent that adapts to any host | Adaptive | smart-organizer |
| Work across similar apps (PKM, editors) | Host-Family | note-linker |
| Maximum features for one app | Host-Specific | zotero-citation-validator |

---

## Running Examples

1. **In a host application:** Install the `.agentlet` file in a compatible host
2. **In browser:** Open the file directly to see the preview (in `<noscript>`)
3. **For development:** Serve via HTTP and install by URL:
   ```bash
   cd examples && python3 -m http.server 8888
   # Then install: http://localhost:8888/universal/hello-world.agentlet
   ```

---

## Testing New Hosts

When developing a new host, use these agents to verify functionality:

| Stage | Test With | Validates |
|-------|-----------|-----------|
| 1. Sandbox works | `universal/hello-world` | Basic bridge, UI |
| 2. Context works | `adaptive/code-explainer` | `perceive`, `inference` |
| 3. Actions work | `adaptive/doc-drafter` | `act`, file creation |
| 4. Full API works | `host-specific/multifile-refactorer` | Limits, cancellation, multi-file |

---

## See Also

- [AGENT-DESIGN.md](../AGENT-DESIGN.md) — Best practices for building agents
- [AGENT-TYPES.md](../AGENT-TYPES.md) — Detailed portability guide
- [SPEC.md](../SPEC.md) — Full protocol specification
- [hosts/](../hosts/) — Host implementations with their own fixtures
