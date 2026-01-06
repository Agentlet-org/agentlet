# Agentlet Roadmap

> **Current Version:** 0.1.0 (Preview)
> **Goal:** Prove adoption before building infrastructure
> **Last Updated:** January 2026

---

## Philosophy

**Build for users, not for completeness.**

The v0.1 spec is comprehensive. What's missing isn't features—it's adoption. The roadmap focuses on:

1. Making agents easy to build
2. Making agents easy to find
3. Stabilizing what works

Advanced features (payments, agent-to-agent, real-time) are [deferred](./drafts/DEFERRED-FEATURES.md) until real demand emerges.

---

## v0.1.0 - Portability (Current)

**Status:** Preview Release — January 2026

This is the first public release. The foundation is in place:

| Feature | Status |
|---------|--------|
| `.agentlet` file format | ✅ Working |
| Portability spectrum (4 types) | ✅ Working |
| `bridge.perceive()` / `bridge.act()` | ✅ Working |
| Standard intents | ✅ Working |
| Core Bridge API | ✅ Working |
| SDK (`@agentlet/host-sdk`) | ✅ Working |
| Host implementations (Zotero, Obsidian, VS Code) | ✅ Working |

### Known Limitations

- CLI tools not yet published to npm
- No agent registry or discovery
- No cryptographic identity
- Limited real-world agents

---

## v0.2.0 - Developer Experience

**Status:** Planned
**Theme:** Make it easy to build agents

If agents are hard to build, nothing else matters. This release focuses on developer tooling and stability.

### Deliverables

#### CLI Tools (Published to npm)

```bash
# Scaffold a new agent
npx @agentlet/cli create my-agent

# Validate manifest and structure
npx @agentlet/cli validate my-agent.agentlet

# Local dev server with mock bridge
npx @agentlet/cli serve my-agent.agentlet

# Run tests
npx @agentlet/cli test my-agent.agentlet
```

#### Testing Library

```javascript
import { createMockBridge } from '@agentlet/testing';

const bridge = createMockBridge({
  capabilities: ['tags', 'search'],
  mockInference: async (req) => 'mocked response'
});

// Test your agent actions
await myAgent.actions.organize({ items: testItems });
expect(bridge.actCalls).toHaveLength(1);
```

#### Bridge Versioning

```javascript
bridge.specVersion              // '0.2'
bridge.supports('perceive')     // true
bridge.features()               // ['perceive', 'act', 'inference', ...]
```

#### Documentation

- Quick Start guide (get first agent running in 5 minutes)
- API reference with examples
- Host implementation guide

### Release Criteria

- [ ] `@agentlet/cli` published to npm
- [ ] `@agentlet/testing` published to npm
- [ ] `agentlet create` scaffolds working agents
- [ ] `agentlet validate` catches common errors
- [ ] `agentlet serve` runs local dev server
- [ ] `bridge.specVersion` and `bridge.supports()` implemented
- [ ] 10+ example agents in repository
- [ ] Quick Start documentation complete

---

## v0.3.0 - Discovery & Trust

**Status:** Planned
**Theme:** Help users find agents

Agents need a distribution channel. This release adds basic discovery and identity.

### Deliverables

#### Agent Registry

A simple, curated listing of agents:

- GitHub Pages site at `agentlet.org/registry`
- Searchable by category, host, capability
- Manual submission and curation initially
- Links to source and installation instructions

#### Basic Identity

```html
<!-- Optional author verification -->
<meta name="agentlet:author:url" content="https://github.com/username">
<meta name="agentlet:source" content="https://github.com/user/repo">
```

Hosts can display verified author information (via GitHub, website).

#### Internationalization

```html
<meta name="agentlet:locale" content="en">
<meta name="agentlet:locale" content="es">
```

```javascript
bridge.locale           // 'es'
bridge.t('action.fix')  // 'Corregir'
```

### Release Criteria

- [ ] Registry website live
- [ ] 20+ agents listed
- [ ] At least 1 external host implementation
- [ ] i18n support in manifest and bridge
- [ ] Author verification displayed in hosts

---

## v1.0.0 - Stable

**Status:** Planned
**Theme:** Freeze what works

After proving adoption, stabilize the spec.

### Stability Guarantees

After v1.0:

- **Manifest format:** Frozen (additive changes only)
- **Bridge API:** Stable (additions only, no breaking changes)
- **Error codes:** Fixed
- **Migration path:** Guaranteed for future versions

### Release Criteria

- [ ] 50+ published agents
- [ ] 3+ host implementations (at least 1 external)
- [ ] 6+ months of v0.3 stability
- [ ] No breaking changes needed
- [ ] Complete documentation
- [ ] Security audit completed

---

## Deferred Features

The following are valuable but deferred until adoption proves demand:

| Feature | Reason to Defer | Trigger to Revisit |
|---------|-----------------|-------------------|
| Agent-to-Agent Communication | No agents need to compose yet | Developers ask how to call other agents |
| Cryptographic Identity (DIDs) | No agents worth protecting yet | Spoofing becomes a problem |
| Payments & Metering | No paid agents exist | Authors want to charge |
| Client-Side ML (Wasm) | Cloud inference works fine | Privacy/offline requirements |
| State Synchronization | Single-host usage is fine | Multi-device users complain |
| Real-time Collaboration | No collaborative use cases | Teams want to share agents |
| Governance Model | No community to govern | Contributors need coordination |

See [drafts/DEFERRED-FEATURES.md](./drafts/DEFERRED-FEATURES.md) for full details.

---

## How to Contribute

### Now (v0.1 → v0.2)

- **Build agents:** Try all four portability types, report what's confusing
- **Test the CLI:** Try `agentlet create`, report friction
- **Documentation:** Improve examples, fix unclear sections

### Soon (v0.2 → v0.3)

- **Build a host:** Implement Agentlet in your application
- **Submit agents:** Contribute to the registry
- **Localization:** Translate agent UI strings

### Ongoing

- **Feedback:** Open issues for problems and ideas
- **Spread the word:** Blog posts, talks, tutorials

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

---

## Changelog

| Version | Date | Highlights |
|---------|------|------------|
| v0.1.0 | Jan 2026 | First public preview: portability spectrum, perceive/act, standard intents |

---

*This roadmap prioritizes adoption over features. Advanced capabilities will be added when real demand emerges.*
