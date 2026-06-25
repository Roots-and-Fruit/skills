# Regression scorecard — `wordpress plugin marketing`

**Purpose:** Binary pass/fail checks before claiming a skill version improves mixed-SERP fan-out.  
**Lane under test:** `primary_topic` (developer GTM)  
**Fixture:** `merged-keywords.fixture.json`  
**Verifier:** `node scripts/verify-scorecard.mjs`

Run after every change that touches tiering, priority, or expansion gates:

```bash
node scripts/verify-scorecard.mjs
```

## Binary checks

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

**Ship gate:** all S1–S8 pass.

## Live MCP check (manual, after fixture passes)

Re-run keyword-only fan-out on `wordpress plugin marketing` with `primary_topic` stated in the prompt. Confirm:

- SERP intent note still shows `intent_split: mixed`
- No email/newsletter `serp_related` terms under **SERP-native** group in the report
- Top 5 `priority_sub_queries` unchanged from v2.2 good list (promote, strategy, free, best, earn money)

## Version history

| Version | S1–S8 | Notes |
|---------|-------|-------|
| 2.2.0 | S3, S4 fail | Email `serp_related` incorrectly `serp_native` |
| 2.3.0 | **All pass** (verified) | Lane-aware facet drift on seed SERP |
