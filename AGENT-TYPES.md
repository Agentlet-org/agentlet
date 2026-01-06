# Agentlet Agent Types

**Understanding the Portability Spectrum**

> Not all agents need to work everywhere. Agentlet supports a spectrum from host-specific specialists to fully adaptive agents that work anywhere.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        PORTABILITY SPECTRUM                                 │
│                                                                             │
│   Host-Specific      Host-Family         Universal          Adaptive        │
│        │                  │                  │                  │           │
│        ▼                  ▼                  ▼                  ▼           │
│   ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐     │
│   │  Full   │        │ Shared  │        │ Zero    │        │   AI    │     │
│   │  Host   │        │  Logic  │        │ Context │        │ Bridges │     │
│   │  Power  │        │   +     │        │  Needs  │        │   Gap   │     │
│   │         │        │ Adapts  │        │         │        │         │     │
│   └─────────┘        └─────────┘        └─────────┘        └─────────┘     │
│                                                                             │
│   Uses full            Works across       Uses only          AI interprets  │
│   host API             similar apps       universal APIs     any host       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

| Type | Portability | Power | Complexity | Best For |
|------|-------------|-------|------------|----------|
| **Host-Specific** | Single host | Maximum | Low | Deep integrations |
| **Host-Family** | Similar apps | High | Medium | Category solutions |
| **Universal** | Anywhere | Medium | Low | Utility tools |
| **Adaptive** | Anywhere | High | High | Smart assistants |

---

## Type 1: Host-Specific

**"Maximum power, single platform"**

Host-specific agents use the full capabilities of one host application. They access host-specific APIs, data models, and features directly.

### When to Use

- Deep integration with one app's data model
- Using features unique to that app
- Performance-critical operations
- Complex workflows specific to one domain

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Portability** | None — works only on declared host |
| **API Access** | Full `bridge.context.*` with host-specific types |
| **Data Model** | Uses host's native schema directly |
| **Capabilities** | All host features available |
| **Maintenance** | Must update when host API changes |

### Manifest

```html
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="zotero-citation-validator">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="host-specific">
<meta name="agentlet:host" content="zotero:>=7.0.0">

<!-- Host-specific capabilities -->
<meta name="agentlet:capability" content="context:bibliographic:read">
<meta name="agentlet:capability" content="context:bibliographic:write">
<meta name="agentlet:capability" content="context:collection:read">
<meta name="agentlet:capability" content="network:api.crossref.org">
<meta name="agentlet:capability" content="inference:basic">
```

### Example: Zotero Citation Validator

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Citation Validator</title>
  
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="citation-validator">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="Validates citations against CrossRef and fixes metadata">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  
  <meta name="agentlet:portability" content="host-specific">
  <meta name="agentlet:host" content="zotero:>=7.0.0">
  
  <meta name="agentlet:capability" content="context:bibliographic:read">
  <meta name="agentlet:capability" content="context:bibliographic:write">
  <meta name="agentlet:capability" content="network:api.crossref.org">
  <meta name="agentlet:capability" content="inference:basic">
  <meta name="agentlet:capability" content="ui:panel">
  <meta name="agentlet:capability" content="ui:notify">
  
  <meta name="agentlet:action" content="validate-selected" data-label="Validate Selected">
  <meta name="agentlet:action" content="validate-all" data-label="Validate Library" data-confirm="true">
</head>
<body>

<script type="module">
const { bridge } = window;

bridge.action('validate-selected', async () => {
  const items = await bridge.context.selection.get();
  await validateItems(items);
});

bridge.action('validate-all', async () => {
  // Uses Zotero-specific query
  const items = await bridge.context.query('bibliographic', {
    itemType: 'journalArticle',
    where: { DOI: { exists: true } }
  });
  await validateItems(items);
});

async function validateItems(items) {
  if (items.length === 0) {
    await bridge.ui.notify('No items with DOIs found', 'warning');
    return;
  }
  
  await bridge.activity.start(`Validating ${items.length} items`);
  
  const issues = [];
  
  for (let i = 0; i < items.length; i++) {
    bridge.throwIfCancelled();
    await bridge.activity.progress(i + 1, items.length, items[i].title);
    
    if (!items[i].DOI) continue;
    
    try {
      // Fetch from CrossRef
      const response = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(items[i].DOI)}`
      );
      
      if (!response.ok) {
        issues.push({ item: items[i], issue: 'DOI not found in CrossRef' });
        continue;
      }
      
      const data = await response.json();
      const crossref = data.message;
      
      // Use AI to compare and find discrepancies
      const analysis = await bridge.inference({
        messages: [
          {
            role: 'system',
            content: `Compare Zotero metadata with CrossRef and list discrepancies.
                      Focus on: title, authors, journal, year, volume, issue, pages.
                      Return JSON: { hasIssues: boolean, discrepancies: string[], suggestedFixes: object }`
          },
          {
            role: 'user',
            content: `Zotero: ${JSON.stringify(items[i])}
                      CrossRef: ${JSON.stringify(crossref)}`
          }
        ]
      });
      
      const result = JSON.parse(analysis);
      
      if (result.hasIssues) {
        issues.push({
          item: items[i],
          discrepancies: result.discrepancies,
          fixes: result.suggestedFixes
        });
        
        // Auto-fix if we have suggestions
        if (result.suggestedFixes && Object.keys(result.suggestedFixes).length > 0) {
          await bridge.context.update('bibliographic', items[i].id, result.suggestedFixes);
        }
      }
    } catch (error) {
      issues.push({ item: items[i], issue: error.message });
    }
  }
  
  await bridge.activity.complete(`Validated ${items.length} items`);
  
  // Show results
  const content = issues.length === 0 
    ? '<p style="color: green;">All items validated successfully!</p>'
    : issues.map(i => `
        <div style="margin-bottom: 1rem; padding: 0.5rem; background: #fef3c7; border-radius: 4px;">
          <strong>${i.item.title}</strong>
          <p>${i.issue || i.discrepancies?.join(', ')}</p>
        </div>
      `).join('');
  
  await bridge.ui.panel({
    title: `Validation Results (${issues.length} issues)`,
    content: `<div style="padding: 1rem;">${content}</div>`
  });
}
</script>

</body>
</html>
```

### More Host-Specific Examples

| Agent | Host | Why Host-Specific |
|-------|------|-------------------|
| Citation validator | Zotero | Needs bibliographic schema, DOI fields |
| Git conflict resolver | VS Code | Needs SCM API, diff views, editor |
| Spaced repetition tuner | Anki | Needs scheduling algorithm, deck structure |
| Email classifier | Gmail | Needs labels, threads, sender data |
| Snippet manager | Raycast | Needs clipboard, hotkeys, search |

---

## Type 2: Host-Family

**"Same solution, similar apps"**

Host-family agents work across applications that share a common purpose. The core logic is shared, with small adaptations for each host's specific API.

### When to Use

- Similar apps with different APIs
- Core logic is the same across apps
- Want to serve a category of users
- Building a "best in class" tool for a category

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Portability** | Works across declared similar hosts |
| **API Access** | `bridge.context.*` with host detection |
| **Data Model** | Similar concepts, different schemas |
| **Capabilities** | Shared features across family |
| **Maintenance** | Update adapters when hosts change |

### Manifest

```html
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="note-linker">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="host-family">
<meta name="agentlet:host" content="obsidian:>=1.0.0">
<meta name="agentlet:host" content="logseq:>=0.9.0">
<meta name="agentlet:host" content="notion:>=2.0.0">

<!-- Shared capabilities across note apps -->
<meta name="agentlet:capability" content="context:note:read">
<meta name="agentlet:capability" content="context:note:write">
<meta name="agentlet:capability" content="inference:basic">
```

### Example: Note Linker for PKM Apps

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Note Linker</title>
  
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="note-linker">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="Finds conceptual connections and suggests links between notes">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  
  <meta name="agentlet:portability" content="host-family">
  <meta name="agentlet:host" content="obsidian:>=1.0.0">
  <meta name="agentlet:host" content="logseq:>=0.9.0">
  <meta name="agentlet:host" content="notion:>=2.0.0">
  
  <meta name="agentlet:capability" content="context:note:read">
  <meta name="agentlet:capability" content="context:note:write">
  <meta name="agentlet:capability" content="inference:basic">
  <meta name="agentlet:capability" content="ui:panel">
  <meta name="agentlet:capability" content="ui:confirm">
  
  <meta name="agentlet:action" content="find-links" data-label="Find Connections">
  <meta name="agentlet:action" content="auto-link" data-label="Auto-Link Selected" data-confirm="true">
</head>
<body>

<script type="module">
const { bridge } = window;

// ═══════════════════════════════════════════════════════════════════
// HOST ADAPTERS
// Small adaptations for each host's API
// ═══════════════════════════════════════════════════════════════════

const adapters = {
  obsidian: {
    async getNotes(scope) {
      if (scope === 'selection') {
        return await bridge.context.selection.get();
      }
      return await bridge.context.query('note', {});
    },
    async createLink(fromId, toId, toTitle) {
      const note = await bridge.context.get('note', fromId);
      const linkSyntax = `[[${toTitle}]]`;
      await bridge.context.update('note', fromId, {
        content: note.content + `\n\nRelated: ${linkSyntax}`
      });
    },
    getContent(note) {
      return note.content;
    },
    getTitle(note) {
      return note.basename || note.title;
    }
  },
  
  logseq: {
    async getNotes(scope) {
      if (scope === 'selection') {
        return await bridge.context.selection.get();
      }
      return await bridge.context.query('page', {});
    },
    async createLink(fromId, toId, toTitle) {
      const page = await bridge.context.get('page', fromId);
      const linkSyntax = `[[${toTitle}]]`;
      await bridge.context.update('page', fromId, {
        content: page.content + `\n- Related: ${linkSyntax}`
      });
    },
    getContent(page) {
      return page.content || page.blocks?.map(b => b.content).join('\n');
    },
    getTitle(page) {
      return page.name || page.title;
    }
  },
  
  notion: {
    async getNotes(scope) {
      if (scope === 'selection') {
        return await bridge.context.selection.get();
      }
      return await bridge.context.query('page', { database: 'Notes' });
    },
    async createLink(fromId, toId, toTitle) {
      // Notion uses page mentions
      await bridge.context.update('page', fromId, {
        appendBlock: {
          type: 'paragraph',
          content: `Related: @[${toTitle}](${toId})`
        }
      });
    },
    getContent(page) {
      return page.plainText || page.title;
    },
    getTitle(page) {
      return page.title;
    }
  }
};

// Get adapter for current host
function getAdapter() {
  const host = bridge.host.name;
  const adapter = adapters[host];
  if (!adapter) {
    throw new Error(`Unsupported host: ${host}. This agent works with: ${Object.keys(adapters).join(', ')}`);
  }
  return adapter;
}

// ═══════════════════════════════════════════════════════════════════
// SHARED LOGIC
// Core functionality is identical across hosts
// ═══════════════════════════════════════════════════════════════════

async function findConnections(notes, adapter) {
  // Build summaries for comparison
  const summaries = notes.map(note => ({
    id: note.id,
    title: adapter.getTitle(note),
    content: adapter.getContent(note)?.slice(0, 1000) // First 1000 chars
  }));
  
  // Use AI to find conceptual connections
  const analysis = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `Analyze these notes and find conceptual connections.
                  Return JSON array: [{ from: title, to: title, reason: string, strength: "strong"|"medium"|"weak" }]
                  Only suggest meaningful connections, not superficial keyword matches.`
      },
      {
        role: 'user',
        content: JSON.stringify(summaries)
      }
    ]
  });
  
  return JSON.parse(analysis);
}

// ═══════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════

bridge.action('find-links', async () => {
  const adapter = getAdapter();
  const notes = await adapter.getNotes('all');
  
  if (notes.length < 2) {
    await bridge.ui.notify('Need at least 2 notes to find connections', 'warning');
    return;
  }
  
  await bridge.activity.start('Analyzing notes for connections...');
  
  const connections = await findConnections(notes, adapter);
  
  await bridge.activity.complete(`Found ${connections.length} potential connections`);
  
  // Display results
  const content = connections.length === 0
    ? '<p>No strong connections found.</p>'
    : connections.map(c => `
        <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f0fdf4; border-radius: 6px; border-left: 3px solid #22c55e;">
          <div style="font-weight: bold;">${c.from} ↔ ${c.to}</div>
          <div style="color: #666; font-size: 0.9rem;">${c.reason}</div>
          <div style="margin-top: 0.15rem;">
            <span style="font-size: 0.75rem; padding: 0.125rem 0.5rem; background: ${
              c.strength === 'strong' ? '#dcfce7' : c.strength === 'medium' ? '#fef9c3' : '#f3f4f6'
            }; border-radius: 999px;">${c.strength}</span>
          </div>
        </div>
      `).join('');
  
  await bridge.ui.panel({
    title: `Connections (${connections.length})`,
    content: `<div style="padding: 1rem; font-family: system-ui;">${content}</div>`,
    width: 400
  });
});

bridge.action('auto-link', async () => {
  const adapter = getAdapter();
  const selected = await adapter.getNotes('selection');
  
  if (selected.length === 0) {
    await bridge.ui.notify('Select notes first', 'warning');
    return;
  }
  
  const allNotes = await adapter.getNotes('all');
  
  await bridge.activity.start('Finding and creating links...');
  
  const connections = await findConnections(allNotes, adapter);
  
  // Filter to connections involving selected notes
  const selectedTitles = selected.map(n => adapter.getTitle(n));
  const relevantConnections = connections.filter(c => 
    selectedTitles.includes(c.from) || selectedTitles.includes(c.to)
  );
  
  // Create links
  let created = 0;
  for (const conn of relevantConnections) {
    if (conn.strength === 'weak') continue; // Skip weak connections
    
    const fromNote = allNotes.find(n => adapter.getTitle(n) === conn.from);
    const toNote = allNotes.find(n => adapter.getTitle(n) === conn.to);
    
    if (fromNote && toNote) {
      await adapter.createLink(fromNote.id, toNote.id, conn.to);
      created++;
    }
  }
  
  await bridge.activity.complete(`Created ${created} links`);
  await bridge.ui.notify(`Created ${created} links`, 'success');
});
</script>

</body>
</html>
```

### More Host-Family Examples

| Agent | Host Family | Shared Logic |
|-------|-------------|--------------|
| Note linker | Obsidian, Logseq, Notion | Find connections, create links |
| Code documenter | VS Code, JetBrains, Vim | Analyze code, generate docs |
| Task prioritizer | Todoist, Things, OmniFocus | Analyze tasks, suggest order |
| Bookmark organizer | Chrome, Firefox, Safari | Categorize, find duplicates |
| Calendar optimizer | Google Cal, Outlook, Apple Cal | Find conflicts, suggest times |

---

## Type 3: Universal

**"Works anywhere, no context needed"**

Universal agents use only the APIs guaranteed to exist everywhere. They don't access host-specific data — their value comes purely from AI capabilities and user interaction.

### When to Use

- Agent's value is in the AI, not host data
- Works with user-provided input
- Utility tools that stand alone
- Maximum distribution is the goal

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Portability** | Works in any host |
| **API Access** | Only universal APIs (inference, storage, ui) |
| **Data Model** | None — user provides input |
| **Capabilities** | AI, storage, UI only |
| **Maintenance** | Minimal — no host dependencies |

### Manifest

```html
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="writing-assistant">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="universal">

<!-- No host declaration - works everywhere -->
<!-- Only universal capabilities -->
<meta name="agentlet:capability" content="inference:basic">
<meta name="agentlet:capability" content="storage">
<meta name="agentlet:capability" content="ui:panel">
<meta name="agentlet:capability" content="ui:prompt">
```

### Example: Writing Assistant

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Writing Assistant</title>
  
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="writing-assistant">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="Improve your writing with AI-powered suggestions">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  
  <meta name="agentlet:portability" content="universal">
  
  <meta name="agentlet:capability" content="inference:basic">
  <meta name="agentlet:capability" content="storage">
  <meta name="agentlet:capability" content="ui:panel">
  <meta name="agentlet:capability" content="ui:prompt">
  <meta name="agentlet:capability" content="ui:form">
  <meta name="agentlet:capability" content="ui:notify">
  
  <meta name="agentlet:action" content="improve" data-label="Improve Text">
  <meta name="agentlet:action" content="summarize" data-label="Summarize">
  <meta name="agentlet:action" content="expand" data-label="Expand">
  <meta name="agentlet:action" content="translate" data-label="Translate">
  <meta name="agentlet:action" content="history" data-label="View History">
  
  <meta name="agentlet:preference" content="tone"
        data-type="select"
        data-label="Default tone"
        data-default="professional">
  <meta name="agentlet:preference:option" content="tone:professional" data-label="Professional">
  <meta name="agentlet:preference:option" content="tone:casual" data-label="Casual">
  <meta name="agentlet:preference:option" content="tone:academic" data-label="Academic">
  <meta name="agentlet:preference:option" content="tone:creative" data-label="Creative">
</head>
<body>

<script type="module">
const { bridge } = window;

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

async function getTextInput(prompt) {
  return await bridge.ui.prompt(prompt);
}

async function saveToHistory(type, input, output) {
  const history = await bridge.storage.get('history') || [];
  history.unshift({
    type,
    input: input.slice(0, 200),
    output: output.slice(0, 500),
    date: new Date().toISOString()
  });
  await bridge.storage.set('history', history.slice(0, 50)); // Keep last 50
}

async function showResult(title, content, original) {
  await bridge.ui.panel({
    title,
    content: `
      <div style="padding: 1rem; font-family: system-ui;">
        <div style="margin-bottom: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #666;">Result</h4>
          <div style="padding: 1rem; background: #f0fdf4; border-radius: 6px; white-space: pre-wrap;">${content}</div>
        </div>
        ${original ? `
          <details>
            <summary style="cursor: pointer; color: #666;">Original</summary>
            <div style="padding: 1rem; background: #f3f4f6; border-radius: 6px; margin-top: 0.5rem; white-space: pre-wrap;">${original}</div>
          </details>
        ` : ''}
      </div>
    `,
    width: 500
  });
}

// ═══════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════

bridge.action('improve', async () => {
  const text = await getTextInput('Paste text to improve:');
  if (!text) return;
  
  const prefs = await bridge.preferences.get();
  
  const improved = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `You are a writing assistant. Improve the given text for clarity, grammar, and flow.
                  Maintain a ${prefs.tone || 'professional'} tone.
                  Return only the improved text, no explanations.`
      },
      { role: 'user', content: text }
    ]
  });
  
  await saveToHistory('improve', text, improved);
  await showResult('Improved Text', improved, text);
});

bridge.action('summarize', async () => {
  const text = await getTextInput('Paste text to summarize:');
  if (!text) return;
  
  const summary = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: 'Summarize the following text concisely. Capture key points in 2-3 sentences.'
      },
      { role: 'user', content: text }
    ]
  });
  
  await saveToHistory('summarize', text, summary);
  await showResult('Summary', summary, text);
});

bridge.action('expand', async () => {
  const text = await getTextInput('Paste text to expand:');
  if (!text) return;
  
  const prefs = await bridge.preferences.get();
  
  const expanded = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `Expand the following text with more detail, examples, and explanation.
                  Maintain a ${prefs.tone || 'professional'} tone.
                  Roughly double the length while keeping it focused.`
      },
      { role: 'user', content: text }
    ]
  });
  
  await saveToHistory('expand', text, expanded);
  await showResult('Expanded Text', expanded, text);
});

bridge.action('translate', async () => {
  const options = await bridge.ui.form({
    title: 'Translate Text',
    fields: [
      {
        id: 'text',
        type: 'textarea',
        label: 'Text to translate',
        required: true
      },
      {
        id: 'language',
        type: 'select',
        label: 'Target language',
        options: [
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' },
          { value: 'pt', label: 'Portuguese' },
          { value: 'it', label: 'Italian' },
          { value: 'zh', label: 'Chinese' },
          { value: 'ja', label: 'Japanese' },
          { value: 'ko', label: 'Korean' }
        ]
      }
    ]
  });
  
  if (!options) return;
  
  const translated = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `Translate the following text to ${options.language}. Return only the translation.`
      },
      { role: 'user', content: options.text }
    ]
  });
  
  await saveToHistory('translate', options.text, translated);
  await showResult(`Translation (${options.language})`, translated, options.text);
});

bridge.action('history', async () => {
  const history = await bridge.storage.get('history') || [];
  
  if (history.length === 0) {
    await bridge.ui.notify('No history yet', 'info');
    return;
  }
  
  const content = history.map(h => `
    <div style="margin-bottom: 1rem; padding: 0.75rem; background: #f9fafb; border-radius: 6px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
        <span style="font-weight: bold; text-transform: capitalize;">${h.type}</span>
        <span style="color: #666; font-size: 0.8rem;">${new Date(h.date).toLocaleDateString()}</span>
      </div>
      <div style="font-size: 0.9rem; color: #666;">${h.input}...</div>
    </div>
  `).join('');
  
  await bridge.ui.panel({
    title: `History (${history.length})`,
    content: `<div style="padding: 1rem; font-family: system-ui;">${content}</div>`,
    width: 400
  });
});
</script>

</body>
</html>
```

### More Universal Examples

| Agent | What It Does |
|-------|--------------|
| Writing assistant | Improve, summarize, expand text |
| Code explainer | Explain code snippets |
| Language tutor | Practice conversations |
| Brainstorm partner | Generate ideas |
| Decision helper | Analyze pros/cons |
| Meeting summarizer | Summarize transcripts |
| Regex builder | Generate regex from description |
| JSON formatter | Format and validate JSON |

---

## Type 4: Adaptive

**"AI figures it out"**

Adaptive agents use `bridge.perceive()` and `bridge.act()` to understand and interact with any host. The AI interprets the host's data structure and adapts behavior accordingly.

### When to Use

- Want maximum reach across all hosts
- Core task is generalizable
- AI can interpret different data structures
- Graceful degradation is acceptable

### Characteristics

| Aspect | Description |
|--------|-------------|
| **Portability** | Works in any host that supports perceive/act |
| **API Access** | `bridge.perceive()`, `bridge.act()`, universal APIs |
| **Data Model** | AI interprets whatever it finds |
| **Capabilities** | Declared as required/optional |
| **Maintenance** | Low — AI handles variations |

### Manifest

```html
<meta name="agentlet" content="0.1">
<meta name="agentlet:name" content="smart-organizer">
<meta name="agentlet:version" content="1.0.0">
<meta name="agentlet:portability" content="adaptive">

<!-- Required: must have these -->
<meta name="agentlet:requires" content="inference:basic">
<meta name="agentlet:requires" content="ui:panel">
<meta name="agentlet:requires" content="perceive">
<meta name="agentlet:requires" content="act">

<!-- Optional: uses if available -->
<meta name="agentlet:optional" content="tags">
<meta name="agentlet:optional" content="collections">
<meta name="agentlet:optional" content="search">

<!-- Intents this agent uses -->
<meta name="agentlet:intent" content="add-tags">
<meta name="agentlet:intent" content="move-to">
```

### Example: Smart Research Organizer

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Smart Organizer</title>
  
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="smart-organizer">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="Intelligently organizes your content using AI">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  
  <meta name="agentlet:portability" content="adaptive">
  
  <!-- Required capabilities -->
  <meta name="agentlet:requires" content="inference:basic">
  <meta name="agentlet:requires" content="ui:panel">
  <meta name="agentlet:requires" content="ui:notify">
  <meta name="agentlet:requires" content="perceive">
  <meta name="agentlet:requires" content="act">
  
  <!-- Optional capabilities -->
  <meta name="agentlet:optional" content="tags">
  <meta name="agentlet:optional" content="collections">
  <meta name="agentlet:optional" content="search">
  <meta name="agentlet:optional" content="content">
  
  <!-- Intents we'll use -->
  <meta name="agentlet:intent" content="add-tags">
  <meta name="agentlet:intent" content="move-to">
  <meta name="agentlet:intent" content="search">
  
  <meta name="agentlet:action" content="organize" data-label="Organize Selection">
  <meta name="agentlet:action" content="analyze" data-label="Analyze Selection">
  <meta name="agentlet:action" content="find-related" data-label="Find Related">
</head>
<body>

<script type="module">
const { bridge } = window;

// ═══════════════════════════════════════════════════════════════════
// PERCEIVE + ACT PATTERN
// The core pattern for adaptive agents
// ═══════════════════════════════════════════════════════════════════

bridge.action('organize', async () => {
  // ─────────────────────────────────────────────────────────────────
  // STEP 1: PERCEIVE
  // Understand what we're working with
  // ─────────────────────────────────────────────────────────────────
  
  const context = await bridge.perceive({
    scope: 'selection',
    understand: true  // AI interprets the data
  });
  
  if (context.items.length === 0) {
    await bridge.ui.notify('Select some items first', 'warning');
    return;
  }
  
  await bridge.activity.start(`Organizing ${context.items.length} items in ${context.host}`);
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 2: REASON
  // Use AI to figure out how to organize
  // ─────────────────────────────────────────────────────────────────
  
  const plan = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `You are organizing items in ${context.host}.
        
Available capabilities: ${context.capabilities.join(', ')}
Items appear to be: ${context.understanding}
Item schema: ${JSON.stringify(context.schema, null, 2)}

Based on what's available, suggest organization:
- If tags available: suggest relevant tags
- If collections/folders available: suggest groupings
- Always: provide an analysis summary

Return JSON:
{
  "analysis": "brief analysis of the content",
  "suggestedTags": ["tag1", "tag2"] or null if tags not available,
  "suggestedCollection": "collection name" or null,
  "groupings": [{ "name": "group", "itemIds": ["id1", "id2"] }] or null
}`
      },
      {
        role: 'user',
        content: `Organize these ${context.items.length} items:\n${JSON.stringify(context.items, null, 2)}`
      }
    ]
  });
  
  let planData;
  try {
    planData = JSON.parse(plan);
  } catch {
    await bridge.ui.notify('Failed to create organization plan', 'error');
    return;
  }
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 3: ACT
  // Apply the plan using available capabilities
  // ─────────────────────────────────────────────────────────────────
  
  const results = {
    tagsAdded: false,
    movedTo: null,
    errors: []
  };
  
  // Try to add tags if available and suggested
  if (context.capabilities.includes('tags') && planData.suggestedTags?.length > 0) {
    try {
      await bridge.act({
        intent: 'add-tags',
        items: context.items,
        tags: planData.suggestedTags
      });
      results.tagsAdded = true;
    } catch (e) {
      if (e.code !== 'INTENT_NOT_SUPPORTED') {
        results.errors.push(`Tags: ${e.message}`);
      }
    }
  }
  
  // Try to move to collection if available and suggested
  if (context.capabilities.includes('collections') && planData.suggestedCollection) {
    try {
      await bridge.act({
        intent: 'move-to',
        items: context.items,
        destination: planData.suggestedCollection
      });
      results.movedTo = planData.suggestedCollection;
    } catch (e) {
      if (e.code !== 'INTENT_NOT_SUPPORTED') {
        results.errors.push(`Move: ${e.message}`);
      }
    }
  }
  
  await bridge.activity.complete('Organization complete');
  
  // ─────────────────────────────────────────────────────────────────
  // STEP 4: REPORT
  // Show what was done
  // ─────────────────────────────────────────────────────────────────
  
  await bridge.ui.panel({
    title: 'Organization Complete',
    content: `
      <div style="padding: 1rem; font-family: system-ui;">
        <h3 style="margin-top: 0;">Analysis</h3>
        <p>${planData.analysis}</p>
        
        <h3>Actions Taken</h3>
        <ul>
          ${results.tagsAdded ? `<li>Added tags: ${planData.suggestedTags.join(', ')}</li>` : ''}
          ${results.movedTo ? `<li>Moved to: ${results.movedTo}</li>` : ''}
          ${!results.tagsAdded && !results.movedTo ? '<li>No actions available in this host</li>' : ''}
        </ul>
        
        ${results.errors.length > 0 ? `
          <h3 style="color: #dc2626;">Errors</h3>
          <ul>${results.errors.map(e => `<li>${e}</li>`).join('')}</ul>
        ` : ''}
        
        <h3>Host Info</h3>
        <p style="color: #666; font-size: 0.9rem;">
          Running in ${context.host} with capabilities: ${context.capabilities.join(', ')}
        </p>
      </div>
    `,
    width: 450
  });
});

bridge.action('analyze', async () => {
  const context = await bridge.perceive({
    scope: 'selection',
    understand: true
  });
  
  if (context.items.length === 0) {
    await bridge.ui.notify('Select some items first', 'warning');
    return;
  }
  
  // Deep analysis using AI
  const analysis = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: `Analyze the selected items thoroughly. Provide:
1. Content summary
2. Key themes
3. Relationships between items
4. Suggestions for further exploration

Be specific and insightful.`
      },
      {
        role: 'user',
        content: `Host: ${context.host}
Understanding: ${context.understanding}
Items: ${JSON.stringify(context.items, null, 2)}`
      }
    ]
  });
  
  await bridge.ui.panel({
    title: `Analysis (${context.items.length} items)`,
    content: `
      <div style="padding: 1rem; font-family: system-ui; white-space: pre-wrap;">
        ${analysis}
      </div>
    `,
    width: 500
  });
});

bridge.action('find-related', async () => {
  const context = await bridge.perceive({
    scope: 'selection',
    understand: true
  });
  
  if (context.items.length === 0) {
    await bridge.ui.notify('Select an item first', 'warning');
    return;
  }
  
  if (!context.capabilities.includes('search')) {
    await bridge.ui.notify('This host does not support search', 'warning');
    return;
  }
  
  // Generate search queries based on selection
  const queries = await bridge.inference({
    messages: [
      {
        role: 'system',
        content: 'Generate 3 search queries to find items related to the selected content. Return JSON array of strings.'
      },
      {
        role: 'user',
        content: `Find items related to: ${context.understanding}\n\nItems: ${JSON.stringify(context.items)}`
      }
    ]
  });
  
  let searchQueries;
  try {
    searchQueries = JSON.parse(queries);
  } catch {
    searchQueries = [context.understanding];
  }
  
  // Search for related items
  const allResults = [];
  for (const query of searchQueries) {
    try {
      const result = await bridge.act({
        intent: 'search',
        query
      });
      if (result.result) {
        allResults.push(...result.result);
      }
    } catch {
      // Search failed, continue
    }
  }
  
  // Deduplicate by ID
  const selectedIds = context.items.map(i => i.id);
  const uniqueResults = allResults
    .filter((item, index, self) => 
      self.findIndex(i => i.id === item.id) === index &&
      !selectedIds.includes(item.id)
    )
    .slice(0, 10);
  
  if (uniqueResults.length === 0) {
    await bridge.ui.notify('No related items found', 'info');
    return;
  }
  
  await bridge.ui.panel({
    title: `Related Items (${uniqueResults.length})`,
    content: `
      <div style="padding: 1rem; font-family: system-ui;">
        ${uniqueResults.map(item => `
          <div style="padding: 0.75rem; margin-bottom: 0.5rem; background: #f9fafb; border-radius: 6px;">
            <div style="font-weight: bold;">${item.title || item.name || item.id}</div>
          </div>
        `).join('')}
      </div>
    `,
    width: 400
  });
});
</script>

</body>
</html>
```

### More Adaptive Examples

| Agent | How It Adapts |
|-------|---------------|
| Research organizer | Tags/folders based on what host supports |
| Content analyzer | Interprets any document type |
| Duplicate finder | Compares items regardless of schema |
| Auto-tagger | Suggests tags for any content |
| Summary generator | Works with any text content |
| Link suggester | Finds connections in any host |

---

## Comparison Table

| Aspect | Host-Specific | Host-Family | Universal | Adaptive |
|--------|---------------|-------------|-----------|----------|
| **Portability** | Single host | Similar hosts | Anywhere | Anywhere |
| **Power** | Maximum | High | Medium | High |
| **Complexity** | Low | Medium | Low | High |
| **AI Dependence** | Optional | Optional | Required | Required |
| **Maintenance** | Per host | Per family | Minimal | Minimal |
| **Best For** | Deep integrations | Category tools | Utilities | Smart assistants |

---

## Choosing the Right Type

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WHICH TYPE SHOULD I USE?                            │
└─────────────────────────────────────────────────────────────────────────┘

                              START
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Does your agent need  │
                    │ to access host data?  │
                    └───────────┬───────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                   YES                      NO
                    │                       │
                    ▼                       ▼
        ┌───────────────────┐      ┌───────────────────┐
        │ Do you need full  │      │    UNIVERSAL      │
        │ power of one host?│      │                   │
        └─────────┬─────────┘      │ Works everywhere  │
                  │                │ Uses inference,   │
          ┌───────┴───────┐        │ storage, UI only  │
          │               │        └───────────────────┘
         YES              NO
          │               │
          ▼               ▼
   ┌─────────────┐  ┌────────────────┐
   │HOST-SPECIFIC│  │ Is the logic   │
   │             │  │ similar across │
   │ Maximum     │  │ multiple hosts?│
   │ power for   │  └───────┬────────┘
   │ one host    │          │
   └─────────────┘  ┌───────┴───────┐
                    │               │
                   YES              NO
                    │               │
                    ▼               ▼
           ┌─────────────┐  ┌─────────────┐
           │ HOST-FAMILY │  │  ADAPTIVE   │
           │             │  │             │
           │ Share logic │  │ AI figures  │
           │ adapt APIs  │  │ out any host│
           └─────────────┘  └─────────────┘
```

---

## Migration Between Types

Agents can evolve over time:

### Host-Specific → Host-Family

When you want to support more hosts:

```javascript
// Before: Host-specific
const items = await bridge.context.query('bibliographic', {...});

// After: Host-family with adapter
const items = await getAdapter().query({...});
```

### Host-Family → Adaptive

When you want to work everywhere:

```javascript
// Before: Host-family with explicit adapters
const adapter = adapters[bridge.host.name];
const items = await adapter.getNotes();

// After: Adaptive with perceive/act
const context = await bridge.perceive({ scope: 'selection' });
// AI figures out the rest
```

### Universal → Adaptive

When you want to use host data too:

```javascript
// Before: Universal (text input only)
const text = await bridge.ui.prompt('Paste text:');
const summary = await bridge.inference({...});

// After: Adaptive (can use selection OR text input)
const context = await bridge.perceive({ scope: 'selection' });
const text = context.items.length > 0 
  ? context.items.map(i => i.content).join('\n')
  : await bridge.ui.prompt('Paste text:');
```

---

## See Also

- [SPEC.md](./SPEC.md) — Full specification
- [README.md](./README.md) — Project overview
- [ROADMAP.md](./ROADMAP.md) — Version roadmap
