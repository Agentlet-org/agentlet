# GAP-02: Agent Identity & Trust

**Status:** Draft  
**Target Version:** 0.2.0  
**Author:** José Fernandes  
**Date:** January 2026

---

## Executive Summary

This document specifies cryptographic identity for Agentlet:

1. **Publisher Identity** — DIDs for agent authors (`did:key:...` or `did:web:...`)
2. **Agent Identity** — Unique identifiers for agents (`did:agentlet:...`)
3. **Agent Signing** — Cryptographic proof of authorship
4. **Signature Verification** — Hosts verify before execution
5. **Attestations** — Third-party trust signals
6. **Trust Scoring** — Computed reputation

This enables: verified authorship, marketplace trust, agent-to-agent auth, and payment routing.

---

## Table of Contents

1. [Motivation](#1-motivation)
2. [Design Decisions](#2-design-decisions)
3. [Publisher Identity](#3-publisher-identity)
4. [Agent Identity](#4-agent-identity)
5. [Agent Signing](#5-agent-signing)
6. [Manifest Additions](#6-manifest-additions)
7. [Bridge API](#7-bridge-api)
8. [Verification Flow](#8-verification-flow)
9. [Attestations](#9-attestations)
10. [Trust Scoring](#10-trust-scoring)
11. [Security Considerations](#11-security-considerations)
12. [Implementation Guide](#12-implementation-guide)
13. [Migration Path](#13-migration-path)

---

## 1. Motivation

### Current State (v0.1)

| Field | Type | Problem |
|-------|------|---------|
| `agentlet:name` | String | Just text, no uniqueness guarantee |
| `agentlet:author` | String | Unverified, anyone can claim |
| `agentlet:homepage` | URL | Can change, be spoofed |
| Source URL | URL | No integrity guarantee |

### What This Blocks

| Feature | Requires |
|---------|----------|
| Marketplace trust badges | Verified authorship |
| Agent-to-agent auth (v0.3) | Cryptographic identity |
| Payment routing (v0.6) | Stable, verified identity |
| Reputation systems | Persistent identity |
| Update verification | Same author signed both versions |

### Goals

1. **Verifiable authorship** — Cryptographic proof that author X created agent Y
2. **Tamper detection** — Know if agent was modified after signing
3. **Persistent identity** — Same author across multiple agents and versions
4. **Decentralized** — No single authority controls identity
5. **Practical** — Works in browsers, minimal dependencies

---

## 2. Design Decisions

### 2.1 DID Methods

| Method | Format | Resolution | Pros | Cons |
|--------|--------|------------|------|------|
| `did:key` | `did:key:z6Mkh...` | Self-describing | Simple, offline, no server | No rotation, no metadata |
| `did:web` | `did:web:example.com` | HTTPS fetch | Domain verification, rotatable | Requires server, domain |
| `did:agentlet` | `did:agentlet:abc123` | Registry lookup | Custom metadata, agent-specific | Centralized registry |

**Decision: Support `did:key` (primary) and `did:web` (optional)**

- `did:key` for most publishers (simple, works offline)
- `did:web` for organizations wanting domain verification
- `did:agentlet` for agents themselves (derived from content hash)

### 2.2 Key Algorithm

| Algorithm | Key Size | Signature Size | Browser Support |
|-----------|----------|----------------|-----------------|
| Ed25519 | 32 bytes | 64 bytes | SubtleCrypto (limited), noble-ed25519 |
| secp256k1 | 33 bytes | 64-72 bytes | noble-secp256k1 |
| RSA-2048 | 256 bytes | 256 bytes | Native SubtleCrypto |

**Decision: Ed25519**

- Compact (good for meta tags)
- Fast
- Modern, secure
- Used by did:key specification
- Library: `@noble/ed25519` (zero dependencies, audited)

### 2.3 Signature Scope

What gets signed?

| Option | Pros | Cons |
|--------|------|------|
| Entire file | Simple, complete | Signature in file = circular |
| File minus signature tag | Complete coverage | Complex extraction |
| Manifest only | Fast, deterministic | Code changes undetected |
| Content hash | Clean separation | Extra step |

**Decision: Sign content hash (SHA-256 of file with signature tag removed)**

```
1. Remove <meta name="agentlet:signature" ...> if present
2. Compute SHA-256 of remaining content
3. Sign the hash with publisher's private key
4. Add signature back to file
```

### 2.4 Encoding

| Format | Use |
|--------|-----|
| Multibase (base58btc) | DIDs, signatures in manifest |
| Hex | Internal processing |
| JSON | API responses |

---

## 3. Publisher Identity

Publishers (agent authors) are identified by DIDs.

### 3.1 did:key (Recommended)

Self-describing identifier containing the public key.

```
did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
        └─────────────────────────────────────────────────┘
                    Multibase-encoded Ed25519 public key
```

**Generation:**

```javascript
import { generateKeyPair } from '@agentlet/identity';

const { publicKey, privateKey } = await generateKeyPair();
const did = `did:key:${multibaseEncode(publicKey)}`;
// did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

**Resolution:**

```javascript
// did:key is self-resolving - public key is in the identifier
function resolveDidKey(did) {
  const multibaseKey = did.replace('did:key:', '');
  const publicKey = multibaseDecode(multibaseKey);
  return {
    id: did,
    publicKey,
    verificationMethod: [{
      id: `${did}#key-1`,
      type: 'Ed25519VerificationKey2020',
      controller: did,
      publicKeyMultibase: multibaseKey
    }]
  };
}
```

### 3.2 did:web (Optional)

Domain-verified identifier resolved via HTTPS.

```
did:web:example.com
did:web:example.com:team:jose
```

**Resolution:**

```
did:web:example.com
  → GET https://example.com/.well-known/did.json

did:web:example.com:team:jose  
  → GET https://example.com/team/jose/did.json
```

**DID Document:**

```json
{
  "@context": ["https://www.w3.org/ns/did/v1"],
  "id": "did:web:example.com",
  "verificationMethod": [{
    "id": "did:web:example.com#key-1",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:web:example.com",
    "publicKeyMultibase": "z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
  }],
  "authentication": ["did:web:example.com#key-1"],
  "assertionMethod": ["did:web:example.com#key-1"]
}
```

### 3.3 Publisher Metadata

Publishers can have associated metadata (stored in registry, not in DID):

```typescript
interface Publisher {
  did: string;                    // did:key:... or did:web:...
  name: string;                   // Display name
  description?: string;
  website?: string;
  github?: string;
  email?: string;
  verified: boolean;              // Domain/GitHub verified
  verifiedAt?: Date;
  agents: string[];               // Agent DIDs
  createdAt: Date;
}
```

---

## 4. Agent Identity

Each agent has a unique, content-derived identifier.

### 4.1 did:agentlet Format

```
did:agentlet:Qm3xK9mPqR7nY2wZvBtL8
             └──────────────────────┘
             Base58-encoded truncated SHA-256
             of canonical agent content
```

**Generation:**

```javascript
function generateAgentDid(agentHtml) {
  // 1. Canonicalize (remove signature, normalize whitespace)
  const canonical = canonicalize(agentHtml);
  
  // 2. Hash
  const hash = sha256(canonical);
  
  // 3. Truncate to 20 bytes (160 bits - sufficient for uniqueness)
  const truncated = hash.slice(0, 20);
  
  // 4. Encode
  return `did:agentlet:${base58btc.encode(truncated)}`;
}
```

### 4.2 Agent DID Properties

| Property | Value |
|----------|-------|
| **Deterministic** | Same content → same DID |
| **Unique** | Different content → different DID |
| **Immutable** | Content changes → DID changes |
| **Verifiable** | Anyone can recompute and verify |

### 4.3 Version Identity

When an agent is updated, its DID changes (content changed). The relationship between versions is tracked by:

1. **Same publisher** — Signed by same key
2. **Same `agentlet:name`** — Machine identifier stays constant
3. **Version field** — `agentlet:version` increments

```html
<!-- v1.0.0 -->
<meta name="agentlet:id" content="did:agentlet:Qm3xK9mPqR7nY2wZvB">
<meta name="agentlet:name" content="smart-tagger">
<meta name="agentlet:version" content="1.0.0">

<!-- v1.1.0 (same name, same publisher, new DID) -->
<meta name="agentlet:id" content="did:agentlet:QmNewHashHere123">
<meta name="agentlet:name" content="smart-tagger">
<meta name="agentlet:version" content="1.1.0">
```

---

## 5. Agent Signing

Publishers sign agents to prove authorship.

### 5.1 Signature Process

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Agent HTML    │────▶│   Canonicalize  │────▶│    SHA-256      │
│   (unsigned)    │     │   & Hash        │     │    Hash         │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Agent HTML    │◀────│   Add Signature │◀────│   Ed25519 Sign  │
│   (signed)      │     │   Meta Tag      │     │   with Priv Key │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 5.2 Canonicalization

Before hashing, the agent is canonicalized:

1. Remove any existing `agentlet:signature` meta tag
2. Remove any existing `agentlet:id` meta tag (will be recomputed)
3. Normalize line endings to `\n`
4. Remove trailing whitespace from lines
5. Ensure single trailing newline

```javascript
function canonicalize(html) {
  // Remove signature and id tags
  let canonical = html
    .replace(/<meta\s+name=["']agentlet:signature["'][^>]*>/gi, '')
    .replace(/<meta\s+name=["']agentlet:id["'][^>]*>/gi, '');
  
  // Normalize whitespace
  canonical = canonical
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n+$/, '\n');
  
  return canonical;
}
```

### 5.3 Signature Generation

```javascript
import { sign } from '@noble/ed25519';

async function signAgent(agentHtml, privateKey) {
  // 1. Canonicalize
  const canonical = canonicalize(agentHtml);
  
  // 2. Compute content hash
  const contentHash = await sha256(canonical);
  
  // 3. Compute agent DID
  const agentDid = generateAgentDid(canonical);
  
  // 4. Create signature payload
  const payload = JSON.stringify({
    agentDid,
    contentHash: hex(contentHash),
    timestamp: new Date().toISOString(),
    specVersion: '0.2'
  });
  
  // 5. Sign payload
  const signature = await sign(
    new TextEncoder().encode(payload),
    privateKey
  );
  
  // 6. Encode signature
  const signatureMultibase = base58btc.encode(signature);
  
  // 7. Insert meta tags
  return insertSignatureTags(agentHtml, {
    id: agentDid,
    signature: signatureMultibase,
    signer: getPublisherDid(privateKey),
    signedAt: new Date().toISOString()
  });
}
```

### 5.4 Signature Tag Format

```html
<meta name="agentlet:id" content="did:agentlet:Qm3xK9mPqR7nY2wZvB">
<meta name="agentlet:signature" content="z3MqCqR7nY2wZ..." 
      data-signer="did:key:z6MkhaXgBZD..."
      data-signed-at="2026-01-15T10:30:00Z"
      data-algorithm="Ed25519">
```

| Attribute | Description |
|-----------|-------------|
| `content` | Multibase-encoded Ed25519 signature |
| `data-signer` | Publisher DID who signed |
| `data-signed-at` | ISO 8601 timestamp |
| `data-algorithm` | Signature algorithm (for future-proofing) |

---

## 6. Manifest Additions

### 6.1 New Meta Tags

```html
<!-- Agent's unique identifier (content-derived) -->
<meta name="agentlet:id" content="did:agentlet:Qm3xK9mPqR7nY2wZvB">

<!-- Cryptographic signature -->
<meta name="agentlet:signature" content="z3MqCqR7nY2wZ..."
      data-signer="did:key:z6MkhaXgBZD..."
      data-signed-at="2026-01-15T10:30:00Z"
      data-algorithm="Ed25519">

<!-- Publisher's DID (can differ from signer for delegated signing) -->
<meta name="agentlet:publisher" content="did:key:z6MkhaXgBZD...">

<!-- Third-party attestations -->
<meta name="agentlet:attestation" content="https://auditor.example/cert/123"
      data-type="security-audit"
      data-issued="2026-01-01">
```

### 6.2 Complete Signed Agent Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Smart Tagger</title>
  
  <!-- Identity -->
  <meta name="agentlet" content="0.2">
  <meta name="agentlet:id" content="did:agentlet:Qm3xK9mPqR7nY2wZvB">
  <meta name="agentlet:name" content="smart-tagger">
  <meta name="agentlet:version" content="1.2.0">
  
  <!-- Authorship -->
  <meta name="agentlet:publisher" content="did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK">
  <meta name="agentlet:signature" content="z3MqCqR7nY2wZvBtL8kPqR9..."
        data-signer="did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK"
        data-signed-at="2026-01-15T10:30:00Z"
        data-algorithm="Ed25519">
  
  <!-- Trust signals -->
  <meta name="agentlet:attestation" content="https://audits.agentlet.ai/abc123"
        data-type="security-audit"
        data-issued="2026-01-10">
  
  <!-- Standard manifest -->
  <meta name="agentlet:description" content="AI-powered automatic tagging">
  <meta name="agentlet:portability" content="adaptive">
  <meta name="agentlet:capability" content="inference">
  <meta name="agentlet:capability" content="perceive">
  <meta name="agentlet:action" content="tag" data-label="Auto-Tag">
</head>
<body>
<script type="module">
bridge.action('tag', async () => {
  // ... implementation
});
</script>
</body>
</html>
```

---

## 7. Bridge API

### 7.1 Identity Namespace

```javascript
// Get current agent's identity
bridge.identity.self()
// Returns: { did: 'did:agentlet:...', publisher: 'did:key:...', signed: true }

// Verify another agent's signature
bridge.identity.verify(agentUrl)
// Returns: { valid: boolean, publisher: string, signedAt: Date, error?: string }

// Resolve a DID to identity info
bridge.identity.resolve(did)
// Returns: { did, publicKey, document, ... }

// Get publisher info from registry
bridge.identity.getPublisher(publisherDid)
// Returns: { did, name, verified, agents: [...], ... }
```

### 7.2 Trust Namespace

```javascript
// Get trust score for an agent or publisher
bridge.trust.getScore(did)
// Returns: { score: 0-100, factors: {...}, lastUpdated: Date }

// Check if DID meets trust requirements
bridge.trust.meets(did, requirements)
// Returns: boolean

// Example requirements
bridge.trust.meets('did:agentlet:...', {
  minScore: 70,
  requireVerifiedPublisher: true,
  requireAudit: false
});

// Get attestations for an agent
bridge.trust.getAttestations(agentDid)
// Returns: [{ type, issuer, url, issuedAt, expiresAt, valid }, ...]
```

### 7.3 API Types

```typescript
interface SelfIdentity {
  did: string;                    // Agent's DID
  publisher: string;              // Publisher's DID
  signed: boolean;                // Whether agent is signed
  signedAt?: Date;
  attestations: Attestation[];
}

interface VerificationResult {
  valid: boolean;
  publisher?: string;             // Publisher DID if valid
  signedAt?: Date;
  algorithm?: string;
  error?: string;                 // Error message if invalid
}

interface PublisherInfo {
  did: string;
  name: string;
  description?: string;
  website?: string;
  verified: boolean;
  verifiedAt?: Date;
  trustScore: number;
  agentCount: number;
}

interface TrustScore {
  score: number;                  // 0-100
  factors: {
    publisherVerified: boolean;
    signatureValid: boolean;
    hasAudit: boolean;
    installCount: number;
    averageRating: number;
    ageInDays: number;
  };
  lastUpdated: Date;
}

interface Attestation {
  type: 'security-audit' | 'registry-verified' | 'publisher-verified' | string;
  issuer: string;                 // DID of attestor
  url: string;                    // Link to attestation details
  issuedAt: Date;
  expiresAt?: Date;
  valid: boolean;                 // Currently valid
}

interface TrustRequirements {
  minScore?: number;              // Minimum trust score (0-100)
  requireVerifiedPublisher?: boolean;
  requireAudit?: boolean;
  requireMinInstalls?: number;
  requireMinRating?: number;
  maxAgeDays?: number;
}
```

---

## 8. Verification Flow

### 8.1 Host Verification (at Install Time)

```
┌─────────────────┐
│   User clicks   │
│   "Install"     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│   Fetch agent   │────▶│  Parse manifest │
│   from URL      │     │  Extract sig    │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Signature      │
                        │  present?       │
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼ Yes                     ▼ No
           ┌─────────────────┐       ┌─────────────────┐
           │  Resolve signer │       │  Warn user:     │
           │  DID            │       │  "Unsigned"     │
           └────────┬────────┘       └────────┬────────┘
                    │                         │
                    ▼                         │
           ┌─────────────────┐                │
           │  Verify         │                │
           │  signature      │                │
           └────────┬────────┘                │
                    │                         │
         ┌──────────┴──────────┐              │
         │                     │              │
         ▼ Valid               ▼ Invalid      │
┌─────────────────┐   ┌─────────────────┐     │
│  Show verified  │   │  Block install  │     │
│  publisher info │   │  Show error     │     │
└────────┬────────┘   └─────────────────┘     │
         │                                    │
         ▼                                    ▼
┌─────────────────┐                  ┌─────────────────┐
│  Proceed with   │                  │  Allow with     │
│  install        │                  │  warning        │
└─────────────────┘                  └─────────────────┘
```

### 8.2 Verification Code

```javascript
async function verifyAgent(agentHtml, sourceUrl) {
  // 1. Parse manifest
  const manifest = extractManifest(agentHtml);
  
  if (!manifest.signature) {
    return { valid: false, error: 'unsigned', publisher: null };
  }
  
  // 2. Extract signature data
  const { content: signature, signer, signedAt, algorithm } = manifest.signature;
  
  if (algorithm !== 'Ed25519') {
    return { valid: false, error: 'unsupported-algorithm', publisher: signer };
  }
  
  // 3. Resolve signer DID
  let publicKey;
  try {
    const resolved = await resolveDid(signer);
    publicKey = resolved.publicKey;
  } catch (e) {
    return { valid: false, error: 'unresolvable-signer', publisher: signer };
  }
  
  // 4. Canonicalize and hash content
  const canonical = canonicalize(agentHtml);
  const contentHash = await sha256(canonical);
  const agentDid = generateAgentDid(canonical);
  
  // 5. Verify DID matches
  if (manifest.id !== agentDid) {
    return { valid: false, error: 'did-mismatch', publisher: signer };
  }
  
  // 6. Reconstruct signature payload
  const payload = JSON.stringify({
    agentDid,
    contentHash: hex(contentHash),
    timestamp: signedAt,
    specVersion: '0.2'
  });
  
  // 7. Verify signature
  const signatureBytes = base58btc.decode(signature);
  const valid = await verify(
    signatureBytes,
    new TextEncoder().encode(payload),
    publicKey
  );
  
  if (!valid) {
    return { valid: false, error: 'invalid-signature', publisher: signer };
  }
  
  return {
    valid: true,
    publisher: signer,
    signedAt: new Date(signedAt),
    algorithm,
    agentDid
  };
}
```

### 8.3 UI Presentation

**Verified Agent:**
```
┌────────────────────────────────────────┐
│ ✓ Smart Tagger                         │
│   by José (@jose) ✓ Verified           │
│   ─────────────────────────────────    │
│   Signed: Jan 15, 2026                 │
│   Publisher: did:key:z6Mkh...          │
│   Trust Score: 87/100                  │
│                                        │
│   [View Details]  [Install]            │
└────────────────────────────────────────┘
```

**Unsigned Agent:**
```
┌────────────────────────────────────────┐
│ ⚠ Unknown Agent                        │
│   Author: "Someone" (unverified)       │
│   ─────────────────────────────────    │
│   ⚠ This agent is not signed.          │
│   The author cannot be verified.       │
│                                        │
│   [Cancel]  [Install Anyway]           │
└────────────────────────────────────────┘
```

**Invalid Signature:**
```
┌────────────────────────────────────────┐
│ ✗ Suspicious Agent                     │
│   ─────────────────────────────────    │
│   ✗ Signature verification failed.     │
│   This agent may have been tampered    │
│   with or is impersonating another     │
│   publisher.                           │
│                                        │
│   [Cancel]  [Report]                   │
└────────────────────────────────────────┘
```

---

## 9. Attestations

Third parties can attest to agent properties.

### 9.1 Attestation Types

| Type | Issuer | Meaning |
|------|--------|---------|
| `security-audit` | Security firm | Code reviewed for vulnerabilities |
| `registry-verified` | agentlet.ai | Listed in official registry |
| `publisher-verified` | agentlet.ai | Publisher identity confirmed |
| `host-approved` | Host app | Meets host's quality standards |
| `community-trusted` | Community | High ratings, many installs |

### 9.2 Attestation Format

Attestations are Verifiable Credentials (simplified):

```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "AgentletAttestation"],
  "issuer": "did:web:audits.agentlet.ai",
  "issuanceDate": "2026-01-10T00:00:00Z",
  "expirationDate": "2027-01-10T00:00:00Z",
  "credentialSubject": {
    "id": "did:agentlet:Qm3xK9mPqR7nY2wZvB",
    "attestationType": "security-audit",
    "auditReport": "https://audits.agentlet.ai/reports/abc123",
    "findings": {
      "critical": 0,
      "high": 0,
      "medium": 1,
      "low": 3
    }
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2026-01-10T12:00:00Z",
    "verificationMethod": "did:web:audits.agentlet.ai#key-1",
    "proofValue": "z3MqCq..."
  }
}
```

### 9.3 Manifest Reference

```html
<meta name="agentlet:attestation" content="https://audits.agentlet.ai/creds/abc123"
      data-type="security-audit"
      data-issuer="did:web:audits.agentlet.ai"
      data-issued="2026-01-10"
      data-expires="2027-01-10">
```

---

## 10. Trust Scoring

### 10.1 Score Computation

Trust scores (0-100) combine multiple factors:

```javascript
function computeTrustScore(agent, publisher) {
  let score = 0;
  
  // Baseline: Signed (required for any positive score)
  if (!agent.signed) return 0;
  score += 20;
  
  // Publisher verified (+20)
  if (publisher.verified) score += 20;
  
  // Has security audit (+15)
  if (agent.attestations.some(a => a.type === 'security-audit' && a.valid)) {
    score += 15;
  }
  
  // Install count (up to +15)
  score += Math.min(15, Math.log10(agent.installCount + 1) * 5);
  
  // Rating (up to +15)
  if (agent.ratingCount >= 5) {
    score += (agent.averageRating / 5) * 15;
  }
  
  // Age bonus (up to +10, maxes at 180 days)
  const ageInDays = (Date.now() - agent.publishedAt) / (1000 * 60 * 60 * 24);
  score += Math.min(10, ageInDays / 18);
  
  // Publisher track record (up to +5)
  if (publisher.agentCount > 1) {
    const avgOtherScore = publisher.agents
      .filter(a => a.did !== agent.did)
      .reduce((sum, a) => sum + a.trustScore, 0) / (publisher.agentCount - 1);
    score += (avgOtherScore / 100) * 5;
  }
  
  return Math.round(Math.min(100, score));
}
```

### 10.2 Score Interpretation

| Score | Label | Meaning |
|-------|-------|---------|
| 0-19 | Untrusted | Unsigned or invalid |
| 20-39 | Low | Signed but unverified publisher |
| 40-59 | Moderate | Verified publisher, limited track record |
| 60-79 | Good | Verified, good ratings, some history |
| 80-100 | Excellent | Audited, popular, established publisher |

---

## 11. Security Considerations

### 11.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Impersonation | Signature verification |
| Tampering | Content hash in signature |
| Replay | Timestamp in signature |
| Key compromise | Key rotation via did:web, revocation list |
| Attestation fraud | Verify attestation signatures |

### 11.2 Key Management

**For Publishers:**

1. **Generate keys offline** — Use secure environment
2. **Backup private key** — Encrypted, offline storage
3. **Consider did:web for rotation** — Can update keys via DNS
4. **Use hardware keys if possible** — YubiKey, etc.

**For Hosts:**

1. **Cache DID documents** — Reduce resolution latency
2. **Respect TTL** — Don't cache forever
3. **Handle resolution failures gracefully** — Offline verification with cached keys
4. **Log verification failures** — For abuse detection

### 11.3 Revocation

For key compromise:

1. **did:key** — No revocation possible (key IS the identifier)
   - Mitigation: Publish new agent with new key, registry marks old as deprecated
   
2. **did:web** — Rotate keys in DID document
   - Old signatures remain valid (signed before rotation)
   - Add revocation list for compromised signatures

```json
// In DID document
{
  "id": "did:web:example.com",
  "verificationMethod": [
    { "id": "#key-2", ... }  // New key
  ],
  "revocationList": "https://example.com/.well-known/revocations.json"
}
```

---

## 12. Implementation Guide

### 12.1 SDK Additions

```typescript
// packages/host-sdk/src/identity/

export interface IdentityModule {
  // Key generation
  generateKeyPair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>;
  
  // DID operations
  createDidKey(publicKey: Uint8Array): string;
  resolveDid(did: string): Promise<DIDDocument>;
  
  // Signing
  signAgent(html: string, privateKey: Uint8Array): Promise<string>;
  
  // Verification
  verifyAgent(html: string): Promise<VerificationResult>;
  extractSignature(html: string): SignatureInfo | null;
  
  // Agent DID
  generateAgentDid(html: string): string;
}
```

### 12.2 CLI Commands

```bash
# Generate a new publisher key pair
agentlet identity create
# Outputs: Created did:key:z6Mkh... (saved to ~/.agentlet/keys/)

# Sign an agent
agentlet sign my-agent.agentlet
# Outputs: Signed with did:key:z6Mkh...

# Verify an agent
agentlet verify my-agent.agentlet
# Outputs: ✓ Valid signature by did:key:z6Mkh...

# Show identity info
agentlet identity show
# Outputs: Publisher DID, public key, created agents
```

### 12.3 Host Implementation Checklist

- [ ] Parse `agentlet:id`, `agentlet:signature`, `agentlet:publisher` tags
- [ ] Implement `resolveDid()` for did:key (required) and did:web (optional)
- [ ] Implement `verifyAgent()` with Ed25519
- [ ] Show verification status in install UI
- [ ] Block/warn on invalid signatures
- [ ] Cache DID resolutions
- [ ] Implement `bridge.identity.*` APIs
- [ ] Implement `bridge.trust.*` APIs (optional, can return defaults)

---

## 13. Migration Path

### 13.1 For Existing Agents (v0.1)

Unsigned agents continue to work but show as "unverified":

1. User sees warning on install
2. No trust score (score = 0)
3. Cannot be listed as "verified" in registry

**Upgrade path:**
```bash
# Generate keys (one time)
agentlet identity create

# Sign existing agent
agentlet sign my-agent.agentlet

# Republish
agentlet publish my-agent.agentlet
```

### 13.2 For Hosts

1. **Phase 1 (v0.2):** Parse and verify signatures, show UI indicators
2. **Phase 2 (v0.3):** Enforce signature for agent-to-agent calls
3. **Phase 3 (v0.4+):** Registry integration for trust scores

### 13.3 Backward Compatibility

| Scenario | Behavior |
|----------|----------|
| v0.2 host, unsigned agent | Works with warning |
| v0.1 host, signed agent | Ignores signature (no verification) |
| v0.2 host, signed agent | Full verification |

---

## Appendix A: Error Codes

| Code | Name | Description |
|------|------|-------------|
| `E201` | UNSIGNED_AGENT | Agent has no signature |
| `E202` | INVALID_SIGNATURE | Signature verification failed |
| `E203` | UNRESOLVABLE_DID | Cannot resolve signer DID |
| `E204` | DID_MISMATCH | Computed DID doesn't match declared |
| `E205` | EXPIRED_ATTESTATION | Attestation has expired |
| `E206` | INVALID_ATTESTATION | Attestation signature invalid |
| `E207` | UNSUPPORTED_ALGORITHM | Unknown signature algorithm |
| `E208` | KEY_REVOKED | Signing key has been revoked |

---

## Appendix B: Dependencies

| Library | Purpose | Size |
|---------|---------|------|
| `@noble/ed25519` | Signing/verification | ~5KB |
| `@noble/hashes` | SHA-256 | ~3KB |
| `multiformats` | Multibase encoding | ~8KB |

All libraries are:
- Zero dependency
- Audited
- Work in browsers and Node.js

---

## References

- [DID Core Specification](https://www.w3.org/TR/did-core/)
- [did:key Method](https://w3c-ccg.github.io/did-method-key/)
- [did:web Method](https://w3c-ccg.github.io/did-method-web/)
- [Ed25519](https://ed25519.cr.yp.to/)
- [Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Multibase](https://github.com/multiformats/multibase)
