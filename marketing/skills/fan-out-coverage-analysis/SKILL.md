---
name: Fan-Out-Coverage-Analysis
type: composite
description: >
  Use when analyzing fan-out coverage, sub-query coverage, topic coverage gaps,
  or keyword-only SERP fan-out without a domain. Simulates AI query fan-out and
  optional domain coverage checks for a keyword.
version: 2.12.0
---

# Fan-Out Coverage Analysis

## Purpose

Approximate query fan-out from SERP + Labs data. With a **user-supplied domain**, measure which sub-queries the site covers. **Without a domain**, run **keyword-only SERP fan-out** (no coverage checks).

**Public skill:** Domain-agnostic and client-agnostic. Use `example.com` and generic seeds in docs/fixtures only — real domains belong in user prompts at runtime, not committed artifacts.

## Not this skill

- **Keyword research / volume discovery** — use your SEO tool's keyword explorer; this skill maps fan-out from a seed you already chose.
- **Full technical SEO audit** — use site-wide crawlers or technical audit workflows.
- **Content differentiation scoring** — use [Information Gain Evaluator](../information-gain-evaluator/) on a specific URL after fan-out identifies gaps.
- **Site page inventory** — use [Site Content Catalog](../site-content-catalog/) before hub/spoke mapping at scale.

## Input policy (non-negotiable)

- **Primary keyword** — from the user only.
- **Domain** — from the user only. **Never** infer from examples, workspace context, project config, or prior runs.
- **`content_context`** (optional) — site or brand name for report framing (e.g. “content angle for example.com”). **Does not** enable domain mode or coverage checks.
- **Mode resolution:** If the user supplies a **domain** (or says “on example.com”), run **Mode A** (`domain_coverage`). If they name a site only for context, ask once whether to measure coverage on that domain or run keyword-only.
- If the user did not supply a domain, **ask once**:

  > *Which domain should I check coverage for? (Optional: anchor URL. Or reply **keyword only** for SERP fan-out without a site.)*

- If still no domain (or user chooses keyword-only), run **Mode B** only. No `ranked_keywords`, no coverage %.

## Quick start

1. Confirm **primary keyword** (required).
2. Resolve **domain** per Input policy.
3. **Steps 0 → 0.5 → 1 → 1b** (both modes).
4. **Mode A** (domain given): Steps 2–6.
5. **Mode B** (no domain): Steps 5b–6b → stop.
6. Offer to save report or pass handoff JSON downstream.

6. **Layperson chat summary** per `LAYPERSON-OUTPUT.md` — **paste only** the stdout block from `run-fanout.mjs --write-reports` (or `build-layperson-summary.mjs`). Do not add tier tables, verifier lines, MCP logs, or handoff JSON in chat.

**Reference:** `REFERENCE.md` — API params, relevance gates, handoff schema v1.2  
**Requirements:** `REQUIREMENTS.md`  
**Examples:** `EXAMPLES.md` — mixed-SERP case study + regression scorecard  
**Layperson contract:** `LAYPERSON-OUTPUT.md`  
**Ship bar:**

```bash
node scripts/verify-all.mjs
```

**Shell note (Windows):** Use `;` between commands in PowerShell — `&&` is not valid. Example:

```powershell
Set-Location marketing/skills/fan-out-coverage-analysis; node scripts/verify-all.mjs
```

**Pipeline (after MCP):**

```bash
node scripts/ingest-mcp-export.mjs --serp raw-serp.json --labs related-raw.json:related -o merged.json --intent-out intents.json
node scripts/run-fanout.mjs --seed "..." --merged merged.json --ranked-file ranked.json --partial partial.json --output handoff.json --write-reports
```

**Merge MCP exports:** `scripts/ingest-mcp-export.mjs` (raw MCP JSON) or `scripts/merge-expansion-input.mjs` (pre-flattened)  
**Coverage merge:** `scripts/apply-coverage.mjs` (or `--ranked-file` on `run-fanout.mjs`)  
**Normalizer (required):** `scripts/normalize-fanout.mjs`  
**Priority mapper (required after intent):** `scripts/apply-priority.mjs`  
**Layperson summary:** `scripts/build-layperson-summary.mjs`

## Shared steps (both modes)

### Step 0 — SERP seed

`serp_organic_live_advanced` on the primary keyword. Extract PAA (dedupe nested), related searches, live AI Overview presence, top organic titles/domains. See `REFERENCE.md`.

Record `ai_overview_present` from **live SERP** only. If Labs index disagrees, note in `limitations[]`.

**Complete when:** `serp_context.people_also_ask` is deduped, `related_searches` captured, `ai_overview_present` + `ai_overview_source: live_serp` set, and top organic domains recorded.

### Step 0.5 — SERP lane classification

Classify top 8–10 organic results into lanes (see `REFERENCE.md`). Set `serp_context.intent_lanes_detected`, `intent_split` (`single` | `mixed`), and `lane_counts`.

If **mixed**, ask once which lane to prioritize — unless the user already stated intent in the prompt:

> *This SERP mixes **[lane A]** and **[lane B]** results. Which should I prioritize for fan-out and gaps? (Or reply **report both**.)*

Store chosen lane in `inputs.intent_lane` when provided.

**Complete when:** every classified organic result has a lane label and `intent_split` is set; user prompted once if mixed and lane not yet chosen.

### Step 1 — Expand sub-queries

**Expansion policy (v2.9):**

| Source | When |
|--------|------|
| SERP seed (Step 0) | Always |
| `related_keywords` | Always |
| `keyword_suggestions` | **Skip** when post-merge SERP + related count ≥ 15 **or** `inputs.intent_lane === tool_discovery` |
| `keyword_ideas` | When `serp_result_count` &lt; 200 **and** related yield &lt; 10 (thin SERP category fan-out) |

Note skipped suggestions or ideas path in `limitations[]`.

Parallel Labs calls per policy above. Merge Step 0 seeds into `{ "items": [ … ] }` via **`ingest-mcp-export.mjs`** (raw MCP JSON) or **`merge-expansion-input.mjs`** (pre-flattened):

```bash
node scripts/ingest-mcp-export.mjs --serp raw-serp.json --labs related-raw.json:related --labs suggestions-raw.json:suggestions -o merged.json --intent-out intents.json
```

**Thin-seed fallback:** When Labs returns empty for the exact seed **and** `seed_volume` &lt; 50 (or missing), retry expansion on a **parent cluster** phrase (e.g. `go to market strategy` for `wordpress product go to market`). Re-merge with SERP seeds; re-run `normalize-fanout.mjs`; note parent cluster in `limitations[]`. Do not import unrelated vertical terms without seed token overlap.

Run **`normalize-fanout.mjs`** with `--seed` and `--lane` (when `inputs.intent_lane` is set). Use script output as the authoritative tier list — do not re-tier in prose. **Do not** drop normalizer rejections (e.g. zero-overlap brands on `serp_related`) post-hoc.

Target **25–30** accepted sub-queries after dedupe on live runs. Keep facet-drift terms **tagged**, not silently dropped, unless zero seed-token overlap. Regression fixtures may use smaller subsets (see `limitations[]`).

**Complete when:** merged input passed through `normalize-fanout.mjs`; each accepted row has `relevance_tier`, `dimension`, and `on_seed_serp`.

### Step 1b — Search intent + priority

`dataforseo_labs_search_intent` on the normalized keyword list. Attach `search_intent` to each row.

Run **`apply-priority.mjs`** with `--intent-split` and `--lane` from handoff inputs. Merge into `sub_queries[]` and build `priority_sub_queries[]` from script output — do not assign `high|medium|low` manually.

**Complete when:** every `sub_queries[]` row has `search_intent` and `priority`; `priority_sub_queries[]` (Mode B) matches `apply-priority.mjs` output.

## Mode A — Domain coverage (Steps 2–6)

Run only when a **domain** was supplied.

### Step 2 — Domain coverage

`dataforseo_labs_google_ranked_keywords`: bulk `ilike` + spot-check gaps. Not `relevant_pages`.

**Filter field:** use `keyword_data.keyword` (not `keyword`) in MCP filters — see `REFERENCE.md`.

Save MCP export, then run coverage merge:

```bash
node scripts/apply-coverage.mjs handoff-partial.json ranked.json -o handoff.json
# or in one pipeline pass:
node scripts/run-fanout.mjs ... --ranked-file ranked.json --partial handoff-partial.json --output handoff.json
```

**Complete when:** each high-priority sub-query has `status`, `covering_url`, and `rank_group` from ranked_keywords or spot-check (via script — do not hand-patch).

### Step 3 — Map status

Hub / spoke / broken spoke / gap. WebFetch for broken-spoke check when anchor URL set.

**Complete when:** every sub-query with a ranking has hub/spoke/broken_spoke status; `hub_spoke_map[]` populated for hubs.

### Step 4 — Metrics

Coverage rate and hub/spoke/broken/gap counts. **SSOT for user-facing %:** `coverage_summary.cluster_coverage_rate_pct` (intent clusters). Set `coverage_summary.labs_coverage_rate_pct` as row-level Labs index; mirror `coverage_rate_pct` to cluster rate for v1.2 handoffs. When live SERP shows `inputs.anchor_url` ranking for the seed but Labs has no row, set `serp_context.anchor_serp_rank` and `coverage_summary.coverage_story` in plain language — do not let **0%** stand alone without context. Use `status: hub_serp_only` when live rank exists but Labs index lags. Seed-synonym clusters count as covered when anchor ranks on seed.

**Complete when:** `coverage_summary` cluster counts match canonical rollup; Labs row rate internally consistent; live anchor rank recorded when known.

### Step 5 — Report (domain)

**Chat:** layperson summary only (`LAYPERSON-OUTPUT.md`). **Detail file:** technical sections below.

Required sections in **detail report**:

- **SERP fan-out ingested** — PAA and related from accepted `sub_queries` (SSOT; supersedes shallow SERP snapshot)
- **SERP intent note** (mandatory when `intent_split` is `mixed`)
- **Coverage map** — tier, status, cluster, intent, source columns
- **Intent clusters** + **weak coverage** (`hub_serp_only`) when domain mode
- **Priority gaps** — prefer `serp_native` / `core` in chosen lane; list `facet_drift` separately if mixed
- **Limitations** — data confidence, AIO source, lane choice, Labs vs live SERP

**Complete when:** detail report written; chat matches layperson contract; gap table matches handoff `gaps[]`.

### Step 6 — Handoff (domain)

Emit `mode: "domain_coverage"`, `handoff_version: "1.2"`, `skill`, `skill_version` per `REFERENCE.md`.

**Complete when:** `node scripts/verify-handoff.mjs <path>` exits 0.

## Mode B — Keyword-only (Steps 5b–6b)

Skip Steps 2–4.

### Step 5b — Report (keyword-only)

**Chat:** layperson summary only. **Detail file:** technical fan-out map.

Required in detail report:

- **SERP intent note** (mandatory when `intent_split` is `mixed`)
- **Fan-out map** — group or sort by `relevance_tier`: SERP-native → core → facet_drift → adjacent
- **Priority sub-queries** — tier rules, not volume-only sort when mixed
- **Seed SERP notes** — top domains + lane labels
- **Limitations**

Optional: `dataforseo_labs_google_serp_competitors` for market context.

**Complete when:** fan-out map tier groups match handoff `sub_queries[]`; `priority_sub_queries[]` is tier-ordered.

### Step 6b — Handoff (keyword-only)

Emit `mode: "keyword_only"`, `handoff_version: "1.2"`, `skill`, `skill_version`. `domain` is `null`.

**Complete when:** `node scripts/verify-handoff.mjs <path>` exits 0.

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
- [ ] `normalize-fanout.mjs` run on merged expansion input
- [ ] `apply-priority.mjs` run after search intent (no manual priority labels)
- [ ] Each sub-query has `relevance_tier`; facet drift tagged where applicable
- [ ] Priority follows tier rules (SERP-native &gt; volume when mixed)
- [ ] Handoff includes `handoff_version: "1.2"`, `skill`, `skill_version`, extended `serp_context`
- [ ] Low-confidence flag when seed volume &lt; 50/mo or thin SERP
- [ ] ≥20 accepted sub-queries on live runs (25–30 target); limitations stated if fewer
- [ ] `node scripts/verify-handoff.mjs` passes on emitted handoff
- [ ] Chat = layperson summary only; detail report linked (`LAYPERSON-OUTPUT.md`)

**Mode A additionally:** coverage via `ranked_keywords`; priority gaps respect chosen lane; `coverage_summary` math consistent.

**Mode B additionally:** no ranked_keywords; `priority_sub_queries[]` populated and tier-ordered.

## Notes

- Fan-out approximates AI decomposition; not a literal trace.
- Credits: `REFERENCE.md`.
- **Maintainers:** after substantive changes, run `node scripts/verify-all.mjs` (S1–S12, G/R, LP1–LP30, CL1–CL13, SC1–SC4, NR1, EP1–EP5, C1–C22, DR1–DR9, AG1–AG4, PR1–PR7, PA1–PA8, I1–I9, XP1–XP4). Re-run live SERP on mixed-intent golden seeds quarterly.

### v2.12.0 — Battle-test remediation (Shopify / Allrecipes / HubSpot / Crunchbase / Wikipedia / Notion)

- **Off-topic PAA demotion (SSOT)** — health/YMYL, hustle/cost, pricing-adjacent PAAs rejected or demoted on `primary_topic` lanes; hustle PAAs capped in tool_discovery write-next.
- **Partial-coverage write-next** — when `tool_discovery` has partial cluster coverage, commercial `serp_native` related ranks before hustle PAAs (`AG4` / `LP29`).
- **Mixed-SERP commercial modifiers** — `free`, `jobs`, `course`, `pdf`, `download` → `facet_drift` when `intent_split: mixed` (`PA8`, `R3`, `R15`).
- **Homograph brand leak** — e.g. `pricing page wise` rejected at normalize (`NR1`).
- **G23 thin all-gap runs** — passes when all gap rows fit under cap 12; fails only when truncation expected but missing.
- **Nested Labs ingest** — one-level flatten of `related_keywords` (`I9`).
- **Marketplace competitor priority** — listicle/marketplace related before PAA when competitor domains on SERP (`PR7`).
- **Encyclopedia profile** — `inputs.site_profile: encyclopedia`; sibling spoke reconciliation; layperson strengthen/link copy (`EP1–EP5`).
- **Dual-lane layperson** — lane note when limitations report both lanes (`LP30`, `SC4`).
- **Intent-file auto-wire** — `run-fanout.mjs` resolves sibling `*-intents.json` when `--merged` provided.

### v2.11.0 — Battle-test hardening (Healthline / NYT)

- **Numeric permutation guard** — `type 1` vs `type 2` tokens no longer collapse to `seed_synonym`.
- **`broken_spoke` layperson section** — page 2+ ranks surfaced as strengthen, not net-new.
- **Lane mismatch verdict** — warns when SERP-dominant lane ≠ chosen `intent_lane`; `intent_split` normalized from `lane_counts`.
- **Career PAA demotion** — salary/PMI/big-3 PAAs rank after commercial related on tool SERPs.
- **Zero-coverage write-next blend** — caps non-career PAAs at 3, fills with high-volume `serp_native` related.

### v2.10.0 — No-PAA hardening

- **Post-coverage canonical refresh** for `seed_synonym` clusters (`refreshClusterCanonicals`) — covered row wins over gap anagram alias.
- **Actionable gaps** demote seed permutations when the cluster already has coverage.
- **Detail report** cluster rollup status (`covered` / `weak` / `gap`); hub-path copy for non-root anchors.
- **Modifier collapse** (`reddit`, years, redundant `download`) into parent `seed_adjacent` clusters.
- **No-PAA priority** — SERP-native commercial terms first; competitor gaps before modifier/theme noise under `tool_discovery`.
- **`gaps_shortlist_count` / `gaps_row_total`** in `coverage_summary`; detail gaps header labels shortlist vs totals.
