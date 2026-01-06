# VS Code Extension Development Guide

This guide covers setting up and debugging the VS Code Agentlet extension.

## Prerequisites

- Node.js 18+
- VS Code 1.85+
- npm (comes with Node.js)

## Quick Start

```bash
# From monorepo root
npm install

# Build SDK (required first time)
npm run build:sdk

# Navigate to VS Code extension
cd hosts/vscode

# Build the extension
npm run build

# Or watch mode for development
npm run dev
```

## Running the Extension

### Option 1: Launch Configuration (Recommended)

1. Open `hosts/vscode/` in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with the extension loaded

The `.vscode/launch.json` is pre-configured:
```json
{
  "name": "Run Extension",
  "type": "extensionHost",
  "request": "launch",
  "args": ["--extensionDevelopmentPath=${workspaceFolder}"]
}
```

### Option 2: Manual Installation

```bash
# Build the extension
npm run build

# Package as VSIX (if vsce is installed)
npx @vscode/vsce package

# Install in VS Code
code --install-extension vscode-agentlet-0.1.0.vsix
```

## Debugging

### Extension Host Logs

The Extension Host output shows extension activation and errors:
- View → Output → Select "Extension Host" from dropdown

Note: `console.log` from extension code does NOT appear here.

### Developer Tools Console

All `console.log` statements appear in Developer Tools:

1. In the Extension Development Host window
2. Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
3. Go to the Console tab

Look for logs prefixed with `[Agentlet]`:
```
[Agentlet] Activating extension v0.1.0...
[Agentlet] Executing action: explain on agent: code-explainer
[Agentlet] Creating sandbox...
[Agentlet] OpenAI response status: 200
```

### WebView Sandbox Debugging

Agent code runs inside a WebView sandbox. To debug it:

1. Run an agent action (so the WebView is created)
2. Open Command Palette (`Cmd+Shift+P`)
3. Run "Developer: Open Webview Developer Tools"
4. This opens DevTools for the agent's WebView

The agent's `console.log` statements appear here, not in the main DevTools.

### Common Debug Scenarios

**Agent not loading:**
```
[Agentlet] Creating sandbox...
[Agentlet] WebView panel created
[Agentlet] Agent HTML loaded
```
If these don't appear, check if the agent HTML is valid.

**Permission denied errors:**
```
Error: UI permission denied: notify
```
The agent needs to be reinstalled after permission parsing fixes. Uninstall and reinstall the agent.

**Inference not working:**
```
[Agentlet] Trying Ollama...
[Agentlet] Ollama failed or skipped, trying OpenAI...
[Agentlet] No OpenAI API key found
```
Configure inference in VS Code settings (see Configuration).

## Hot Reloading

The extension does NOT hot-reload. After code changes:

1. Rebuild: `npm run build`
2. Reload the Extension Development Host:
   - Press `Cmd+Shift+P` → "Developer: Reload Window"
   - Or close and press `F5` again

For faster iteration, use watch mode in a terminal:
```bash
npm run dev
```
Then just reload the window after each change (no manual rebuild needed).

## Project Structure

```
hosts/vscode/
├── .vscode/
│   ├── launch.json          # F5 launch configuration
│   └── tasks.json           # Build tasks
├── src/
│   ├── extension.ts         # activate() / deactivate()
│   ├── types/agentlet.ts    # Type re-exports
│   ├── modules/
│   │   ├── agent-manager.ts     # Agent installation/storage
│   │   ├── agent-runtime.ts     # Action execution
│   │   ├── bridge-handler.ts    # Message routing
│   │   ├── webview-sandbox.ts   # WebView container
│   │   ├── manifest-parser.ts   # HTML manifest extraction
│   │   └── adapters/
│   │       ├── context.ts       # File/workspace access
│   │       ├── ui.ts            # Notifications/panels
│   │       ├── storage.ts       # Persistent storage
│   │       ├── inference.ts     # LLM providers
│   │       └── intents.ts       # File operations
│   └── ui/
│       └── agent-sidebar.ts     # TreeView provider
├── dist/
│   └── extension.js         # Bundled output
├── package.json             # Extension manifest
├── tsconfig.json
└── esbuild.config.mjs       # Build configuration
```

## Configuration Settings

Configure via VS Code Settings (`Cmd+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `agentlet.inference.provider` | `ollama` | `ollama` or `openai` |
| `agentlet.inference.ollamaUrl` | `http://localhost:11434` | Ollama server URL |
| `agentlet.inference.ollamaModel` | `llama3.2` | Ollama model name |
| `agentlet.inference.openaiModel` | `gpt-4o-mini` | OpenAI model name |
| `agentlet.inference.openaiApiKey` | `` | OpenAI API key |

Or set via environment variable:
```bash
export OPENAI_API_KEY=sk-...
```

## Installing Test Agents

Install agents from local files during development:

```
/Users/you/Dev/Agentlet/examples/adaptive/code-explainer.agentlet
```

Or from the examples directory:
- `examples/universal/hello-world.agentlet` - Basic test
- `examples/adaptive/code-explainer.agentlet` - Uses inference + perceive

## Troubleshooting

### "Extension 'agentlet.vscode-agentlet' not found"

This appears in development mode when clicking "Manage Extension". It's normal - the extension isn't installed from marketplace.

### "Sandbox not loaded"

The WebView panel was closed or failed to create. Try running the action again.

### Progress notification won't dismiss

Check that all async operations in adapters don't unnecessarily `await` VS Code notification APIs (they block until dismissed).

### Agent works once but fails on retry

Ensure the previous runtime is properly destroyed. The extension should cancel/destroy any active runtime before creating a new one.

### No console output

Make sure you're looking in the right place:
- Extension code → Developer Tools Console (`Cmd+Option+I`)
- Agent code → WebView Developer Tools (`Developer: Open Webview Developer Tools`)
- NOT Extension Host output panel

## Testing Workflow

1. Start watch mode: `npm run dev`
2. Press `F5` to launch Extension Development Host
3. Install a test agent from `examples/`
4. Make code changes
5. Reload window (`Cmd+Shift+P` → "Reload Window")
6. Test again

## Building for Release

```bash
# Production build
npm run build

# Package VSIX
npx @vscode/vsce package

# Output: vscode-agentlet-0.1.0.vsix
```
