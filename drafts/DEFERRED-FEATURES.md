# Deferred Features

> **Purpose:** Features that are valuable but deferred until adoption proves they're needed.
> **Last Updated:** January 2026

These features are valid long-term goals, ordered by likely importance. Each has a specific trigger condition for when to revisit.

---

## 1. Full Identity System (DIDs & Signatures)

**Trigger:** Spoofing or impersonation becomes a real problem
**Design Doc:** [01-identity-system.md](./01-identity-system.md)

### What We Have Instead

Simple verification that solves 80% of trust needs:

| Aspect | Simple (Current) | Full System (Deferred) |
|--------|------------------|------------------------|
| Author verification | GitHub URL, website link | `did:key`, `did:web` DIDs |
| Agent integrity | SHA256 hash | Ed25519 cryptographic signature |
| Trust signal | "Verified" badge | 0-100 computed trust score |
| Attestations | None | Third-party security audits |

### What's Deferred

```html
<!-- Agent identity -->
<meta name="agentlet:id" content="did:agentlet:3xK9mPqR7nY2wZvB">
<meta name="agentlet:signature" content="z3hQ7mR9pK2...">
<meta name="agentlet:signer" content="did:key:z6Mkha...">

<!-- Publisher identity -->
<meta name="agentlet:author:did" content="did:web:example.com">

<!-- Attestations -->
<meta name="agentlet:attestation" content="https://auditor.example/cert/123">
```

```javascript
bridge.identity.get(did)           // Resolve DID to identity info
bridge.identity.verify(agentHtml)  // Verify agent signature
bridge.trust.getScore(did)         // Get 0-100 trust score
bridge.trust.meets(did, { minScore: 80 })
```

### Why Deferred

Adds significant complexity: key management, DID resolution infrastructure, signature verification in all hosts, trust score computation. Simple GitHub/URL verification provides meaningful trust signals without this overhead.

---

## 2. Capability Negotiation (Levels & MCP Exposure)

**Trigger:** Hosts implement different capability levels, or agents need to expose MCP tools
**Design Doc:** [02-capability-negotiation.md](./02-capability-negotiation.md)

### What We Have Instead

Basic capability detection:

```javascript
bridge.specVersion           // '0.2'
bridge.supports('perceive')  // true/false
bridge.capabilities          // ['tags', 'search', ...]
```

### What's Deferred

#### Primitive Levels

```html
<meta name="agentlet:requires" content="perceive:standard">
<meta name="agentlet:requires" content="inference:advanced">
<meta name="agentlet:enhances-with" content="perceive:advanced">
```

```javascript
bridge.capabilities.getLevel('perceive')     // 'basic' | 'standard' | 'advanced'
bridge.capabilities.meetsLevel('perceive', 'standard')  // true/false
bridge.capabilities.hasFeature('inference', 'streaming')
```

#### MCP Tool Exposure

```html
<meta name="agentlet:mcp-server" content="true">
<meta name="agentlet:mcp-tool" content="summarize">
```

```javascript
bridge.mcp.expose({
  name: "summarize",
  inputSchema: { ... },
  handler: async (params) => { ... }
});
```

#### Graceful Degradation

```javascript
const ctx = await bridge.perceive({ depth: 'semantic' });
if (ctx.degraded?.missing.includes('semantic')) {
  // Fallback: interpret ourselves
}
```

### Why Deferred

No hosts currently implement different capability levels. The basic `bridge.supports()` covers current needs. MCP exposure adds complexity without clear use cases yet.

---

## 3. Full Registry Infrastructure

**Trigger:** Manual curation can't keep up, or hosts need programmatic access
**Design Doc:** [03-registry-infrastructure.md](./03-registry-infrastructure.md)

### What We Have Instead

- GitHub Pages site with curated list
- Manual submission via PR
- Simple category filtering
- Links to source repositories

### What's Deferred

- REST API with programmatic access
- CDN-backed file hosting
- Automated security scanning
- Ratings and reviews system
- Analytics dashboard
- Payment processing
- Webhook notifications

### Why Deferred

Start with a static site, see what breaks, then build infrastructure.

---

## 4. Agent-to-Agent Communication

**Trigger:** Developers ask "how do I call another agent from my agent?"

### What's Deferred

```javascript
// Discovery
const agents = await bridge.agents.discover({
  intent: 'summarize-document',
  trust: { minRating: 4.5 }
});

// Invocation
const result = await bridge.agents.invoke('did:agentlet:summarizer', {
  action: 'summarize',
  input: { document: doc }
});

// Capability delegation
const limited = await bridge.capabilities.attenuate(
  'context:document:write',
  { fields: ['tags'], items: [selectedId] }
);
```

```html
<meta name="agentlet:provides" content="intent:summarize-document">
<meta name="agentlet:depends" content="did:agentlet:translator@^1.0.0">
```

### Why Deferred

Requires agent identity (DIDs), multiple agents that need to work together, and clear composition patterns from real usage.

---

## 5. Client-Side ML (Wasm)

**Trigger:** Privacy requirements prevent cloud inference, or offline operation is critical
**Design Docs:** [05-wasm-spec.md](./05-wasm-spec.md), [05-wasm-guide.md](./05-wasm-guide.md)

### What's Deferred

```html
<meta name="agentlet:capability" content="wasm">
<meta name="agentlet:capability" content="wasm:simd">
<meta name="agentlet:limit" content="maxMemoryBytes:268435456">
```

```javascript
if (bridge.wasm.supported) {
  const { pipeline } = await import('@huggingface/transformers');
  const embedder = await pipeline('feature-extraction',
    'Xenova/nomic-embed-text-v1.5',
    { device: 'wasm', quantized: true }
  );
}

// Vector storage
await bridge.vectors.store('docs', { id: 'doc-1', embedding: [...] });
const results = await bridge.vectors.search('docs', { query: 'machine learning' });
```

**Reference:** ZotSeek demonstrates this pattern (ChromeWorker + Transformers.js, ~3s embeddings, 100% local).

### Why Deferred

Adds complexity: CSP changes, memory management, cross-browser issues, large downloads (100MB+). Most agents can use `bridge.inference({ type: 'embedding' })` which routes to host providers.

---

## 6. Semantic Intent Layer

**Trigger:** Developers consistently ask for intents not in the standard vocabulary

### What We Have Instead

Standard intents (`add-tags`, `move-to`, `search`, etc.) via `bridge.act({ intent: '...' })`.

### What's Deferred

```html
<meta name="agentlet:action" content="fix-metadata"
      data-intent="https://intents.agentlet.org/document/repair/1.0">
```

```javascript
const resolved = await bridge.intents.resolve(
  "Summarize my selected papers in Spanish"
);
// { intent: 'document/summarize', params: { language: 'es' }, agents: [...] }
```

### Why Deferred

v0.1 standard intents cover most use cases. NL resolution adds complexity and requires proven limitations of explicit intents.

---

## 7. Economic Primitives

**Trigger:** Agent authors ask "how do I charge for my agent?"

### What's Deferred

```html
<meta name="agentlet:pricing" content="action:analyze"
      data-amount="0.05" data-currency="USD">
```

```javascript
const result = await bridge.agents.invoke('did:agentlet:premium', {
  action: 'analyze',
  budget: { max: '1.00 USD' }
});

const usage = await bridge.metering.current();
// { inference: { tokens: 1500, cost: '0.02 USD' } }
```

### Why Deferred

No paid agents exist. Payment infrastructure requires legal/regulatory considerations, provider integrations, revenue sharing agreements.

---

## 8. State Synchronization

**Trigger:** Users ask "why don't my agent settings follow me across devices?"

### What's Deferred

```javascript
await bridge.storage.set('prefs', data, { scope: 'user' });  // Syncs across hosts
```

- User-scoped synchronized storage
- End-to-end encryption
- Conflict resolution (CRDTs)

### Why Deferred

Requires sync backend, encryption key management, conflict resolution. Current per-host storage covers most use cases.

---

## 9. Offline & Real-time

**Trigger:** Agents need to work without network, or multiple users need to collaborate

### What's Deferred

```html
<meta name="agentlet:offline" content="full">
```

```javascript
await bridge.offline.queue({ action: 'sync', input: data });

const session = await bridge.realtime.join('document:123');
session.on('change', (change) => applyChange(change));
```

### Why Deferred

Requires service workers, WebSocket/WebRTC, CRDT libraries. No clear use cases have emerged.

---

## 10. Governance Model

**Trigger:** 5+ external contributors, 3+ external host implementations, or contentious spec changes

### What's Deferred

- GOVERNANCE.md - Decision-making process
- RFC process - Formal proposal format
- Trademark guidelines - "Agentlet Compatible" certification
- Code of conduct

### Why Deferred

Governance for a small project is overhead. Build community first.

---

## Summary

| # | Feature | Trigger |
|---|---------|---------|
| 1 | Full Identity (DIDs) | Spoofing becomes a problem |
| 2 | Capability Negotiation | Hosts implement different levels |
| 3 | Full Registry API | Manual curation can't scale |
| 4 | Agent-to-Agent | Developers need composition |
| 5 | Client-Side ML | Privacy/offline requirements |
| 6 | Semantic Intents | Standard intents insufficient |
| 7 | Payments | Authors want to charge |
| 8 | State Sync | Multi-device users |
| 9 | Offline/Real-time | Specific use cases emerge |
| 10 | Governance | Community needs coordination |

---

*Features should be promoted back to ROADMAP.md when adoption proves they're needed.*
