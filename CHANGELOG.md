# Changelog

All notable changes to the Agentlet specification and reference implementation will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

#### Zotero Host - Panel UI
- `agentlet-panel.xhtml` - XUL window template for panel content
- Panel window reuse by title (avoids multiple windows)
- Message forwarding from panel iframe → sandbox
- Sandbox lifecycle waits for panels to close before cleanup
- Fixed XUL `unload` event quirk (fires during load)

#### Community Agents Section
- Added "Community Agents" section to examples/README.md for external real-world agents
- First community agent: [zotero-metadata-healer](https://github.com/introfini/zotero-metadata-healer) - extracted to demonstrate ecosystem adoption pattern

#### Developer Tooling (v0.2 Target)
- `@agentlet/cli` package (built, not yet published):
  - `agentlet create` - Scaffold agents from templates
  - `agentlet validate` - Validate agent manifest and structure
  - `agentlet serve` - Development server with mock bridge
  - `agentlet test` - Run agent tests
- `@agentlet/testing` package (built, not yet published)

#### Host SDK Enhancements
- `extractManifest()` - Environment-aware manifest parser
- Transport abstraction layer for iframe, webview, websocket
- `HeadlessSandbox` - Node.js sandbox for CLI/testing

#### Versioning & Feature Detection
- `bridge.specVersion` - Current spec version string ("0.1")
- `bridge.features()` - List of available Bridge API features
- `bridge.supports(feature)` - Check if specific feature is available
- `bridge.compareVersion(a, b)` - Semver comparison utility

#### Documentation
- Quick Start section added to SPEC.md
- Simplified ROADMAP.md (3 versions instead of 8)
- Created drafts/DEFERRED-FEATURES.md for features deferred until adoption

### Deferred Features

The following features are tracked in [drafts/DEFERRED-FEATURES.md](./drafts/DEFERRED-FEATURES.md) with trigger conditions for when to revisit:

1. Full Identity System (DIDs & signatures)
2. Capability Negotiation (levels & MCP exposure)
3. Full Registry Infrastructure (API, CDN, scanning)
4. Agent-to-Agent Communication
5. Client-Side ML (Wasm)
6. Semantic Intent Layer
7. Economic Primitives (payments)
8. State Synchronization
9. Offline & Real-time
10. Governance Model

See [ROADMAP.md](./ROADMAP.md) for the simplified roadmap.

---

## [0.1.0] - 2026-01-06

### The Portability Release

This release introduces the four-type portability model, enabling agents to choose their trade-off between host integration depth and cross-platform compatibility.

### Added

#### Portability Types
- **Host-specific** - Full power of one host application
- **Host-family** - Works across similar apps (e.g., PKM tools)
- **Universal** - No host context needed, works everywhere
- **Adaptive** - AI-powered understanding of any host

#### Perceive/Act API (Adaptive Agents)
- `bridge.perceive()` - Get AI-interpreted context from any host
  - `scope: 'selection' | 'all' | 'query'`
  - `understand: boolean` - AI interpretation of items
  - Returns items, capabilities, schema, and understanding
- `bridge.act()` - Execute intent-based actions
  - Standard intents work across hosts
  - Graceful degradation when intent not supported

#### Host Detection
- `bridge.host.name` - Host application name
- `bridge.host.version` - Host version
- `bridge.capabilities` - Array of available capabilities
- `bridge.hasCapability(name)` - Check specific capability

#### Standard Intents
- `add-tags` - Add tags to items
- `remove-tags` - Remove tags from items
- `move-to` - Move items to location
- `copy-to` - Copy items to location
- `link` - Create link between items
- `unlink` - Remove link between items
- `create` - Create new item
- `update` - Update item fields
- `delete` - Delete items
- `search` - Search for items
- `open` - Open/focus item
- `export` - Export items
- `favorite` - Mark as favorite
- `archive` - Archive items

#### Standard Host Capabilities
- Content: `content`, `content:rich`, `content:markdown`
- Organization: `tags`, `collections`, `folders`, `favorites`
- Relationships: `links`, `backlinks`, `references`
- Metadata: `metadata`, `metadata:custom`, `dates`, `authors`
- Operations: `search`, `search:semantic`, `batch`
- Media: `attachments`, `images`, `pdf`

#### New Manifest Tags
- `agentlet:portability` - Agent portability type
- `agentlet:requires` - Required capabilities (adaptive)
- `agentlet:optional` - Optional capabilities (adaptive)
- `agentlet:intent` - Intents used by agent

#### New Error Codes
- E1001: INTENT_NOT_SUPPORTED - Intent not supported by host
- E1002: PERCEIVE_FAILED - Perceive operation failed
- E1003: ACT_FAILED - Act operation failed

#### Documentation
- Agent types guide (AGENT-TYPES.md)
- Updated README with portability spectrum
- Complete examples for all four types
- Host implementation guide for perceive/act

### Changed
- Spec version bumped to 0.1
- README rewritten to emphasize portability
- ROADMAP updated with new timeline
- `agentlet:portability` now required in manifest

### Migration from v0.1

Existing v0.1 agents continue to work. To migrate:

1. Add portability type:
   ```html
   <meta name="agentlet:portability" content="host-specific">
   ```

2. Update spec version:
   ```html
   <meta name="agentlet" content="0.1">
   ```

3. (Optional) Convert to adaptive for cross-platform support

#### Spec Format
- Single-file `.agentlet` HTML format
- Meta tag manifest (parseable without execution)
- MIME type: `application/x-agentlet+html`

#### Manifest Tags
- `agentlet` â€” Spec version
- `agentlet:name` â€” Agent identifier
- `agentlet:version` â€” Agent version (semver)
- `agentlet:description` â€” Short description
- `agentlet:author` â€” Author name
- `agentlet:author:url` â€” Author URL
- `agentlet:author:email` â€” Author email
- `agentlet:license` â€” License identifier
- `agentlet:homepage` â€” Project homepage
- `agentlet:icon` â€” Icon reference
- `agentlet:host` â€” Host compatibility
- `agentlet:capability` â€” Required capabilities
- `agentlet:action` â€” Available actions
- `agentlet:default-action` â€” Default action
- `agentlet:trigger` â€” Event triggers
- `agentlet:preference` â€” User preferences
- `agentlet:limit` â€” Resource limits
- `agentlet:category` â€” Discovery category
- `agentlet:tag` â€” Discovery tags
- `agentlet:update-url` â€” Update URL
- `agentlet:integrity` â€” Content hash

#### Bridge API
- `bridge.context.query()` â€” Query host context
- `bridge.context.get()` â€” Get single item
- `bridge.context.update()` â€” Update item
- `bridge.context.create()` â€” Create item
- `bridge.context.delete()` â€” Delete item
- `bridge.context.batch()` â€” Batch operations
- `bridge.context.selection.get()` â€” Get selection
- `bridge.inference()` â€” AI inference
- `bridge.storage.get/set/remove/clear/keys()` â€” Persistent storage
- `bridge.ui.notify()` â€” Notifications
- `bridge.ui.confirm()` â€” Confirmation dialog
- `bridge.ui.prompt()` â€” Text prompt
- `bridge.ui.form()` â€” Form dialog
- `bridge.ui.select()` â€” Selection dialog
- `bridge.ui.panel()` â€” Side panels
- `bridge.activity.start/step/progress/log/complete/error()` â€” Activity tracking
- `bridge.preferences.get()` â€” User preferences
- `bridge.limits.remaining()` â€” Resource limits
- `bridge.mcp.list/isAvailable/getTools/call/read/subscribe()` â€” MCP integration

#### Lifecycle Hooks
- `bridge.onInstall()` â€” First install or update
- `bridge.onActivate()` â€” Agent loaded
- `bridge.onDeactivate()` â€” Agent unloading
- `bridge.onSuspend()` â€” App suspending (mobile)
- `bridge.onResume()` â€” App resuming
- `bridge.onUninstall()` â€” Agent being removed

#### Cancellation Support
- `bridge.isCancelled()` â€” Check cancellation
- `bridge.throwIfCancelled()` â€” Throw if cancelled
- `bridge.onCancel()` â€” Cancellation handler

#### Utilities
- `bridge.utils.sleep()` â€” Async delay
- `bridge.utils.retry()` â€” Retry with backoff
- `bridge.utils.withRetry()` â€” Create retryable function
- `bridge.utils.debounce()` â€” Debounce function
- `bridge.utils.throttle()` â€” Throttle function

#### Capabilities
- Context: `context:{type}:read`, `context:{type}:write`
- Network: `network:{domain}`
- Inference: `inference:basic`, `inference:reasoning`, `inference:vision`, `inference:embedding`
- Storage: `storage`
- UI: `ui:notify`, `ui:confirm`, `ui:prompt`, `ui:form`, `ui:select`, `ui:panel`, `ui:chat`
- MCP: `mcp:{server}`

#### Error Codes
- E1xx: Permission errors
- E2xx: Context errors
- E3xx: Inference errors
- E4xx: Network errors
- E5xx: Resource limit errors
- E6xx: Agent errors
- E7xx: User errors
- E8xx: Host errors
- E9xx: MCP errors

#### Security
- Sandbox via iframe with `allow-scripts allow-same-origin`
- Content Security Policy from declared capabilities
- Permission enforcement on all bridge calls
- Content integrity verification

#### Documentation
- Full specification (SPEC.md)
- Public roadmap (ROADMAP.md)
- Contribution guidelines (CONTRIBUTING.md)
- Example agents

### Known Limitations

- No cryptographic agent identity
- No agent-to-agent communication
- No payment or metering capabilities
- No offline support
- No state synchronization across hosts

These limitations are addressed in the [roadmap](./ROADMAP.md).

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 0.1.0 | 2026-01-06 | Current |

---

[Unreleased]: https://github.com/Agentlet-org/agentlet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/Agentlet-org/agentlet/releases/tag/v0.1.0
