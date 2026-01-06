# WebAssembly Support Specification

**Spec Version:** 0.5.0  
**Status:** Draft  
**Target Section:** 6.15 (Bridge API), 9.1 (Capabilities)  
**Last Updated:** December 2025

---

## 1. Overview

WebAssembly (Wasm) enables agents to run high-performance code within the sandbox. This specification defines the capability model, CSP requirements, feature detection API, and error codes for Wasm support in Agentlet.

Wasm is an **optional capability** that agents must explicitly request. Hosts enable Wasm execution by adjusting CSP and providing feature detection APIs.

### 1.1 Design Principles

1. **Opt-in** — Agents must declare Wasm capability; it's not available by default
2. **Minimal bridge surface** — Feature detection only; agents use standard Web APIs to load Wasm
3. **Sandbox preservation** — Wasm does not bypass existing security restrictions
4. **Progressive enhancement** — Agents should gracefully degrade when Wasm unavailable

### 1.2 Relationship to `inference:embedding`

The `inference:embedding` capability routes embedding requests through the host's inference provider. The `wasm` capability enables agents to run their own models directly.

| Approach | Description | Use When |
|----------|-------------|----------|
| `inference:embedding` | Host-managed embedding | Host supports it, simpler code |
| `wasm` + local models | Agent-managed embedding | Offline needed, specific model required |

Agents MAY use both approaches:

```javascript
async function embed(text) {
  // Prefer host-provided embedding
  if (bridge.hasCapability('inference:embedding')) {
    return await bridge.inference({ type: 'embedding', input: text });
  }
  
  // Fall back to local Wasm model
  if (bridge.wasm.supported) {
    return await localEmbed(text);
  }
  
  throw new Error('No embedding capability available');
}
```

---

## 2. Manifest Declaration

### 2.1 Wasm Capabilities

```html
<!-- Basic Wasm execution -->
<meta name="agentlet:capability" content="wasm">

<!-- SIMD optimization (implies wasm) -->
<meta name="agentlet:capability" content="wasm:simd">

<!-- Multi-threading (implies wasm) -->
<meta name="agentlet:capability" content="wasm:threads">
```

**Capability Hierarchy:**

| Declared | Implies |
|----------|---------|
| `wasm` | — |
| `wasm:simd` | `wasm` |
| `wasm:threads` | `wasm` |

Declaring `wasm:simd` alone is sufficient — no separate `wasm` declaration needed.

### 2.2 Resource Limits

Wasm operations often require significant memory. Agents SHOULD declare limits explicitly:

```html
<!-- Memory limit (bytes) -->
<meta name="agentlet:limit" content="maxMemoryBytes:268435456">  <!-- 256MB -->

<!-- Storage limit for cached models -->
<meta name="agentlet:limit" content="maxStorageBytes:209715200">  <!-- 200MB -->
```

**Memory Guidelines:**

| Model Size | Recommended `maxMemoryBytes` |
|------------|------------------------------|
| < 50MB | 128MB (134217728) |
| 50-150MB | 256MB (268435456) |
| 150-500MB | 512MB (536870912) |
| 500MB+ | 1GB+ (specify explicitly) |

Rule of thumb: Budget 2-3x model size for runtime memory.

### 2.3 Wasm Asset Declaration (Optional)

Agents MAY declare Wasm assets for transparency and integrity verification:

```html
<!-- Bundled Wasm file -->
<meta name="agentlet:wasm" content="model.wasm"
      data-size="21000000"
      data-integrity="sha384-oqVuAfXRKap7fdgcCY...">

<!-- External Wasm URL -->
<meta name="agentlet:wasm" content="https://cdn.example.com/ort-wasm.wasm"
      data-size="21000000"
      data-integrity="sha384-...">
```

| Attribute | Required | Description |
|-----------|----------|-------------|
| `content` | Yes | Filename or URL |
| `data-size` | No | Size in bytes (for user transparency) |
| `data-integrity` | No | SRI hash for verification |

---

## 3. Bridge API

### 3.1 Feature Detection

The Wasm feature detection API is always available on `bridge.wasm`, regardless of whether the agent declared the capability. This allows agents to check support before attempting to use Wasm.

```typescript
interface BridgeWasm {
  /** Whether the host supports Wasm execution for agents */
  readonly supported: boolean;
  
  /** Available Wasm features: 'simd', 'threads' */
  readonly features: readonly string[];
  
  /** Check if a specific feature is available */
  hasFeature(feature: 'simd' | 'threads'): boolean;
}
```

**Usage:**

```javascript
// Check basic support
if (!bridge.wasm.supported) {
  await bridge.ui.notify('This agent requires WebAssembly support', 'error');
  return;
}

// Check specific features
if (bridge.wasm.hasFeature('simd')) {
  // Use SIMD-optimized code path
}

// List all features
console.log('Wasm features:', bridge.wasm.features);
// ['simd', 'threads']
```

### 3.2 No Load Helper

The bridge does NOT provide a Wasm loading helper. Agents load Wasm using standard Web APIs:

```javascript
// Standard WebAssembly API
const response = await fetch('model.wasm');
const module = await WebAssembly.compileStreaming(response);
const instance = await WebAssembly.instantiate(module, imports);

// Or via libraries like Transformers.js
const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.0');
const embedder = await pipeline('feature-extraction', 'Xenova/model', { device: 'wasm' });
```

**Rationale:** Different hosts may bundle different libraries. Keeping Wasm loading in agent code ensures portability and avoids spec bloat.

---

## 4. CSP Requirements

### 4.1 Host CSP Generation

When an agent declares `wasm`, `wasm:simd`, or `wasm:threads`, hosts MUST adjust the Content Security Policy to allow Wasm compilation:

```javascript
function buildCSP(capabilities) {
  const hasWasm = capabilities.some(c => 
    c === 'wasm' || c.startsWith('wasm:')
  );
  
  const scriptSrc = hasWasm
    ? "'unsafe-inline' blob: 'wasm-unsafe-eval'"
    : "'unsafe-inline' blob:";
  
  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    // ... other directives based on capabilities
  ].join('; ');
}
```

### 4.2 Security Properties

| Directive | Allows | Does NOT Allow |
|-----------|--------|----------------|
| `'wasm-unsafe-eval'` | `WebAssembly.compile()`, `WebAssembly.instantiate()` | `eval()`, `new Function()` |

The `'wasm-unsafe-eval'` directive is narrower than `'unsafe-eval'` and does not introduce JavaScript eval vulnerabilities.

---

## 5. Memory Limit Enforcement

### 5.1 Monitoring

Hosts SHOULD monitor agent memory usage using available APIs:

| API | Browser Support | Notes |
|-----|-----------------|-------|
| `performance.measureUserAgentSpecificMemory()` | Chrome 89+ | Most accurate, requires cross-origin isolation |
| `performance.memory` | Chrome | Deprecated but widely available |
| WebAssembly.Memory tracking | All | Track linear memory allocations |

### 5.2 Enforcement Behavior

When `maxMemoryBytes` is exceeded, hosts SHOULD:

1. Log a warning to the agent's activity log
2. Attempt to trigger garbage collection (if possible)
3. If still exceeded after a grace period (e.g., 5 seconds), terminate the agent with error `E1104`

**Note:** Precise cross-browser memory measurement is difficult. Hosts MAY implement best-effort enforcement and SHOULD document their approach.

---

## 6. Error Codes

New error codes for Wasm operations (E11xx range):

| Code | Name | Description |
|------|------|-------------|
| E1101 | WASM_NOT_SUPPORTED | Host doesn't support Wasm |
| E1102 | WASM_CAPABILITY_DENIED | Agent didn't declare `wasm` capability |
| E1103 | WASM_COMPILATION_FAILED | Wasm module compilation failed |
| E1104 | WASM_MEMORY_EXCEEDED | Memory limit exceeded |
| E1105 | WASM_SIMD_NOT_AVAILABLE | SIMD requested but not available |
| E1106 | WASM_THREADS_NOT_AVAILABLE | Threading requested but not available |

**Error Handling Example:**

```javascript
try {
  const module = await WebAssembly.compileStreaming(fetch('model.wasm'));
} catch (error) {
  if (error.code === 'E1102') {
    // Agent forgot to declare capability
    console.error('Add <meta name="agentlet:capability" content="wasm"> to manifest');
  } else if (error.code === 'E1104') {
    // Out of memory
    await bridge.ui.notify('Out of memory. Try a smaller model.', 'error');
  } else {
    throw error;
  }
}
```

---

## 7. Security Considerations

### 7.1 Sandbox Preservation

Wasm execution does NOT bypass sandbox restrictions:

| Restriction | Still Enforced? |
|-------------|-----------------|
| Network access limited to declared domains | ✅ Yes |
| Storage scoped to agent | ✅ Yes |
| No filesystem access beyond storage API | ✅ Yes |
| No access to host application internals | ✅ Yes |
| Iframe sandbox attributes | ✅ Yes |

### 7.2 Memory Safety

Wasm provides memory isolation:

- Wasm linear memory is separate from JavaScript heap
- Out-of-bounds memory access traps (doesn't corrupt JavaScript)
- Hosts enforce overall memory limits via `maxMemoryBytes`

### 7.3 Code Integrity

For high-security scenarios, agents SHOULD declare Wasm assets with integrity hashes:

```html
<meta name="agentlet:wasm" content="model.wasm"
      data-integrity="sha384-oqVuAfXRKap7fdgcCY...">
```

Hosts MAY verify integrity before allowing execution.

---

## 8. Future: WebGPU Acceleration

WebGPU provides GPU-accelerated computation, significantly faster than Wasm for large models. The capability hierarchy extends naturally:

```html
<meta name="agentlet:capability" content="wasm">        <!-- CPU baseline -->
<meta name="agentlet:capability" content="wasm:simd">   <!-- Vectorized CPU -->
<meta name="agentlet:capability" content="webgpu">      <!-- GPU accelerated -->
```

WebGPU support is **reserved for a future spec version** but follows the same pattern:

- Capability declaration in manifest
- Feature detection: `bridge.webgpu.supported`
- CSP adjustments (if required)

**Current recommendation:** Design agents for Wasm, enable WebGPU when available:

```javascript
const device = bridge.webgpu?.supported ? 'webgpu' : 'wasm';
const embedder = await pipeline('feature-extraction', model, { device });
```

---

## 9. Host Implementation Requirements

### 9.1 Minimum Requirements

Hosts supporting Wasm MUST:

| Requirement | Description |
|-------------|-------------|
| CSP adjustment | Add `'wasm-unsafe-eval'` when capability declared |
| Feature detection | Provide `bridge.wasm.supported`, `bridge.wasm.features`, `bridge.wasm.hasFeature()` |
| Error codes | Return appropriate E11xx errors |

### 9.2 Recommended Enhancements

Hosts MAY provide:

| Enhancement | Benefit |
|-------------|---------|
| Shared model cache | Avoid re-downloading models across agents |
| Worker infrastructure | Isolate Wasm execution from main thread |
| Bundled runtimes | Pre-install common libraries (ONNX Runtime) |
| Memory monitoring | Enforce `maxMemoryBytes` limits |

---

## 10. Additions to Main Spec

When this draft is finalized, add to SPEC.md:

### Section 9.1 Capability Categories

```markdown
| Category | Capabilities |
|----------|-------------|
| **Wasm** | `wasm`, `wasm:simd`, `wasm:threads` |
```

### Section 5.7 Resource Limits

```html
<meta name="agentlet:limit" content="maxMemoryBytes:268435456">
```

### Section 13.1 Error Codes

```markdown
| **E11xx** | **Wasm** | |
| E1101 | WASM_NOT_SUPPORTED | Host doesn't support Wasm |
| E1102 | WASM_CAPABILITY_DENIED | Agent didn't declare capability |
| E1103 | WASM_COMPILATION_FAILED | Compilation failed |
| E1104 | WASM_MEMORY_EXCEEDED | Memory limit exceeded |
| E1105 | WASM_SIMD_NOT_AVAILABLE | SIMD not available |
| E1106 | WASM_THREADS_NOT_AVAILABLE | Threading not available |
```

### Appendix B: Bridge API Quick Reference

```javascript
// Wasm (v0.5+)
bridge.wasm.supported             // boolean
bridge.wasm.features              // string[]
bridge.wasm.hasFeature(name)      // boolean
```

---

## Changelog

| Date | Change |
|------|--------|
| Dec 2025 | Initial draft |
| Dec 2025 | Removed `bridge.wasm.load()` helper |
| Dec 2025 | Added relationship to `inference:embedding` |
| Dec 2025 | Added WebGPU forward path |
| Dec 2025 | Added memory enforcement guidance |
