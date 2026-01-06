# VS Code Extension Improvements

Known limitations, testing needs, and planned enhancements.

## Current Limitations

### Context Adapter

| Feature | Status | Notes |
|---------|--------|-------|
| Selection context | Working | Returns selected text with file info |
| Active file | Working | Returns full file content |
| Workspace folders | Working | Returns folder paths |
| Diagnostics | Not implemented | Could expose errors/warnings |
| Git status | Not implemented | Could expose staged/modified files |
| Open editors | Not implemented | Could list all open tabs |

### Intent Handler

| Intent | Status | Notes |
|--------|--------|-------|
| `create` | Working | Creates files |
| `update` | Working | Modifies file content |
| `delete` | Working | Deletes files |
| `open` | Working | Opens file in editor |
| `replace-selection` | Working | Replaces selected text |
| `move-to` | Not implemented | |
| `copy-to` | Not implemented | |
| `search` | Not implemented | Could use workspace.findFiles |
| `git-commit` | Not implemented | Could use Git extension API |

### UI Adapter

| Feature | Status | Notes |
|---------|--------|-------|
| Notifications | Working | Non-blocking |
| Confirm dialog | Working | Modal with Yes/No |
| Input prompt | Working | Text input |
| Form | Working | Multi-step QuickPick |
| Select | Working | Single/multi select |
| Panel (WebView) | Working | HTML content |
| Activity progress | Working | Notification with progress |
| Output channel | Not implemented | Could log to dedicated channel |

### Inference Provider

| Provider | Status | Notes |
|----------|--------|-------|
| Ollama | Working | Local inference |
| OpenAI | Working | Cloud inference |
| Streaming | Not tested | API exists but untested |
| Tool calls | Not tested | API exists but untested |
| Anthropic | Not implemented | Could add Claude support |
| Local models | Not implemented | Could use Transformers.js |

## Testing Needs

### Phase 6: Testing with Example Agents

- [ ] `hello-world.agentlet` - Basic notification test
- [ ] `code-explainer.agentlet` - Inference + perceive + panel
- [ ] Test all three explanation modes (normal, detailed, beginner)
- [ ] Test with no selection (should show "No Selection")
- [ ] Test with Ollama provider
- [ ] Test with OpenAI provider

### Edge Cases to Test

- [ ] Agent panel closed during execution
- [ ] Multiple rapid action invocations
- [ ] Very large selection (>10KB)
- [ ] Binary file selection
- [ ] No workspace open
- [ ] Extension reload during action
- [ ] Network timeout during inference

### Automated Testing

Currently no automated tests. Consider adding:

1. **Unit tests** for manifest parser
2. **Unit tests** for permission computation
3. **Integration tests** for bridge message flow
4. **E2E tests** using VS Code extension testing framework

## Planned Enhancements

### High Priority

1. **Git context adapter**
   - Expose staged files, diff, status
   - Enable commit-message agents
   - Use VS Code Git extension API

2. **Diagnostics context**
   - Expose errors and warnings
   - Enable lint-fix agents
   - Use `vscode.languages.getDiagnostics()`

3. **Error handling improvements**
   - Better error messages for users
   - Error recovery strategies
   - Retry logic for transient failures

### Medium Priority

4. **Streaming inference UI**
   - Show tokens as they arrive
   - Progress indicator during generation

5. **Agent update mechanism**
   - Check for updates from source URL
   - Notify user of available updates

6. **Agent preferences UI**
   - Settings page for agent preferences
   - Persist preferences in storage

7. **Output channel logging**
   - Dedicated "Agentlet" output channel
   - Show agent activity logs
   - Debug mode toggle

### Low Priority

8. **Anthropic provider**
   - Add Claude API support
   - Configuration for API key

9. **Multi-workspace support**
   - Per-workspace agent storage option
   - Workspace-specific permissions

10. **Agent marketplace**
    - Browse and install from registry
    - Agent ratings and reviews

## Known Issues

### Fixed in Latest Build

- [x] `activityComplete` blocking - notifications awaited user dismissal
- [x] `notify` blocking - same issue
- [x] `activityError` blocking - same issue
- [x] Timeout not cleared - action timeout wasn't cancelled on success
- [x] Optional permissions ignored - only `requires` was processed
- [x] Local file installation - `file://` URLs not supported

### Open Issues

- [ ] WebView panel title shows "Agent: name" even for result panels
- [ ] No way to distinguish agent sandbox panel from result panels
- [ ] Sidebar doesn't auto-refresh after install from command palette
- [ ] No visual indication of running agent in sidebar

## Spec Feedback

Issues discovered during VS Code implementation that could improve the spec:

### 1. Notification Blocking Semantics

**Issue:** Should `ui.notify()` block until dismissed or return immediately?

**Recommendation:** Spec should clarify that notifications are fire-and-forget. If blocking behavior is needed, use `ui.confirm()`.

### 2. Panel vs Sandbox Distinction

**Issue:** Both agent execution and result display use WebView panels, causing confusion.

**Recommendation:** Add guidance that sandbox panels should be hidden/background, while result panels are visible.

### 3. Permission Inheritance

**Issue:** When an agent declares `perceive`, what specific permissions does that grant?

**Recommendation:** Document that `perceive` implies `context:file:read` and `context:selection`.

### 4. Error Code Usage

**Issue:** When to use E801 (host error) vs E101 (permission denied)?

**Recommendation:** Clearer guidance on error code selection for common scenarios.

## Performance Considerations

### Current Performance

- Sandbox creation: ~100-200ms
- Bridge initialization: ~100ms
- Ollama inference: 1-10s depending on model
- OpenAI inference: 0.5-3s depending on model

### Optimization Opportunities

1. **Sandbox pooling** - Reuse sandboxes for same agent
2. **Lazy loading** - Don't load agent HTML until needed
3. **Inference caching** - Cache identical requests
4. **Parallel initialization** - Create sandbox while fetching agent

## Security Considerations

### Current Security Model

- Sandboxed WebView with CSP
- Permission-gated API access
- No direct file system access from agent
- Network restricted to declared domains

### Potential Improvements

1. **Audit logging** - Log all bridge calls for review
2. **Permission revocation** - Allow revoking specific permissions
3. **Resource limits** - Enforce max inference calls, storage size
4. **Code signing** - Verify agent integrity (spec v0.2 feature)

## Contributing

When adding new features:

1. Update `IMPLEMENTATION.md` with architecture details
2. Add debug logging with `[Agentlet]` prefix
3. Handle errors gracefully with user-friendly messages
4. Test with example agents before merging
5. Update `IMPROVEMENTS.md` to mark completed items
