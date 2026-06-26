# Regression scorecard — `example.com` performance matrix (golden fixture)

**Purpose:** Schema (M-layer), rubric rules (R-layer), and deterministic quadrant assignments (S-layer) on synthetic sample CSVs.  
**Fixture:** `example-saas.handoff.fixture.json` (regenerated from sample CSVs with intended + protected URLs)  
**Sample inputs:** `sample-gsc-queries.csv`, `sample-ga4-landing-pages.csv`

**Verifiers:**

```bash
node scripts/verify-handoff.mjs examples/example-saas.handoff.fixture.json
node scripts/verify-scorecard.mjs
node scripts/verify-intent-classifier.mjs
```

---

## Layer 1 — Schema (M1–M17)

| ID | Criterion |
|----|-----------|
| M1 | `handoff_version === "1.0"` |
| M2 | `skill === "analytics-and-searchconsole-performance-audit"` |
| M3 | `mode` in enum (`full`, `gsc_only`, `ga4_only`, `empty`) |
| M4 | `inputs.domain` non-empty string |
| M5 | `inputs.conversion_events` is array |
| M6 | `summary` has `total_pages` and `quadrant_counts` |
| M7 | `pages[]` length ≥ 1 |
| M8 | Every page: `url`, valid `quadrant`, `confidence`, `hub_type_hint`, `flags[]`, `recommended_review` |
| M9 | `limitations[]` is array |
| M10 | `quadrant_counts` sums to `pages.length` |
| M11 | `full` mode: every page has `gsc` or `ga4` |
| M12 | No `prune_candidate` with `protected` flag |
| M13 | `inputs.analysis_mode` in (`discovery_only`, `discovery_plus_conversions`) |
| M14 | `discovery` block shape when present |
| M15 | `discovery_only`: no `unicorn` / `hidden_gem` / `prune_candidate` quadrants |
| M16 | Every `inputs.intended_hubs[]` URL in `discovery.intended_hubs[]` |
| M17 | Each `discovery.intended_hubs[]` entry has required fields |

**Ship gate:** all M1–M17 pass on `example-saas.handoff.fixture.json`.

---

## Layer 2 — Rubric (R1–R6)

| ID | Criterion | Pass when |
|----|-----------|-----------|
| R1 | Accidental hub visibility dominance | Every `accidental_hub`: `visibility_score > value_score` |
| R2 | Hidden gem value dominance | Every `hidden_gem` with GSC: `value_score > visibility_score` |
| R3 | Unicorn dual strength | Every `unicorn`: both scores ≥ 0.5 on golden cohort |
| R4 | Protected review | Every `protected_review` has `protected` flag |
| R5 | Protected never prune | No `prune_candidate` with `protected` flag |
| R6 | Accidental hub signal | SSO blog: `low_ctr_high_impressions` + impressions > 50k |

**Ship gate:** all R1–R6 pass via `verify-scorecard.mjs`.

---

## Layer 3 — Script output (S1–S9)

Golden run: `build-matrix.mjs` with sample CSVs, intended hubs (home, analytics, pricing), protected security page.

| ID | Criterion | Expected |
|----|-----------|----------|
| S1 | SSO blog quadrant | `accidental_hub` |
| S2 | Analytics feature | `unicorn` |
| S3 | Homepage | `unicorn` |
| S4 | Pricing | `hidden_gem` + `intended_hub` + `building_toward_intent` |
| S5 | Security (protected) | `protected_review` + `protected` |
| S6 | Legacy announcement | `prune_candidate` |
| S7 | Mode | `full` |
| S8 | Summary counts | 1 accidental, 2 unicorn, 2 hidden, 1 protected, 2 prune |
| S9 | GA4-only partial | `ga4_only` mode; no `converts_without_search_clicks` flags; GSC limitation present |

**Ship gate:** all S1–S9 pass via `verify-scorecard.mjs`.

---

## Layer 4 — Discovery (D1–D5)

| ID | Criterion | Expected |
|----|-----------|----------|
| D1 | `discovery.intent_split` present | All intent buckets are objects |
| D2 | Intended hub `/pricing` verdict | `discovering`, `brand_only`, or `misaligned` |
| D3 | Fixture analysis mode | `discovery_plus_conversions` |
| D4 | `discovery_only` golden run | No conversion quadrants on sample CSVs |
| D5 | `discovery_only` intended hub parity | All `--intended` URLs in `discovery.intended_hubs[]` |

**Ship gate:** all D1–D5 pass via `verify-scorecard.mjs`.

---

## Layer 5 — Intent classifier (I1–I7)

Golden queries in `scripts/verify-intent-classifier.mjs` (domain-agnostic).

**Ship gate:** all I1–I7 pass via `node scripts/verify-intent-classifier.mjs`.

---

## Expected bands (golden fixture)

| URL path | Quadrant | Notes |
|----------|----------|-------|
| `/blog/how-to-configure-sso` | `accidental_hub` | High GSC, weak conversions |
| `/features/analytics` | `unicorn` | Intended hub |
| `/` | `unicorn` | Intended hub |
| `/pricing` | `hidden_gem` | Intended; building toward intent |
| `/contact` | `hidden_gem` | GA4-only in GSC export; converts without search clicks |
| `/about/security` | `protected_review` | Protected override |
| `/docs/api-reference` | `prune_candidate` | Weak on both axes |
| `/blog/legacy-feature-announcement` | `prune_candidate` | Legacy dead weight |

---

## Version history

| Version | Change |
|---------|--------|
| 1.3.1 | Report template hardening; M16–M17 intended-hub parity; D4–D5 discovery_only regression; I1–I7 intent classifier |
| 1.3.0 | Dual `analysis_mode`; `discovery` handoff block; M13–M15, D1–D3 |
| 1.2.0 | Available-data-first Step 0; partial-mode report templates; S9 regression |
| 1.1.0 | Renamed from `first-party-performance-matrix`; human-facing title; `skill` slug update |
| 1.0.1 | Added M/S/R scorecard layers per `write-a-skill` Tier C standard |
| 1.0.0 | Initial golden fixture + M1–M12 schema verifier |
