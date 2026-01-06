# Agentlet Registry & Marketplace: Vision & Master Plan

**Document:** Strategic Plan  
**Status:** Draft  
**Date:** January 2026  
**Domain:** agentlet.ai

---

## Executive Summary

**agentlet.ai** is the official Agentlet Registry & Marketplace — the central hub for distributing and discovering portable AI agents.

It serves two functions:

| Layer | Purpose | Audience |
|-------|---------|----------|
| **Registry** | Host files, version, API access | Hosts, CLI tools, automation |
| **Marketplace** | Browse, review, purchase | End users, developers |

The registry is the foundation. The marketplace is a user-friendly interface built on top.

---

## Vision

> **"The npm for AI agents — with an App Store face."**

### Core Principles

| Principle | Meaning |
|-----------|---------|
| **Open** | Anyone can publish; no gatekeeping |
| **Portable** | Agents work anywhere, not locked to us |
| **Hosted** | We serve files — reliable, fast, permanent |
| **Trust-forward** | Clear signals about safety and quality |
| **Developer-first** | Great API, CLI, automation |
| **Sustainable** | Business model that funds ongoing development |

### What We're NOT

| Anti-pattern | Why Not |
|--------------|---------|
| Index only | Broken links, unreliable — we host files |
| Walled garden | Agents remain portable |
| 30% tax | Kills ecosystem before it starts |
| Manual review queue | Doesn't scale |

---

## Architecture: Two Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         agentlet.ai                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    MARKETPLACE LAYER                              │  │
│  │                    (User-Facing)                                  │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  • Web UI (browse, search, filter)                                │  │
│  │  • Agent detail pages                                             │  │
│  │  • Publisher profiles                                             │  │
│  │  • Ratings & reviews                                              │  │
│  │  • Curated collections                                            │  │
│  │  • Payments & licensing (future)                                  │  │
│  │  • Analytics dashboard                                            │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              │                                          │
│                              ▼                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                     REGISTRY LAYER                                │  │
│  │                     (Technical Foundation)                        │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  • File hosting (CDN-backed)                                      │  │
│  │  • Metadata database                                              │  │
│  │  • Version history                                                │  │
│  │  • REST API                                                       │  │
│  │  • Signature verification                                         │  │
│  │  • Automated security scanning                                    │  │
│  │  • Webhook notifications                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Concern | Registry | Marketplace |
|---------|----------|-------------|
| **Store files** | ✓ | — |
| **Serve downloads** | ✓ | — |
| **Version management** | ✓ | — |
| **API access** | ✓ | — |
| **Signature verification** | ✓ | — |
| **Search UI** | — | ✓ |
| **Browse/filter** | — | ✓ |
| **Reviews & ratings** | — | ✓ |
| **Publisher profiles** | — | ✓ |
| **Payments** | — | ✓ |
| **Collections/curation** | — | ✓ |

---

## Why Host Files (Not Just Index)

We host agent files directly, not just index URLs to external sources.

| Factor | Index Only | Host Files | Winner |
|--------|------------|------------|--------|
| **Reliability** | Author's server can go down | Always available | **Host** |
| **Broken links** | Common (authors abandon) | Never | **Host** |
| **Speed** | Variable latency | CDN-fast globally | **Host** |
| **Integrity** | Can't guarantee | Serve what we verified | **Host** |
| **No-server authors** | Can't easily publish | Upload directly | **Host** |
| **Version history** | Lost if author deletes | Preserved forever | **Host** |
| **Auditability** | Can't scan external | Scan on upload | **Host** |

### Storage is Negligible

| Scale | Agents | Avg Size | Total | Cost/month |
|-------|--------|----------|-------|------------|
| Launch | 100 | 50KB | 5 MB | ~$0 |
| Year 1 | 1,000 | 50KB | 50 MB | ~$0 |
| Year 3 | 10,000 | 50KB | 500 MB | ~$0.01 |
| Massive | 100,000 | 100KB | 10 GB | ~$0.23 |

Agents are tiny HTML files. Hosting them is essentially free.

### Source Verification (Optional)

Authors can optionally link to their source repository. We verify the hosted file matches:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ Author      │────▶│ agentlet.ai  │────▶│ Users       │
│ uploads     │     │ hosts file   │     │ download    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────┐     ┌──────────────┐
│ GitHub repo │◀───▶│ Hash match?  │
│ (optional)  │     │ (integrity)  │
└─────────────┘     └──────────────┘
```

---

## Ecosystem Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENTLET ECOSYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   agentlet.org                          agentlet.ai                     │
│   ────────────                          ───────────                     │
│   • Specification                       • Registry (files + API)        │
│   • Documentation                       • Marketplace (browse + buy)    │
│   • Reference implementations           • Publisher profiles            │
│   • Governance (RFCs, decisions)        • Analytics dashboard           │
│   • Developer guides                    • Trust & safety                │
│                                                                         │
│   Audience: Implementers                Audience: Users & Developers    │
│   Content: Technical                    Content: Discovery & Commerce   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   github.com/Agentlet-org               npm: @agentlet/*                │
│   ────────────────────────              ────────────────                │
│   • Source code                         • host-sdk                      │
│   • Issues & discussions                • cli (publish, validate)       │
│   • Host implementations                • testing                       │
│   • Example agents                                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### URL Structure

```
# Specification (agentlet.org)
agentlet.org/                      → Spec home
agentlet.org/spec/                 → Current specification
agentlet.org/docs/                 → Developer documentation
agentlet.org/hosts/                → Host implementation guide
agentlet.org/governance/           → RFCs, decisions

# Registry & Marketplace (agentlet.ai)
agentlet.ai/                       → Marketplace home (browse)
agentlet.ai/agents/                → Browse all agents
agentlet.ai/agents/smart-tagger    → Agent detail page
agentlet.ai/categories/research    → Category browse
agentlet.ai/publishers/jose        → Publisher profile
agentlet.ai/dashboard/             → Developer dashboard (auth)

# Registry API & Downloads
agentlet.ai/api/v1/agents          → REST API
agentlet.ai/dl/smart-tagger.agentlet           → Download (latest)
agentlet.ai/dl/smart-tagger@1.2.0.agentlet     → Download (specific version)
```

---

## User Journeys

### Journey 1: User Finds & Installs an Agent

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Problem │───▶│ Search/Browse│───▶│ Agent Page  │───▶│ Install  │
│         │    │ Marketplace  │    │ Trust check │    │ in Host  │
└─────────┘    └──────────────┘    └─────────────┘    └──────────┘
                     │                                      │
                     ▼                                      ▼
              ┌──────────────┐                       ┌──────────┐
              │ Host's       │                       │ Registry │
              │ embedded UI  │                       │ serves   │
              │ (API-powered)│                       │ file     │
              └──────────────┘                       └──────────┘
```

### Journey 2: Developer Publishes an Agent

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Build   │───▶│ Validate     │───▶│ Sign        │───▶│ Upload   │
│ .agentlet│   │ agentlet lint│    │ agentlet sign   │ agentlet publish
└─────────┘    └──────────────┘    └─────────────┘    └──────────┘
                                                            │
                                                            ▼
                                                      ┌──────────┐
                                                      │ Registry │
                                                      │ hosts it │
                                                      └──────────┘
```

### Journey 3: Host Integrates Registry

```
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│ Host    │───▶│ Registry API │───▶│ Show in     │───▶│ Download │
│ App     │    │ GET /agents  │    │ Host UI     │    │ from CDN │
└─────────┘    └──────────────┘    └─────────────┘    └──────────┘
```

---

## Feature Roadmap

### Phase 1: Registry MVP (Q2 2026)

Launch with spec v0.4 (requires identity for signatures).

**Registry Layer:**

| Feature | Description |
|---------|-------------|
| **File hosting** | Upload and serve .agentlet files |
| **CDN distribution** | Fast global downloads |
| **Version management** | Multiple versions per agent |
| **REST API** | Search, get, download programmatically |
| **Signature verification** | Verify on upload |
| **Automated scanning** | Basic security checks |

**Marketplace Layer:**

| Feature | Description |
|---------|-------------|
| **Search** | Full-text on name, description, tags |
| **Browse** | Categories, host filtering, portability type |
| **Agent pages** | Details, install button, README |
| **Publisher profiles** | Name, bio, list of agents |

**What's NOT in MVP:**
- Payments
- Reviews/ratings
- Verified badges
- Analytics dashboard

### Phase 2: Trust (Q3 2026)

**Registry Layer:**

| Feature | Description |
|---------|-------------|
| **Install tracking** | Count downloads (anonymized) |
| **Webhook notifications** | Notify hosts of updates |
| **Enhanced scanning** | Deeper security analysis |

**Marketplace Layer:**

| Feature | Description |
|---------|-------------|
| **Verified publishers** | Domain/GitHub verification |
| **Ratings & reviews** | 1-5 stars + text |
| **Trust badges** | "Verified", "Popular", "Audited" |
| **Report abuse** | Flag malicious agents |
| **Install counts** | Public popularity metrics |

### Phase 3: Developer Experience (Q3-Q4 2026)

**Registry Layer:**

| Feature | Description |
|---------|-------------|
| **CLI publishing** | `agentlet publish` command |
| **CI/CD integration** | GitHub Actions workflow |
| **API tokens** | Scoped access for automation |

**Marketplace Layer:**

| Feature | Description |
|---------|-------------|
| **Analytics dashboard** | Downloads, ratings, errors |
| **Version analytics** | Adoption curves |
| **Collections** | Curated groups |
| **A/B descriptions** | Test listing copy |

### Phase 4: Economy (Q4 2026+)

**Registry Layer:**

| Feature | Description |
|---------|-------------|
| **License enforcement** | Check entitlement before download |
| **Usage metering** | Track for pay-per-use |

**Marketplace Layer:**

| Feature | Description |
|---------|-------------|
| **Paid agents** | One-time or subscription |
| **Revenue sharing** | 85/15 split (developer/platform) |
| **Free trials** | Try before buying |
| **Team licenses** | Enterprise purchasing |
| **Sponsorships** | Support open source agents |

### Phase 5: Platform (2027+)

| Feature | Description |
|---------|-------------|
| **Agent bundles** | Install packs |
| **Workflows** | Pre-configured agent chains |
| **Enterprise portal** | Admin controls, approved lists |
| **White-label registry** | Hosts run their own |
| **Federated sync** | Connect multiple registries |

---

## Registry API

### Endpoints

```yaml
# Discovery
GET  /api/v1/agents                    # List/search agents
GET  /api/v1/agents/:slug              # Get agent metadata
GET  /api/v1/agents/:slug/versions     # List versions
GET  /api/v1/agents/:slug/readme       # Get README content

# Downloads (no API prefix — direct CDN)
GET  /dl/:slug.agentlet                # Latest version
GET  /dl/:slug@:version.agentlet       # Specific version

# Publishing (auth required)
POST /api/v1/agents                    # Create new agent
PUT  /api/v1/agents/:slug              # Update metadata
POST /api/v1/agents/:slug/versions     # Upload new version

# Reviews (auth required)
GET  /api/v1/agents/:slug/reviews      # List reviews
POST /api/v1/agents/:slug/reviews      # Submit review

# Publishers
GET  /api/v1/publishers/:slug          # Get publisher profile
GET  /api/v1/publishers/:slug/agents   # Publisher's agents

# Categories
GET  /api/v1/categories                # List categories
GET  /api/v1/categories/:slug/agents   # Agents in category

# Search parameters
?q=citation                            # Full-text search
?category=research                     # Filter by category
?host=zotero                           # Filter by host compatibility
?portability=adaptive                  # Filter by portability type
?minRating=4                           # Minimum rating
?sort=popular|recent|rating            # Sort order
?limit=20&offset=0                     # Pagination
```

### Download URLs

```
# Latest version
https://agentlet.ai/dl/smart-tagger.agentlet

# Specific version  
https://agentlet.ai/dl/smart-tagger@1.2.0.agentlet

# Integrity check (returns hash)
https://agentlet.ai/api/v1/agents/smart-tagger/versions/1.2.0/integrity
→ { "sha256": "abc123...", "signature": "..." }
```

---

## Data Model

```sql
-- Publishers (developers)
CREATE TABLE publishers (
  id UUID PRIMARY KEY,
  did TEXT UNIQUE,                     -- did:key:... or did:web:...
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  website TEXT,
  github TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (metadata)
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  publisher_id UUID REFERENCES publishers,
  did TEXT UNIQUE,                     -- did:agentlet:...
  slug TEXT UNIQUE NOT NULL,           -- URL identifier
  name TEXT NOT NULL,                  -- From manifest (agentlet:name)
  display_name TEXT NOT NULL,          -- From <title>
  description TEXT,
  current_version TEXT NOT NULL,
  portability TEXT NOT NULL,           -- universal, adaptive, etc.
  categories TEXT[],
  tags TEXT[],
  hosts TEXT[],                        -- Compatible hosts
  capabilities TEXT[],                 -- Required capabilities
  license TEXT,
  homepage TEXT,
  repository TEXT,                     -- Source repo (optional)
  download_count INTEGER DEFAULT 0,
  rating_avg DECIMAL(2,1),
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Versions (files)
CREATE TABLE agent_versions (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents,
  version TEXT NOT NULL,
  file_path TEXT NOT NULL,             -- S3/CDN path
  file_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,                -- Integrity hash
  signature TEXT,                      -- Author signature
  changelog TEXT,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, version)
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents,
  publisher_id UUID REFERENCES publishers,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, publisher_id)
);

-- Download tracking (anonymized)
CREATE TABLE downloads (
  id UUID PRIMARY KEY,
  agent_id UUID REFERENCES agents,
  version TEXT NOT NULL,
  host TEXT,                           -- Which host requested
  country TEXT,                        -- Geographic distribution
  downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Full-text search
CREATE INDEX agents_search_idx ON agents 
  USING GIN (to_tsvector('english', display_name || ' ' || COALESCE(description, '')));
```

---

## Trust & Safety

### Trust Signals

| Signal | Source | Meaning |
|--------|--------|---------|
| **Verified Author** | Domain/GitHub | Author is who they claim |
| **Signed** | Cryptographic | Code hasn't been tampered |
| **Audited** | Third-party | Security reviewed |
| **Popular** | Download threshold | Many users trust it |
| **Highly Rated** | Rating threshold | Users like it |
| **Open Source** | License + repo link | Code is inspectable |

### Automated Checks (on upload)

| Check | Action |
|-------|--------|
| Manifest valid | Block if invalid |
| Signature valid | Block if doesn't verify |
| Known malware patterns | Block + flag |
| Capabilities match code | Warn if mismatch |
| File size reasonable | Block if > 5MB |

### Abuse Response

| Severity | Response | Action |
|----------|----------|--------|
| Critical (malware) | < 1 hour | Remove, notify hosts |
| High (data exfil) | < 24 hours | Remove, investigate |
| Medium (misleading) | < 72 hours | Warning or remove |
| Low (spam) | < 1 week | Remove |

---

## Business Model

### Phase 1-2: Free

**Goal:** Adoption. Become the default registry.

| Service | Cost |
|---------|------|
| Hosting | Free |
| API access | Free (rate limited) |
| Publishing | Free |

### Phase 3+: Sustainable

| Revenue | Model |
|---------|-------|
| **Paid agents** | 15% platform fee |
| **Featured listings** | Paid promotion |
| **Enterprise** | Private registries, SSO |
| **Support** | Priority support contracts |

### Why 15% (not 30%)?

- Open standard — can't justify gatekeeper tax
- Self-hosting always possible
- Attract developers from other ecosystems
- Build goodwill

---

## Integration with Spec Roadmap

### Dependencies

```
GAP-01 (Versioning)     ──┐
  + Capability           │
    Negotiation          ├──▶ Registry MVP (Q2 2026)
    (see drafts/         │      • Capability levels for compatibility scoring
     capability-         │      • Primitive levels: perceive, act, inference
     negotiation.md)     │      • Two-sided: requires + provides
                          │
GAP-02 (Identity)       ──┤      • Signatures require identity
    (see drafts/         │      • Verified publishers
     gap-02-identity-    │      • Trust scoring (0-100)
     trust.md)           │      • Attestations
                          │
GAP-04 (CLI Tools)      ──┘      • `agentlet publish` command

GAP-07 (Registry)       ──────▶ This document IS GAP-07 implementation

GAP-08 (Updates)        ──────▶ Registry provides update notifications

GAP-12 (Economy)        ──────▶ Marketplace handles payments
```

### Capability Negotiation Integration

The registry uses capability negotiation ([`drafts/capability-negotiation.md`](./capability-negotiation.md)) for:

1. **Compatibility scoring** — Calculate agent/host compatibility from `requires` and `enhances-with`
2. **Discovery filtering** — Search by `provides`, `domain`, `mcp-tool`
3. **Compatibility display** — Show Full/Good/Basic/None for each host

### Identity & Trust Integration

The registry uses identity & trust ([`drafts/gap-02-identity-trust.md`](./gap-02-identity-trust.md)) for:

1. **Publisher verification** — `did:key` for most publishers, `did:web` for domain verification
2. **Agent identity** — Content-derived `did:agentlet` identifiers ensure immutability
3. **Signature verification** — Ed25519 signatures verified on upload
4. **Trust scoring** — 0-100 computed from signatures, audits, installs, ratings
5. **Attestations** — Third-party security audits, registry verification badges
6. **UI indicators** — Verified/unsigned/invalid status shown on agent pages

### Timeline

| Spec | Date | Registry/Marketplace |
|------|------|----------------------|
| v0.2 | Q1 2026 | Foundation work |
| v0.4 | Q2 2026 | **Registry + Marketplace MVP** |
| v0.5 | Q3 2026 | Trust features |
| v0.6 | Q3 2026 | Developer experience |
| v0.7 | Q4 2026 | Economy |
| v1.0 | 2026 | Full platform |

---

## Technical Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js | SSR for SEO |
| **API** | Node.js / Hono | Fast, TypeScript |
| **Database** | PostgreSQL | Reliable, good search |
| **Search** | PostgreSQL FTS → Meilisearch | Start simple |
| **Auth** | OAuth + DID | Familiar + future-proof |
| **File Storage** | S3 / R2 | Cheap, reliable |
| **CDN** | Cloudflare | Global, fast |
| **Payments** | Stripe | Standard |

---

## Success Metrics

| Phase | Metric | Target |
|-------|--------|--------|
| **MVP** | Agents hosted | 50+ |
| | Publishers | 20+ |
| | API requests/month | 10K+ |
| **Trust** | Verified publishers | 50% |
| | Agents with reviews | 30% |
| **DX** | CLI publishes | 50% of submissions |
| **Economy** | Paid agents | 10% of listings |
| | Monthly GMV | $10K+ |

---

## Next Steps

1. **Buy domains:** agentlet.ai + agentlets.ai (redirect)
2. **Complete GAP-02:** Identity required for trust
3. **Build registry MVP:** Q1 2026
4. **Launch:** Q2 2026 with spec v0.4
5. **Outreach:** Get first 50 agents

---

## Appendix: Naming Comparison

| Platform | What It's Called | Technical | User-Facing |
|----------|------------------|-----------|-------------|
| **npm** | "npm registry" | Registry | Basic marketplace |
| **PyPI** | "Python Package Index" | Registry | Minimal UI |
| **crates.io** | "Rust package registry" | Registry | Good UI |
| **VS Code** | "Marketplace" | Also registry | Strong marketplace |
| **Chrome** | "Web Store" | Also registry | Strong marketplace |
| **Agentlet** | "Registry & Marketplace" | Registry | Marketplace UI |

We use both terms because we serve both functions. The registry is the foundation (API, hosting), the marketplace is the face (discovery, trust, commerce).
