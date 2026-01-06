# Testing Agentlet Examples

This guide explains how to manually test the example agentlets using the CLI dev server and host applications.

## Quick Start with CLI Dev Server

The fastest way to test any agentlet is with the CLI dev server:

```bash
# Install CLI (from repo root)
cd packages/cli && npm install && npm run build

# Serve any agentlet
npx agentlet serve examples/universal/hello-world.agentlet

# Open http://localhost:3456 in your browser
```

The dev server provides:
- **Control panel** at `http://localhost:3456/` with action buttons
- **Agent preview** iframe showing notifications and UI
- **Activity logs** showing all bridge API calls
- **Inference settings** to switch between mock/OpenAI/Ollama

### With Real AI (OpenAI)

```bash
# Set API key via environment
export OPENAI_API_KEY=sk-...
npx agentlet serve examples/universal/text-improver.agentlet -i openai

# Or pass directly
npx agentlet serve examples/adaptive/todo-collector.agentlet -i openai -k sk-... -m gpt-4o-mini
```

### With Local AI (Ollama)

```bash
# Make sure Ollama is running with a model
ollama run llama3

# Serve with Ollama
npx agentlet serve examples/adaptive/smart-organizer.agentlet -i ollama -m llama3
```

---

## Example Agentlets by Type

### Universal (No host context needed)

These work everywhere - good for basic testing.

| Agent | Actions | What it does |
|-------|---------|--------------|
| `hello-world.agentlet` | Run | Says hello via inference |
| `text-improver.agentlet` | Improve Text | Rewrites text with AI |

**Test hello-world:**
```bash
npx agentlet serve examples/universal/hello-world.agentlet
# Click "Run" - should show notification with greeting
```

**Test text-improver:**
```bash
npx agentlet serve examples/universal/text-improver.agentlet -i openai
# Click "Improve Text" - prompts for text, shows improved version
```

### Adaptive (AI interprets any host)

These use `perceive/act` APIs to work across different hosts.

| Agent | Actions | What it does |
|-------|---------|--------------|
| `todo-collector.agentlet` | Scan for TODOs, Scan Current File | Finds TODO comments |
| `smart-organizer.agentlet` | Organize Selection, Organize All | Organizes items with AI |
| `daily-summary.agentlet` | Generate Summary | Summarizes recent activity |
| `code-explainer.agentlet` | Explain Code | Explains selected code |
| `link-suggester.agentlet` | Suggest Links | Suggests connections |
| `doc-drafter.agentlet` | Draft Documentation | Generates docs from code |
| `version-aware.agentlet` | Check Compatibility | Tests feature detection |

**Test todo-collector:**
```bash
npx agentlet serve examples/adaptive/todo-collector.agentlet -i openai
# Click "Scan for TODOs" - uses perceive() to get context, finds TODOs
# In dev server: returns mock items, but shows the flow
```

**Test smart-organizer:**
```bash
npx agentlet serve examples/adaptive/smart-organizer.agentlet -i openai
# Click "Organize All" - perceives items, uses AI to suggest organization
```

### Host-Family (Works across similar apps)

| Agent | Target Hosts | What it does |
|-------|--------------|--------------|
| `note-linker.agentlet` | PKM apps | Links related notes |
| `test-generator.agentlet` | Code editors | Generates tests |
| `refactor-assistant.agentlet` | Code editors | Suggests refactoring |
| `commit-message.agentlet` | Code editors | Writes commit messages |

### Host-Specific (Full power of one host)

| Agent | Target Host | What it does |
|-------|-------------|--------------|
| `zotero-citation-validator.agentlet` | Zotero | Validates citations |
| `multifile-refactorer.agentlet` | VS Code | Multi-file refactoring |

---

## Installing in Host Applications

### VS Code / Cursor

1. **Build the extension:**
   ```bash
   cd hosts/vscode
   npm install
   npm run build
   ```

2. **Launch Extension Development Host:**
   - Open `hosts/vscode/` in VS Code
   - Press `F5` to launch Extension Development Host
   - Or: `code --extensionDevelopmentPath=/path/to/hosts/vscode`

3. **Install an agent:**
   - Open Command Palette (`Cmd+Shift+P`)
   - Run "Agentlet: Install Agent"
   - Enter URL or file path to `.agentlet` file:
     ```
     file:///path/to/Agentlet/examples/universal/hello-world.agentlet
     ```

4. **Run an agent:**
   - Command Palette → "Agentlet: Run Agent Action"
   - Select agent and action

### Obsidian

1. **Build the plugin:**
   ```bash
   cd hosts/obsidian
   npm install
   npm run build
   ```

2. **Install in vault:**
   ```bash
   # Create plugin folder
   mkdir -p /path/to/vault/.obsidian/plugins/obsidian-agentlet

   # Copy built files
   cp main.js manifest.json styles.css /path/to/vault/.obsidian/plugins/obsidian-agentlet/
   ```

3. **Enable plugin:**
   - Open Obsidian Settings → Community plugins
   - Enable "Agentlet"

4. **Install an agent:**
   - Settings → Agentlet → Install Agent
   - Paste file URL or drag `.agentlet` file

5. **Run an agent:**
   - Command Palette (`Cmd+P`) → agent actions appear as commands
   - Or: Right-click context menu on notes

### Zotero

1. **Build the plugin:**
   ```bash
   cd hosts/zotero
   npm install
   npm run build
   ```

2. **Install plugin:**
   ```bash
   # For development (proxy file method):
   echo '/path/to/Agentlet/hosts/zotero/.scaffold/build/addon' > \
     ~/Library/Application\ Support/Zotero/Profiles/[profile].default/extensions/zotagentlet@agentlet.org
   ```

3. **Restart Zotero:**
   ```bash
   osascript -e 'quit app "Zotero"'; sleep 2 && open -a Zotero --args -purgecaches -jsconsole
   ```

4. **Install an agent:**
   - Tools → Agentlet → Install Agent
   - Enter URL to `.agentlet` file

---

## CLI Commands Reference

```bash
# Validate an agent
npx agentlet validate examples/universal/hello-world.agentlet

# Create new agent from template
npx agentlet create my-agent -t adaptive

# List available templates
npx agentlet templates

# Serve with options
npx agentlet serve <file> [options]
  -p, --port <number>     Port (default: 3456)
  -w, --watch             Watch for changes
  -i, --inference <type>  mock | openai | ollama
  -k, --api-key <key>     OpenAI API key
  -m, --model <name>      Model name
  --ollama-url <url>      Ollama URL (default: http://localhost:11434)

# Run tests
npx agentlet test examples/universal/hello-world.agentlet
```

---

## What to Expect

### Dev Server (Mock Mode)

With mock inference (default), you'll see:
- Actions trigger and complete
- Activity logs show all bridge calls
- Inference returns placeholder text
- Perceive returns mock items
- UI dialogs appear visually

### Dev Server (Real Inference)

With OpenAI/Ollama:
- Actual AI responses
- May take a few seconds
- Costs apply for OpenAI

### In Hosts

When installed in a real host:
- Perceive returns actual host data
- Act modifies real items
- Storage persists across sessions
- Full UI integration

---

## Troubleshooting

### "Agent ready" but nothing happens
- Check the Activity Logs panel for errors
- Make sure you clicked an action button

### Inference timeout
- Check API key is valid
- For Ollama, ensure it's running: `ollama list`

### Permission errors
- Agent may require capabilities not granted
- Check manifest capabilities vs host support

### Build errors
- Run `npm install` in the package directory
- Ensure Node.js 18+ is installed
