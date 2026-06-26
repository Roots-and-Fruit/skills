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

**Ideas:** same locale; apply relevance gate below.

### Unified relevance gate (all sources)

Apply to **ideas, suggestions, related items, and nested related strings** — not ideas only.

**Accept** a candidate if **any** of:

1. Source is `serp_paa` or `serp_related` (after PAA filter below)
2. Normalized keyword appears in seed SERP related searches
3. Shares ≥2 salient tokens with seed (after stopword removal), **or** seed has ≤2 salient tokens and ≥1 shared
4. Shares DataForSEO `core_keyword` with an already-accepted term
5. User explicitly widened scope

**Reject** (do not include in `sub_queries[]`):

- **Zero** salient-token overlap with seed (e.g. unrelated brand returned by related-keywords API)
- Single-token overlap only when seed has **≥3** salient tokens **and** term is not on seed SERP — unless user widened scope

**Tag but keep** (facet drift):

- Passes gate but adds a **product facet** not present in seed tokens — see Facet drift below

### PAA relevance filter

1. Dedupe identical PAA strings.
2. **Reject** platform-meta PAA matching patterns in `REFERENCE` platform-meta list (e.g. “outdated in 20XX”, “moving away from”, “what is replacing”, “leaving”) unless user widened scope.
3. When seed has **≥3** salient tokens: require **≥2** token overlap **or** `serp_related` match **or** alignment with chosen `intent_lane`.
4. When seed has **≤2** salient tokens: require **≥1** overlap.

### Facet drift

A term **shares seed tokens** but changes the job — typically Labs suggestions swapping one facet for another (e.g. seed = “market your plugin”, expansion = “email marketing plugin”).

Signals:

- Contains facet tokens **not** in seed: `email`, `newsletter`, `affiliate`, `crm`, `seo`, `analytics`, `sms`, `referral`, etc.
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

1. **High:** `serp_native` in chosen lane, or `core` matching `inputs.intent_lane`
2. **Medium:** `core` without lane match, or `facet_drift` with high commercial volume
3. **Low:** `adjacent`, platform-meta, wrong-lane facet drift

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

### Spot-check gaps

Exact-match filter per high-priority gap in **chosen lane**.

**MCP filter limit:** max 3 top-level filter elements per call.

## Handoff schema v1.1

Set `handoff_version: "1.1"`. v1.0 fields remain valid; v1.1 adds optional fields below.

### Extended `inputs`

```json
{
  "primary_keyword": "string",
  "domain": "string | null",
  "anchor_url": "string | null",
  "location_name": "string",
  "language_code": "string",
  "intent_lane": "primary_topic | tool_discovery | community | directory | null"
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
  "serp_result_count": 123
}
```

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

See `examples/domain-coverage.handoff.sample.json` and `examples/keyword-only.handoff.sample.json` for v1.1 samples.

## normalize-fanout.mjs

```bash
node scripts/normalize-fanout.mjs --seed "your keyword" --file merged.json
node scripts/normalize-fanout.mjs --seed "your keyword" --lane primary_topic --file merged.json
```

- Applies unified relevance gate to all sources
- Outputs `relevance_tier`, `dimension` (including `facet_drift`), `priority_score`
- Sorts by priority score (SERP-native first), not volume alone

Input: `{ "items": [ { "keyword", "search_volume", "source" } ] }`

## Credit guidance

Typical run: 1 SERP + 3 Labs + 1 intent + 0–2 ranked bulk + 5–15 spot checks (domain mode).
