# Agentlet Capability Negotiation

**Version:** 0.1.0 (Draft)
**Target Spec:** v0.2.0
**Status:** Proposal
**Date:** January 2026
**Related:** GAP-01 (Versioning), GAP-05 (Agent Communication), GAP-06 (Semantic Intents)

---

## Executive Summary

This document defines the **capability negotiation system** for Agentlet — how agents declare what they need, what they provide, and how hosts advertise their capabilities.

### Key Principles

| Principle | Implementation |
|-----------|----------------|
| **Don't reinvent MCP** | Agents expose tools via MCP protocol, not custom |
| **Perceive/Act is the innovation** | Semantic, AI-interpreted — not tool calling |
| **Levels for broad matching** | basic/standard/advanced for registry filtering |
| **Features for precision** | Runtime checks for specific capabilities |
| **Graceful degradation** | Agents adapt when features are missing |

### Design Goals

1. Agents declare what they **NEED** (requirements from host)
2. Agents declare what they **PROVIDE** (tools, intents, domains)
3. Hosts advertise capability **LEVELS** (not just boolean support)
4. **Graceful degradation** when host < agent expectations
5. **Registry integration** for discovery and compatibility scoring
6. **MCP alignment** for tool exposure (don't reinvent)

---

## 1. Two-Sided Capabilities

Capability negotiation is bidirectional:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     TWO-SIDED CAPABILITY MODEL                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   AGENT NEEDS                              AGENT PROVIDES               │
│   ───────────                              ──────────────               │
│                                                                         │
│   "What can the HOST do for me?"           "What can I do for others?"  │
│                                                                         │
│   • perceive:standard                      • MCP tools (summarize, etc) │
│   • inference:standard                     • Intents (for routing)      │
│   • capability:tags                        • Domains (for discovery)    │
│   • inference.streaming                                                 │
│                                                                         │
│   Declared via:                            Declared via:                │
│   • agentlet:requires                      • agentlet:mcp-tool          │
│   • agentlet:enhances-with                 • agentlet:provides          │
│   • agentlet:capability                    • agentlet:domain            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. What Agents Need (Host Capabilities)

### 2.1 Primitive Levels

Three levels per primitive, each building on the previous:

#### Perceive Levels

| Level | Description | Includes |
|-------|-------------|----------|
| **basic** | Raw data dump, structured JSON | `structured` |
| **standard** | + Schema info + host interpretation | `structured`, `schema`, `understanding` |
| **advanced** | + AI-powered semantic understanding | All above + `semantic`, `related`, `history` |

#### Act Levels

| Level | Description | Includes |
|-------|-------------|----------|
| **basic** | Core CRUD intents | `create`, `update`, `delete` |
| **standard** | + Organization intents | All above + `add-tags`, `remove-tags`, `move-to`, `search` |
| **advanced** | + AI-resolved natural language | All above + `natural-language`, `batch`, `undo` |

#### Inference Levels

| Level | Description | Includes |
|-------|-------------|----------|
| **basic** | Simple completions | `completion` |
| **standard** | + Chat, moderate context | All above + `chat`, `moderate-context` |
| **advanced** | + Streaming, tools, vision | All above + `streaming`, `tools`, `vision`, `long-context` |

**Note:** Levels are additive. `advanced` includes everything from `standard` and `basic`.

### 2.2 Manifest Declaration

```html
<!-- Minimum requirements (agent won't work without these) -->
<meta name="agentlet:requires" content="perceive:standard">
<meta name="agentlet:requires" content="inference:standard">
<meta name="agentlet:requires" content="act:basic">

<!-- Specific feature requirements -->
<meta name="agentlet:requires" content="inference.streaming">

<!-- Host data capabilities required -->
<meta name="agentlet:requires" content="capability:tags">
<meta name="agentlet:requires" content="capability:search">

<!-- Enhanced experience when available (optional) -->
<meta name="agentlet:enhances-with" content="perceive:advanced">
<meta name="agentlet:enhances-with" content="inference.tools">
<meta name="agentlet:enhances-with" content="inference.vision">
```

### 2.3 Runtime Discovery API

```javascript
// ═══════════════════════════════════════════════════════════════════
// PRIMITIVE LEVELS
// ═══════════════════════════════════════════════════════════════════

// Get current level for a primitive
bridge.capabilities.getLevel('perceive');     // 'basic' | 'standard' | 'advanced'
bridge.capabilities.getLevel('act');          // 'basic' | 'standard' | 'advanced'
bridge.capabilities.getLevel('inference');    // 'basic' | 'standard' | 'advanced'

// Check if host meets a level requirement
bridge.capabilities.meetsLevel('perceive', 'standard');  // true/false

// Compare levels
bridge.capabilities.compareLevel('standard', 'advanced');  // -1 (standard < advanced)

// ═══════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════

// Check specific feature within a primitive
bridge.capabilities.hasFeature('perceive', 'semantic');     // true/false
bridge.capabilities.hasFeature('inference', 'streaming');   // true/false
bridge.capabilities.hasFeature('act', 'natural-language');  // false

// Get all features for a primitive
bridge.capabilities.getFeatures('inference');
// { completion: true, chat: true, streaming: true, tools: true, vision: false }

// ═══════════════════════════════════════════════════════════════════
// HOST DATA CAPABILITIES (unchanged from v0.1)
// ═══════════════════════════════════════════════════════════════════

// Available host data capabilities
bridge.capabilities.data;            // ['tags', 'collections', 'search', ...]
bridge.hasCapability('tags');        // true/false (shorthand)

// Supported intents
bridge.capabilities.intents;         // ['add-tags', 'move-to', 'search', ...]
bridge.capabilities.hasIntent('add-tags');  // true/false

// ═══════════════════════════════════════════════════════════════════
// FULL CAPABILITY DESCRIPTION
// ═══════════════════════════════════════════════════════════════════

const caps = await bridge.capabilities.describe();
/*
{
  specVersion: "0.2",
  host: { name: "zotero", version: "8.0.1" },
  primitives: {
    perceive: {
      level: "advanced",
      features: { structured: true, schema: true, semantic: true, related: true }
    },
    act: {
      level: "standard",
      features: { create: true, update: true, "add-tags": true, "move-to": true },
      intents: ["add-tags", "remove-tags", "move-to", "search", "create", "update", "delete"]
    },
    inference: {
      level: "advanced",
      features: { streaming: true, tools: true, vision: false }
    }
  },
  data: ["tags", "collections", "search", "attachments", "pdf"]
}
*/
```

---

## 3. What Agents Provide

Agents can provide value in three ways:

| Type | Purpose | Protocol |
|------|---------|----------|
| **MCP Tools** | Callable functions | MCP (don't reinvent) |
| **Intents** | Semantic routing hints | Agentlet manifest |
| **Domains** | Registry categorization | Agentlet manifest |

### 3.1 MCP Tool Exposure

Agents that provide callable tools expose themselves as MCP servers:

```html
<!-- Declare agent as MCP server -->
<meta name="agentlet:mcp-server" content="true">

<!-- List tools provided (for manifest parsing / registry) -->
<meta name="agentlet:mcp-tool" content="summarize">
<meta name="agentlet:mcp-tool" content="translate">
<meta name="agentlet:mcp-tool" content="extract-citations">
```

```javascript
// Agent registers MCP-compatible tool handlers
bridge.mcp.expose({
  name: "summarize",
  description: "Summarize text or documents",
  inputSchema: {
    type: "object",
    properties: {
      content: { type: "string", description: "Text to summarize" },
      length: { type: "string", enum: ["brief", "detailed"], default: "brief" }
    },
    required: ["content"]
  },
  handler: async ({ content, length }) => {
    const summary = await bridge.inference({
      prompt: `Summarize the following text (${length}): ${content}`
    });
    return { summary };
  }
});

bridge.mcp.expose({
  name: "translate",
  description: "Translate text to another language",
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string" },
      targetLanguage: { type: "string" }
    },
    required: ["text", "targetLanguage"]
  },
  handler: async ({ text, targetLanguage }) => {
    const translated = await bridge.inference({
      prompt: `Translate to ${targetLanguage}: ${text}`
    });
    return { translated };
  }
});
```

**Why MCP?**
- Don't reinvent tool protocols
- Interoperability with MCP ecosystem
- Agents become portable MCP servers
- Host can expose agent tools to other MCP clients

### 3.2 Intent Declaration (For Routing)

Intents are semantic hints for host-mediated routing (see GAP-05, GAP-06):

```html
<!-- Intents this agent can fulfill -->
<meta name="agentlet:provides" content="intent:summarize">
<meta name="agentlet:provides" content="intent:translate">
<meta name="agentlet:provides" content="intent:extract-citations">
```

When a host receives an intent request, it can route to an agent that provides it:

```javascript
// Some code (host or agent) requests an intent
await bridge.intents.request({
  intent: "translate",
  text: "Hello world",
  targetLanguage: "es"
});

// Host decides fulfillment:
// 1. Built-in capability
// 2. Route to agent that provides intent:translate
// 3. Call MCP server
// 4. External API
```

**Intent vs MCP Tool:**
- **MCP Tool** = Explicit function call with schema
- **Intent** = Semantic request, host decides how to fulfill

### 3.3 Domain Declaration (For Discovery)

Domains categorize agents for registry discovery:

```html
<!-- Domains this agent operates in -->
<meta name="agentlet:domain" content="research">
<meta name="agentlet:domain" content="writing">
<meta name="agentlet:domain" content="bibliography">
```

Used by registry for filtering and categorization:

```
GET /api/v1/agents?domain=research
GET /api/v1/agents?domain=writing&provides=intent:translate
```

---

## 4. Graceful Degradation

### 4.1 Problem

When an agent requests features the host doesn't support:

```javascript
const ctx = await bridge.perceive({
  query: "Find semantically related papers",
  depth: "semantic",        // Host might not support
  includeRelated: true      // Host might not support
});
```

### 4.2 Solution: Degraded Response

Host returns what it can, with degradation info:

```javascript
const ctx = await bridge.perceive({
  depth: "semantic",
  includeRelated: true
});

// Response includes degradation info
{
  items: [...],
  understanding: "5 research papers about machine learning...",
  capabilities: ["tags", "collections"],

  // NEW: What was requested vs fulfilled
  degraded: {
    requested: ["semantic", "related"],
    fulfilled: ["semantic"],
    missing: ["related"],
    reason: "Related papers feature not available in this host"
  }
}
```

### 4.3 Agent Fallback Handling

```javascript
async function analyzeSelection() {
  const ctx = await bridge.perceive({
    scope: 'selection',
    depth: 'semantic',
    includeRelated: true
  });

  // Check degradation and adapt
  if (ctx.degraded?.missing.includes('semantic')) {
    // Fallback: Agent interprets raw data itself
    ctx.understanding = await bridge.inference({
      prompt: `Analyze these items: ${JSON.stringify(ctx.items.slice(0, 5))}`
    });
  }

  if (ctx.degraded?.missing.includes('related')) {
    // Fallback: Skip or search manually
    console.log('Related items unavailable, using search fallback');
    if (bridge.capabilities.hasIntent('search')) {
      const related = await bridge.act({
        intent: 'search',
        query: extractKeywords(ctx.understanding)
      });
      ctx.relatedItems = related.result;
    }
  }

  return ctx;
}
```

### 4.4 Manifest Fallback Declaration (Optional)

Agents can declare fallback strategies:

```html
<meta name="agentlet:fallback" content="perceive.semantic"
      data-strategy="agent-interpret"
      data-description="Agent interprets raw data if semantic unavailable">

<meta name="agentlet:fallback" content="inference.streaming"
      data-strategy="batch"
      data-description="Use non-streaming if unavailable">
```

---

## 5. Host Capability Advertisement

### 5.1 Capability Object Structure

```javascript
bridge.capabilities = {
  // Primitive levels and features
  primitives: {
    perceive: {
      level: "advanced",
      features: {
        structured: true,
        schema: true,
        understanding: true,
        semantic: true,
        related: true,
        history: false
      }
    },
    act: {
      level: "standard",
      features: {
        create: true,
        update: true,
        delete: true,
        "add-tags": true,
        "remove-tags": true,
        "move-to": true,
        search: true,
        "natural-language": false,
        batch: false,
        undo: false
      },
      intents: ["add-tags", "remove-tags", "move-to", "search", "create", "update", "delete"]
    },
    inference: {
      level: "advanced",
      features: {
        completion: true,
        chat: true,
        "moderate-context": true,
        streaming: true,
        tools: true,
        vision: false,
        "long-context": true
      }
    }
  },

  // Host data capabilities
  data: ["tags", "collections", "search", "content", "attachments", "pdf"],

  // MCP servers available
  mcp: ["github", "filesystem"]
};
```

### 5.2 Install-Time Compatibility Check

Host checks compatibility before installing:

```javascript
function checkCompatibility(agentManifest, hostCapabilities) {
  const errors = [];
  const warnings = [];

  // Check required levels
  for (const req of agentManifest.requires) {
    if (req.includes(':')) {
      // Level requirement: "perceive:standard"
      const [primitive, level] = req.split(':');
      const hostLevel = hostCapabilities.primitives[primitive]?.level;

      if (!hostLevel) {
        errors.push(`Missing primitive: ${primitive}`);
      } else if (!meetsLevel(hostLevel, level)) {
        errors.push(`${primitive} level insufficient: need ${level}, have ${hostLevel}`);
      }
    } else if (req.includes('.')) {
      // Feature requirement: "inference.streaming"
      const [primitive, feature] = req.split('.');
      if (!hostCapabilities.primitives[primitive]?.features[feature]) {
        errors.push(`Missing feature: ${primitive}.${feature}`);
      }
    } else if (req.startsWith('capability:')) {
      // Data capability: "capability:tags"
      const cap = req.replace('capability:', '');
      if (!hostCapabilities.data.includes(cap)) {
        errors.push(`Missing data capability: ${cap}`);
      }
    }
  }

  // Check enhancements (warnings only)
  for (const enh of agentManifest.enhancesWith || []) {
    // Similar logic but add to warnings, not errors
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings
  };
}

function meetsLevel(hostLevel, requiredLevel) {
  const levels = ['basic', 'standard', 'advanced'];
  return levels.indexOf(hostLevel) >= levels.indexOf(requiredLevel);
}
```

---

## 6. Registry Integration

### 6.1 Compatibility Scoring

Registry calculates compatibility for each host:

```javascript
function calculateCompatibility(agent, host) {
  const levels = ['basic', 'standard', 'advanced'];
  let score = 0;
  let maxScore = 0;

  // Required capabilities (must have)
  for (const req of agent.requires) {
    if (!hostMeetsRequirement(host, req)) {
      return { compatible: false, score: 0, label: 'Incompatible' };
    }
  }

  // Enhancement capabilities (bonus points)
  for (const enh of agent.enhancesWith || []) {
    maxScore += 1;
    if (hostMeetsRequirement(host, enh)) {
      score += 1;
    }
  }

  const percentage = maxScore > 0 ? score / maxScore : 1;

  return {
    compatible: true,
    score: percentage,
    label: percentage > 0.8 ? 'Full' : percentage > 0.4 ? 'Good' : 'Basic'
  };
}
```

### 6.2 Registry Display

```
Smart Research Assistant
├── Requires: perceive:standard, inference:standard
├── Provides: summarize, translate, extract-citations
├── Domains: research, bibliography
├── Enhanced with: perceive:advanced, inference.streaming
│
│ Compatibility:
├── Zotero 8      ████████████ Full    (all enhancements available)
├── Obsidian      ████████░░░░ Good    (perceive:standard only)
├── VS Code       ██████░░░░░░ Basic   (meets requirements)
└── Simple Host   ░░░░░░░░░░░░ None    (missing perceive)
```

### 6.3 Registry API

```yaml
# Search by provides
GET /api/v1/agents?provides=intent:translate
GET /api/v1/agents?mcp-tool=summarize
GET /api/v1/agents?domain=research

# Search by requirements (what hosts can run it)
GET /api/v1/agents?max-requires=perceive:basic
GET /api/v1/agents?host=obsidian

# Get compatibility for a specific host
GET /api/v1/agents/:slug/compatibility?host=zotero
→ { "score": "full", "percentage": 100, "details": {...} }

# Get compatibility matrix
GET /api/v1/agents/:slug/compatibility
→ {
    "zotero": { "score": "full", "percentage": 100 },
    "obsidian": { "score": "good", "percentage": 60 },
    "vscode": { "score": "basic", "percentage": 30 }
  }
```

---

## 7. Complete Manifest Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Smart Research Assistant</title>

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- IDENTITY                                                            -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <meta name="agentlet" content="0.2">
  <meta name="agentlet:name" content="smart-research-assistant">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="AI-powered research organization and analysis">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  <meta name="agentlet:portability" content="adaptive">

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- WHAT THIS AGENT NEEDS (Requirements)                                -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

  <!-- Primitive levels required -->
  <meta name="agentlet:requires" content="perceive:standard">
  <meta name="agentlet:requires" content="inference:standard">
  <meta name="agentlet:requires" content="act:basic">

  <!-- Host data capabilities required -->
  <meta name="agentlet:requires" content="capability:tags">

  <!-- Enhanced when available -->
  <meta name="agentlet:enhances-with" content="perceive:advanced">
  <meta name="agentlet:enhances-with" content="inference:advanced">
  <meta name="agentlet:enhances-with" content="inference.streaming">
  <meta name="agentlet:enhances-with" content="inference.tools">
  <meta name="agentlet:enhances-with" content="capability:collections">

  <!-- Fallback strategies -->
  <meta name="agentlet:fallback" content="perceive.semantic" data-strategy="agent-interpret">

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- WHAT THIS AGENT PROVIDES                                            -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

  <!-- MCP server exposure -->
  <meta name="agentlet:mcp-server" content="true">
  <meta name="agentlet:mcp-tool" content="summarize">
  <meta name="agentlet:mcp-tool" content="translate">
  <meta name="agentlet:mcp-tool" content="extract-citations">

  <!-- Intents for routing -->
  <meta name="agentlet:provides" content="intent:summarize">
  <meta name="agentlet:provides" content="intent:translate">
  <meta name="agentlet:provides" content="intent:classify">

  <!-- Domains for discovery -->
  <meta name="agentlet:domain" content="research">
  <meta name="agentlet:domain" content="bibliography">

  <!-- ═══════════════════════════════════════════════════════════════════ -->
  <!-- ACTIONS                                                             -->
  <!-- ═══════════════════════════════════════════════════════════════════ -->

  <meta name="agentlet:action" content="organize" data-label="Organize Selection">
  <meta name="agentlet:action" content="summarize" data-label="Summarize">
  <meta name="agentlet:action" content="find-related" data-label="Find Related">

</head>
<body>

<script type="module">
const { bridge } = window;

// ═══════════════════════════════════════════════════════════════════
// LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

bridge.onActivate(async () => {
  // Check what's available and adapt
  const perceiveLevel = bridge.capabilities.getLevel('perceive');
  const hasSemanticSearch = bridge.capabilities.hasFeature('perceive', 'semantic');

  console.log(`Running with perceive:${perceiveLevel}, semantic:${hasSemanticSearch}`);

  // Register MCP tools
  registerTools();
});

// ═══════════════════════════════════════════════════════════════════
// MCP TOOL EXPOSURE
// ═══════════════════════════════════════════════════════════════════

function registerTools() {
  bridge.mcp.expose({
    name: "summarize",
    description: "Summarize text or documents",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "Text to summarize" },
        length: { type: "string", enum: ["brief", "detailed"], default: "brief" }
      },
      required: ["content"]
    },
    handler: async ({ content, length }) => {
      const summary = await bridge.inference({
        prompt: `Summarize (${length}): ${content}`,
        max_tokens: length === 'brief' ? 150 : 500
      });
      return { summary };
    }
  });

  bridge.mcp.expose({
    name: "translate",
    description: "Translate text to another language",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        targetLanguage: { type: "string" }
      },
      required: ["text", "targetLanguage"]
    },
    handler: async ({ text, targetLanguage }) => {
      const translated = await bridge.inference({
        prompt: `Translate to ${targetLanguage}: ${text}`
      });
      return { translated };
    }
  });

  bridge.mcp.expose({
    name: "extract-citations",
    description: "Extract citations from academic text",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" }
      },
      required: ["text"]
    },
    handler: async ({ text }) => {
      const result = await bridge.inference({
        prompt: `Extract all citations from this text as JSON array: ${text}`
      });
      return { citations: JSON.parse(result) };
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// ACTIONS (with graceful degradation)
// ═══════════════════════════════════════════════════════════════════

bridge.action('organize', async () => {
  // Perceive with graceful degradation
  const ctx = await bridge.perceive({
    scope: 'selection',
    depth: 'semantic',
    understand: true
  });

  if (ctx.items.length === 0) {
    await bridge.ui.notify('Select items first', 'warning');
    return;
  }

  // Handle degradation
  let understanding = ctx.understanding;
  if (ctx.degraded?.missing.includes('semantic')) {
    // Fallback: interpret ourselves
    understanding = await bridge.inference({
      prompt: `Briefly describe these items: ${JSON.stringify(ctx.items.slice(0, 3))}`
    });
  }

  // Generate organization suggestions
  const plan = await bridge.inference({
    prompt: `Based on: ${understanding}
Available capabilities: ${ctx.capabilities.join(', ')}
Suggest tags and organization as JSON: { tags: [], collection: "" }`
  });

  const { tags, collection } = JSON.parse(plan);

  // Apply with capability checks
  if (tags?.length && bridge.capabilities.hasIntent('add-tags')) {
    await bridge.act({ intent: 'add-tags', items: ctx.items, tags });
  }

  if (collection && bridge.capabilities.hasIntent('move-to')) {
    await bridge.act({ intent: 'move-to', items: ctx.items, destination: collection });
  }

  await bridge.ui.notify(`Organized ${ctx.items.length} items`, 'success');
});

bridge.action('summarize', async () => {
  const ctx = await bridge.perceive({ scope: 'selection', understand: true });

  if (ctx.items.length === 0) {
    await bridge.ui.notify('Select items first', 'warning');
    return;
  }

  const summary = await bridge.inference({
    prompt: `Summarize: ${ctx.understanding || JSON.stringify(ctx.items)}`,
    stream: bridge.capabilities.hasFeature('inference', 'streaming'),
    onToken: (token) => bridge.activity.log(token)
  });

  await bridge.ui.panel({
    title: 'Summary',
    content: `<div style="padding:1rem;white-space:pre-wrap">${summary}</div>`
  });
});

bridge.action('find-related', async () => {
  const ctx = await bridge.perceive({ scope: 'selection' });

  if (!bridge.capabilities.hasIntent('search')) {
    await bridge.ui.notify('Search not available in this host', 'warning');
    return;
  }

  const keywords = await bridge.inference({
    prompt: `Extract 3 search keywords from: ${JSON.stringify(ctx.items[0])}`
  });

  const results = await bridge.act({
    intent: 'search',
    query: keywords
  });

  await bridge.ui.panel({
    title: `Related Items (${results.result?.length || 0})`,
    content: `<ul>${results.result?.map(i => `<li>${i.title}</li>`).join('') || 'None found'}</ul>`
  });
});
</script>

</body>
</html>
```

---

## 8. Error Codes

| Code | Name | Description |
|------|------|-------------|
| E807 | CAPABILITY_LEVEL_INSUFFICIENT | Host level < agent requires |
| E808 | CAPABILITY_FEATURE_MISSING | Required feature not available |
| E809 | CAPABILITY_NEGOTIATION_FAILED | No compatible configuration found |
| E810 | MCP_EXPOSE_FAILED | Failed to register MCP tool |

---

## 9. Migration from v0.1.0

### What Changes

| v0.1.0 | v0.2.0 |
|--------|--------|
| `bridge.capabilities` (string[]) | `bridge.capabilities.data` (string[]) |
| `bridge.hasCapability(x)` | `bridge.hasCapability(x)` (unchanged) |
| `bridge.supports(x)` | `bridge.capabilities.hasFeature(primitive, feature)` |
| — | `bridge.capabilities.getLevel(primitive)` |
| — | `bridge.capabilities.meetsLevel(primitive, level)` |
| — | `bridge.mcp.expose(toolDefinition)` |

### Backward Compatibility

```javascript
// v0.1.0 code still works
if (bridge.hasCapability('tags')) { ... }

// v0.2.0 code uses enhanced API
if (bridge.capabilities.meetsLevel('perceive', 'standard')) { ... }
```

---

## 10. Summary

### Agentlet's Unique Value (Not MCP)

| Agentlet Innovation | Description |
|---------------------|-------------|
| **Perceive/Act** | Semantic, AI-interpreted context (not explicit tool calls) |
| **Portability** | Single HTML file runs anywhere |
| **Capability Levels** | basic/standard/advanced for broad compatibility |
| **Graceful Degradation** | Agents adapt when features missing |
| **Registry Discovery** | Compatibility scoring and filtering |

### What Uses MCP (Don't Reinvent)

| MCP Usage | Description |
|-----------|-------------|
| **Tool Exposure** | Agents expose tools via `bridge.mcp.expose()` |
| **Tool Schema** | JSON Schema for inputs/outputs |
| **Tool Invocation** | Standard MCP protocol |

### The Key Insight

```
MCP answers:      "Here's a function you can call"
Perceive/Act:     "I don't know your data model — let me understand it"

Agentlet = Portable agents that speak MCP + semantic perceive/act
```

---

## 11. Open Questions

| Question | Status | Notes |
|----------|--------|-------|
| Feature registry | Open | Who defines valid features for each level? |
| Level evolution | Open | How do levels change across spec versions? |
| MCP transport | Open | How does host expose agent's MCP server? |
| Intent vs MCP tool | Resolved | Intents for routing, MCP for explicit calls |

---

## 12. Implementation Roadmap

### Spec v0.2 (Foundation)

- [ ] Define level semantics for perceive, act, inference
- [ ] Implement `bridge.capabilities.getLevel()`, `meetsLevel()`, `hasFeature()`
- [ ] Add `degraded` field to perceive/act responses
- [ ] Implement `bridge.mcp.expose()` for tool registration
- [ ] New manifest tags: `requires`, `enhances-with`, `mcp-server`, `mcp-tool`, `provides`, `domain`
- [ ] Update SDK with new capability types

### Spec v0.3 (Integration)

- [ ] Registry compatibility scoring
- [ ] Host capability advertisement format
- [ ] MCP server exposure mechanism

### Spec v0.4 (Communication)

- [ ] Intent routing via provides
- [ ] Agent discovery by capabilities

---

*This document defines capability negotiation for Agentlet v0.2.0. It will evolve based on implementation experience and community feedback.*
