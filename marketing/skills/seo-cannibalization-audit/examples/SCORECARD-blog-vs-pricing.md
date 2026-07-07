# Regression scorecard — blog vs pricing (playbook tension)

**Purpose:** Binary pass/fail for playbook-focused cannibalization — blog accidental hub vs intended pricing LP.  
**Fixture:** `blog-vs-pricing.handoff.fixture.json`  
**Pair fixture:** `blog-vs-pricing.pair.fixture.json`  
**Gold profile:** `blog-vs-pricing`  
**Verifier:** `node scripts/verify-handoff.mjs`

```bash
node scripts/verify-handoff.mjs
node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json --gold blog-vs-pricing
node scripts/verify-handoff.mjs examples/hub-spoke-ok.handoff.fixture.json --gold hub-spoke-ok
```

---

## Archetype under test

| Signal | Expected |
|--------|----------|
| Page types | `how_to` blog vs `product` pricing |
| Structural relationship | `hub_spoke_ok` by intent types |
| Playbook tension | `blog_vs_landing` (same commercial keyword) |
| Severity | `emerging` (blog #8, pricing #34) |
| Resolution | `needs_human_approval` — not silent 301 |
| Recovery | Phase `5f` transition tree |

**Anti-pattern:** Labeling overlap `hub_spoke_ok` resolution and closing the audit — blog still wins the money keyword.

---

## G-layer (schema)

| ID | Criterion |
|----|-----------|
| G1 | `handoff_version === "1.0"` |
| G2 | `skill === "seo-cannibalization-audit"` |
| G3 | Valid `mode` enum |
| G4–G10 | Domain, subject pages, arrays, limitations |
| G11–G16 | Conflict shape, page intents, redirect_target rules |

---

## R-layer (rubric)

| ID | Criterion |
|----|-----------|
| R1 | Protected URLs → `protected_review` only |
| R2 | `hub_spoke_ok` + no tension → healthy; with tension → `5f` path |
| R3 | Playbook tension → `recovery_phase: 5f` |
| R4 | `redirect_301` → `redirect_target` set |
| R6 | Blog-vs-pricing gold → `needs_human_approval` |
| R7 | `consolidate` → `redirect_target` set |
| R8–R10 | Gold profile field match |

---

## S-layer (scripts)

| ID | Criterion |
|----|-----------|
| S1 | `classifyRelationship(how_to, product)` → `hub_spoke_ok` |
| S2 | `detectPlaybookTension` on pair fixture → `blog_vs_landing` |
| S3 | `classifySeverity(8, 34)` → `emerging` |
| S4 | `resolveConflict` on pair → `needs_human_approval`, `5f` |

**Ship gate:** all G + R + S checks pass on default fixture run.

---

## Version history

| Version | Notes |
|---------|-------|
| 2.0.2 | Step 4b healthy_relationships when zero overlap; G17–G20 + S5 verifier |
| 2.0.0 | Tier C; handoff v1.0; playbook_hub_recovery mode; blog-vs-pricing golden case |
