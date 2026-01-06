# Agentlet Host Implementations

This directory contains official Agentlet host implementations for different platforms.

## Available Hosts

| Host | Platform | Status | Description |
|------|----------|--------|-------------|
| [obsidian](./obsidian/) | Obsidian | Complete | Full implementation with perceive/act, intents |
| [zotero](./zotero/) | Zotero 8 | Complete | Reference implementation with Transformers.js inference |

## Creating a New Host

### Quick Start

1. **Create directory structure:**

```
hosts/my-host/
├── package.json
├── src/
│   ├── modules/
│   │   ├── agent-manager.ts    # Install/uninstall agents
│   │   ├── agent-runtime.ts    # Execute agent actions
│   │   ├── bridge-handler.ts   # Extend BridgeHandlerBase
│   │   └── adapters/
│   │       ├── context.ts      # Implement IContextAdapter
│   │       ├── ui.ts           # Implement IUIHandler
│   │       ├── storage.ts      # Implement IStorageAdapter
│   │       └── inference.ts    # Implement IInferenceProvider
│   └── types/
│       └── agentlet.ts         # Re-export SDK + host constants
└── README.md
```

2. **Add SDK dependency:**

```json
{
  "dependencies": {
    "@agentlet/host-sdk": "*"
  }
}
```

3. **Re-export SDK types with host-specific constants:**

```typescript
// src/types/agentlet.ts
export { ErrorCodes, AgentletError } from "@agentlet/host-sdk";
export type { ExtractedManifest, GrantedPermissions, ... } from "@agentlet/host-sdk";

// Host-specific
export const SUPPORTED_INTENTS = ["add-tags", "search", "open"] as const;
export const MY_HOST_CAPABILITIES = ["content", "tags", "search"] as const;
```

4. **Extend BridgeHandlerBase:**

```typescript
// src/modules/bridge-handler.ts
import { BridgeHandlerBase } from "@agentlet/host-sdk";

export class BridgeHandler extends BridgeHandlerBase {
  getHostName() { return "my-host"; }
  getHostVersion() { return "1.0.0"; }
  getHostCapabilities() { return [...MY_HOST_CAPABILITIES]; }
  getSupportedIntents() { return [...SUPPORTED_INTENTS]; }

  // Implement abstract methods...
}
```

5. **Use SDK sandbox:**

```typescript
// src/modules/agent-runtime.ts
import { createSandbox } from "@agentlet/host-sdk";

const sandbox = createSandbox({
  container: containerElement,
  permissions: grantedPermissions,
});
await sandbox.load(agentHtml);
```

---

## Host Implementation Guidelines

**Version:** 0.1.0
**Companion to:** [SPEC.md](../SPEC.md)

This section provides best practices for building a great host experience. While the spec defines **what** hosts must implement, these guidelines describe **how** to build it well.

### Guiding Principles

1. **Transparency** - Users should understand what agents do before running them
2. **Safety** - Fail secure; deny by default
3. **Predictability** - Consistent behavior across agents
4. **Responsiveness** - Keep users informed during long operations

### Naming Conventions

| Context | Pattern | Example |
|---------|---------|---------|
| Plugin/package ID | `{host}-agentlet` | `obsidian-agentlet`, `zotero-agentlet` |
| Repository folder | `hosts/{host}/` | `hosts/obsidian/`, `hosts/zotero/` |
| Display name | "Agentlet" or "{Host} Agentlet" | "Agentlet", "Zotero Agentlet" |

---

## User Experience

### Agent Manager UI

Hosts SHOULD provide a dedicated UI for managing agents:

```
┌─────────────────────────────────┐
│ Agentlets                    [+]│
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ agent-name                  │ │
│ │ Description text here       │ │
│ │ [adaptive]                  │ │
│ │ [Action 1] [Action 2] [</>] │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Recommended elements:**
- Agent name and description
- Portability badge (adaptive, universal, host-specific, host-family)
- Action buttons for each declared action
- Quick actions: view source, remove, update

### Activity Feedback

| Method | Display Recommendation |
|--------|----------------------|
| `activity.start(msg)` | Show persistent status indicator |
| `activity.step(msg)` | Update status message |
| `activity.progress(n, total)` | Show progress bar or percentage |
| `activity.complete(msg)` | Success notification (auto-dismiss) |
| `activity.error(msg)` | Error notification (persistent until dismissed) |

### Notifications

| Type | Duration | Style |
|------|----------|-------|
| `info` | 4 seconds | Neutral |
| `success` | 4 seconds | Green/positive |
| `warning` | 7 seconds | Yellow/caution |
| `error` | 10+ seconds | Red/alert |

---

## Security & Transparency

### View Source Code

Hosts SHOULD allow users to inspect agent source code:

```
┌─────────────────────────────────────┐
│ agent-name - Source Code        [×]│
├─────────────────────────────────────┤
│ <!DOCTYPE html>                     │
│ <html>                              │
│ <head>                              │
│ <meta name="agentlet" content="0.1">│
│ ...                                 │
└─────────────────────────────────────┘
```

### Permission Summary

Before installation, hosts SHOULD display requested permissions:

```
┌─────────────────────────────────────┐
│ Install "smart-tagger"?             │
├─────────────────────────────────────┤
│ This agent requests:                │
│                                     │
│ ● Read notes                        │
│ ● AI inference (basic)              │
│ ● Modify tags                       │
│                                     │
│ [Cancel]              [Install]     │
└─────────────────────────────────────┘
```

### Capability Indicators

| Capability | Indicator | Reason |
|------------|-----------|--------|
| `inference:*` | 🤖 or "AI" badge | Users should know AI is involved |
| `network:*` | 🌐 or "Network" badge | Data may leave device |
| `context:*:write` | ✏️ or "Write" badge | Agent can modify data |
| `storage` | 💾 | Agent persists data |

### Portability Badges

| Type | Badge Color | Meaning |
|------|-------------|---------|
| `adaptive` | Green | Works on any host |
| `universal` | Blue | Works on any host (static) |
| `host-family` | Orange | Works on similar hosts |
| `host-specific` | Purple | Built for this host only |

---

## Installation Flow

### Recommended Steps

1. **Fetch** - Download agent HTML from URL
2. **Parse** - Extract manifest (safe, no execution)
3. **Validate** - Check spec version compatibility
4. **Compatibility Check** - Verify host requirements
5. **Permission Review** - Show user what agent requests
6. **Confirm** - User approves installation
7. **Store** - Save agent to persistent storage
8. **Register** - Add commands/actions to host

### Compatibility Checks

```javascript
if (portability === "host-specific") {
  if (!hosts.includes(currentHost)) {
    // REJECT or WARN
  }
}

if (portability === "adaptive") {
  // Always compatible - check requires/optional at runtime
}
```

---

## Error Handling

### User-Friendly Messages

| Code | Technical | User-Friendly |
|------|-----------|---------------|
| `E101` | PERMISSION_DENIED | "This agent doesn't have permission to do that" |
| `E301` | INFERENCE_FAILED | "AI request failed. Check your inference settings." |
| `E304` | INFERENCE_UNAVAILABLE | "No AI provider configured. Set up Ollama or OpenAI in settings." |
| `E501` | LIMIT_TIME_EXCEEDED | "Agent took too long and was stopped" |
| `E701` | USER_CANCELLED | "Cancelled" |

### Recovery Suggestions

```
Error: No AI provider configured

→ Open Settings → Agentlet → Configure Ollama or OpenAI
```

---

## Performance

### Recommended Default Limits

| Resource | Default | Notes |
|----------|---------|-------|
| Execution time | 5 minutes | Per action invocation |
| Inference calls | 50 | Per action invocation |
| Network requests | 100 | Per action invocation |
| Storage | 5 MB | Per agent total |

### Sandbox Lifecycle

- Create sandbox only when executing
- Destroy sandbox after action completes
- Reuse sandbox for rapid successive actions (optional)

---

## Accessibility

### Keyboard Navigation

- All agent actions accessible via keyboard
- Command palette integration where available
- Focus management in modals

### Visual

- Respect system color scheme (dark/light)
- Sufficient color contrast for badges
- Don't rely on color alone for status

---

## Checklist

### Minimum Viable Host

- [ ] Parse agent manifest from HTML (`extractManifestFromHtml`)
- [ ] Sandbox execution (`IframeSandbox` or `ContainerIframeSandbox`)
- [ ] Bridge message routing (`BridgeHandlerBase`)
- [ ] Basic permissions enforcement (inherited from base class)
- [ ] Install/uninstall agents
- [ ] Execute agent actions

### Recommended Features

- [ ] View agent source code
- [ ] Permission summary before install
- [ ] Activity progress display
- [ ] Portability badges
- [ ] Capability indicators (AI, network, write)
- [ ] Update agents from URL
- [ ] Command palette integration
- [ ] Settings UI for inference providers

### Nice to Have

- [ ] Agent catalog/discovery
- [ ] Usage analytics (local only)
- [ ] Agent ratings/reviews
- [ ] Batch operations
- [ ] Export/import agent list

---

## SDK Reference

The `@agentlet/host-sdk` package provides:

| Export | Purpose |
|--------|---------|
| `ErrorCodes` | Standard error codes from spec |
| `AgentletError` | Error class with code property |
| `extractManifestFromHtml()` | Parse manifest from agent HTML |
| `parseCapabilities()` | Parse capability strings |
| `BridgeHandlerBase` | Abstract base class (~80% of handler logic) |
| `IframeSandbox` | Ready-to-use sandbox (attaches to body) |
| `ContainerIframeSandbox` | Sandbox for specific container |
| `BRIDGE_SCRIPT` | Raw bridge script for custom injection |
| `injectBridgeIntoHtml()` | Inject bridge + CSP into HTML |
| `I*` interfaces | `ISandbox`, `IContextAdapter`, `IUIHandler`, etc. |

See [SDK README](../packages/host-sdk/README.md) for full API documentation.

---

*These guidelines complement the Agentlet specification. For protocol requirements, see [SPEC.md](../SPEC.md).*
