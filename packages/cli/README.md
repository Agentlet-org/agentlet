# @agentlet/cli

Command-line interface for developing Agentlet agents.

## Installation

```bash
npm install -g @agentlet/cli
```

Or use directly with npx:

```bash
npx @agentlet/cli <command>
```

## Commands

### `agentlet create <name>`

Scaffold a new agent from a template.

```bash
agentlet create my-agent
agentlet create my-agent -t adaptive
agentlet create my-agent -t universal -d "My description" -a "Author Name"
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-t, --template <type>` | Template type: `minimal`, `universal`, `adaptive` | `minimal` |
| `-o, --output <path>` | Output file path | `./<name>.agentlet` |
| `-d, --description <desc>` | Agent description | |
| `-a, --author <name>` | Author name | |

### `agentlet validate <file>`

Validate an agent's manifest and structure.

```bash
agentlet validate my-agent.agentlet
agentlet validate my-agent.agentlet -v
```

**Options:**
| Option | Description |
|--------|-------------|
| `-v, --verbose` | Show detailed validation info |

**Exit codes:**
- `0` - Valid
- `1` - Invalid (errors found)

### `agentlet serve <file>`

Start a development server for testing agents in the browser.

```bash
# Basic usage (mock inference)
agentlet serve my-agent.agentlet

# With OpenAI
agentlet serve my-agent.agentlet -i openai -k sk-... -m gpt-4o-mini

# With Ollama (local)
agentlet serve my-agent.agentlet -i ollama -m llama3

# Watch for changes
agentlet serve my-agent.agentlet -w
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <number>` | Port number | `3456` |
| `-w, --watch` | Watch for file changes | |
| `-i, --inference <provider>` | Inference provider: `mock`, `openai`, `ollama` | `mock` |
| `-k, --api-key <key>` | OpenAI API key (or set `OPENAI_API_KEY` env) | |
| `-m, --model <name>` | Model name | `gpt-4o-mini` / `llama3` |
| `--ollama-url <url>` | Ollama server URL | `http://localhost:11434` |

**Control Panel:**

The dev server provides a web-based control panel at `http://localhost:3456/` with:
- Action buttons to trigger agent actions
- Agent preview iframe showing notifications and UI
- Activity logs showing all bridge calls
- Inference settings panel to change provider on-the-fly

### `agentlet test <file>`

Run tests on an agent.

```bash
agentlet test my-agent.agentlet
agentlet test my-agent.agentlet -a run
agentlet test my-agent.agentlet -t 10000 -v
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-a, --action <id>` | Test specific action only | |
| `-t, --timeout <ms>` | Timeout in milliseconds | `5000` |
| `-v, --verbose` | Show detailed test output | |

### `agentlet templates`

List available agent templates.

```bash
agentlet templates
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key (alternative to `-k` flag) |
| `OLLAMA_URL` | Ollama server URL (alternative to `--ollama-url`) |

## Programmatic Usage

The CLI commands can also be used programmatically:

```typescript
import {
  createAgent,
  validateAgent,
  serveAgent,
  testAgent
} from '@agentlet/cli';

// Create an agent
const outputPath = await createAgent({
  name: 'my-agent',
  template: 'universal',
  description: 'My agent',
});

// Validate an agent
const result = await validateAgent('my-agent.agentlet');
if (!result.valid) {
  console.log(result.errors);
}

// Start dev server
const server = await serveAgent('my-agent.agentlet', {
  port: 3456,
  inference: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
});

// Run tests
const testResult = await testAgent('my-agent.agentlet', {
  action: 'run',
  timeout: 5000,
});
```

## License

MIT
