# @agentlet/host-sdk Improvement Plan

**Version:** 2.0 Roadmap
**Status:** Draft
**Created:** January 2026

---

## GAP-04 Dependencies

> **Important:** Phases 1, 2, and 4 are prerequisites for GAP-04 (Developer Experience & Tooling).
> These should be prioritized to unblock the testing library and CLI.

| SDK Phase | Enables GAP-04 Component |
|-----------|-------------------------|
| Phase 1: Transport | CLI `serve`, testing mock bridge |
| Phase 2: Sandbox (HeadlessSandbox) | `createTestHarness()`, CLI `serve` |
| Phase 4: Environment | CLI `validate` (Node.js manifest parsing) |

---

## Executive Summary

The Agentlet host SDK currently provides ~40% code reuse across host implementations. This plan targets **80%+ reuse**, reducing new host implementation from **2000+ lines to ~500 lines** of truly host-specific code.

**Key Insight:** Host implementations share far more than they differ. The differences fall into just 3-4 categories (transport, sandbox container, environment), not N categories per host.

---

## Table of Contents

1. [Vision](#vision)
2. [Current State Analysis](#current-state-analysis)
3. [Architecture Strategy](#architecture-strategy)
4. [Implementation Plan](#implementation-plan)
5. [Migration Guide](#migration-guide)
6. [Success Metrics](#success-metrics)

---

## Vision

### The 30-Minute Host

A developer should be able to create a working Agentlet host in 30 minutes by:

1. **Choosing a transport** (iframe, webview, native) — 1 line
2. **Choosing a sandbox type** (DOM, IDE webview, headless) — 1 line  
3. **Implementing adapters** (context, UI, storage) — the actual work
4. **Done** — SDK handles everything else

### Code Distribution Target

| Component | Current | Target | Change |
|-----------|---------|--------|--------|
| SDK-provided infrastructure | 2,500 LoC | 5,000 LoC | +100% |
| Per-host infrastructure | 1,500 LoC | 100 LoC | -93% |
| Per-host adapters (unavoidable) | 1,000 LoC | 1,000 LoC | — |
| **Total per host** | **2,500 LoC** | **1,100 LoC** | **-56%** |

### Design Principles

1. **Convention over configuration** — sensible defaults, override when needed
2. **Composition over inheritance** — mix and match components
3. **Progressive disclosure** — simple things simple, complex things possible
4. **Type safety** — catch errors at compile time, not runtime

---

## Current State Analysis

### What Works Well

| Component | SDK Coverage | Notes |
|-----------|-------------|-------|
| `BridgeHandlerBase` | 80% | Hosts extend with ~50 lines |
| `ErrorCodes` | 100% | Fully reusable |
| `extractManifestFromHtml` | 100%* | *Browser only |
| Type definitions | 100% | Excellent interface coverage |

### What's Duplicated

| Component | Zotero | VS Code | Obsidian | Root Cause |
|-----------|--------|---------|----------|------------|
| Bridge script | 400 LoC | 370 LoC | (SDK) | Transport variants |
| Sandbox | 1,047 LoC | 565 LoC | 21 LoC | Container variants |
| Manifest parser | 200 LoC | 173 LoC | (SDK) | Environment (Node vs browser) |
| Runtime orchestration | 300 LoC | 269 LoC | 180 LoC | No base class |
| Inference (Ollama/OpenAI) | — | 412 LoC | 99 LoC | Utility code |

### The Three Families

Analysis reveals hosts cluster into families, not individual implementations:

**Transport Family:**
```
┌─────────────────────────────────────────────────────────┐
│ iframe (postMessage)                                    │
│   Browser, Obsidian, Zotero, Electron, Tauri, RN Web   │
├─────────────────────────────────────────────────────────┤
│ IDE WebView (acquireApi)                               │
│   VS Code, JetBrains, Eclipse, Theia                   │
├─────────────────────────────────────────────────────────┤
│ Native Bridge (window.bridge)                          │
│   React Native, Capacitor, native mobile               │
└─────────────────────────────────────────────────────────┘
```

**Sandbox Family:**
```
┌─────────────────────────────────────────────────────────┐
│ DOM iframe (document.createElement)                    │
│   Browser, Obsidian, Zotero, Electron                  │
├─────────────────────────────────────────────────────────┤
│ IDE WebView Panel                                      │
│   VS Code, JetBrains                                   │
├─────────────────────────────────────────────────────────┤
│ Native WebView Component                               │
│   React Native, mobile apps                            │
├─────────────────────────────────────────────────────────┤
│ Headless (jsdom/Puppeteer)                            │
│   CLI tools, server-side, testing                      │
└─────────────────────────────────────────────────────────┘
```

**Environment Family:**
```
┌─────────────────────────────────────────────────────────┐
│ Browser (has DOMParser, fetch, WebSocket)              │
│   Obsidian, Zotero, Electron renderer                  │
├─────────────────────────────────────────────────────────┤
│ Node.js (no DOMParser, has fs, child_process)          │
│   VS Code extension host, CLI tools                    │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Strategy

### Layer 1: Transport Abstraction

**Goal:** One bridge script template, parameterized by transport.

```typescript
// New SDK export
export type TransportType = 'iframe' | 'vscode-webview' | 'native-bridge' | 'worker';

export interface TransportAdapter {
  send(message: unknown): void;
  onReceive(handler: (message: unknown) => void): void;
  destroy?(): void;
}

// Built-in transports
export const IframeTransport: TransportAdapter;      // window.parent.postMessage
export const VSCodeTransport: TransportAdapter;      // vscode.postMessage  
export const NativeBridgeTransport: TransportAdapter; // window.NativeBridge.send
export const WorkerTransport: TransportAdapter;      // self.postMessage

// Generate bridge script for any transport
export function generateBridgeScript(transport: TransportType): string;
```

**Implementation:**

```typescript
// packages/host-sdk/src/transport/bridge-template.ts
const BRIDGE_TEMPLATE = `
// ═══ TRANSPORT (injected) ═══
{{TRANSPORT_SETUP}}

const bridge = {
  _pending: new Map(),
  _requestId: 0,
  // ... 95% shared logic ...
  
  _request(method, params) {
    return new Promise((resolve, reject) => {
      const id = String(++this._requestId);
      this._pending.set(id, { resolve, reject });
      {{SEND}}({ id, type: 'request', method, params });
    });
  },
  
  _handleMessage(data) {
    // ... shared message handling ...
  }
};

{{RECEIVE}}((msg) => bridge._handleMessage(msg));
window.bridge = bridge;
`;

const TRANSPORTS = {
  'iframe': {
    setup: '',
    send: 'window.parent.postMessage(msg, "*")',
    receive: 'window.addEventListener("message", (e) => handler(e.data))'
  },
  'vscode-webview': {
    setup: 'const vscode = acquireVsCodeApi();',
    send: 'vscode.postMessage(msg)',
    receive: 'window.addEventListener("message", (e) => handler(e.data))'
  },
  'native-bridge': {
    setup: '',
    send: 'window.NativeBridge.send(JSON.stringify(msg))',
    receive: 'window.NativeBridge.onMessage = handler'
  }
};

export function generateBridgeScript(transport: TransportType): string {
  const t = TRANSPORTS[transport];
  return BRIDGE_TEMPLATE
    .replace('{{TRANSPORT_SETUP}}', t.setup)
    .replace('{{SEND}}', `(msg) => ${t.send}`)
    .replace('{{RECEIVE}}', `(handler) => ${t.receive}`);
}
```

### Layer 2: Sandbox Abstraction

**Goal:** Pluggable sandbox creation with built-in variants.

```typescript
// New SDK exports
export interface SandboxConfig {
  permissions: GrantedPermissions;
  transport?: TransportType;  // Default: auto-detect
  
  // DOM sandbox options
  container?: HTMLElement | 'body' | 'create';
  hidden?: boolean;
  
  // IDE WebView options  
  webviewPanel?: unknown;  // VS Code WebviewPanel, etc.
  
  // Custom options
  documentProvider?: () => Document;
  windowProvider?: () => Window;
}

// Factory function
export function createSandbox(config: SandboxConfig): ISandbox;

// Built-in implementations
export class DOMIframeSandbox implements ISandbox { ... }
export class VSCodeWebViewSandbox implements ISandbox { ... }
export class HeadlessSandbox implements ISandbox { ... }
```

**Implementation:**

```typescript
// packages/host-sdk/src/sandbox/factory.ts
export function createSandbox(config: SandboxConfig): ISandbox {
  const transport = config.transport ?? detectTransport();
  
  if (config.webviewPanel) {
    return new VSCodeWebViewSandbox(config);
  }
  
  if (typeof document !== 'undefined') {
    return new DOMIframeSandbox(config);
  }
  
  throw new Error('Cannot auto-detect sandbox type. Provide explicit config.');
}

function detectTransport(): TransportType {
  if (typeof acquireVsCodeApi !== 'undefined') return 'vscode-webview';
  if (typeof window?.NativeBridge !== 'undefined') return 'native-bridge';
  return 'iframe';
}
```

### Layer 3: Runtime Orchestration

**Goal:** Abstract base class for agent execution lifecycle.

```typescript
// New SDK export
export interface RuntimeConfig<THost = unknown> {
  host: THost;
  agent: InstalledAgent;
  adapters: HostAdapters;
  limits?: ResourceLimits;
  sandbox?: SandboxConfig;
}

export interface HostAdapters {
  context: IContextAdapter;
  ui: IUIHandler;
  storage: IStorageAdapter;
  inference?: IInferenceProvider;
  intent?: IIntentHandler;
}

export abstract class AgentRuntimeBase<THost = unknown> {
  protected config: RuntimeConfig<THost>;
  protected sandbox: ISandbox | null = null;
  protected bridgeHandler: BridgeHandlerBase | null = null;
  
  constructor(config: RuntimeConfig<THost>) {
    this.config = config;
  }
  
  // ═══ ABSTRACT (host must implement) ═══
  
  /** Create the sandbox for this host */
  protected abstract createSandbox(): ISandbox;
  
  /** Create the bridge handler for this host */  
  protected abstract createBridgeHandler(sandbox: ISandbox): BridgeHandlerBase;
  
  /** Get host identification info */
  protected abstract getHostInfo(): HostInfo;
  
  // ═══ SHARED IMPLEMENTATION ═══
  
  /** Execute an agent action */
  async executeAction(actionId: string, input?: unknown): Promise<unknown> {
    this.validateAction(actionId);
    
    try {
      this.sandbox = this.createSandbox();
      this.bridgeHandler = this.createBridgeHandler(this.sandbox);
      
      this.wireMessageHandling();
      await this.sandbox.load(this.config.agent.html);
      await this.waitForBridgeLoaded();
      
      this.sandbox.postMessage({
        type: 'init',
        host: this.getHostInfo()
      });
      
      await this.waitForReady();
      return await this.invokeAction(actionId, input);
      
    } finally {
      this.cleanup();
    }
  }
  
  /** Cancel current execution */
  cancel(): void {
    this.bridgeHandler?.cancel();
  }
  
  // ═══ PROTECTED HELPERS ═══
  
  protected validateAction(actionId: string): void {
    const action = this.config.agent.manifest.actions?.find(a => a.id === actionId);
    if (!action) {
      throw new AgentletError(
        ErrorCodes.AGENT_ACTION_NOT_FOUND,
        `Action "${actionId}" not found`
      );
    }
  }
  
  protected wireMessageHandling(): void {
    this.sandbox!.onMessage(msg => this.bridgeHandler!.handleMessage(msg));
  }
  
  protected waitForBridgeLoaded(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Bridge load timeout')),
        10000
      );
      
      const handler = (msg: unknown) => {
        if ((msg as any).type === 'bridge-loaded') {
          clearTimeout(timeout);
          resolve();
        }
      };
      
      this.sandbox!.onMessage(handler);
    });
  }
  
  protected waitForReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Agent ready timeout')),
        10000
      );
      
      const handler = (msg: unknown) => {
        if ((msg as any).type === 'ready') {
          clearTimeout(timeout);
          resolve();
        }
      };
      
      this.sandbox!.onMessage(handler);
    });
  }
  
  protected invokeAction(actionId: string, input?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const invokeId = `invoke-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const limits = this.config.limits ?? DEFAULT_LIMITS;
      
      const timeout = setTimeout(
        () => reject(new AgentletError(ErrorCodes.LIMIT_TIME_EXCEEDED, 'Action timeout')),
        limits.maxExecutionTime
      );
      
      const handler = (msg: unknown) => {
        const m = msg as any;
        if (m.invokeId !== invokeId) return;
        
        clearTimeout(timeout);
        if (m.type === 'invoke-result') resolve(m.result);
        else if (m.type === 'invoke-error') reject(new Error(m.error));
      };
      
      this.sandbox!.onMessage(handler);
      this.sandbox!.postMessage({
        type: 'invoke',
        invokeId,
        action: actionId,
        input: input ?? {}
      });
    });
  }
  
  protected cleanup(): void {
    this.sandbox?.destroy();
    this.sandbox = null;
    this.bridgeHandler = null;
  }
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxExecutionTime: 300000,  // 5 minutes
  maxInferenceCalls: 50,
  maxNetworkRequests: 100,
  maxStorageBytes: 5 * 1024 * 1024
};
```

### Layer 4: Environment-Aware Utilities

**Goal:** Auto-detect environment and use appropriate implementations.

```typescript
// Manifest parsing
export function extractManifest(html: string): ExtractedManifest {
  if (typeof DOMParser !== 'undefined') {
    return extractManifestDOM(html);
  }
  return extractManifestRegex(html);
}

// Both available for explicit use
export { extractManifestDOM } from './manifest-dom';
export { extractManifestRegex } from './manifest-regex';
```

### Layer 5: Inference Utilities

**Goal:** Reusable LLM client implementations.

```typescript
// packages/host-sdk/src/inference/

export interface LLMClientConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  defaultOptions?: Partial<InferenceOptions>;
}

export class OllamaClient {
  constructor(config: { baseUrl: string; model: string }) { ... }
  
  async chat(request: InferenceRequest): Promise<string> { ... }
  async chatStream(request: InferenceRequest, onToken: OnToken): Promise<string> { ... }
  async isAvailable(): Promise<boolean> { ... }
}

export class OpenAIClient {
  constructor(config: { apiKey: string; model: string }) { ... }
  
  async chat(request: InferenceRequest): Promise<string> { ... }
  async chatStream(request: InferenceRequest, onToken: OnToken): Promise<string> { ... }
}

export class AnthropicClient {
  constructor(config: { apiKey: string; model: string }) { ... }
  // ...
}

// Composite provider with fallback
export class FallbackInferenceProvider implements IInferenceProvider {
  constructor(providers: IInferenceProvider[]) { ... }
  
  async inference(request: InferenceRequest): Promise<string> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable?.()) {
          return await provider.inference(request);
        }
      } catch { continue; }
    }
    throw new AgentletError(ErrorCodes.INFERENCE_UNAVAILABLE, 'No provider available');
  }
}
```

---

## Implementation Plan

### Phase 1: Transport Abstraction

> **GAP-04 Blocker:** Unblocks CLI `serve` and testing mock bridge.

**Goal:** Eliminate bridge script duplication.

**Tasks:**
1. Create `packages/host-sdk/src/transport/` directory
2. Implement `TransportAdapter` interface
3. Create bridge script template with injection points
4. Implement `generateBridgeScript()` function
5. Add built-in transports: iframe, vscode-webview, native-bridge
6. Export from main index
7. Update documentation

**Deliverables:**
- `generateBridgeScript('iframe')` returns current SDK bridge
- `generateBridgeScript('vscode-webview')` returns VS Code variant
- Backwards compatible: existing `BRIDGE_SCRIPT` export unchanged

**Files:**
```
packages/host-sdk/src/
├── transport/
│   ├── index.ts           # Public exports
│   ├── types.ts           # TransportAdapter interface
│   ├── template.ts        # Bridge script template
│   ├── iframe.ts          # Iframe transport
│   ├── vscode.ts          # VS Code WebView transport
│   └── native.ts          # Native bridge transport
└── index.ts               # Add transport exports
```

**Validation:**
- [ ] VS Code host can use `generateBridgeScript('vscode-webview')`
- [ ] Generated script passes existing tests
- [ ] Bundle size increase < 5KB

### Phase 2: Sandbox Factory

> **GAP-04 Blocker:** Unblocks `createTestHarness()` and CLI `serve`.
> **Note:** Must include `HeadlessSandbox` (jsdom-based) for testing library.

**Goal:** Unified sandbox creation API.

**Tasks:**
1. Create `packages/host-sdk/src/sandbox/` directory
2. Define `SandboxConfig` interface
3. Implement `createSandbox()` factory
4. Extract `DOMIframeSandbox` from current `IframeSandbox`
5. Add `VSCodeWebViewSandbox` implementation
6. Add auto-detection logic
7. Maintain backwards compatibility

**Deliverables:**
- `createSandbox({ permissions, container })` for DOM hosts
- `createSandbox({ permissions, webviewPanel })` for VS Code
- Existing `IframeSandbox` class unchanged (deprecated)

**Files:**
```
packages/host-sdk/src/
├── sandbox/
│   ├── index.ts           # Public exports, factory
│   ├── types.ts           # SandboxConfig
│   ├── dom-iframe.ts      # DOM-based sandbox
│   ├── vscode-webview.ts  # VS Code WebView sandbox
│   └── headless.ts        # jsdom-based (for GAP-04 testing)
└── index.ts               # Add sandbox exports
```

**Validation:**
- [ ] Obsidian still works with `ContainerIframeSandbox`
- [ ] VS Code can migrate to `createSandbox()`
- [ ] Type safety for config options

### Phase 3: Runtime Base Class

**Goal:** Extract shared execution logic.

**Tasks:**
1. Create `packages/host-sdk/src/runtime/` directory
2. Define `RuntimeConfig` and `HostAdapters` interfaces
3. Implement `AgentRuntimeBase` abstract class
4. Extract shared methods from existing hosts
5. Document extension points
6. Create example implementation

**Deliverables:**
- `AgentRuntimeBase` with 80% of execution logic
- Hosts extend with ~50 lines
- Clear documentation of abstract methods

**Files:**
```
packages/host-sdk/src/
├── runtime/
│   ├── index.ts           # Public exports
│   ├── types.ts           # RuntimeConfig, HostAdapters
│   └── base.ts            # AgentRuntimeBase
└── index.ts               # Add runtime exports
```

**Validation:**
- [ ] New test host can execute agents with <100 lines
- [ ] All lifecycle events work correctly
- [ ] Timeout handling works

### Phase 4: Environment Utilities

> **GAP-04 Blocker:** Unblocks CLI `validate` (Node.js manifest parsing).

**Goal:** Node.js support for manifest parsing.

**Tasks:**
1. Extract current DOM-based parser to `manifest-dom.ts`
2. Create regex-based parser in `manifest-regex.ts`
3. Create auto-detecting `extractManifest()` function
4. Add comprehensive tests for both parsers
5. Document differences/limitations

**Deliverables:**
- `extractManifest()` works in both browser and Node.js
- `extractManifestDOM()` for explicit DOM usage
- `extractManifestRegex()` for explicit regex usage

**Files:**
```
packages/host-sdk/src/
├── manifest/
│   ├── index.ts           # Auto-detecting export
│   ├── dom.ts             # DOMParser-based
│   ├── regex.ts           # Regex-based (Node.js compatible)
│   └── types.ts           # Shared types
└── index.ts               # Update exports
```

**Validation:**
- [ ] VS Code can use `extractManifest()` directly
- [ ] Both parsers produce identical output
- [ ] Edge cases handled (malformed HTML, etc.)

### Phase 5: Inference Utilities

**Goal:** Reusable LLM clients.

**Tasks:**
1. Create `packages/host-sdk/src/inference/` directory
2. Implement `OllamaClient` with streaming support
3. Implement `OpenAIClient` with streaming support
4. Implement `FallbackInferenceProvider`
5. Add configuration helpers
6. Document usage patterns

**Deliverables:**
- `OllamaClient` for local inference
- `OpenAIClient` for cloud inference
- `FallbackInferenceProvider` for graceful degradation

**Files:**
```
packages/host-sdk/src/
├── inference/
│   ├── index.ts           # Public exports
│   ├── types.ts           # Request/response types
│   ├── ollama.ts          # Ollama client
│   ├── openai.ts          # OpenAI client
│   ├── anthropic.ts       # Anthropic client
│   └── fallback.ts        # Composite provider
└── index.ts               # Add inference exports
```

**Validation:**
- [ ] Ollama client works with local server
- [ ] OpenAI client handles rate limits
- [ ] Streaming works correctly
- [ ] Fallback tries providers in order

### Phase 6: Host Migration

**Goal:** Migrate existing hosts to new SDK.

**Tasks:**
1. **Obsidian** (reference implementation)
   - Already using SDK well
   - Minor updates to use new features
   
2. **VS Code**
   - Replace custom bridge script with `generateBridgeScript()`
   - Replace `WebViewSandbox` with `createSandbox()`
   - Replace custom inference with SDK clients
   - Extend `AgentRuntimeBase`
   
3. **Zotero**
   - Replace custom bridge script
   - Replace custom sandbox (biggest change)
   - Extend `AgentRuntimeBase`
   - Use SDK manifest parser

**Deliverables:**
- All hosts using SDK v2.0 features
- Reduced code in each host
- Consistent behavior across hosts

**Validation:**
- [ ] All existing agents still work
- [ ] No regression in functionality
- [ ] Code reduction achieved

---

## Migration Guide

### For Existing Hosts

#### Bridge Script Migration

**Before:**
```typescript
// Custom bridge script in host
const CUSTOM_BRIDGE_SCRIPT = `
  const vscode = acquireVsCodeApi();
  // ... 400 lines of duplicated code
`;
```

**After:**
```typescript
import { generateBridgeScript } from '@agentlet/host-sdk';

const bridgeScript = generateBridgeScript('vscode-webview');
```

#### Sandbox Migration

**Before:**
```typescript
// Custom WebViewSandbox class (565 lines)
export class WebViewSandbox implements ISandbox {
  // ... lots of code
}
```

**After:**
```typescript
import { createSandbox } from '@agentlet/host-sdk';

const sandbox = createSandbox({
  permissions: agent.permissions,
  webviewPanel: panel,
  transport: 'vscode-webview'
});
```

#### Runtime Migration

**Before:**
```typescript
// Duplicated in every host (200-300 lines)
async executeAction(actionId: string, input?: unknown): Promise<unknown> {
  const sandbox = new WebViewSandbox(...);
  const bridgeHandler = new VSCodeBridgeHandler(...);
  
  sandbox.onMessage(msg => bridgeHandler.handleMessage(msg));
  await sandbox.load(this.agent.html);
  await this.waitForBridgeLoaded();
  // ... same pattern repeated
}
```

**After:**
```typescript
import { AgentRuntimeBase } from '@agentlet/host-sdk';

class VSCodeAgentRuntime extends AgentRuntimeBase<vscode.ExtensionContext> {
  protected createSandbox(): ISandbox {
    return createSandbox({
      permissions: this.config.agent.permissions,
      webviewPanel: this.createWebviewPanel(),
      transport: 'vscode-webview'
    });
  }
  
  protected createBridgeHandler(sandbox: ISandbox): BridgeHandlerBase {
    return new VSCodeBridgeHandler({
      agentId: this.config.agent.id,
      permissions: this.config.agent.permissions,
      limits: this.config.limits,
      onSendMessage: (msg) => sandbox.postMessage(msg),
      adapters: this.config.adapters
    });
  }
  
  protected getHostInfo(): HostInfo {
    return {
      name: 'vscode',
      version: vscode.version,
      capabilities: VSCODE_CAPABILITIES
    };
  }
  
  // That's it! executeAction() is inherited
}
```

#### Inference Migration

**Before:**
```typescript
// Custom implementation (400+ lines)
export class VSCodeInferenceProvider implements IInferenceProvider {
  private async tryOllama(req: InferenceRequest): Promise<string | null> {
    // ... duplicated Ollama logic
  }
  
  private async tryOpenAI(req: InferenceRequest): Promise<string | null> {
    // ... duplicated OpenAI logic
  }
}
```

**After:**
```typescript
import { OllamaClient, OpenAIClient, FallbackInferenceProvider } from '@agentlet/host-sdk';

const inference = new FallbackInferenceProvider([
  new OllamaClient({ baseUrl: settings.ollamaUrl, model: settings.ollamaModel }),
  new OpenAIClient({ apiKey: settings.openaiKey, model: settings.openaiModel })
]);
```

### For New Hosts

#### Minimal Implementation

```typescript
import {
  AgentRuntimeBase,
  BridgeHandlerBase,
  createSandbox,
  type HostAdapters,
  type InstalledAgent
} from '@agentlet/host-sdk';

// 1. Define host constants
const HOST_NAME = 'my-app';
const HOST_VERSION = '1.0.0';
const HOST_CAPABILITIES = ['content', 'storage', 'inference'] as const;

// 2. Implement adapters (genuinely host-specific)
class MyContextAdapter implements IContextAdapter { /* ... */ }
class MyUIHandler implements IUIHandler { /* ... */ }
class MyStorageAdapter implements IStorageAdapter { /* ... */ }

// 3. Extend bridge handler (~30 lines)
class MyBridgeHandler extends BridgeHandlerBase {
  constructor(private adapters: HostAdapters, config: BridgeHandlerConfig) {
    super(config);
  }
  
  getHostName() { return HOST_NAME; }
  getHostVersion() { return HOST_VERSION; }
  getHostCapabilities() { return [...HOST_CAPABILITIES]; }
  getSupportedIntents() { return []; }
  getContextAdapter() { return this.adapters.context; }
  getStorageAdapter() { return this.adapters.storage; }
  getUIHandler() { return this.adapters.ui; }
  getInferenceProvider() { return this.adapters.inference; }
  getIntentHandler() { return this.adapters.intent; }
  protected getDefaultContextType() { return 'item'; }
  protected getItemSchema() { return { fields: ['id', 'title'] }; }
}

// 4. Extend runtime (~20 lines)
class MyAgentRuntime extends AgentRuntimeBase<MyApp> {
  protected createSandbox(): ISandbox {
    return createSandbox({
      permissions: this.config.agent.permissions,
      container: document.body
    });
  }
  
  protected createBridgeHandler(sandbox: ISandbox): BridgeHandlerBase {
    return new MyBridgeHandler(this.config.adapters, {
      agentId: this.config.agent.id,
      permissions: this.config.agent.permissions,
      limits: this.config.limits,
      onSendMessage: (msg) => sandbox.postMessage(msg)
    });
  }
  
  protected getHostInfo() {
    return { name: HOST_NAME, version: HOST_VERSION, capabilities: [...HOST_CAPABILITIES] };
  }
}

// 5. Use it
const runtime = new MyAgentRuntime({
  host: myApp,
  agent: installedAgent,
  adapters: {
    context: new MyContextAdapter(myApp),
    ui: new MyUIHandler(myApp),
    storage: new MyStorageAdapter(myApp)
  }
});

const result = await runtime.executeAction('my-action', { input: 'data' });
```

---

## Success Metrics

### Quantitative

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Lines per new host | 2,500 | 1,100 | Code analysis |
| SDK coverage | 40% | 80% | Shared vs total code |
| Time to new host | 2 days | 4 hours | Developer testing |
| Bridge script variants | 3 separate | 1 template | File count |
| Sandbox implementations | 3 separate | 1 factory | File count |

### Qualitative

- [ ] New host developers report easier onboarding
- [ ] Existing host maintainers report less maintenance burden
- [ ] Bug fixes in SDK automatically benefit all hosts
- [ ] New features (e.g., new transport) benefit all hosts

### Testing

- [ ] Unit tests for all new SDK components
- [ ] Integration tests with at least 2 host implementations
- [ ] Compatibility tests ensuring existing agents work
- [ ] Performance benchmarks for sandbox creation

---

## Appendix: File Structure

### Final SDK Structure

```
packages/host-sdk/
├── package.json
├── README.md
├── SDK-IMPROVEMENT-PLAN.md    # This document
├── MIGRATION-GUIDE.md         # Extracted from this doc
├── src/
│   ├── index.ts               # Public exports
│   │
│   ├── errors.ts              # ErrorCodes, AgentletError
│   ├── types.ts               # Core interfaces
│   │
│   ├── transport/             # NEW: Bridge script generation
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── template.ts
│   │   ├── iframe.ts
│   │   ├── vscode.ts
│   │   └── native.ts
│   │
│   ├── sandbox/               # ENHANCED: Sandbox factory
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── factory.ts
│   │   ├── dom-iframe.ts
│   │   ├── vscode-webview.ts
│   │   └── headless.ts
│   │
│   ├── manifest/              # ENHANCED: Multi-environment
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── dom.ts
│   │   └── regex.ts
│   │
│   ├── runtime/               # NEW: Execution orchestration
│   │   ├── index.ts
│   │   ├── types.ts
│   │   └── base.ts
│   │
│   ├── inference/             # NEW: LLM utilities
│   │   ├── index.ts
│   │   ├── types.ts
│   │   ├── ollama.ts
│   │   ├── openai.ts
│   │   ├── anthropic.ts
│   │   └── fallback.ts
│   │
│   └── bridge-handler.ts      # Existing (unchanged)
│
├── test/
│   ├── transport/
│   ├── sandbox/
│   ├── manifest/
│   ├── runtime/
│   └── inference/
│
└── dist/                      # Build output
```

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| Jan 2026 | 1.0 | Initial draft |

---

*This document is a living plan. Updates will be made as implementation progresses and feedback is received.*
