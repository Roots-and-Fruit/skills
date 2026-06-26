---
name: Fan-Out Coverage Analysis
type: composite
description: >
  Use when analyzing fan-out coverage, sub-query coverage, topic coverage gaps,
  or keyword-only SERP fan-out without a domain. Simulates AI query fan-out and
  optional domain coverage checks for a keyword.
version: 2.3.0
---

# Fan-Out Coverage Analysis

## Purpose

Google AI Overviews decompose a query into parallel sub-queries. This workflow approximates that fan-out from SERP + Labs data. With a **user-supplied domain**, it also measures which sub-queries the site covers and packages a neutral handoff. **Without a domain**, it runs **keyword-only SERP fan-out** (no coverage checks, no site assumptions).

## Domain policy (non-negotiable)

- **Never** infer a domain from examples, workspace context, project config, or prior runs.
- If the user did not supply a domain, **ask once**:

  > *Which domain should I check coverage for? (Optional: anchor URL. Or reply **keyword only** for SERP fan-out without a site.)*

- If still no domain (or user chooses keyword-only), run **Mode B** only. No `ranked_keywords`, no coverage %.

## Quick start

1. Confirm **primary keyword** (required).
2. Resolve **domain** per Domain policy.
3. **Steps 0 → 0.5 → 1 → 1b** (both modes).
4. **Mode A** (domain given): Steps 2–6.
5. **Mode B** (no domain): Steps 5b–6b → stop.
6. Offer to save report or pass handoff JSON downstream.

**Reference:** `REFERENCE.md` — API params, relevance gates, handoff schema v1.1  
**Requirements:** `REQUIREMENTS.md`  
**Examples:** `EXAMPLES.md` — mixed-SERP case study + regression scorecard  
**Regression:** `examples/SCORECARD-wordpress-plugin-marketing.md` · `node scripts/verify-scorecard.mjs`  
**Script:** `scripts/normalize-fanout.mjs`

## Shared steps (both modes)

### Step 0 — SERP seed

`serp_organic_live_advanced` on the primary keyword. Extract PAA (dedupe nested), related searches, live AI Overview presence, top organic titles/domains. See `REFERENCE.md`.

Record `ai_overview_present` from **live SERP** only. If Labs index disagrees, note in `limitations[]`.

### Step 0.5 — SERP lane classification

Classify top 8–10 organic results into lanes (see `REFERENCE.md`). Set `serp_context.intent_lanes_detected` and `intent_split` (`single` | `mixed`).

If **mixed**, ask once which lane to prioritize — unless the user already stated intent in the prompt:

> *This SERP mixes **[lane A]** and **[lane B]** results. Which should I prioritize for fan-out and gaps? (Or reply **report both**.)*

Store chosen lane in `inputs.intent_lane` when provided.

### Step 1 — Expand sub-queries

Parallel Labs: `related_keywords`, `suggestions`, `keyword_ideas`. Merge with Step 0 seeds.

Apply the **unified relevance gate** to **all** sources (not just ideas). Tag `relevance_tier` using **lane-aware rules** (`REFERENCE.md` v2.3): seed-SERP terms with facet drift are **not** `serp_native` unless `intent_lane` matches `inputs.intent_lane`. Optional: `normalize-fanout.mjs` with `--lane`.

Target **25–30** accepted sub-queries after dedupe. Keep facet-drift terms **tagged**, not silently dropped, unless zero seed-token overlap.

### Step 1b — Search intent

`dataforseo_labs_search_intent` on merged list. Attach `main_intent` to each sub-query.

Assign **priority** using tier rules in `REFERENCE.md` — when `intent_split` is `mixed`, **SERP-native beats raw Labs volume**.

## Mode A — Domain coverage (Steps 2–6)

Run only when a **domain** was supplied.

### Step 2 — Domain coverage

`dataforseo_labs_google_ranked_keywords`: bulk `ilike` + spot-check gaps. Not `relevant_pages`.

### Step 3 — Map status

Hub / spoke / broken spoke / gap. WebFetch for broken-spoke check when anchor URL set.

### Step 4 — Metrics

Coverage rate and hub/spoke/broken/gap counts. If seed volume &lt; 50/mo or thin SERP, add **low confidence** note before interpreting %.

### Step 5 — Report (domain)

Required sections:

- **SERP intent note** (mandatory when `intent_split` is `mixed`)
- **Coverage map** — include `Tier` column (`relevance_tier`)
- **Priority gaps** — prefer `serp_native` / `core` in chosen lane; list `facet_drift` separately if mixed
- **Limitations** — data confidence, AIO source, lane choice

### Step 6 — Handoff (domain)

Emit `mode: "domain_coverage"`, `handoff_version: "1.1"` per `REFERENCE.md`.

## Mode B — Keyword-only (Steps 5b–6b)

Skip Steps 2–4.

### Step 5b — Report (keyword-only)

Required sections:

- **SERP intent note** (mandatory when `intent_split` is `mixed`)
- **Fan-out map** — group or sort by `relevance_tier`: SERP-native → core → facet_drift → adjacent
- **Priority sub-queries** — tier rules, not volume-only sort when mixed
- **Seed SERP notes** — top domains + lane labels
- **Limitations**

Optional: `dataforseo_labs_google_serp_competitors` for market context.

### Step 6b — Handoff (keyword-only)

Emit `mode: "keyword_only"`, `handoff_version: "1.1"`. `domain` is `null`.

## Optional enrichments (domain mode)

| When | Tool |
|------|------|
| GEO / citation | `ai_opt_llm_ment_search` |
| Competitor set | `dataforseo_labs_google_serp_competitors` |
| Empirical fan-out | GSC MCP when available |

## Done definition

**All modes**

- [ ] Step 0 live SERP executed; PAA deduped
- [ ] Step 0.5 lane classification recorded
- [ ] Unified relevance gate applied to all expansion sources
- [ ] Each sub-query has `relevance_tier`; facet drift tagged where applicable
- [ ] Priority follows tier rules (SERP-native &gt; volume when mixed)
- [ ] `handoff_version: "1.1"` with extended `serp_context`
- [ ] Low-confidence flag when seed volume &lt; 50/mo or thin SERP
- [ ] ≥20 accepted sub-queries; limitations stated

**Mode A additionally:** coverage via `ranked_keywords`; priority gaps respect chosen lane.

**Mode B additionally:** no ranked_keywords; `priority_sub_queries[]` populated.

## Notes

- Fan-out approximates AI decomposition; not a literal trace.
- Credits: `REFERENCE.md`.
- **Maintainers:** after tiering/priority changes, run `node scripts/verify-scorecard.mjs` (S1–S8 in `examples/SCORECARD-wordpress-plugin-marketing.md`).
