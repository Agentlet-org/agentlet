# VS Code Agentlet Extension

Run portable AI agents in VS Code (and compatible editors like Cursor).

## Status: Functional

All core phases are complete. The extension can:

- Install agents from URLs or local files
- Execute agent actions in sandboxed WebViews
- Access file/selection/workspace context via `perceive` API
- Show notifications, prompts, panels, and progress indicators
- Perform file operations (create, update, delete, open)
- Run LLM inference via Ollama or OpenAI

**Implementation Status:**

- [x] Phase 1: Core Infrastructure (package.json, types, storage, agent manager)
- [x] Phase 2: WebView sandbox with adapted bridge script
- [x] Phase 3: Context, UI, and Intent adapters
- [x] Phase 4: Inference provider (Ollama/OpenAI)
- [x] Phase 5: Agent runtime and extension integration
- [ ] Phase 6: Testing with example agents

## Quick Start

```bash
# From monorepo root
npm install
npm run build:sdk

# Build extension
cd hosts/vscode
npm run build

# Launch in VS Code
# Press F5 (requires opening hosts/vscode/ folder in VS Code)
```

## Installing Agents

1. Click the Agentlet icon in the activity bar
2. Click **+** to add an agent
3. Enter a URL or local path:
   - HTTP: `https://example.com/agent.agentlet`
   - Local: `/path/to/agent.agentlet`

**Example agents:**
```
/path/to/Agentlet/examples/universal/hello-world.agentlet
/path/to/Agentlet/examples/adaptive/code-explainer.agentlet
```

## Configuration

Configure inference provider in VS Code Settings (`Cmd+,`):

| Setting | Default | Description |
|---------|---------|-------------|
| `agentlet.inference.provider` | `ollama` | `ollama` or `openai` |
| `agentlet.inference.ollamaUrl` | `http://localhost:11434` | Ollama server URL |
| `agentlet.inference.ollamaModel` | `llama3.2` | Ollama model name |
| `agentlet.inference.openaiModel` | `gpt-4o-mini` | OpenAI model name |
| `agentlet.inference.openaiApiKey` | | OpenAI API key |

Or set via environment:
```bash
export OPENAI_API_KEY=sk-...
```

## Commands

| Command | Description |
|---------|-------------|
| `agentlet.installFromUrl` | Install agent from URL or path |
| `agentlet.refreshAgents` | Refresh agent list |
| `agentlet.uninstall` | Uninstall selected agent |
| `agentlet.viewSource` | View agent HTML source |

## Architecture

```
src/
├── extension.ts              # Entry point (activate/deactivate)
├── types/agentlet.ts         # SDK re-exports + VS Code constants
├── modules/
│   ├── agent-manager.ts      # Install/uninstall agents
│   ├── agent-runtime.ts      # Execute agents in WebView sandboxes
│   ├── bridge-handler.ts     # Route messages to adapters
│   ├── webview-sandbox.ts    # WebView container with bridge script
│   ├── manifest-parser.ts    # Extract manifest from HTML
│   └── adapters/
│       ├── context.ts        # File/selection/workspace access
│       ├── ui.ts             # Notifications, prompts, panels
│       ├── storage.ts        # Persistent globalState storage
│       ├── inference.ts      # Ollama/OpenAI LLM inference
│       └── intents.ts        # File operations
└── ui/
    └── agent-sidebar.ts      # TreeView provider for sidebar
```

## Troubleshooting

### Agent shows "Permission denied"

The agent was installed before a permission fix. Uninstall and reinstall it.

### Progress notification won't dismiss

Fixed in latest build. Ensure you've rebuilt: `npm run build`

### No console output visible

Extension logs go to Developer Tools, not Output panel:
1. Press `Cmd+Option+I` in Extension Development Host
2. Check Console tab for `[Agentlet]` logs

### "Sandbox not loaded" error

The WebView panel was closed. Run the action again to create a new sandbox.

### Inference not working

Check configuration:
1. For Ollama: ensure server is running at configured URL
2. For OpenAI: ensure API key is set in settings or environment

## Documentation

| Document | Description |
|----------|-------------|
| [DEVELOPMENT.md](./DEVELOPMENT.md) | Development setup and debugging |
| [IMPLEMENTATION.md](./IMPLEMENTATION.md) | Architecture and technical details |
| [IMPROVEMENTS.md](./IMPROVEMENTS.md) | Known issues and planned features |

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed instructions.

```bash
# Watch mode
npm run dev

# Production build
npm run build

# Package VSIX
npx @vscode/vsce package
```

## License

MIT
