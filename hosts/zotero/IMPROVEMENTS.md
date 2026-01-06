# ZotAgentlet Improvements & Spec Feedback

Based on implementing the Agentlet v0.4 spec in Zotero, here are the identified improvements, documentation needs, and spec recommendations.

---

## 1. What Could Be Made Better

### 1.1 Security Improvements

**Current State:**
- Sandbox requires `allow-same-origin` + `allow-scripts` for postMessage to work
- This combination reduces sandbox security (iframe can access parent DOM)

**Improvements:**
- [ ] Use a unique sandbox ID in all messages instead of relying on source matching
- [ ] Implement a MessageChannel for more secure bidirectional communication
- [ ] Add CSP `frame-ancestors` to prevent clickjacking
- [ ] Consider using a Web Worker instead of iframe for pure computation tasks

**Security Note for Spec:**
The spec's security model (Section 11.1) states `sandbox="allow-scripts"` prevents DOM access, but this doesn't work for `postMessage` communication. Real implementations need `allow-same-origin` which significantly weakens the sandbox.

### 1.2 Agent Loading

**Current State:**
- Agent code is fetched from URL and inlined via blob URL
- This was necessary because dynamic `import()` doesn't work in sandboxed iframes

**Improvements:**
- [ ] Cache agent code locally after first fetch
- [ ] Add integrity checking (SHA hash) for agent code
- [ ] Support versioned agent URLs for cache busting
- [ ] Add agent update checking mechanism

### 1.3 Error Handling & UX

**Current State:**
- Errors show raw JavaScript alerts
- Activity panel is basic (just a progress window)
- ✅ Panel UI implemented (floating windows via `bridge.ui.panel()`)

**Improvements:**
- [ ] Create proper error dialog with details and retry option
- [ ] Richer activity panel with:
  - Log history
  - Expandable steps
  - Estimated time remaining
  - Cancel button
- [ ] Better timeout feedback (what operation timed out)
- [ ] Agent crash recovery (restart sandbox, resume if possible)

### 1.4 Agent Management

**Improvements:**
- [ ] Update mechanism (check source URL for newer version)
- [ ] Enable/disable agents without uninstalling
- [ ] Agent marketplace/registry browser
- [ ] Import/export agent configurations
- [ ] Agent grouping/categories

### 1.5 Performance

**Improvements:**
- [ ] Lazy load agents (don't load all at startup)
- [ ] Cache agent code in SQLite
- [ ] Support parallel agent execution
- [ ] Warm sandbox pool for faster action execution

### 1.6 Developer Experience

**Improvements:**
- [ ] Debug mode with verbose logging
- [ ] "Development" agent install (auto-reload on file change)
- [ ] Agent console/REPL for testing bridge methods
- [ ] Agent template generator
- [ ] Type definitions for agent development

---

## 2. What Needs Documentation

### 2.1 For Users

| Topic | Status | Notes |
|-------|--------|-------|
| Installation guide | Needed | How to install ZotAgentlet XPI |
| Agent installation | Needed | How to add agents from URLs |
| Permission explanations | Needed | What each permission means |
| Troubleshooting | Needed | Common issues and solutions |
| Security considerations | Needed | What agents can/can't do |

### 2.2 For Agent Developers

| Topic | Status | Notes |
|-------|--------|-------|
| Quick start | Needed | Hello world agent |
| Manifest reference | Partial | Spec has it, but needs Zotero-specific info |
| Bridge API reference | Partial | Spec has it, implementation may differ |
| Context types | Needed | Zotero-specific: bibliographic, collection, etc. |
| Best practices | Needed | Error handling, progress, cancellation |
| Testing guide | Needed | How to test agents locally |

### 2.3 For Plugin Developers

| Topic | Status | Notes |
|-------|--------|-------|
| Architecture overview | Partial | Plan file has some, needs expansion |
| Module reference | Needed | What each module does |
| Adding context types | Needed | How to add new context adapters |
| Security model | Needed | Detailed explanation of sandbox |

---

## 3. Spec Improvement Recommendations

### 3.1 Sandbox Communication (Critical)

**Issue:** The spec doesn't address how sandbox communication works with `srcdoc` iframes.

**Problem Found:**
- `postMessage` with `sandbox="allow-scripts"` only fails silently
- `event.source` matching doesn't work reliably with `srcdoc`
- Dynamic `import()` from external URLs is blocked by null origin

**Recommendation for Spec Section 11.1:**

```markdown
### 11.1.1 Sandbox Communication

Hosts MUST implement sandbox communication via `postMessage`. Due to browser
security restrictions:

1. **Sandbox Attributes**: Use `sandbox="allow-scripts allow-same-origin"`
   - `allow-same-origin` is required for postMessage to work
   - This means the iframe CAN access parent DOM
   - Additional protections via CSP are critical

2. **Agent Loading**: Hosts SHOULD NOT use dynamic `import()` from external URLs.
   Instead:
   - Fetch agent code from the source URL
   - Create a blob URL from the fetched code
   - Import from the blob URL within the sandbox

3. **Message Identification**: Include a unique sandbox ID in all messages:
   ```javascript
   { sandboxId: 'unique-id', type: 'ready', ... }
   ```
   This allows hosts to identify messages from specific sandboxes.
```

### 3.2 Agent Loading Mechanism

**Issue:** Spec assumes agents can be loaded via `import()` from URLs.

**Recommendation:** Add new section:

```markdown
### Agent Loading

Hosts load agents in the following sequence:

1. **Fetch Phase**: Host fetches `agent.js` from the agent URL
   - Validate response content-type
   - Check for integrity if provided in manifest

2. **Injection Phase**: Host inlines the code into the sandbox
   - Via blob URL: `new Blob([code], {type: 'text/javascript'})`
   - Or via inline script (if CSP allows)

3. **Initialization Phase**: Sandbox signals ready
   - Agent exports are captured
   - Host sends `init` message with host info
   - Agent calls lifecycle hooks
```

### 3.3 Error Codes Expansion

**Issue:** Some error scenarios aren't covered.

**Recommendation:** Add error codes:

```javascript
// Sandbox errors (9xx)
SANDBOX_LOAD_FAILED: { code: 'E901', message: 'Failed to load agent code' },
SANDBOX_TIMEOUT: { code: 'E902', message: 'Sandbox initialization timeout' },
SANDBOX_COMMUNICATION_FAILED: { code: 'E903', message: 'Failed to communicate with sandbox' },
```

### 3.4 Network Capability Clarification

**Issue:** Network permission only specifies domains, not protocols.

**Recommendation:** Clarify in spec:

```markdown
### Network Capability

The `capabilities.network` array lists allowed domains:

```json
"network": ["api.crossref.org", "localhost:8888"]
```

Rules:
- HTTPS is always allowed for listed domains
- HTTP is allowed only for `localhost` and local IPs (development)
- Wildcard subdomains: `"*.example.com"` allows all subdomains
- Port specification: `"api.example.com:8080"` restricts to specific port
```

### 3.5 Manifest Validation

**Issue:** No formal schema for manifest validation.

**Recommendation:** Add JSON Schema to spec appendix:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["manifest_version", "name", "version", "capabilities", "actions"],
  "properties": {
    "manifest_version": { "type": "string", "pattern": "^0\\.[0-9]+$" },
    "name": { "type": "string", "minLength": 1, "maxLength": 50 },
    "version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$" },
    ...
  }
}
```

### 3.6 Activity API Enhancement

**Issue:** Current activity API is flat; complex workflows need hierarchy.

**Recommendation:**

```javascript
// Nested activities
const mainActivity = await bridge.activity.start("Processing items");
const subActivity = await mainActivity.child("Fetching metadata");
await subActivity.progress(1, 10);
await subActivity.complete("Done");
// mainActivity continues
```

### 3.7 Host-Specific Extensions

**Issue:** Hosts may want to provide additional APIs beyond the core spec.

**Recommendation:** Add section:

```markdown
### Host Extensions

Hosts MAY provide additional bridge methods under a namespaced key:

```javascript
// Zotero-specific extensions
bridge.host.zotero.getLibraries()
bridge.host.zotero.openItem(id)

// Obsidian-specific extensions
bridge.host.obsidian.getVault()
bridge.host.obsidian.createNote(content)
```

Extensions:
- MUST be namespaced under `bridge.host.<hostname>`
- SHOULD be documented by the host
- MUST NOT conflict with core bridge methods
- Agents SHOULD feature-detect before using
```

---

## 4. Implementation-Specific Issues Found

### 4.1 Zotero-Specific

| Issue | Solution |
|-------|----------|
| `console` not available | Use `Zotero.debug()` instead |
| MenuManager requires l10nID | Use XUL injection for menus |
| Window not available in module scope | Use `Zotero.getMainWindow()` |
| Plugin caching | Use `-purgecaches` flag during development |

### 4.2 Bridge Message Handling

| Issue | Solution |
|-------|----------|
| Messages from srcdoc not matching source | Accept messages by type signature |
| Multiple handlers per sandbox | Use handler array, not single handler |
| Ready timeout | Increase timeout, add retry logic |

---

## 5. Recommended Priority

### High Priority (Should be done)
1. Fix message identification (use sandbox ID)
2. Add agent code caching
3. Document Zotero-specific context types
4. Create agent development guide

### Medium Priority (Nice to have)
1. Agent update mechanism
2. Better activity panel UI
3. Debug mode for development
4. Agent enable/disable

### Low Priority (Future)
1. Agent marketplace
2. Parallel execution
3. Hot reload for development
4. Agent REPL/console

---

## 6. Files to Update

| File | Changes Needed |
|------|----------------|
| `SPEC.md` | Add sandbox communication, agent loading, error codes |
| `hosts/zotero/README.md` | Create user documentation |
| `hosts/zotero/AGENT_DEVELOPMENT.md` | Create agent dev guide |
| `hosts/zotero/src/modules/iframe-sandbox.ts` | Add sandbox ID to messages |
| `hosts/zotero/src/modules/agent-manager.ts` | Add code caching |
