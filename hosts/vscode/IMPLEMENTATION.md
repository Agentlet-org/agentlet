# VS Code Extension Implementation

Technical documentation for the VS Code Agentlet host implementation.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     VS Code Extension Host                       │
│                                                                  │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ extension.ts │───▶│ AgentManager  │───▶│ globalState      │  │
│  │ (entry)      │    │ (install/list)│    │ (persistence)    │  │
│  └──────┬───────┘    └───────────────┘    └──────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐    ┌───────────────┐    ┌──────────────────┐  │
│  │ AgentRuntime │───▶│ BridgeHandler │───▶│ Adapters         │  │
│  │ (execution)  │    │ (routing)     │    │ (host APIs)      │  │
│  └──────┬───────┘    └───────────────┘    └──────────────────┘  │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    WebViewSandbox                         │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              Agent HTML + Bridge Script             │  │   │
│  │  │  window.bridge.perceive() ──▶ vscode.postMessage() │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Module Reference

| Module | File | Purpose |
|--------|------|---------|
| **Entry Point** | `extension.ts` | Extension lifecycle, command registration |
| **Agent Manager** | `agent-manager.ts` | Install, uninstall, list agents |
| **Agent Runtime** | `agent-runtime.ts` | Execute actions, manage sandbox lifecycle |
| **Bridge Handler** | `bridge-handler.ts` | Route messages between sandbox and adapters |
| **WebView Sandbox** | `webview-sandbox.ts` | Sandboxed execution environment |
| **Manifest Parser** | `manifest-parser.ts` | Extract manifest from agent HTML |
| **Context Adapter** | `adapters/context.ts` | File, selection, workspace access |
| **UI Adapter** | `adapters/ui.ts` | Notifications, prompts, panels, progress |
| **Storage Adapter** | `adapters/storage.ts` | Persistent key-value storage |
| **Inference Provider** | `adapters/inference.ts` | LLM inference (Ollama/OpenAI) |
| **Intent Handler** | `adapters/intents.ts` | File operations (create, update, delete) |
| **Sidebar UI** | `agent-sidebar.ts` | TreeView for agent list |

## Message Flow

When an agent calls `bridge.inference(request)`:

```
1. Agent code (in WebView)
   └─▶ bridge._request('inference', request)
       └─▶ vscode.postMessage({ type: 'request', method: 'inference', params })

2. WebViewSandbox.onDidReceiveMessage
   └─▶ AgentRuntime.handleMessage
       └─▶ BridgeHandler.handleMessage
           └─▶ checks permissions
           └─▶ calls InferenceProvider.inference()
           └─▶ sends response via onSendMessage callback

3. WebViewSandbox.postMessage({ type: 'response', id, result })
   └─▶ Agent receives via window.addEventListener('message')
       └─▶ bridge._handleMessage resolves pending promise
```

## WebView Sandbox

VS Code uses WebviewPanel instead of iframes. Key differences:

| Feature | iframe | VS Code WebView |
|---------|--------|-----------------|
| Communication | `window.parent.postMessage()` | `vscode.postMessage()` |
| API access | `window.parent` | `acquireVsCodeApi()` |
| CSP | via meta tag | via WebviewOptions |
| Persistence | session | `retainContextWhenHidden` |

### Bridge Script Adaptation

The bridge script is modified for WebView:

```javascript
// Standard iframe bridge
window.parent.postMessage(msg, '*');

// VS Code WebView bridge
const vscode = acquireVsCodeApi();
vscode.postMessage(msg);
```

### Content Security Policy

CSP is built from agent permissions:

```typescript
const csp = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  `connect-src ${networkDomains}`,  // from permissions.network
  "style-src 'unsafe-inline'",
  "img-src data: blob: https:",
].join("; ");
```

## Adapters

### Context Adapter

Provides access to VS Code editor context:

| Method | VS Code API | Returns |
|--------|-------------|---------|
| `getSelection()` | `activeTextEditor.selection` | Selected text, range, file info |
| `getActiveFile()` | `activeTextEditor.document` | File path, content, language |
| `getWorkspace()` | `workspace.workspaceFolders` | Workspace folders |

**Perceive Implementation:**

```typescript
async perceive(options: PerceiveOptions): Promise<PerceiveResult> {
  const items = [];

  if (options.scope === 'selection') {
    const editor = vscode.window.activeTextEditor;
    if (editor && !editor.selection.isEmpty) {
      items.push({
        type: 'selection',
        content: editor.document.getText(editor.selection),
        file: editor.document.uri.fsPath,
        language: editor.document.languageId,
      });
    }
  }

  return { items, understanding: `${items.length} items` };
}
```

### UI Adapter

Maps Agentlet UI APIs to VS Code:

| Agentlet API | VS Code API | Notes |
|--------------|-------------|-------|
| `ui.notify()` | `showInformationMessage` | Non-blocking |
| `ui.confirm()` | `showWarningMessage` | With Yes/No buttons |
| `ui.prompt()` | `showInputBox` | Returns user input |
| `ui.form()` | Multi-step QuickPick | Sequential prompts |
| `ui.select()` | `showQuickPick` | Single or multi-select |
| `ui.panel()` | `createWebviewPanel` | HTML content panel |
| `activity.*` | `withProgress` | Progress notification |

**Non-blocking Pattern:**

```typescript
// WRONG - blocks until user dismisses
async notify(message: string): Promise<void> {
  await vscode.window.showInformationMessage(message);
}

// CORRECT - fire and forget
async notify(message: string): Promise<void> {
  vscode.window.showInformationMessage(message);
}
```

### Storage Adapter

Uses VS Code's `ExtensionContext.globalState`:

```typescript
// Namespaced by agent ID
const key = `agentlet.${agentId}.${userKey}`;
await context.globalState.update(key, value);
```

Storage is persistent across sessions and workspaces.

### Inference Provider

Priority order:
1. **Ollama** (local) - if configured and running
2. **OpenAI** (cloud) - fallback with API key

```typescript
async inference(request: InferenceRequest): Promise<string> {
  // Try Ollama first
  const ollamaResult = await this.tryOllama(request);
  if (ollamaResult !== null) return ollamaResult;

  // Fall back to OpenAI
  const openaiResult = await this.tryOpenAI(request);
  if (openaiResult !== null) return openaiResult;

  throw new Error("No inference provider available");
}
```

### Intent Handler

File operations via VS Code APIs:

| Intent | VS Code API |
|--------|-------------|
| `create` | `workspace.fs.writeFile` |
| `update` | `WorkspaceEdit.replace` |
| `delete` | `workspace.fs.delete` |
| `open` | `window.showTextDocument` |
| `replace-selection` | `TextEditor.edit` |

## Permission System

Permissions are computed from agent manifest:

```typescript
// Manifest declares capabilities
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:optional" content="ui:notify">

// Becomes permissions object
{
  context: ['file:read'],
  inference: 'inference:basic',
  ui: { notify: true, panel: true },
  storage: false,
  network: []
}
```

Permission checks happen in BridgeHandler before each operation.

## Error Handling

Errors flow from adapters through bridge to agent:

```typescript
// In BridgeHandler
try {
  const result = await adapter.method(params);
  this.sendResponse(id, result);
} catch (error) {
  this.sendError(id, {
    code: error.code || 'E801',
    message: error.message
  });
}

// Agent receives
bridge._request('method', params)
  .catch(err => {
    // err.code = 'E801'
    // err.message = 'Permission denied'
  });
```

## Extension Lifecycle

```typescript
export async function activate(context: ExtensionContext) {
  // 1. Initialize adapters
  agentManager = new AgentManager(context);
  storageAdapter = new VSCodeStorageAdapter(context);
  inferenceProvider = new VSCodeInferenceProvider();

  // 2. Load installed agents
  await agentManager.ensureLoaded();

  // 3. Register sidebar
  treeDataProvider = new AgentTreeDataProvider(agentManager);
  vscode.window.createTreeView('agentlet.agents', { treeDataProvider });

  // 4. Register commands
  registerCommands(context);
  registerAgentCommands(context);
}

export function deactivate() {
  // Clean up active runtime
  activeRuntime?.destroy();
}
```

## Agent Execution Flow

```
1. User clicks action in sidebar
   └─▶ executeAgentAction(agentId, actionId)

2. Create AgentRuntime
   └─▶ new AgentRuntime(context, agent, storage, inference)

3. Execute action
   └─▶ runtime.executeAction(actionId)
       └─▶ Create WebViewSandbox
       └─▶ Create BridgeHandler with adapters
       └─▶ Load agent HTML (with bridge script injected)
       └─▶ Wait for bridge ready signal
       └─▶ Send init message with host capabilities
       └─▶ Send invoke message with action ID
       └─▶ Wait for invoke-result or invoke-error

4. Cleanup
   └─▶ runtime.destroy()
       └─▶ sandbox.destroy() (disposes WebviewPanel)
```

## Supported Capabilities

```typescript
const VSCODE_CAPABILITIES = [
  'content',           // File content access
  'content:code',      // Code-specific content
  'folders',           // Workspace folders
  'search',            // File search
  'diagnostics',       // Errors/warnings (planned)
] as const;

const SUPPORTED_INTENTS = [
  'create',            // Create files
  'update',            // Modify files
  'delete',            // Delete files
  'open',              // Open in editor
  'replace-selection', // Replace selected text
] as const;
```

## Database Schema

No database - uses VS Code's globalState:

```
Key: agentlet.installedAgents
Value: {
  "agent-id": {
    id: string,
    url: string,
    manifest: ExtractedManifest,
    html: string,
    permissions: GrantedPermissions,
    installedAt: string,
    updatedAt: string
  }
}

Key: agentlet.{agentId}.{userKey}
Value: any (agent storage)
```
