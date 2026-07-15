# Regression scorecard — `wordpress plugin marketing`

**Purpose:** Binary pass/fail checks before claiming a skill version improves mixed-SERP fan-out.  
**Lane under test:** `primary_topic` (developer GTM)  
**Fixtures:** `merged-keywords.fixture.json` · `wordpress-plugin-marketing-v2.3.handoff.fixture.json`  
**Verifiers:**

```bash
node scripts/verify-all.mjs
```

See `LAYPERSON-OUTPUT.md` for chat vs detail report contract.

Run after every change that touches tiering, priority, handoff schema, or expansion gates.

---

## Layer S — Normalizer output (S1–S8)

**Script:** `normalize-fanout.mjs` on `merged-keywords.fixture.json` with `--lane primary_topic`

| ID | Criterion | Pass when |
|----|-----------|-----------|
| S1 | GTM PAA survives | `how to promote a wordpress plugin` in output with `relevance_tier: serp_native` |
| S2 | GTM related survives | `wordpress plugin marketing strategy` in output with `relevance_tier: serp_native` |
| S3 | Email related demoted | `wordpress email marketing plugin free` has `relevance_tier: facet_drift` (not `serp_native`) |
| S4 | Newsletter related demoted | `best newsletter plugin for wordpress free` has `relevance_tier: facet_drift` |
| S5 | Zero-overlap brand rejected | `mailpoet` absent from output |
| S6 | Platform-meta PAA rejected | `is wordpress outdated in 2026` absent from output |
| S7 | Priority order | First output row is `how to promote a wordpress plugin` when `--lane primary_topic` |
| S8 | Labs facet drift tagged | `wordpress email marketing plugin` (suggestions) has `relevance_tier: facet_drift` |
| S9 | Zero-overlap brand on serp_related | `mailpoet` absent even when `source: serp_related` |
| S10 | GTM PAA acronym | `what are the 5 pillars of gtm` in output (`merged-gtm-seed.fixture.json`) |
| S11 | GTM mistakes PAA | `what are common gtm mistakes` in output |
| S12 | GTM fixture brand reject | `mailpoet` absent on GTM fixture |

**Ship gate:** all S1–S12 pass.

---

## Layer LP — Layperson chat (LP1–LP10)

`node scripts/verify-layperson-summary.mjs` on golden handoff.

| ID | Criterion |
|----|-----------|
| LP1–LP3 | Verdict, What's working, What to write next sections |
| LP4–LP5 | No handoff JSON or tier tables in chat summary |
| LP6 | What still needs attention |
| LP7–LP10 | Working list + detail report contains handoff JSON |

---

## Layer G — Handoff schema (G1–G18)

Applied to every `examples/*.handoff.fixture.json` by `verify-handoff.mjs`.

| ID | Criterion |
|----|-----------|
| G1 | `handoff_version: "1.1"` |
| G2 | `skill: "fan-out-coverage-analysis"` |
| G3 | `skill_version` semver string |
| G4 | `mode` is `keyword_only` or `domain_coverage` |
| G5 | `generated_at` valid ISO 8601 |
| G6–G7 | `inputs.primary_keyword` set; `domain` null (keyword_only) or string (domain_coverage) |
| G8–G9 | Extended `serp_context` + optional `ai_overview_source` enum |
| G10–G12 | `sub_queries[]` with `relevance_tier`, `dimension`, `priority`, `source[]` |
| G13–G14 | `priority_sub_queries[]` when keyword_only |
| G15–G16 | `coverage_summary`, `gaps[]`, `status` when domain_coverage |
| G17 | `limitations[]` non-empty |
| G18 | `coverage_rate_pct` matches covered / sub_query_count |

**Ship gate:** all G1–G18 pass on all handoff fixtures.

---

## Layer R — Rubric anti-drift (R1–R10)

| ID | Criterion | Applies |
|----|-----------|---------|
| R1 | `mailpoet` absent from `sub_queries[]` | all fixtures |
| R2 | Platform-meta PAA absent from `sub_queries[]` | all fixtures |
| R3 | Email/newsletter `serp_related` not `serp_native` when `intent_split: mixed` | all fixtures |
| R4 | `priority_sub_queries[]` tier-ordered (serp_native → core → facet_drift → adjacent) | keyword_only |
| R5 | No `facet_drift` + `high` in `priority_sub_queries[]` when mixed | keyword_only |
| R6 | `gaps[]` keywords have `status: gap` in `sub_queries[]` | domain_coverage |
| R7 | `intent_split` matches golden profile | profile-specific |
| R8 | Profile-specific tier or count check | profile-specific |
| R9 | GTM PAA first in `priority_sub_queries[]` | wordpress golden only |
| R10 | Labs email term is `facet_drift` | wordpress golden only |

**Ship gate:** all applicable R checks pass.

---

## Live MCP check (manual, after fixtures pass)

Re-run keyword-only fan-out on `wordpress plugin marketing` with `primary_topic` stated in the prompt. Confirm:

- SERP intent note still shows `intent_split: mixed`
- No email/newsletter `serp_related` terms under **SERP-native** group in the report
- Top 5 `priority_sub_queries` unchanged from v2.3 good list (promote, earn money, strategy, free, best)

---

## Version history

| Version | S | G/R | Notes |
|---------|---|-----|-------|
| 2.2.0 | S3, S4 fail | — | Email `serp_related` incorrectly `serp_native` |
| 2.3.0 | All pass | — | Lane-aware facet drift on seed SERP (S-layer only) |
| 2.4.0 | All pass | **All pass** | Handoff verifier + golden fixtures; normalize required |
| 2.5.0 | All pass | **All pass** | Zero-overlap serp_related fix; `apply-priority.mjs`; mode/content_context clarity |
| 2.6.0 | S10–S12 | G19, R11, LP1–LP10 | GTM synonyms; all-highs shortlist; layperson contract; `run-fanout.mjs`; thin-seed fallback |
| 2.7.0 | S10–S12 | M1–M5, C1–C8 | `merge-expansion-input.mjs`; `apply-coverage.mjs` + `--ranked-file`; strict chat stdout; `keyword_data.keyword` filter doc |
| 2.8.0 | S10–S12 | I1–I6, C9–C11 | `ingest-mcp-export.mjs`; `mergeGaps` high-first; branded `hub_serp_only`; layperson high count fix; PowerShell notes |
| 2.9.0 | S10–S12 | PA1–PA3, CL1–CL7, G18a–G21, R12–R13, C12–C18, LP15–LP16, XP1–XP4, I7–I8, DR1–DR6 | Intent clusters SSOT; `seed_adjacent` merges SERP + Labs variants; PAA ingest; cluster coverage %; detail report v2; `verify-client-agnostic.mjs`; handoff v1.2 |

## Failure protocol (phased work)

Each phase has one gate command. On first failure: one fix attempt in phase scope. On second failure: **stop** — report check IDs, root cause, options (relax spec vs change design). Do not weaken assertions to pass.

**Ship bar:** `node scripts/verify-all.mjs` (exit 0).

**Client-agnostic gate:** `node scripts/verify-client-agnostic.mjs` — no real client domains in tracked fixtures/docs.
