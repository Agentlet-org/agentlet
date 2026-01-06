# @agentlet/host-sdk

SDK for building Agentlet host implementations.

This package provides the shared infrastructure for implementing Agentlet hosts across different platforms (Zotero, Obsidian, VS Code, Electron, etc.).

## Installation

```bash
npm install @agentlet/host-sdk
```

Or in a monorepo with workspaces:

```json
{
  "dependencies": {
    "@agentlet/host-sdk": "*"
  }
}
```

## Quick Start

```typescript
import {
  BridgeHandlerBase,
  createSandbox,
  extractManifest,
  ErrorCodes,
} from '@agentlet/host-sdk';

// 1. Parse agent manifest (works in Node.js and browser)
const manifest = extractManifest(agentHtml);

// 2. Create sandbox (auto-selects type based on environment)
const sandbox = createSandbox({
  type: 'iframe',  // or 'headless' for Node.js
  permissions: { context: ['*:read'] },
});
await sandbox.load(agentHtml);

// 3. Create bridge handler (extend base class)
class MyBridgeHandler extends BridgeHandlerBase {
  getHostName() { return 'my-host'; }
  getHostVersion() { return '1.0.0'; }
  // ... implement abstract methods
}
```

## Exports

### Error Handling

```typescript
import { ErrorCodes, AgentletError } from '@agentlet/host-sdk';

// Standard error codes from spec
ErrorCodes.PERMISSION_DENIED       // "E101"
ErrorCodes.INFERENCE_FAILED        // "E301"
ErrorCodes.USER_CANCELLED          // "E701"
ErrorCodes.SPEC_VERSION_TOO_LOW    // "E804"
ErrorCodes.SPEC_VERSION_TOO_HIGH   // "E805"
ErrorCodes.FEATURE_NOT_SUPPORTED   // "E806"

// Throw typed errors
throw new AgentletError(ErrorCodes.PERMISSION_DENIED, 'Storage access denied');
```

### Manifest Parsing

```typescript
import { extractManifest, extractManifestFromHtml, parseCapabilities } from '@agentlet/host-sdk';

// Environment-aware parser (works in Node.js AND browser)
const manifest = extractManifest(html);
// Returns: { name, version, capabilities, actions, ... }

// DOM-based parser (browser only - legacy)
const manifest = extractManifestFromHtml(html);

// Parse capabilities into structured form
const caps = parseCapabilities(['notes:read', 'inference', 'storage']);
// Returns: { context: ['notes:read'], inference: true, storage: true, network: [] }
```

### Transport System

Generate bridge scripts for different communication channels:

```typescript
import { generateBridgeScript, TransportType, detectTransport } from '@agentlet/host-sdk';

// Generate bridge script for iframe postMessage (default)
const script = generateBridgeScript({ type: 'iframe' });

// Generate for WebView (VS Code, Electron)
const script = generateBridgeScript({ type: 'webview' });

// Generate for WebSocket
const script = generateBridgeScript({ type: 'websocket', wsUrl: 'ws://localhost:3456' });

// Auto-detect appropriate transport
const transport = detectTransport(); // Returns 'iframe' | 'webview' | 'websocket'
```

**Available transports:**
| Type | Use Case |
|------|----------|
| `iframe` | Browser iframes (Obsidian, web hosts) |
| `webview` | VS Code WebViews, Electron |
| `websocket` | CLI dev server, remote hosts |

### Sandbox

```typescript
import { createSandbox, HeadlessSandbox } from '@agentlet/host-sdk';

// Factory function (recommended) - auto-selects sandbox type
// Browser: creates IframeSandbox or ContainerIframeSandbox
const sandbox = createSandbox({
  permissions: { context: ['*:read'] },
  container: myElement,  // optional - uses body if omitted
});

// Headless sandbox (Node.js/testing) - provide jsdom window/document
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const sandbox = createSandbox({
  permissions: { inference: true },
  windowProvider: () => dom.window,
  documentProvider: () => dom.window.document,
});

// Load agent
await sandbox.load(agentHtml);  // Injects bridge script and CSP

// Communication
sandbox.postMessage({ type: 'init', host: { name: 'my-host', ... } });
sandbox.onMessage((msg) => console.log('From agent:', msg));

// Cleanup
sandbox.destroy();
```

**Sandbox auto-detection:**
| Config | Sandbox Used |
|--------|--------------|
| `windowProvider` + `documentProvider` | HeadlessSandbox (Node.js) |
| `container` element | ContainerIframeSandbox |
| Neither | IframeSandbox (attaches to body) |

### Bridge Handler

Extend `BridgeHandlerBase` to implement host-specific behavior:

```typescript
import { BridgeHandlerBase, BridgeHandlerConfig } from '@agentlet/host-sdk';

class MyBridgeHandler extends BridgeHandlerBase {
  // Required: Host identification
  getHostName(): string { return 'my-host'; }
  getHostVersion(): string { return '1.0.0'; }
  getHostCapabilities(): string[] { return ['content', 'tags', 'search']; }
  getSupportedIntents(): string[] { return ['add-tags', 'search', 'open']; }
  getSupportedFeatures(): string[] {
    return ['context', 'storage', 'ui', 'inference', 'perceive', 'act'];
  }

  // Required: Adapters
  getContextAdapter(): IContextAdapter { return this.contextAdapter; }
  getStorageAdapter(): IStorageAdapter { return this.storageAdapter; }
  getUIHandler(): IUIHandler { return this.uiHandler; }
  getInferenceProvider(): IInferenceProvider | undefined { return this.inference; }
  getIntentHandler(): IIntentHandler | undefined { return this.intentHandler; }

  // Required: Schema for perceive API
  protected getItemSchema(): Record<string, unknown> {
    return { fields: ['id', 'title', 'content', 'tags'] };
  }

  // Optional: Override for custom behavior
  protected getDefaultContextType(): string { return 'note'; }
}
```

The base class handles:
- Message routing (`handleMessage`)
- Permission checking (`checkPermission`, `checkUIPermission`)
- Resource limit enforcement (`checkTimeLimit`, `checkInferenceLimit`)
- Standard handlers for storage, UI, activity, limits
- Perceive/Act API with sensible defaults

### Types

```typescript
import type {
  // Versioning
  VersionConstraint,
  ConstrainedCapability,

  // Manifest
  ExtractedManifest,
  AgentActionMeta,
  AgentPreferenceMeta,

  // Permissions
  GrantedPermissions,
  ResourceLimits,
  ResourceUsage,

  // Bridge messages
  BridgeRequest,
  BridgeResponse,

  // Host info
  HostInfo,
  InstalledAgent,

  // Adapter interfaces
  ISandbox,
  IContextAdapter,
  IUIHandler,
  IStorageAdapter,
  IInferenceProvider,
  IIntentHandler,

  // Perceive/Act
  PerceiveOptions,
  PerceiveResult,
  ActOptions,
  ActResult,
} from '@agentlet/host-sdk';

// Helper to extract names from constrained capabilities
import { getCapabilityNames } from '@agentlet/host-sdk';
const names = getCapabilityNames(manifest.capabilities); // string[]
```

### Bridge Script

For advanced use cases, access the raw bridge script:

```typescript
import { BRIDGE_SCRIPT, injectBridgeIntoHtml } from '@agentlet/host-sdk';

// Raw bridge script (runs inside sandbox)
console.log(BRIDGE_SCRIPT);

// Inject bridge + CSP into HTML
const modifiedHtml = injectBridgeIntoHtml(html, ['api.example.com']);
```

## Architecture

```
Host Application
    │
    ├── AgentRuntime (your code)
    │       │
    │       ├── IframeSandbox ◄──── from SDK
    │       │       │
    │       │       └── postMessage ◄─► Agent (sandboxed)
    │       │
    │       └── BridgeHandler ◄──── extend from SDK
    │               │
    │               ├── YourContextAdapter (implements IContextAdapter)
    │               ├── YourUIHandler (implements IUIHandler)
    │               └── YourStorageAdapter (implements IStorageAdapter)
    │
    └── AgentManager (your code)
            │
            └── extractManifestFromHtml ◄──── from SDK
```

## Example: Minimal Host

```typescript
import {
  BridgeHandlerBase,
  IframeSandbox,
  extractManifestFromHtml,
  type IContextAdapter,
  type IUIHandler,
  type IStorageAdapter,
} from '@agentlet/host-sdk';

// 1. Implement adapters
class MyContextAdapter implements IContextAdapter {
  async query(type: string, filter?: unknown) { /* ... */ }
  async get(type: string, id: string | number) { /* ... */ }
  async update(type: string, id: string | number, data: unknown) { /* ... */ }
  async create(type: string, data: unknown) { /* ... */ }
  async delete(type: string, id: string | number) { /* ... */ }
  async getSelection() { /* ... */ }
}

// 2. Extend bridge handler
class MyBridgeHandler extends BridgeHandlerBase {
  constructor(private adapters: { context: IContextAdapter; /* ... */ }) {
    super({ agentId: 'agent-1', permissions: {}, limits: defaultLimits, onSendMessage: () => {} });
  }

  getHostName() { return 'my-host'; }
  getHostVersion() { return '1.0.0'; }
  getHostCapabilities() { return ['content']; }
  getSupportedIntents() { return []; }
  getContextAdapter() { return this.adapters.context; }
  // ... other abstract methods
}

// 3. Run agent
async function runAgent(agentHtml: string, actionId: string) {
  const manifest = extractManifestFromHtml(agentHtml);
  const sandbox = new IframeSandbox({ context: ['*:read'] });

  await sandbox.load(agentHtml);

  const handler = new MyBridgeHandler({ context: new MyContextAdapter() });
  sandbox.onMessage((msg) => handler.handleMessage(msg));

  // Send init, invoke action, etc.
}
```

## Reference Implementations

- **VS Code**: `hosts/vscode/` - WebView sandbox with VS Code API integration
- **Obsidian**: `hosts/obsidian/` - Iframe sandbox with Obsidian plugin API
- **Zotero**: `hosts/zotero/` - Reference implementation with local ML inference

## Related

- [Agentlet Spec](../../SPEC.md) - Protocol specification
- [Host Guidelines](../../hosts/README.md) - UX and implementation guidelines
- [@agentlet/cli](../cli/README.md) - CLI for development and testing
- [@agentlet/testing](../testing/README.md) - Test harness using HeadlessSandbox

## License

MIT
