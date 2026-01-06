# Contributing to Agentlet

Thank you for your interest in contributing to Agentlet! We're building an open standard for portable AI agents, and community input is essential to getting it right.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Workflow](#contribution-workflow)
- [Spec Changes (RFCs)](#spec-changes-rfcs)
- [Style Guidelines](#style-guidelines)
- [Community](#community)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming, inclusive, and harassment-free environment.

**In short:** Be kind, be respectful, assume good intent.

---

## How Can I Contribute?

### 🐛 Report Bugs

Found something broken? [Open an issue](../../issues/new?template=bug_report.md) with:

- Clear title describing the problem
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (host app, browser, OS)

### 💡 Suggest Features

Have an idea? [Start a discussion](../../discussions/new?category=ideas) first to gauge interest before opening a formal issue.

Good feature requests include:
- The problem you're trying to solve
- Your proposed solution
- Alternative approaches you considered
- Impact on existing agents/hosts

### 📖 Improve Documentation

Documentation improvements are always welcome:

- Fix typos, clarify confusing sections
- Add examples
- Translate to other languages
- Write tutorials or blog posts

### 🔧 Contribute Code

We accept contributions to:

- **Reference runtime** — The core execution environment
- **Host adapters** — Integrations with Zotero, Obsidian, VS Code, etc.
- **Example agents** — Demonstrate spec capabilities
- **Tooling** — CLI tools, validators, dev utilities

### 🧪 Test & Review

- Try the spec in new environments
- Security review
- Performance testing
- Review open PRs

---

## Getting Started

### 1. Understand the Project

Read these first:

| Document | Purpose |
|----------|---------|
| [README.md](./README.md) | Project overview |
| [SPEC.md](./SPEC.md) | Full specification |
| [ROADMAP.md](./ROADMAP.md) | Where we're headed |

### 2. Find Something to Work On

- **Good first issues:** [labeled `good-first-issue`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
- **Help wanted:** [labeled `help-wanted`](../../issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22)
- **Discussions:** [open discussions](../../discussions) may have items needing volunteers

### 3. Claim the Issue

Comment on the issue to let others know you're working on it. If there's no response from maintainers within 48 hours, feel free to start anyway.

---

## Development Setup

### Prerequisites

- Node.js 18+ (for tooling)
- A modern browser (for testing)
- Git

### Clone & Install

```bash
git clone https://github.com/Agentlet-org/agentlet.git
cd agentlet
npm install
```

### Project Structure

```
agentlet/
├── SPEC.md                 # The specification
├── ROADMAP.md              # Version roadmap
├── packages/host-sdk/      # Shared SDK for host implementations
├── hosts/                  # Host implementations (VS Code, Zotero, Obsidian)
├── examples/               # Example agents by portability type
│   ├── adaptive/           # AI-powered portable agents
│   ├── universal/          # Static portable agents
│   ├── host-family/        # Similar-host agents
│   └── host-specific/      # Single-host agents
├── docs/                   # Additional documentation
└── tests/                  # Test suites
```

### Running Tests

```bash
npm test                    # Run all tests
npm run test:spec           # Spec compliance tests
npm run test:runtime        # Runtime unit tests
npm run test:e2e            # End-to-end tests
```

### Building

```bash
npm run build               # Build all packages
npm run build:runtime       # Build runtime only
```

---

## Contribution Workflow

### For Small Changes (Typos, Bug Fixes)

1. Fork the repository
2. Create a branch: `git checkout -b fix/typo-in-readme`
3. Make your changes
4. Commit with a clear message: `git commit -m "Fix typo in README"`
5. Push: `git push origin fix/typo-in-readme`
6. Open a Pull Request

### For Larger Changes

1. **Discuss first** — Open an issue or discussion
2. **Get alignment** — Wait for maintainer feedback
3. **Fork & branch** — Use descriptive branch names
4. **Implement** — Write code, tests, and docs
5. **Self-review** — Check your own PR before requesting review
6. **Open PR** — Reference the issue, explain your approach
7. **Iterate** — Respond to feedback, make requested changes
8. **Merge** — Maintainer merges when approved

### Branch Naming

```
feat/agent-discovery        # New feature
fix/bridge-timeout          # Bug fix
docs/improve-examples       # Documentation
refactor/sandbox-cleanup    # Code refactoring
test/add-mcp-tests          # Test additions
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add agent discovery API
fix: resolve race condition in bridge initialization
docs: add example for MCP integration
test: add tests for capability delegation
refactor: simplify manifest parsing
chore: update dependencies
```

---

## Spec Changes (RFCs)

Changes to SPEC.md require a more formal process:

### When Is an RFC Needed?

- New manifest tags
- New bridge APIs
- Changes to existing behavior
- New capabilities or permissions
- Anything that affects compatibility

### RFC Process

1. **Start a Discussion**
   - Category: "RFC"
   - Title: `[RFC] Your Proposal Title`
   - Include: Problem, proposed solution, alternatives, impact

2. **Gather Feedback** (minimum 2 weeks)
   - Respond to questions and concerns
   - Iterate on the proposal
   - Build consensus

3. **Formal Proposal**
   - Create a PR adding your changes to SPEC.md
   - Include implementation (if applicable)
   - Reference the discussion

4. **Review Period** (minimum 1 week)
   - Maintainers review
   - Community can raise objections
   - Final changes made

5. **Decision**
   - Maintainers make final call
   - Merge or close with explanation

### RFC Template

```markdown
# RFC: [Title]

## Summary
One paragraph explanation.

## Motivation
Why are we doing this? What problem does it solve?

## Detailed Design
Technical details of the proposal.

### Manifest Changes
```html
<meta name="agentlet:new-thing" content="...">
```

### Bridge API Changes
```javascript
await bridge.newThing();
```

## Alternatives Considered
What else could we do?

## Migration Path
How do existing agents/hosts upgrade?

## Unresolved Questions
What needs more discussion?
```

---

## Style Guidelines

### Specification (SPEC.md)

- Use clear, unambiguous language
- Include code examples for every feature
- Use tables for reference information
- Mark requirements with MUST, SHOULD, MAY (per RFC 2119)

### Code

- **JavaScript:** Follow [Standard JS](https://standardjs.com/) style
- **HTML:** 2-space indentation, lowercase tags
- **Comments:** Explain "why," not "what"
- **Tests:** Every feature needs tests

### Documentation

- Use Markdown
- One sentence per line (for better diffs)
- Include working code examples
- Keep paragraphs short

### Agent Examples

- Keep examples minimal but complete
- Comment non-obvious parts
- Test that examples actually work
- Include browser preview (`<noscript>`)

---

## Review Criteria

PRs are evaluated on:

| Criterion | What We Look For |
|-----------|------------------|
| **Correctness** | Does it work? Does it match the spec? |
| **Completeness** | Tests? Docs? Migration notes? |
| **Compatibility** | Does it break existing agents/hosts? |
| **Clarity** | Is the code readable? Is the intent clear? |
| **Scope** | Is it focused? Does it do one thing well? |

---

## Community

### Getting Help

- **Questions:** [GitHub Discussions](../../discussions)
- **Real-time chat:** [Discord/Slack] (if available)
- **Security issues:** Email security@agentlet.org (do not open public issues)

### Recognition

Contributors are recognized in:

- CHANGELOG.md for each release
- Annual contributor acknowledgments
- Special recognition for significant contributions

### Maintainers

Current maintainers:

| Name | Role | Links |
|------|------|-------|
| José Fernandes | Lead | [GitHub](https://github.com/introfini) · [ResearchGate](https://www.researchgate.net/profile/Jose-Fernandes-46) |

Want to become a maintainer? Sustained, quality contributions over time are the path.

---

## Legal

### License

Contributions are licensed under the same license as the project (see [LICENSE](./LICENSE)).

### DCO (Developer Certificate of Origin)

By contributing, you certify that:

- You have the right to submit the contribution
- You're submitting under the project's license
- You understand contributions are public and permanent

We may require a formal DCO sign-off for larger contributions:

```
Signed-off-by: Your Name <your.email@example.com>
```

---

## Thank You!

Every contribution matters — whether it's a typo fix, a bug report, or a major feature. We're building something that could change how AI agents work, and we're glad you're here.

Questions? Open a discussion or reach out to the maintainers.

Happy contributing! 🚀
