# Agent Design Guide

**Best Practices for Building Agentlet Agents**

> This guide covers the principles and patterns that make agents trustworthy, usable, and effective. It's the "how to build *good* agents" companion to [SPEC.md](./SPEC.md) (what the protocol allows) and [AGENT-TYPES.md](./AGENT-TYPES.md) (portability options).

---

## Table of Contents

- [The Trust Progression Model](#the-trust-progression-model)
- [Transparency Patterns](#transparency-patterns)
- [Error Handling UX](#error-handling-ux)
- [Activity Stream Conventions](#activity-stream-conventions)
- [Performance & Resource Management](#performance--resource-management)
- [Testing Strategies](#testing-strategies)
- [Common Anti-Patterns](#common-anti-patterns)

---

## The Trust Progression Model

When users interact with AI agents, there's an inherent **asymmetry of understanding**:

- The agent "sees" context the user may not be aware of
- The agent's reasoning is opaque unless explicitly surfaced
- Actions are often irreversible (file edits, API calls, data mutations)

This creates anxiety. Users ask: *"What did it see? Why did it do that? Can I undo it?"*

Good agents build trust progressively.

### The Four-Stage Trust Ladder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                          THE TRUST LADDER                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Stage 4: AUTONOMOUS                                                │   │
│  │                                                                     │   │
│  │  Agent acts proactively, user reviews after                        │   │
│  │  Trust level: "I trust you to do the right thing"                  │   │
│  │                                                                     │   │
│  │  Example: Agent auto-organizes new items as they're added          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Stage 3: SUPERVISED ACTION                                         │   │
│  │                                                                     │   │
│  │  Agent proposes actions, user approves before execution             │   │
│  │  Trust level: "Show me what you'll do first"                       │   │
│  │                                                                     │   │
│  │  Example: "I'll add these 3 tags. Proceed?" [Yes] [No] [Edit]      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Stage 2: TRANSPARENT REASONING                                     │   │
│  │                                                                     │   │
│  │  Agent explains its understanding and intent                        │   │
│  │  Trust level: "Tell me what you're thinking"                       │   │
│  │                                                                     │   │
│  │  Example: "I see 12 papers about machine learning. I suggest..."   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ▲                                        │
│                                    │                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Stage 1: OBSERVATION ONLY                                          │   │
│  │                                                                     │   │
│  │  Agent perceives and reports, no actions                           │   │
│  │  Trust level: "Let me see what you see"                            │   │
│  │                                                                     │   │
│  │  Example: "Selected: 5 notes, 2 with tags, 3 without links"        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              USER STARTS HERE                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why Start with Observation?

Users need to verify that the agent understands their context correctly *before* trusting it to act. If an agent shows it "sees" the wrong thing, the user can correct it before any damage is done.

```javascript
// GOOD: Show what you perceive first
bridge.action('organize', async () => {
  const context = await bridge.perceive({ scope: 'selection' });

  // Stage 1: Show observation
  await bridge.activity.log(`Found ${context.items.length} items`);
  await bridge.activity.log(`Types: ${context.understanding}`);

  // Stage 2: Explain reasoning
  const plan = await bridge.inference({...});
  await bridge.activity.log(`Suggested: ${plan.summary}`);

  // Stage 3: Get approval
  const approved = await bridge.ui.confirm({
    title: 'Apply these changes?',
    message: plan.details,
    actions: ['Apply', 'Edit', 'Cancel']
  });

  if (!approved) return;

  // Stage 4: Execute
  await bridge.act({...});
});
```

```javascript
// BAD: Act without showing understanding
bridge.action('organize', async () => {
  const context = await bridge.perceive({ scope: 'selection' });
  await bridge.act({ intent: 'add-tags', tags: ['auto-tagged'] }); // No transparency!
});
```

### Design for Each Stage

| Stage | User Mindset | Agent Should... |
|-------|--------------|-----------------|
| **Observation** | "What does it see?" | Display perceived context clearly |
| **Reasoning** | "What does it think?" | Explain analysis and intent |
| **Supervised** | "What will it change?" | Show diff/preview, require approval |
| **Autonomous** | "Just handle it" | Act, summarize, allow undo |

### Earning Autonomy Over Time

Trust is earned through consistent, correct behavior. Consider implementing graduated autonomy:

```javascript
// Track user trust signals
const trustLevel = await bridge.storage.get('trustLevel') || 1;

if (trustLevel >= 4) {
  // Autonomous mode - act and report
  await bridge.act({...});
  await bridge.ui.notify(`Organized ${items.length} items`, 'success');
} else if (trustLevel >= 3) {
  // Supervised mode - show preview
  const approved = await bridge.ui.confirm({...});
  if (approved) {
    await bridge.act({...});
    // Upgrade trust after successful supervised actions
    await bridge.storage.set('trustLevel', trustLevel + 0.1);
  }
} else {
  // Explain-first mode
  await showDetailedPlan(plan);
}
```

---

## Transparency Patterns

Transparency is how agents show their "thinking." Good transparency answers three questions:

1. **What do you see?** (perception)
2. **What do you conclude?** (reasoning)
3. **What will you do?** (action)

### Pattern 1: Progressive Disclosure

Show summary first, details on demand:

```javascript
// Summary in notification
await bridge.ui.notify(`Found 5 duplicate notes`, 'info');

// Details in expandable panel
await bridge.ui.panel({
  title: 'Duplicates Found',
  content: `
    <details>
      <summary>5 duplicates found (click to expand)</summary>
      <ul>
        ${duplicates.map(d => `<li>${d.title}</li>`).join('')}
      </ul>
    </details>
  `
});
```

### Pattern 2: Show Your Work

Use the activity stream to narrate the process:

```javascript
await bridge.activity.start('Analyzing selection');
await bridge.activity.log('Reading 12 items...');
await bridge.activity.log('Extracting key concepts...');
await bridge.activity.log('Finding connections...');
await bridge.activity.progress(50, 100, 'Building graph');
// ...
await bridge.activity.complete('Analysis complete');
```

### Pattern 3: Diff Before Apply

For any mutation, show what will change:

```javascript
const preview = {
  add: ['tag:reviewed', 'tag:2024'],
  remove: [],
  modify: [{ field: 'status', from: 'pending', to: 'complete' }]
};

const approved = await bridge.ui.confirm({
  title: 'Confirm Changes',
  content: `
    <div style="font-family: monospace;">
      ${preview.add.map(t => `<div style="color: green;">+ ${t}</div>`).join('')}
      ${preview.remove.map(t => `<div style="color: red;">- ${t}</div>`).join('')}
      ${preview.modify.map(m => `<div style="color: orange;">~ ${m.field}: ${m.from} → ${m.to}</div>`).join('')}
    </div>
  `
});
```

### Pattern 4: Explain AI Decisions

When AI makes choices, explain why:

```javascript
const analysis = await bridge.inference({
  messages: [{
    role: 'system',
    content: `Analyze and categorize. Return JSON:
    {
      "category": "chosen category",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }`
  }, ...]
});

const result = JSON.parse(analysis);

await bridge.ui.panel({
  content: `
    <p><strong>Category:</strong> ${result.category}</p>
    <p><strong>Confidence:</strong> ${(result.confidence * 100).toFixed(0)}%</p>
    <p><strong>Why:</strong> ${result.reasoning}</p>
  `
});
```

---

## Error Handling UX

Errors are inevitable. How you handle them determines whether users trust your agent.

### Principle: Errors Should Be Actionable

```javascript
// BAD: Opaque error
await bridge.ui.notify('Error', 'error');

// GOOD: Actionable error
await bridge.ui.notify(
  'Cannot access CrossRef API. Check your internet connection and try again.',
  'error'
);

// BETTER: Error with recovery action
await bridge.ui.panel({
  title: 'Connection Failed',
  content: `
    <p>Cannot reach CrossRef API.</p>
    <button onclick="bridge.action('retry')">Retry</button>
    <button onclick="bridge.action('work-offline')">Work Offline</button>
  `
});
```

### Error Categories

| Error Type | User Message Style | Example |
|------------|-------------------|---------|
| **Permission** | Request action | "Grant access to notes to continue" |
| **Network** | Suggest retry | "Check connection and retry" |
| **Not Found** | Clarify scope | "No items selected. Select items first." |
| **Limit** | Explain constraint | "Monthly inference limit reached (1000/1000)" |
| **Invalid Input** | Guide correction | "Title cannot be empty" |
| **Unexpected** | Apologize + report | "Something went wrong. Error logged." |

### Graceful Degradation

When optional features fail, continue with reduced functionality:

```javascript
try {
  // Try enhanced behavior
  const embeddings = await bridge.mcp.call('embeddings', {...});
  results = await semanticSearch(embeddings);
} catch (e) {
  if (e.code === 'E901_MCP_NOT_AVAILABLE') {
    // Fall back to basic behavior
    await bridge.activity.log('Semantic search unavailable, using keyword search');
    results = await keywordSearch();
  } else {
    throw e;
  }
}
```

---

## Activity Stream Conventions

The activity stream (`bridge.activity.*`) is your agent's voice. Use it consistently.

### Lifecycle Pattern

```javascript
// 1. Start with what you're doing
await bridge.activity.start('Validating citations');

// 2. Log significant steps
await bridge.activity.log('Fetching metadata from CrossRef...');

// 3. Show progress for long operations
for (let i = 0; i < items.length; i++) {
  await bridge.activity.progress(i + 1, items.length, items[i].title);
}

// 4. Complete with summary
await bridge.activity.complete(`Validated ${items.length} citations, ${errors.length} issues found`);
```

### Log Levels

| Method | Use For | Example |
|--------|---------|---------|
| `start()` | Beginning of operation | "Organizing 12 items" |
| `log()` | Significant steps | "Fetching metadata..." |
| `progress()` | Iterative work | "Processing 5/12: Title..." |
| `complete()` | Successful end | "Done: 12 organized, 2 skipped" |
| `error()` | Failure | "Failed: API timeout" |

### Verbosity Guidelines

- **Don't log every detail** — Users don't need to see every function call
- **Do log decisions** — "Skipping item (no DOI)" helps users understand behavior
- **Do log wait states** — "Waiting for API response..." shows the agent isn't frozen
- **Don't log success for every item** — Use progress for iteration, log for exceptions

```javascript
// TOO VERBOSE
await bridge.activity.log('Checking item 1');
await bridge.activity.log('Item 1 has DOI');
await bridge.activity.log('Fetching DOI for item 1');
await bridge.activity.log('DOI fetched for item 1');
await bridge.activity.log('Checking item 2');
// ...

// JUST RIGHT
await bridge.activity.start(`Validating ${items.length} items`);
for (let i = 0; i < items.length; i++) {
  await bridge.activity.progress(i + 1, items.length);

  if (!items[i].DOI) {
    await bridge.activity.log(`Skipping "${items[i].title}" (no DOI)`);
    continue;
  }

  // ... validation logic ...
}
await bridge.activity.complete('Validation complete');
```

---

## Performance & Resource Management

Agents run in sandboxes with limited resources. Design accordingly.

### Check Limits Before Long Operations

```javascript
bridge.action('analyze-all', async () => {
  const limits = await bridge.limits.get();

  if (limits.inferenceRemaining < 50) {
    await bridge.ui.notify(
      `Only ${limits.inferenceRemaining} inference calls remaining. This may not complete.`,
      'warning'
    );

    const proceed = await bridge.ui.confirm({ message: 'Continue anyway?' });
    if (!proceed) return;
  }

  // ... proceed with operation ...
});
```

### Handle Cancellation

Long operations should be cancellable:

```javascript
for (let i = 0; i < items.length; i++) {
  // Check if user cancelled
  bridge.throwIfCancelled();

  await bridge.activity.progress(i + 1, items.length);
  await processItem(items[i]);
}
```

### Batch vs. Stream

For many items, consider showing results as they arrive:

```javascript
// BAD: Wait for all results, then show
const allResults = [];
for (const item of items) {
  allResults.push(await analyze(item));
}
await showResults(allResults);

// GOOD: Show results incrementally
for (const item of items) {
  const result = await analyze(item);
  await appendToResultsPanel(result); // User sees progress
}
```

### Cache Expensive Operations

```javascript
// Use storage for expensive computations
const cacheKey = `analysis:${items.map(i => i.id).join(',')}`;
let cached = await bridge.storage.get(cacheKey);

if (!cached || Date.now() - cached.timestamp > 3600000) { // 1 hour
  cached = {
    result: await expensiveAnalysis(items),
    timestamp: Date.now()
  };
  await bridge.storage.set(cacheKey, cached);
}

return cached.result;
```

---

## Testing Strategies

### Test Across Hosts

If your agent is `host-family` or `adaptive`, test on multiple hosts:

| Portability | Minimum Test Coverage |
|-------------|-----------------------|
| `host-specific` | Target host only |
| `host-family` | All declared hosts |
| `universal` | 2+ different hosts |
| `adaptive` | 3+ hosts with different data models |

### Test Edge Cases

| Scenario | How to Test |
|----------|-------------|
| Empty selection | Select nothing, invoke agent |
| Large selection | Select 100+ items |
| Mixed types | Select files + folders (if applicable) |
| Network failure | Disable network, test graceful degradation |
| Cancelled operation | Start long operation, cancel mid-way |
| Low limits | Set low inference/storage limits |

### Test Trust Stages

Verify each trust stage works correctly:

1. **Observation**: Does the agent correctly report what it sees?
2. **Reasoning**: Does the explanation match the action?
3. **Supervised**: Does cancelling actually prevent the action?
4. **Autonomous**: Are notifications accurate? Can users undo?

---

## Common Anti-Patterns

### Anti-Pattern 1: Silent Failure

```javascript
// BAD
try {
  await bridge.act({...});
} catch (e) {
  // Silently swallow error
}

// GOOD
try {
  await bridge.act({...});
} catch (e) {
  await bridge.activity.error(`Failed: ${e.message}`);
  await bridge.ui.notify('Action failed. See activity log.', 'error');
}
```

### Anti-Pattern 2: Unexplained AI Decisions

```javascript
// BAD: Black box
const category = await bridge.inference({
  messages: [{ role: 'user', content: `Categorize: ${item.title}` }]
});
await bridge.act({ intent: 'move-to', destination: category });

// GOOD: Explain the decision
const analysis = await bridge.inference({
  messages: [{
    role: 'system',
    content: 'Categorize and explain. Return JSON: { category, reason }'
  }, { role: 'user', content: item.title }]
});

const { category, reason } = JSON.parse(analysis);
await bridge.activity.log(`Moving to "${category}" because: ${reason}`);
await bridge.act({...});
```

### Anti-Pattern 3: No Recovery Path

```javascript
// BAD: Destructive with no undo
await bridge.act({ intent: 'delete', items: selected });

// GOOD: Archive first, allow recovery
const backup = await bridge.storage.get('deletedItems') || [];
backup.push({ items: selected, date: Date.now() });
await bridge.storage.set('deletedItems', backup);

await bridge.act({ intent: 'delete', items: selected });
await bridge.ui.notify('Deleted. Undo available for 24 hours.', 'info');
```

### Anti-Pattern 4: Assuming Context

```javascript
// BAD: Assumes selection exists
bridge.action('process', async () => {
  const items = await bridge.context.selection.get();
  await processItems(items); // Crashes if empty
});

// GOOD: Validate first
bridge.action('process', async () => {
  const items = await bridge.context.selection.get();

  if (items.length === 0) {
    await bridge.ui.notify('Select items first', 'warning');
    return;
  }

  await processItems(items);
});
```

### Anti-Pattern 5: Ignoring User Preferences

```javascript
// BAD: Hardcoded behavior
const tone = 'professional';

// GOOD: Respect user preferences
const prefs = await bridge.preferences.get();
const tone = prefs.tone || 'professional';
```

---

## Summary: The Trust-First Approach

Building trustworthy agents comes down to three principles:

1. **Show before you act** — Let users verify your perception
2. **Explain your reasoning** — Make AI decisions transparent
3. **Earn autonomy** — Start supervised, graduate to autonomous

The best agents don't just work correctly — they help users *understand* that they're working correctly. Trust is built through transparency, one successful interaction at a time.

---

## See Also

- [SPEC.md](./SPEC.md) — Protocol specification (what's possible)
- [AGENT-TYPES.md](./AGENT-TYPES.md) — Portability spectrum (where agents run)
- [CONTRIBUTING.md](./CONTRIBUTING.md) — How to contribute
- [examples/](./examples/) — Working agent examples
