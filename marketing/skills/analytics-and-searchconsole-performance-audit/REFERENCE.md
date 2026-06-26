# Analytics and Search Console Performance Audit — Reference

Handoff schema **v1.0**, CSV column aliases, scoring notes, and playbook consumer contract.

## Tier decision (this skill)

| Question | Answer |
|----------|--------|
| Playbook consumes handoff fields? | Yes — Hub & Spoke Discovery & Recovery Phase 1a |
| Proven agent drift risk? | Quadrant labels on identical CSVs |
| Named failure mode | Wrong `accidental_hub` / `hidden_gem` breaks recovery prioritization |
| **Tier** | **C** per [`write-a-skill`](../../../utilities/write-a-skill/SKILL.md) |

## URL normalization

Before join:

- Force `https://` scheme
- Strip trailing slashes on paths (except `/`)
- Strip `www.` when `inputs.domain` is provided
- GA4 path-only values (`/pricing`) → `https://{domain}/pricing`

Record merged/dropped row counts in `limitations[]` when non-trivial.

## GSC column aliases

| Canonical | Accepted headers (normalized) |
|-----------|------------------------------|
| page | `page`, `top_pages`, `landing_page`, `landingpage`, `url` |
| query | `query`, `top_queries`, `search_query`, `queries` |
| impressions | `impressions`, `impression` |
| clicks | `clicks`, `click` |
| position | `position`, `average_position`, `avg_position` |

## GA4 column aliases

| Canonical | Accepted headers |
|-----------|------------------|
| landing_page | `landing_page`, `landingpage`, `page_path`, `page_path_screen_class`, `page` |
| sessions | `sessions`, `session` |
| engagement_rate | `engagement_rate`, `engaged_sessions_rate` |

Conversion columns: match `inputs.conversion_events[]` by exact name or snake_case normalization.

## Scoring reference

### Visibility score weights

| Signal | Weight |
|--------|--------|
| Clicks percentile | 40% |
| CTR percentile | 25% |
| Position percentile (inverted) | 20% |
| Impressions percentile | 15% |

**Penalty:** `avg_position > 20` → multiply score by `0.85`

### Value score weights

| Condition | Formula |
|-----------|---------|
| `conversion_total > 0` | 85% conversion percentile + 15% sessions percentile |
| `conversion_total === 0` | 35% sessions percentile |

### Thresholds

Default: percentile rank ≥ `0.5` on each score distribution within the export cohort.

Override via `inputs.visibility_threshold` and `inputs.value_threshold` (advanced).

## Quadrant enum

**Full mode:**

- `unicorn`
- `accidental_hub`
- `hidden_gem`
- `prune_candidate`
- `protected_review`

**Partial modes:**

- `high_visibility_unvalued` / `low_visibility_unvalued` (gsc_only)
- `high_value_untracked` / `low_value_untracked` (ga4_only)
- `unclassified` (empty)

## Hub type hint enum

`commercial` · `technical` · `trust` · `product` · `unknown`

SSOT: `scripts/classify-hub-type.mjs`

## Handoff schema v1.0

```json
{
  "handoff_version": "1.0",
  "skill": "analytics-and-searchconsole-performance-audit",
  "skill_version": "1.3.1",
  "generated_at": "<ISO 8601>",
  "mode": "full | gsc_only | ga4_only | empty",
  "inputs": {
    "domain": "example.com",
    "date_range": "2025-12-01/2026-05-31",
    "analysis_mode": "discovery_only | discovery_plus_conversions",
    "conversion_events": ["demo_request"],
    "intended_hubs": ["https://example.com/pricing"],
    "protected_pages": [],
    "visibility_threshold": 0.5,
    "value_threshold": 0.5
  },
  "summary": {
    "total_pages": 0,
    "gsc_pages": 0,
    "ga4_pages": 0,
    "quadrant_counts": {
      "unicorn": 0,
      "accidental_hub": 0,
      "hidden_gem": 0,
      "prune_candidate": 0
    }
  },
  "top_by_quadrant": {
    "accidental_hub": [
      {
        "url": "https://example.com/blog/example",
        "visibility_score": 0.61,
        "value_score": 0.45,
        "flags": ["low_ctr_high_impressions"]
      }
    ]
  },
  "pages": [
    {
      "url": "https://example.com/pricing",
      "gsc": {
        "url": "https://example.com/pricing",
        "impressions": 5400,
        "clicks": 62,
        "ctr": 0.0115,
        "avg_position": 7.4,
        "query_breadth": 2
      },
      "ga4": {
        "url": "https://example.com/pricing",
        "sessions": 1240,
        "engagement_rate": 0.68,
        "conversions": { "demo_request": 84 },
        "conversion_total": 84
      },
      "visibility_score": 0.54,
      "value_score": 0.86,
      "hub_type_hint": "commercial",
      "quadrant": "hidden_gem",
      "confidence": "high",
      "flags": ["intended_hub", "building_toward_intent"],
      "recommended_review": "Increase organic visibility with spokes and internal links from high-traffic pages."
    }
  ],
  "limitations": [],
  "discovery": {
    "intent_split": {
      "brand": { "clicks": 0, "impressions": 0, "query_count": 0 },
      "commercial": { "clicks": 0, "impressions": 0, "query_count": 0 },
      "job": { "clicks": 0, "impressions": 0, "query_count": 0 },
      "product": { "clicks": 0, "impressions": 0, "query_count": 0 },
      "diy": { "clicks": 0, "impressions": 0, "query_count": 0 },
      "other": { "clicks": 0, "impressions": 0, "query_count": 0 }
    },
    "intended_hubs": [
      {
        "url": "https://example.com/pricing",
        "verdict": "discovering | brand_only | invisible | misaligned | no_gsc_data",
        "top_queries": [{ "query": "example pricing", "clicks": 0, "impressions": 0, "intent": "commercial" }],
        "gsc_clicks": 0,
        "gsc_impressions": 0
      }
    ],
    "misalignments": [
      {
        "url": "https://example.com/blog/example",
        "query": "example jobs",
        "clicks": 0,
        "impressions": 0,
        "query_intent": "job",
        "hub_type_hint": "technical"
      }
    ],
    "indexing_noise_urls": []
  }
}
```

## Analysis modes

| `inputs.analysis_mode` | Quadrants | Discovery block | Conversions |
|------------------------|-----------|-----------------|-------------|
| `discovery_only` | GSC visibility only (`high_visibility_unvalued` / `low_visibility_unvalued`; media → `accidental_hub`) | Required when GSC page×query parsed | Ignored for scoring |
| `discovery_plus_conversions` | Full matrix when GSC+GA4 | Required when GSC page×query parsed | Required with GA4 |

## Discovery block

Present when GSC page×query rows are available. Answers: **Are keywords driving the right kind of traffic?**

| Field | Purpose |
|-------|---------|
| `intent_split` | Site-wide clicks/impressions by query intent (rules in `scripts/classify-query-intent.mjs`) |
| `intended_hubs[].verdict` | Per-hub discovery health |
| `misalignments` | High-click query landing on mismatched page type |
| `indexing_noise_urls` | Media/asset URLs with impressions |

**Intended hub verdicts:** `discovering` · `brand_only` · `invisible` · `misaligned` · `no_gsc_data`

Intent classification is domain-agnostic (brand terms derived from `inputs.domain`).

---

### Field notes

| Field | Rule |
|-------|------|
| `gsc` / `ga4` | Null when source missing for that URL |
| `recommended_review` | Advisory text only — never an auto-action |
| `flags` | Machine hints for playbook Phase 2 review |
| `top_by_quadrant` | Up to 10 URLs per quadrant, sorted by visibility then value |
| `limitations[]` | Required for partial modes, row caps, missing conversion events |

### Flags

| Flag | When set |
|------|----------|
| `converts_without_search_clicks` | `discovery_plus_conversions` + GSC + GA4 conversions > 0 + GSC clicks < 5 |
| `building_toward_intent` | Intended hub + (`hidden_gem` OR `intended_hub_invisible` OR `intended_hub_brand_only`) |
| `intended_hub_invisible` | Intended hub + GSC impressions < 100 |
| `intended_hub_brand_only` | Intended hub + ≥80% of GSC clicks from brand-intent queries |
| `query_intent_misalignment` | Intended hub `verdict === misaligned` or page in `discovery.misalignments` |
| `indexing_noise` | Media/upload URL pattern (`scripts/build-discovery-summary.mjs`) |
| `false_hub_warning` | GSC — high query breadth, poor position |
| `low_ctr_high_impressions` | GSC — impressions ≥ 1000, CTR < 1% |

### Agent constraints (partial data)

- Do not install packages or call unofficial APIs to backfill missing GSC/GA4.
- Do not use third-party SEO tools as GSC substitutes in this skill.
- Ship the report section order from `SKILL.md` Step 4.
- **`discovery_only`:** no numbered site remediation list; close with playbook pointer only.

### Human report contract (`discovery_only`)

Mandatory order: banner → intent split → intended hubs (all `inputs.intended_hubs[]`) → misalignments → indexing noise → strategic read → visibility split → top GSC pages (**with `hub_type_hint` + `flags`**) → GA4 organic sessions → limitations → closeout.

Vocabulary: use **high-impression / low-CTR landings** for DIY/commercial pages unless `indexing_noise` flag — not “accidental hub.”

---

Hub & Spoke Discovery & Recovery Phase 1a reads:

- `discovery` (primary for services / low-conversion sites)
- `inputs.analysis_mode`
- `pages[]` for quadrant, flags, scores
- `summary.quadrant_counts` for executive summary
- `top_by_quadrant` for checkpoint preview
- `inputs.intended_hubs` for gap labeling in Phase 1c triangulation
- `limitations[]` for honest partial-data warnings

Phase 1c join key: normalized `pages[].url` ↔ catalog ↔ keyword discovery URLs.

## Regression

- Fixture: `examples/example-saas.handoff.fixture.json`
- Scorecard narrative: `examples/SCORECARD-example-saas.md`

```bash
node scripts/refresh-handoff-fixtures.mjs
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
```

Scorecard: `examples/SCORECARD-example-saas.md` (M1–M17, R1–R6, S1–S9, D1–D5, I1–I7).

Package layout (from `utilities/write-a-skill/`):

```bash
node scripts/verify-skill-package.mjs \
  --path ../../marketing/skills/analytics-and-searchconsole-performance-audit \
  --tier C --public --run-verifiers
```
