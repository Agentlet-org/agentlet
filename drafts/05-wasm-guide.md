# WebAssembly Developer Guide

**For Agentlet Spec:** v0.5.0
**Status:** Draft
**Last Updated:** December 2025
**Reference Implementation:** [ZotSeek](https://github.com/introfini/ZotSeek)

---

## Introduction

This guide covers practical patterns for using WebAssembly in Agentlet agents. It's based on production experience from ZotSeek, a Zotero plugin that implements client-side semantic search using Transformers.js and ONNX Runtime.

For the formal specification (capabilities, CSP, errors), see [WASM-SPEC.md](./WASM-SPEC.md).

---

## Table of Contents

1. [When to Use Wasm](#1-when-to-use-wasm)
2. [Getting Started](#2-getting-started)
3. [Loading Patterns](#3-loading-patterns)
4. [Performance Optimization](#4-performance-optimization)
5. [Memory Management](#5-memory-management)
6. [File Size Guidelines](#6-file-size-guidelines)
7. [Complete Example: Local Semantic Search](#7-complete-example-local-semantic-search)
8. [Host-Specific Considerations](#8-host-specific-considerations)
9. [Debugging Tips](#9-debugging-tips)
10. [Library Reference](#10-library-reference)

---

## 1. When to Use Wasm

### ✅ Good Use Cases

| Use Case | Example | Why Wasm |
|----------|---------|----------|
| **Client-side embeddings** | Transformers.js + ONNX Runtime | Privacy, offline, no API costs |
| **Semantic search** | Local vector similarity | Fast after initial load |
| **Privacy-critical processing** | Medical/legal documents | Data never leaves device |
| **Offline AI** | Field research, air-gapped environments | Works without network |
| **High-performance computation** | Image processing, compression | 10-100x faster than JS |
| **Cryptography** | DID signing, verification | Battle-tested implementations |

### ❌ When to Avoid Wasm

| Situation | Why Avoid | Alternative |
|-----------|-----------|-------------|
| Simple text processing | JavaScript is fast enough | Native JS |
| Cloud API wrappers | Network latency dominates | `bridge.inference()` |
| File-size-sensitive contexts | Wasm + models can be 100MB+ | Host-provided inference |
| One-time operations | Compilation overhead not worth it | JS or host API |
| When host provides the feature | Duplicates functionality | `inference:embedding` |

### Decision Flowchart

```
Need embeddings/ML?
    │
    ├─ Yes → Does host support inference:embedding?
    │           │
    │           ├─ Yes → Use bridge.inference({ type: 'embedding' })
    │           │
    │           └─ No → Need offline support?
    │                      │
    │                      ├─ Yes → Use Wasm
    │                      │
    │                      └─ No → Consider cloud API via network capability
    │
    └─ No → Need high-performance computation?
              │
              ├─ Yes → Use Wasm
              │
              └─ No → Use JavaScript
```

---

## 2. Getting Started

### 2.1 Minimal Wasm Agent

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Wasm Example</title>
  
  <meta name="agentlet" content="0.5">
  <meta name="agentlet:name" content="wasm-example">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:portability" content="universal">
  
  <!-- Declare Wasm capability -->
  <meta name="agentlet:capability" content="wasm:simd">
  
  <!-- Memory limit -->
  <meta name="agentlet:limit" content="maxMemoryBytes:268435456">
  
  <meta name="agentlet:capability" content="ui:notify">
  <meta name="agentlet:action" content="run" data-label="Run Wasm">
</head>
<body>
<script type="module">
const { bridge } = window;

bridge.action('run', async () => {
  // Always check support first
  if (!bridge.wasm.supported) {
    await bridge.ui.notify('WebAssembly not supported', 'error');
    return;
  }
  
  // Check for SIMD
  if (!bridge.wasm.hasFeature('simd')) {
    await bridge.ui.notify('SIMD not available, performance may be reduced', 'warning');
  }
  
  // Your Wasm code here
  await bridge.ui.notify('Wasm is ready!', 'success');
});
</script>
</body>
</html>
```

### 2.2 Feature Detection Pattern

Always check capabilities before using Wasm:

```javascript
async function initializeWasm() {
  // Check basic support
  if (!bridge.wasm.supported) {
    throw new Error('WebAssembly not supported by this host');
  }
  
  // Log available features
  console.log('Wasm features:', bridge.wasm.features);
  
  // Adapt to available features
  const config = {
    simd: bridge.wasm.hasFeature('simd'),
    threads: bridge.wasm.hasFeature('threads'),
    numThreads: bridge.wasm.hasFeature('threads') 
      ? navigator.hardwareConcurrency || 4 
      : 1
  };
  
  return config;
}
```

---

## 3. Loading Patterns

### 3.1 Pattern: CDN Loading (Recommended for Most Cases)

Best for agents distributed via URL, models 10MB+:

```javascript
// Load Transformers.js from CDN
const { pipeline, env } = await import(
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0'
);

// Configure for optimal Wasm performance
env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;

// Initialize model (downloads on first use, cached in browser)
const embedder = await pipeline(
  'feature-extraction',
  'Xenova/nomic-embed-text-v1.5',
  { 
    device: 'wasm',
    quantized: true  // Smaller, faster
  }
);
```

**Pros:** Simple, automatic caching, always up-to-date
**Cons:** Requires network on first load

### 3.2 Pattern: Bundled Assets (Offline-First)

For agents that must work completely offline:

```html
<!DOCTYPE html>
<title>Offline Agent</title>
<meta name="agentlet" content="0.5">
<meta name="agentlet:capability" content="wasm:simd">
<meta name="agentlet:capability" content="wasm:threads">

<!-- Declare bundled Wasm for transparency -->
<meta name="agentlet:wasm" content="./wasm/ort-wasm-simd-threaded.wasm"
      data-size="21000000">

<script type="module">
import { pipeline, env } from './lib/transformers.js';

// Point to bundled assets
env.backends.onnx.wasm.wasmPaths = './wasm/';
env.localModelPath = './models/';
env.allowRemoteModels = false;
env.allowLocalModels = true;

const embedder = await pipeline(
  'feature-extraction',
  'nomic-embed-text-v1.5',
  { local_files_only: true }
);
</script>
```

**Pros:** True offline, predictable performance
**Cons:** Larger agent file, manual updates

### 3.3 Pattern: Worker Isolation

For CPU-intensive operations, use a Web Worker to avoid blocking the UI:

```javascript
// main.js - Runs in main thread
const worker = new Worker(new URL('./embedding-worker.js', import.meta.url));

// Initialize worker
worker.postMessage({ type: 'init', model: 'Xenova/nomic-embed-text-v1.5' });

// Wait for ready
await new Promise(resolve => {
  worker.onmessage = (e) => {
    if (e.data.type === 'ready') resolve();
  };
});

// Use worker for embedding
function embed(text) {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36);
    
    worker.postMessage({ type: 'embed', id, text });
    
    const handler = (e) => {
      if (e.data.id === id) {
        worker.removeEventListener('message', handler);
        if (e.data.error) reject(new Error(e.data.error));
        else resolve(e.data.embedding);
      }
    };
    
    worker.addEventListener('message', handler);
  });
}
```

```javascript
// embedding-worker.js - Runs in worker thread
import { pipeline, env } from '@huggingface/transformers';

let embedder = null;

self.onmessage = async (e) => {
  const { type, id, text, model } = e.data;
  
  if (type === 'init') {
    try {
      env.backends.onnx.wasm.numThreads = 4;
      embedder = await pipeline('feature-extraction', model, {
        device: 'wasm',
        quantized: true
      });
      self.postMessage({ type: 'ready' });
    } catch (error) {
      self.postMessage({ type: 'error', error: error.message });
    }
  }
  
  if (type === 'embed') {
    try {
      const result = await embedder(text, { pooling: 'mean', normalize: true });
      self.postMessage({ type: 'result', id, embedding: Array.from(result.data) });
    } catch (error) {
      self.postMessage({ type: 'result', id, error: error.message });
    }
  }
};
```

**Pros:** Non-blocking UI, better perceived performance
**Cons:** More complex, message passing overhead

### 3.4 Pattern: Lazy Loading

Load Wasm only when needed:

```javascript
let embedder = null;

async function ensureEmbedder() {
  if (embedder) return embedder;
  
  await bridge.activity.start('Loading AI model...');
  
  const { pipeline, env } = await import(
    'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0'
  );
  
  env.backends.onnx.wasm.numThreads = navigator.hardwareConcurrency || 4;
  
  embedder = await pipeline('feature-extraction', 'Xenova/nomic-embed-text-v1.5', {
    device: 'wasm',
    quantized: true
  });
  
  await bridge.activity.complete('Model loaded');
  
  return embedder;
}

// Only loads when first action is triggered
bridge.action('embed', async () => {
  const model = await ensureEmbedder();
  // Use model...
});
```

---

## 4. Performance Optimization

### 4.1 Benchmarks (ZotSeek Production Data)

Using Transformers.js + ONNX Runtime + nomic-embed-text-v1.5 (131MB quantized):

| Operation | Time | Notes |
|-----------|------|-------|
| **Model loading** | ~1.5s | First time only (cached after) |
| **Wasm compilation** | Included | One-time, browser caches |
| **Single embedding (2K tokens)** | ~3s | 8000 characters |
| **Single embedding (1K tokens)** | ~1.5s | 4000 characters |
| **Single embedding (500 tokens)** | ~0.8s | 2000 characters |
| **Vector search (1000 items)** | ~70ms | Pre-normalized Float32Arrays |

### 4.2 Critical: Text Chunking

Embedding time scales **O(n²)** with sequence length due to attention mechanisms:

```javascript
// ❌ BAD: Long text takes exponentially longer
const text = document.content;  // 24000 chars → ~45 seconds!
const embedding = await embedder(text);

// ✅ GOOD: Chunk to manageable size
const MAX_CHARS = 8000;  // ~2000 tokens → ~3-5 seconds

function chunkText(text, maxChars) {
  const chunks = [];
  let start = 0;
  
  while (start < text.length) {
    // Try to break at sentence boundary
    let end = Math.min(start + maxChars, text.length);
    
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      if (lastPeriod > start + maxChars * 0.5) {
        end = lastPeriod + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  
  return chunks;
}

// Process incrementally
const chunks = chunkText(document.content, MAX_CHARS);
for (const chunk of chunks) {
  const embedding = await embedder(chunk);
  // Store or aggregate embeddings
}
```

**Recommended chunk sizes:**

| Chunk Size | Tokens | Time | Best For |
|------------|--------|------|----------|
| 2000 chars | ~500 | ~0.8s | Real-time UI |
| 4000 chars | ~1000 | ~1.5s | Interactive |
| 8000 chars | ~2000 | ~3-5s | Background processing |

### 4.3 SIMD Optimization

SIMD (Single Instruction, Multiple Data) provides ~2-4x speedup:

```javascript
// Check SIMD availability
const useSIMD = bridge.wasm.hasFeature('simd');

// Transformers.js automatically uses SIMD when available
// Just ensure you're using the right Wasm file
env.backends.onnx.wasm.simd = useSIMD;
```

### 4.4 Threading

Multi-threading can improve throughput for batch operations:

```javascript
const numThreads = bridge.wasm.hasFeature('threads')
  ? navigator.hardwareConcurrency || 4
  : 1;

env.backends.onnx.wasm.numThreads = numThreads;
```

**Note:** Threading requires `SharedArrayBuffer`, which needs cross-origin isolation headers. Some hosts may not support this.

### 4.5 Vector Search Optimization

For similarity search, pre-normalize vectors:

```javascript
// ❌ SLOW: Normalizing on every search
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ✅ FAST: Pre-normalize, then dot product is sufficient
function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map(v => v / norm);
}

// Store normalized vectors
const normalizedVectors = vectors.map(normalize);

// Search is just dot product
function dotProduct(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
```

### 4.6 Use Float32Array

JavaScript arrays are slow for vector operations:

```javascript
// ❌ SLOW: Regular arrays
const vector = [0.1, 0.2, 0.3, ...];

// ✅ FAST: Typed arrays
const vector = new Float32Array([0.1, 0.2, 0.3, ...]);

// Convert from Transformers.js output
const embedding = new Float32Array(result.data);
```

---

## 5. Memory Management

### 5.1 Memory Usage Reference

| Component | Memory |
|-----------|--------|
| nomic-embed-text-v1.5 (quantized) | ~150MB loaded |
| ONNX Runtime Wasm | ~20MB |
| Per 1000 vectors (768-dim, Float32) | ~3MB |
| 10,000 documents indexed | ~30MB vectors + metadata |

### 5.2 Declaring Memory Limits

Be honest about memory needs:

```html
<!-- Embedding agent: model + vectors + headroom -->
<meta name="agentlet:limit" content="maxMemoryBytes:268435456">  <!-- 256MB -->

<!-- Light agent: small model only -->
<meta name="agentlet:limit" content="maxMemoryBytes:134217728">  <!-- 128MB -->
```

### 5.3 Memory Cleanup

Release resources when done:

```javascript
// Explicitly dispose of model when no longer needed
bridge.onDeactivate(async () => {
  if (embedder) {
    await embedder.dispose?.();
    embedder = null;
  }
});

// For large vector stores, consider IndexedDB over in-memory
if (vectorStore.vectors.length > 10000) {
  // Move to IndexedDB
  await saveToIndexedDB(vectorStore);
  vectorStore = null;  // Release memory
}
```

### 5.4 Progressive Loading

For very large models, show progress:

```javascript
const embedder = await pipeline('feature-extraction', model, {
  device: 'wasm',
  progress_callback: (progress) => {
    if (progress.status === 'downloading') {
      const pct = Math.round((progress.loaded / progress.total) * 100);
      bridge.activity.progress(pct, 100, `Downloading model... ${pct}%`);
    }
  }
});
```

---

## 6. File Size Guidelines

### 6.1 Size Recommendations

| Total Size | Recommendation |
|------------|----------------|
| **< 1MB** | Inline in `.agentlet` file |
| **1-10MB** | Bundle with agent or CDN |
| **10-50MB** | CDN with caching |
| **50-200MB** | On-demand download with user consent |
| **200MB+** | Consider cloud inference instead |

### 6.2 Size Reduction Strategies

| Strategy | Reduction | Trade-off |
|----------|-----------|-----------|
| **Quantization (int8/int4)** | 4-8x smaller | Minor accuracy loss |
| **Distillation** | 2-10x smaller | Model-specific accuracy loss |
| **Pruning** | 20-50% smaller | Depends on sparsity |
| **Model selection** | Varies | Choose smaller model for task |

Example model sizes (embedding models):

| Model | Original | Quantized |
|-------|----------|-----------|
| nomic-embed-text-v1.5 | ~520MB | ~131MB |
| all-MiniLM-L6-v2 | ~90MB | ~23MB |
| gte-small | ~120MB | ~30MB |

### 6.3 User Consent for Large Downloads

```javascript
async function downloadLargeModel() {
  const confirmed = await bridge.ui.confirm(
    'This will download a 131MB AI model. Continue?'
  );
  
  if (!confirmed) {
    await bridge.ui.notify('Model download cancelled', 'info');
    return false;
  }
  
  await bridge.activity.start('Downloading AI model (131MB)...');
  // ... download
  return true;
}
```

---

## 7. Complete Example: Local Semantic Search

A production-ready semantic search agent based on ZotSeek:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Local Semantic Search</title>
  
  <meta name="agentlet" content="0.5">
  <meta name="agentlet:name" content="local-semantic-search">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="Privacy-first semantic search using local AI">
  <meta name="agentlet:author" content="José">
  <meta name="agentlet:license" content="MIT">
  
  <meta name="agentlet:portability" content="adaptive">
  
  <!-- Wasm capabilities -->
  <meta name="agentlet:capability" content="wasm:simd">
  <meta name="agentlet:capability" content="wasm:threads">
  
  <!-- Other capabilities -->
  <meta name="agentlet:requires" content="perceive">
  <meta name="agentlet:requires" content="storage">
  <meta name="agentlet:capability" content="ui:panel">
  <meta name="agentlet:capability" content="ui:prompt">
  <meta name="agentlet:capability" content="ui:notify">
  
  <!-- Resource limits -->
  <meta name="agentlet:limit" content="maxMemoryBytes:268435456">
  <meta name="agentlet:limit" content="maxStorageBytes:209715200">
  
  <!-- Actions -->
  <meta name="agentlet:action" content="search" data-label="Semantic Search">
  <meta name="agentlet:action" content="index" data-label="Build Index">
  <meta name="agentlet:action" content="stats" data-label="Index Stats">
  <meta name="agentlet:action" content="clear" data-label="Clear Index" data-confirm="true">
</head>
<body>

<script type="module">
const { bridge } = window;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const MODEL_ID = 'Xenova/nomic-embed-text-v1.5';
const MAX_CHARS = 8000;  // ~2000 tokens, keeps embedding time ~3-5s
const PREFIX_DOCUMENT = 'search_document: ';
const PREFIX_QUERY = 'search_query: ';

let embedder = null;
let vectorStore = null;

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

bridge.onActivate(async () => {
  // Check Wasm support
  if (!bridge.wasm.supported) {
    await bridge.ui.notify(
      'This agent requires WebAssembly support',
      'error'
    );
    return;
  }
  
  // Load stored vectors
  vectorStore = await bridge.storage.get('vectorStore') || { 
    items: [], 
    vectors: [] 
  };
  
  console.log(`Loaded ${vectorStore.items.length} indexed items`);
});

async function ensureModel() {
  if (embedder) return;
  
  await bridge.activity.start('Loading AI model (~150MB on first use)...');
  
  try {
    const { pipeline, env } = await import(
      'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0'
    );
    
    // Configure based on available features
    env.backends.onnx.wasm.numThreads = bridge.wasm.hasFeature('threads')
      ? navigator.hardwareConcurrency || 4
      : 1;
    
    embedder = await pipeline('feature-extraction', MODEL_ID, {
      device: 'wasm',
      quantized: true
    });
    
    await bridge.activity.complete('Model loaded');
  } catch (error) {
    await bridge.activity.error(`Failed to load model: ${error.message}`);
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMBEDDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function embedDocument(text) {
  await ensureModel();
  
  // Truncate to avoid O(n²) blowup
  const truncated = text.slice(0, MAX_CHARS);
  const prefixed = PREFIX_DOCUMENT + truncated;
  
  const result = await embedder(prefixed, { 
    pooling: 'mean', 
    normalize: true 
  });
  
  return new Float32Array(result.data);
}

async function embedQuery(text) {
  await ensureModel();
  
  const prefixed = PREFIX_QUERY + text;
  
  const result = await embedder(prefixed, { 
    pooling: 'mean', 
    normalize: true 
  });
  
  return new Float32Array(result.data);
}

function dotProduct(a, b) {
  // Vectors are pre-normalized, so dot product = cosine similarity
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

bridge.action('index', async () => {
  const ctx = await bridge.perceive({ scope: 'all' });
  
  if (ctx.items.length === 0) {
    await bridge.ui.notify('No items to index', 'warning');
    return;
  }
  
  await bridge.activity.start(`Indexing ${ctx.items.length} items`);
  
  const existingIds = new Set(vectorStore.items.map(v => v.id));
  let indexed = 0;
  let skipped = 0;
  
  for (let i = 0; i < ctx.items.length; i++) {
    bridge.throwIfCancelled();
    
    const item = ctx.items[i];
    const title = item.title || item.name || `Item ${item.id}`;
    
    await bridge.activity.progress(i + 1, ctx.items.length, title);
    
    // Skip if already indexed
    if (existingIds.has(item.id)) {
      skipped++;
      continue;
    }
    
    // Get text content
    const text = item.content || item.abstract || item.body || item.title || '';
    if (!text || text.length < 50) {
      skipped++;
      continue;
    }
    
    try {
      const embedding = await embedDocument(text);
      
      vectorStore.items.push({ 
        id: item.id, 
        title,
        indexed: new Date().toISOString()
      });
      vectorStore.vectors.push(Array.from(embedding));
      
      indexed++;
    } catch (error) {
      await bridge.activity.log(`Failed: ${title}`, 'warning');
    }
  }
  
  // Save to storage
  await bridge.storage.set('vectorStore', vectorStore);
  
  await bridge.activity.complete(
    `Indexed ${indexed} new items (${skipped} skipped, ${vectorStore.items.length} total)`
  );
});

bridge.action('search', async () => {
  if (vectorStore.items.length === 0) {
    await bridge.ui.notify('Index is empty. Run "Build Index" first.', 'warning');
    return;
  }
  
  const query = await bridge.ui.prompt('Search for:');
  if (!query) return;
  
  await bridge.activity.start('Searching...');
  
  const queryEmbedding = await embedQuery(query);
  
  // Compute similarities
  const results = vectorStore.items
    .map((item, i) => ({
      item,
      score: dotProduct(queryEmbedding, new Float32Array(vectorStore.vectors[i]))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  
  await bridge.activity.complete();
  
  // Display results
  const content = results.length === 0
    ? '<p>No results found.</p>'
    : results.map((r, i) => `
        <div style="
          padding: 0.75rem; 
          margin-bottom: 0.5rem; 
          background: ${i === 0 ? '#f0fdf4' : '#f9fafb'}; 
          border-radius: 6px; 
          border-left: 3px solid ${i === 0 ? '#22c55e' : '#e5e7eb'};
        ">
          <div style="font-weight: ${i === 0 ? 'bold' : 'normal'};">
            ${escapeHtml(r.item.title)}
          </div>
          <div style="font-size: 0.85rem; color: #666;">
            Relevance: ${(r.score * 100).toFixed(1)}%
          </div>
        </div>
      `).join('');
  
  await bridge.ui.panel({
    title: `Results for "${escapeHtml(query)}"`,
    content: `<div style="padding: 1rem; font-family: system-ui;">${content}</div>`,
    width: 400
  });
});

bridge.action('stats', async () => {
  const memoryMB = (vectorStore.vectors.length * 768 * 4 / 1024 / 1024).toFixed(1);
  
  await bridge.ui.panel({
    title: 'Index Statistics',
    content: `
      <div style="padding: 1rem; font-family: system-ui;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Items indexed</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">
              ${vectorStore.items.length}
            </td>
          </tr>
          <tr>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Vector dimensions</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">768</td>
          </tr>
          <tr>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb;">Vector memory</td>
            <td style="padding: 0.5rem; border-bottom: 1px solid #e5e7eb; text-align: right;">~${memoryMB} MB</td>
          </tr>
          <tr>
            <td style="padding: 0.5rem;">Model</td>
            <td style="padding: 0.5rem; text-align: right; font-size: 0.9rem;">${MODEL_ID}</td>
          </tr>
        </table>
      </div>
    `,
    width: 350
  });
});

bridge.action('clear', async () => {
  vectorStore = { items: [], vectors: [] };
  await bridge.storage.set('vectorStore', vectorStore);
  await bridge.ui.notify('Index cleared', 'success');
});

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
</script>

</body>
</html>
```

---

## 8. Host-Specific Considerations

### 8.1 Zotero (ChromeWorker)

Zotero uses ChromeWorker instead of standard Web Workers. Requires polyfills:

```javascript
// In ChromeWorker
(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
(globalThis as any).navigator = {
  userAgent: 'AgentletHost ChromeWorker',
  hardwareConcurrency: 4,
  language: 'en-US',
  languages: ['en-US', 'en'],
};

// Configure Wasm paths BEFORE imports
env.backends.onnx.wasm.wasmPaths = 'resource://agentlet/wasm/';
env.allowRemoteModels = false;
env.localModelPath = 'resource://agentlet/models/';
env.useBrowserCache = false;
```

### 8.2 Electron

Electron supports Wasm natively. Consider:

- Using `nodeIntegration: false` for security
- SharedArrayBuffer requires `contextIsolation: true`
- May need to configure CSP in `webPreferences`

### 8.3 Tauri

Tauri (Rust-based) has excellent Wasm support:

- WebView2 on Windows, WebKit on macOS/Linux
- SharedArrayBuffer support varies by platform
- Consider bundling models in app resources

### 8.4 Browser Extension

Browser extensions can use Wasm with some caveats:

- Manifest V3 may require additional CSP declarations
- Background service workers have memory limits
- Consider offscreen documents for heavy Wasm work

---

## 9. Debugging Tips

### 9.1 Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "CompileError: Wasm decoding failed" | CSP blocks Wasm | Check `'wasm-unsafe-eval'` in CSP |
| "SharedArrayBuffer is not defined" | Cross-origin isolation | Host needs COOP/COEP headers |
| "Out of memory" | Exceeded limits | Increase `maxMemoryBytes` or use smaller model |
| Very slow embedding | Long text | Chunk text to MAX_CHARS |
| Model download hangs | Network/CORS | Check network capability and CDN accessibility |

### 9.2 Performance Profiling

```javascript
// Time embedding operations
async function timedEmbed(text) {
  const start = performance.now();
  const result = await embedder(text);
  const elapsed = performance.now() - start;
  
  console.log(`Embedding took ${elapsed.toFixed(0)}ms for ${text.length} chars`);
  
  return result;
}

// Monitor memory
function logMemory() {
  if (performance.memory) {
    const mb = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
    console.log(`Memory: ${mb} MB`);
  }
}
```

### 9.3 Testing Wasm Availability

```javascript
// Test in browser console before building agent
(async () => {
  // Basic Wasm
  const wasmSupported = typeof WebAssembly === 'object';
  console.log('Wasm supported:', wasmSupported);
  
  // SIMD
  const simdSupported = await (async () => {
    try {
      return WebAssembly.validate(new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
        3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
      ]));
    } catch { return false; }
  })();
  console.log('SIMD supported:', simdSupported);
  
  // SharedArrayBuffer (needed for threads)
  const threadsSupported = typeof SharedArrayBuffer !== 'undefined';
  console.log('Threads supported:', threadsSupported);
})();
```

---

## 10. Library Reference

### 10.1 Recommended Libraries

| Library | Use Case | Size | Link |
|---------|----------|------|------|
| **Transformers.js** | ML models (embedding, classification, generation) | ~2MB + models | [GitHub](https://github.com/xenova/transformers.js) |
| **ONNX Runtime Web** | Run ONNX models | ~20MB | [ONNX Runtime](https://onnxruntime.ai/) |
| **TensorFlow.js** | ML models | ~1MB + models | [TensorFlow.js](https://www.tensorflow.org/js) |
| **FFmpeg.wasm** | Audio/video processing | ~25MB | [GitHub](https://github.com/ffmpegwasm/ffmpeg.wasm) |
| **sql.js** | SQLite in browser | ~1.5MB | [GitHub](https://github.com/sql-js/sql.js) |

### 10.2 Recommended Models

| Model | Task | Size (Quantized) | Dimensions |
|-------|------|------------------|------------|
| **nomic-embed-text-v1.5** | Embeddings | ~131MB | 768 |
| **all-MiniLM-L6-v2** | Embeddings | ~23MB | 384 |
| **gte-small** | Embeddings | ~30MB | 384 |
| **bge-small-en-v1.5** | Embeddings | ~33MB | 384 |

### 10.3 CDN URLs

```javascript
// Transformers.js (recommended for ML)
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0';

// ONNX Runtime (if needed directly)
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.17.0/dist/esm/ort.min.js';
```

---

## References

- **ZotSeek:** https://github.com/introfini/ZotSeek — Production reference implementation
- **Transformers.js:** https://huggingface.co/docs/transformers.js — Client-side ML
- **ONNX Runtime Web:** https://onnxruntime.ai/docs/tutorials/web/ — Wasm ML runtime
- **nomic-embed-text-v1.5:** https://huggingface.co/nomic-ai/nomic-embed-text-v1.5 — Recommended embedding model
- **CSP wasm-unsafe-eval:** https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src#wasm-unsafe-eval

---

## Changelog

| Date | Change |
|------|--------|
| Dec 2025 | Initial draft based on ZotSeek analysis |
| Dec 2025 | Split from spec into standalone guide |
| Dec 2025 | Added debugging tips and library reference |
