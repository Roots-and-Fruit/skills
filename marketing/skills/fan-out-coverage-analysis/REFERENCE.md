# Fan-Out Coverage Analysis — Reference

API contracts, SERP lane rules, relevance gates, handoff schema v1.1, and filters.

## Domain policy

- Domains come **only** from the user prompt or explicit playbook parameters.
- Missing domain → ask once → **keyword_only** mode if still absent.

## MCP tool names (DataForSEO)

| Step | MCP tool |
|------|----------|
| SERP seed | `serp_organic_live_advanced` |
| Expansion | `dataforseo_labs_google_related_keywords` |
| Expansion | `dataforseo_labs_google_keyword_suggestions` |
| Expansion (filtered) | `dataforseo_labs_google_keyword_ideas` |
| Intent batch | `dataforseo_labs_search_intent` |
| Coverage (primary) | `dataforseo_labs_google_ranked_keywords` |
| Competitors | `dataforseo_labs_google_serp_competitors` |
| LLM visibility (optional) | `ai_opt_llm_ment_search`, `ai_opt_llm_ment_top_pages` |

**Do not use** `dataforseo_labs_google_relevant_pages` for per-keyword coverage.

## Location and language

Default: `location_name: "United States"`, `language_code: "en"`.

## Step 0 — SERP seed

```
serp_organic_live_advanced
  keyword: <primary keyword>
  location_name: United States
  language_code: en
  depth: 10
  people_also_ask_click_depth: 2
```

Extract:

- PAA questions — **dedupe** identical questions across nested PAA expansions
- `related_searches`
- Live `ai_overview` block presence (from this response, not Labs index alone)
- Top organic: `domain`, `title`, `url` for lane classification

Mark SERP-sourced terms with sources: `serp_paa`, `serp_related` (related searches on seed SERP).

### AI Overview source of truth

| Source | Use for |
|--------|---------|
| **Live SERP** (`serp_organic_live_advanced`) | `ai_overview_present` in handoff |
| **Labs index** (`serp_item_types` on keyword) | Context only — if it disagrees with live SERP, note in `limitations[]` |

## Step 0.5 — SERP lane classification

Label each top-8 organic result with one lane:

| Lane | Typical signals (title, URL, domain) |
|------|--------------------------------------|
| `primary_topic` | Directly answers the seed job (how-to, strategy, product page for the seed topic) |
| `tool_discovery` | Listicles, “best X plugin/tool”, comparisons, roundups |
| `community` | Forums, Q&A threads, practitioner discussions |
| `directory` | Tag pages, marketplaces, repo listings |
| `platform_meta` | “Is X dead/outdated”, migration away, industry trend pieces |
| `other` | Does not fit above |

Set `serp_context`:

```json
{
  "intent_lanes_detected": ["primary_topic", "tool_discovery"],
  "intent_split": "single | mixed",
  "lane_counts": { "primary_topic": 4, "tool_discovery": 4 }
}
```

- **`single`**: one lane has ≥70% of classified results.
- **`mixed`**: two or more lanes each have ≥2 results, or no lane ≥70%.

When **mixed**, ask user for `inputs.intent_lane` unless they already specified focus or said “report both”.

Generic lane names — map to the user’s words in the report (e.g. “developer GTM” vs “martech listicle”).

## Step 1 — Keyword expansion

### API calls

**Related keywords:**

```
dataforseo_labs_google_related_keywords
  keyword: <primary>
  location_name: United States
  language_code: en
  limit: 20
  filters: [["keyword_data.keyword_info.search_volume", ">", 0]]
  order_by: ["keyword_data.keyword_info.search_volume,desc"]
```

Harvest nested `related_keywords` strings when present.

**Suggestions:**

```
dataforseo_labs_google_keyword_suggestions
  keyword: <primary>
  ...
```

**Ideas:** same locale; apply relevance gate below. **Skip** when `serp_result_count` &lt; 200 (thin SERP) — related + suggestions + SERP seeds are sufficient.

### Thin-seed parent-cluster fallback

When Labs `related_keywords` and `keyword_suggestions` return **empty** for the exact seed and `seed_volume` &lt; 50:

1. Choose a parent phrase (e.g. `go to market strategy` for `wordpress product go to market`).
2. Run Labs expansion on parent; merge with Step 0 SERP seeds.
3. Re-run `normalize-fanout.mjs` — unified gate still rejects zero-overlap drift.
4. Note parent cluster + low confidence in `limitations[]`.

### Unified relevance gate (all sources)

Apply to **ideas, suggestions, related items, and nested related strings** — not ideas only.

**Accept** a candidate if **any** of:

1. Source is `serp_paa` or `serp_related` (after PAA filter below)
2. Normalized keyword appears in seed SERP related searches
3. Shares ≥2 salient tokens with seed (after stopword removal), **or** seed has ≤2 salient tokens and ≥1 shared
4. Shares DataForSEO `core_keyword` with an already-accepted term
5. User explicitly widened scope

**Reject** (do not include in `sub_queries[]`):

- **Zero** salient-token overlap with seed — **including** `serp_related` / `related_searches` brands (e.g. `mailpoet` on a plugin-marketing SERP)
- Single-token overlap only when seed has **≥3** salient tokens **and** term is not on seed SERP — unless user widened scope

**Acronym expansion (overlap only):** `gtm` / `gtms` → `go to market` before token overlap (so PAA like “5 pillars of GTM” survives on GTM seeds).

**Tag but keep** (facet drift):

- Passes gate but adds a **product facet** not present in seed tokens — see Facet drift below

### PAA relevance filter

1. Dedupe identical PAA strings.
2. **Reject** platform-meta PAA matching patterns in `REFERENCE` platform-meta list (e.g. “outdated in 20XX”, “moving away from”, “what is replacing”, “leaving”) unless user widened scope.
3. When seed has **≥3** salient tokens: require **≥2** token overlap **or** `serp_related` match **or** alignment with chosen `intent_lane`.
4. When seed has **≤2** salient tokens: require **≥1** overlap.
5. **Off-topic demotable PAA (v2.12, `isOffTopicDemotablePaa` SSOT):** on `primary_topic` lanes, reject or demote PAAs matching:

| Category | Example tokens / patterns |
|----------|---------------------------|
| Health / YMYL | `blood pressure`, `blood sugar`, `diabetes`, `spike` (when absent from seed) |
| Hustle / cost | `$100`, `fail`, `enough to start`, `per month` |
| Pricing-adjacent | `how much is`, `worth`, `cost to send` |
| Career (v2.11) | `salary`, `PMP`, `big 3` |

On `tool_discovery`, demotable PAAs rank after commercial related; excluded from layperson write-next but may remain in priority shortlist after marketplace/listicle rows.

A term **shares seed tokens** but changes the job — typically Labs suggestions swapping one facet for another (e.g. seed = “market your plugin”, expansion = “email marketing plugin”).

Signals:

- Contains facet tokens **not** in seed: `email`, `newsletter`, `affiliate`, `crm`, `seo`, `analytics`, `sms`, `referral`, etc.
- **Commercial modifiers on mixed SERP (v2.12):** `free`, `jobs`, `course`, `pdf`, `download` when `intent_split: mixed` and row is not the seed keyword
- Classified as `tool_discovery` lane mismatch vs user’s `intent_lane`
- High Labs volume but absent from seed SERP related searches and PAA

Set:

- `dimension`: `facet_drift` (or `detail_drill` + `relevance_tier: facet_drift`)
- `relevance_tier`: `facet_drift`
- `intent_lane`: best-fit lane or `null`

Do **not** treat facet-drift terms as priority gaps for the wrong lane.

### Platform-meta PAA patterns (reject by default)

Case-insensitive match on PAA text:

- `\boutdated\b`, `\breplacing\b`, `\bmoving away\b`, `\bleaving\b`, `\bdead\b`, `\bstill relevant\b`, `\bwhat is replacing\b`

## Step 1b — Search intent

```
dataforseo_labs_search_intent
  keywords: [<up to 30 merged sub-queries>]
  language_code: en
```

## Relevance tiers and priority

### `relevance_tier` (required on each sub-query)

| Tier | Definition |
|------|------------|
| `serp_native` | On seed SERP (PAA or related search), **not** facet drift — **or** facet drift with `intent_lane` matching `inputs.intent_lane` |
| `core` | Labs expansion aligned with seed; not facet drift |
| `facet_drift` | Token overlap but different facet/job — includes **seed related searches** that are facet drift when lane does not match |
| `adjacent` | Weak fit; platform-meta; brand-only; zero overlap |

**v2.3 lane-aware rule (mixed SERPs):** Do **not** assign `serp_native` to a seed related-search term solely because it appears on the SERP. If the term is **facet drift** and `inputs.intent_lane` is set, require `intent_lane === inputs.intent_lane` for `serp_native`; otherwise use `facet_drift`. If `intent_lane` is unset and the term is facet drift, use `facet_drift` (not `serp_native`).

Regression proof: `examples/SCORECARD-wordpress-plugin-marketing.md` · `node scripts/verify-scorecard.mjs`

### Priority (`high` | `medium` | `low`)

When `intent_split` is **`mixed`**, apply tiers **before** raw volume:

1. **High:** `serp_native` with `intent_lane` matching `inputs.intent_lane`, **or** PAA `question` on seed SERP, **or** `core` matching `inputs.intent_lane`
2. **Medium:** `serp_native` on seed without lane match; `core` without lane match; `facet_drift` with volume ≥ 50
3. **Low:** `adjacent`; `facet_drift` with volume &lt; 50; wrong-lane facet drift on related searches

**Script:** `node scripts/apply-priority.mjs --intent-split mixed --lane <lane>`

When `intent_split` is **`single`**, volume and commercial intent may boost priority as before:

- **High:** volume ≥ 50, commercial intent, in PAA, or `serp_native`
- **Medium:** volume 10–49, question in PAA, `core` tier
- **Low:** volume &lt; 10, `adjacent`, `facet_drift` unless user chose that lane

### `priority_sub_queries[]` ordering

1. All `high` in tier order: serp_native → core → facet_drift
2. Do **not** sort by volume alone when `intent_split` is `mixed`

## Data confidence flags

Add to `limitations[]` when **any** apply:

| Condition | Message |
|-----------|---------|
| Seed volume &lt; 50/mo | Low head-term volume — prioritize SERP-native signals |
| Labs `se_results_count` &lt; 200 (when available) | Thin SERP — expansion unstable |
| `intent_split` is `mixed` and user did not pick lane | Report includes both lanes — gaps are lane-dependent |
| Export/CSV mode | Stale or partial data |

## Dimension classification

| Dimension | Signals |
|-----------|---------|
| **core_variant** | Same entities reordered; high seed token overlap |
| **detail_drill** | Adds method, feature, or role without facet drift |
| **facet_drift** | Seed tokens + different product facet or listicle job |
| **question** | how/what/why/can/does; troubleshooting |
| **long_tail** | ≥5 words, specific scenario |
| **adjacent_topic** | Brand, platform-meta, or no seed tokens |

Use `scripts/normalize-fanout.mjs` for deterministic merge when normalizing raw JSON.

## Domain coverage (Mode A)

### Bulk pass

```
dataforseo_labs_google_ranked_keywords
  target: <domain>
  filters: [["keyword_data.keyword", "ilike", "%<stem>%"]]
  ...
```

**MCP filter cheat sheet:** ranked_keywords filters must use **`keyword_data.keyword`** — not `keyword`. Wrong field returns empty results with no error.

Example spot-check filter:

```json
[["keyword_data.keyword", "=", "sso vs oauth"]]
```

### Spot-check gaps

Exact-match filter per high-priority gap in **chosen lane**.

**MCP filter limit:** max 3 top-level filter elements per call.

## Handoff schema v1.2

Set `handoff_version: "1.2"`. v1.1 fields remain valid; v1.2 adds intent-cluster fields below.

### Top-level fields (all modes)

```json
{
  "handoff_version": "1.2",
  "skill": "fan-out-coverage-analysis",
  "skill_version": "2.12.0",
  "mode": "keyword_only | domain_coverage",
  "generated_at": "ISO 8601",
  "limitations": ["string"]
}
```

**Regression:** `node scripts/verify-all.mjs` — includes G1–G23, R1–R15, PA1–PA8, CL1–CL13, NR1, EP1–EP5, SC1–SC4, C/LP/DR/AG/PR/XP/I layers.

**G23 (v2.12):** `gaps_shortlist_count` must equal `gaps[]` length and be ≤ `gaps_row_total`. **Fail** only when `gaps_row_total > 12` and `gaps_shortlist_count === gaps_row_total` (truncation to 12 expected). Thin all-gap runs where every gap fits under the cap **pass**.

**Encyclopedia profile (v2.12):** Set `inputs.site_profile: "encyclopedia"` (auto for `wikipedia.org` domains in `run-fanout.mjs`). Coverage reconciliation maps gap keywords to ranked sibling articles as `spoke`; year-only variants do not get `hub_serp_only` on anchor. Layperson copy favors strengthen/link existing articles.

**Nested Labs ingest (v2.12):** `ingest-mcp-export.mjs` flattens one level of `keyword_properties.related_keywords`, dedupes, caps at 50 per parent.

### v1.2 cluster fields (`sub_queries[]`)

| Field | Type | Notes |
|-------|------|-------|
| `intent_cluster_id` | string | Stable cluster key (`seed_synonym`, `seed_adjacent:…`, `serp_paa:…`, `intent_sig:…`) |
| `is_canonical` | boolean | One canonical row per cluster |
| `cluster_role` | string | `canonical` \| `alias` |

### v1.2 `coverage_summary` (domain mode)

| Field | SSOT |
|-------|------|
| `cluster_coverage_rate_pct` | **User-facing coverage %** |
| `cluster_count` / `cluster_covered_count` / `cluster_gap_count` | Intent cluster rollup |
| `labs_coverage_rate_pct` | Row-level Labs index (may lag live SERP) |
| `gaps_shortlist_count` | Length of actionable `gaps[]` shortlist (max 12) |
| `gaps_row_total` | Count of sub-query rows with `status: gap` |

**Canonical refresh (v2.10):** After `apply-coverage`, `refreshClusterCanonicals` reassigns `is_canonical` on `seed_synonym` clusters so covered rows (including `hub_serp_only`) win over gap anagram aliases.

**`gaps[]` shortlist:** Actionable canonical gaps from `priority_sub_queries` — not the same as `gaps_row_total` or `cluster_gap_count`. Detail report header: `Gaps (shortlist N of M row gaps, K cluster gaps)`.

**PAA ingest:** SERP `serp_paa` rows skip token-overlap gate; only platform-meta patterns reject.

**Optional Step 1b enrichment:** `dataforseo_labs_google_keyword_overview` on canonical keywords post-normalize (batch ≤ 30) for volume/intent validation.

## Handoff schema v1.1 (legacy)

Set `handoff_version: "1.1"`. v1.0 fields remain valid; v1.1 adds optional fields below.

### Top-level fields (all modes)

```json
{
  "handoff_version": "1.1",
  "skill": "fan-out-coverage-analysis",
  "skill_version": "2.8.0",
  "mode": "keyword_only | domain_coverage",
  "generated_at": "ISO 8601",
  "limitations": ["string"]
}
```

**Regression:** `node scripts/verify-handoff.mjs` — G1–G19 schema + R1–R6 rubric on all `*.handoff.fixture.json`; profile-specific R7–R11 on golden fixtures.

### Extended `inputs`

```json
{
  "primary_keyword": "string",
  "domain": "string | null",
  "anchor_url": "string | null",
  "location_name": "string",
  "language_code": "string",
  "intent_lane": "primary_topic | tool_discovery | community | directory | null",
  "content_context": "string | null",
  "site_profile": "encyclopedia | null"
}
```

### Extended `serp_context`

```json
{
  "ai_overview_present": false,
  "ai_overview_source": "live_serp | labs_index | none",
  "people_also_ask": ["string"],
  "related_searches": ["string"],
  "top_organic_domains": ["string"],
  "intent_lanes_detected": ["primary_topic", "tool_discovery"],
  "intent_split": "single | mixed",
  "lane_counts": {},
  "seed_volume": 30,
  "serp_result_count": 123,
  "anchor_serp_rank": 4
}
```

`anchor_serp_rank` — optional live organic position for `inputs.anchor_url` or domain on the **seed keyword** (from Step 0 SERP, not Labs).

### Extended `coverage_summary` (domain mode)

```json
{
  "sub_query_count": 30,
  "covered_count": 0,
  "gap_count": 30,
  "labs_coverage_rate_pct": 0,
  "coverage_rate_pct": 0,
  "anchor_serp_rank": 4,
  "coverage_story": "Anchor ranks #4 live for seed; Labs index not yet updated for fan-out terms."
}
```

Use `labs_coverage_rate_pct` as SSOT; mirror `coverage_rate_pct` for backward compatibility. Always pair low Labs % with `coverage_story` when live SERP rank is known.

### Sub-query `status` (domain mode)

`hub` | `spoke` | `broken_spoke` | `gap` | **`hub_serp_only`** — live SERP confirms rank for seed or **branded** `serp_related` term (shares distinctive seed tokens) but Labs `ranked_keywords` has no row yet. Generic GTM-only related searches stay `gap`.

### Extended `sub_queries[]` fields

```json
{
  "keyword": "string",
  "search_volume": 0,
  "dimension": "core_variant | detail_drill | facet_drift | question | long_tail | adjacent_topic",
  "search_intent": "informational | navigational | commercial | transactional | null",
  "relevance_tier": "serp_native | core | facet_drift | adjacent",
  "intent_lane": "primary_topic | tool_discovery | null",
  "on_seed_serp": true,
  "priority": "high | medium | low",
  "source": ["serp_paa", "serp_related", "related", "suggestions", "ideas"]
}
```

Mode A adds: `status`, `covering_url`, `rank_group`.

### `priority_sub_queries[]`

```json
{
  "keyword": "string",
  "search_volume": 0,
  "relevance_tier": "serp_native",
  "priority": "high",
  "rationale": "PAA on seed SERP; matches chosen lane primary_topic"
}
```

### Full mode payloads

See `examples/domain-coverage.handoff.sample.json` and `examples/keyword-only.handoff.sample.json` for illustrative shapes.

**Golden regression fixtures:** `wordpress-plugin-marketing-v2.3.handoff.fixture.json` (keyword_only) · `enterprise-sso-domain.handoff.fixture.json` (domain_coverage)

## normalize-fanout.mjs

```bash
node scripts/normalize-fanout.mjs --seed "your keyword" --file merged.json
node scripts/normalize-fanout.mjs --seed "your keyword" --lane primary_topic --file merged.json
```

- Applies unified relevance gate to all sources
- Outputs `relevance_tier`, `dimension` (including `facet_drift`), `priority_score`
- Sorts by priority score (SERP-native first), not volume alone

Input: `{ "items": [ { "keyword", "search_volume", "source" } ] }`

## apply-priority.mjs

```bash
node scripts/normalize-fanout.mjs --seed "..." --lane primary_topic --file merged.json \
  | node scripts/apply-priority.mjs --intent-split mixed --lane primary_topic
```

After `dataforseo_labs_search_intent`, pass intents via `--intent-file` or pre-merged `search_intent` on rows. Output: `{ sub_queries[], priority_sub_queries[] }` ready to wrap in handoff v1.1.

**Shortlist rule:** `priority_sub_queries[]` includes **all** `priority: high` rows first, then `medium` up to cap (default 12).

## merge-expansion-input.mjs

```bash
node scripts/merge-expansion-input.mjs --serp serp.json --labs related.json --labs suggestions.json -o merged.json
```

Folds SERP PAA/related + Labs `items[]` into normalize input `{ "items": [...] }`.

## ingest-mcp-export.mjs

```bash
node scripts/ingest-mcp-export.mjs \
  --serp raw-serp.json \
  --labs related-raw.json:related \
  --labs suggestions-raw.json:suggestions \
  -o merged.json \
  --intent-out intents.json
```

Flattens raw DataForSEO MCP task JSON (`tasks[0].result[0].items`) into merge input. Reads `keyword_data.keyword`, `keyword_info.search_volume`, and optional `search_intent_info.main_intent`. Prefer this over hand-flattening MCP responses.

Pass `--intent-out` to produce the JSON map for `apply-priority.mjs --intent-file`.

## apply-coverage.mjs

```bash
node scripts/apply-coverage.mjs handoff-partial.json ranked.json -o handoff.json
```

Maps `ranked_keywords` export to `status`, `covering_url`, `rank_group`, `coverage_summary`, `gaps[]`, and `hub_spoke_map[]`. Sets `hub_serp_only` for seed matches and branded `on_seed_serp` + `serp_related` rows when `anchor_serp_rank` is known. `gaps[]` shortlist: all **high** rows first, then medium (cap 12).

## run-fanout.mjs

```bash
node scripts/run-fanout.mjs \
  --seed "wordpress product go to market" \
  --lane primary_topic \
  --intent-split mixed \
  --merged merged.json \
  --ranked-file ranked.json \
  --partial handoff-partial.json \
  --output handoff.json \
  --write-reports
```

Chains normalize → apply-priority → apply-coverage (when `--ranked-file` + domain mode) → handoff merge → optional `writeFanoutReports()`. See `LAYPERSON-OUTPUT.md`.

## build-layperson-summary.mjs

```bash
node scripts/build-layperson-summary.mjs path/to/handoff.json [output_dir]
```

Prints chat summary to stdout; writes `reports/{slug}-{date}-detail.md`. Contract: `LAYPERSON-OUTPUT.md`.

## Credit guidance

Typical run: 1 SERP + 3 Labs + 1 intent + 0–2 ranked bulk + 5–15 spot checks (domain mode).
