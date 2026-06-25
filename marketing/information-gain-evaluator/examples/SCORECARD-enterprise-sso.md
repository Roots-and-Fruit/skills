# Regression scorecard — `enterprise SSO` (golden fixture)

**Purpose:** Schema + rigorous information-gain checks on the synthetic golden handoff.  
**Fixture:** `enterprise-sso.handoff.fixture.json` (handoff v1.1)  
**Verifier:**

```bash
node scripts/verify-handoff.mjs examples/enterprise-sso.handoff.fixture.json
```

---

## Layer 1 — Schema (G1–G14)

| ID | Criterion |
|----|-----------|
| G1–G14 | See `verify-handoff.mjs` — handoff v1.1 shape, five dimensions, evidence, legacy-safe overall math |

**Ship gate:** all G1–G14 pass.

---

## Layer 2 — Rigorous information gain (R1–R18)

| ID | Criterion | Pass when |
|----|-----------|-----------|
| R1 | Citation fit field | `citation_fit_for_keyword` set |
| R2 | Page fit field | `page_keyword_fit` set |
| R3 | Baseline pct | `baseline_coverage_pct` 0–100 |
| R4 | Baseline consistency | `baseline_completeness` matches pct bands |
| R5 | Table stakes depth | ≥5 stakes, ≥1 gap |
| R6 | Rationale | `citation_fit_rationale` ≥30 chars |
| R7 | Evidence depth | All snippets ≥40 chars |
| R8 | No unfetchable evidence | Evidence URLs not `unfetchable` |
| R9 | Novel angle cap | `novel_angle` not `high` when `citation_fit: poor` |
| R10 | Overall cap (poor cite) | `overall` not `high` when `citation_fit: poor` |
| R11 | High bar | `overall: high` requires citation-core `high` |
| R12 | Mismatch cap (cite) | `citation_fit` not `strong` when `page_keyword_fit: mismatched` |
| R13 | Mismatch cap (overall) | `overall` not `high` when mismatched |
| R14 | Confidence vs fetchable | `high` iff ≥3 fetchable competitors |
| R15 | Strong cite bar | `citation_fit: strong` requires citation-core `high` |
| R16 | Novel angle proof | `novel_angle: high` requires another core `high` |
| R17 | Unique strengths | ≥2 entries |
| R18 | Low overall sanity | `overall: low` has poor cite or ≥1 dimension `low` |

**Ship gate:** all R1–R18 pass on golden fixture.

---

## Expected bands (golden fixture)

| Field | Expected |
|-------|----------|
| `overall` | `medium` |
| `citation_fit_for_keyword` | `partial` |
| `page_keyword_fit` | `aligned` |
| `baseline_completeness` | `adequate` |
| `baseline_coverage_pct` | 60 |

---

## Version history

| Version | G + R | Notes |
|---------|-------|-------|
| 1.0.0 | G only | Schema-only gate — too easy |
| 1.1.0 | **G + R** | Citation fit, page fit, rigorous overall, evidence depth |
