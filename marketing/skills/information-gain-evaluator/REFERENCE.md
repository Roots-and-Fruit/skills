# Information Gain Evaluator — Reference

API contracts, SERP lane rules, dimension rubric, rigorous overall scoring, and handoff schema **v1.1**.

## Input policy

- Target URL or draft content — **user-supplied only**; never infer from examples, workspace, or project config
- Primary keyword — **required**
- Competitor URLs — optional; auto-select from SERP when absent
- When auto-selecting, **exclude** the target's registrable domain
- Default locale: `location_name: "United States"`, `language_code: "en"`
- **Examples use fictional domains** (`example.com`, `example-vendor.com`, `competitor-a.example`) — do not treat them as defaults for live runs

## MCP tool names (DataForSEO)

| Step | MCP tool |
|------|----------|
| SERP seed + competitor discovery | `serp_organic_live_advanced` |

**Page content:** WebFetch (or equivalent fetch tool). No DataForSEO on-page parse required.

### Step 0 — SERP seed

```
serp_organic_live_advanced
  keyword: <primary keyword>
  location_name: United States
  language_code: en
  depth: 10
```

Extract for `serp_context`:

- Top organic: `url`, `domain`, `title`, `rank_group`
- `people_also_ask` (dedupe nested duplicates)
- `related_searches`
- Live `ai_overview` presence from this response

### Step 0.5 — SERP lane classification

Label each top-8 organic result:

| Lane | Typical signals |
|------|-----------------|
| `primary_topic` | How-to, guide, strategy, definition content |
| `tool_discovery` | "best", "top", comparison, listicle, vendor roundup |
| `community` | Reddit, Quora, Stack Exchange, forums |
| `directory` | G2, Capterra, marketplaces, app stores |

Set:

- `intent_lanes_detected`: array of lanes present
- `intent_split`: `single` | `mixed`
- `lane_counts`: object lane → count

When `mixed`, ask user which lane defines competitors unless `inputs.intent_lane` is already set (e.g. from fan-out handoff).

### Competitor selection rules

1. Prefer `primary_topic` or user-chosen lane
2. Max **5** competitors
3. Skip: target domain, `community`, `directory` unless user opts in
4. Skip non-article SERP features (video packs, sitelinks-only) unless user opts in
5. Record `lane` per competitor in `competitor_set[]`

## Dimensions

Each dimension uses `high` | `medium` | `low`.

| ID | Label | High | Medium | Low |
|----|-------|------|--------|-----|
| `original_data` | Original Data | Proprietary or first-party metrics, surveys, benchmarks not on competitors | Uncommon cited sources most competitors skip | Commodity stats only (widely cited industry reports) or none |
| `unique_framework` | Unique Framework | Named methodology, rubric, or decision model not on competitors | Clear structure competitors lack but not named/novel | Generic listicle or unordered tips |
| `first_hand_experience` | First-Hand Experience | Specific "we/customer did X → Y" with names or numbers | Vague "in our experience" without outcomes | Third-person advice only |
| `novel_angle` | Novel Angle | Meaningful **informational** perspective none of top competitors take — not merely a different page type (commercial vs guide) | Deeper treatment of a subtopic competitors mention briefly | Same angle and scope as majority |
| `citable_specificity` | Citable Specificity | Multiple self-contained, fact-dense passages suitable for AI citation | Some quotable lines mixed with fluff | Mostly generic; nothing quotable |

**Evidence requirement:** every dimension must include `evidence_target` and at least one `evidence_competitors[]` entry with real snippets (≥40 characters each) — snippets must not reference `unfetchable` competitor URLs. If evidence is insufficient, score conservatively (`medium` max for that dimension).

## Citation fit (required v1.1)

`citation_fit_for_keyword` — would an AI answering the **primary keyword** plausibly cite this page as a primary source?

| Value | When |
|-------|------|
| `strong` | Primary source for most informational sub-questions; citeable data/frameworks |
| `partial` | Citeable for some sub-claims only |
| `poor` | Not a sensible primary cite for the head query (e.g. commercial page on DIY informational SERP) |

`citation_fit_rationale` — one sentence explaining the verdict (≥30 characters).

## Page–keyword fit (required v1.1)

| Value | When |
|-------|------|
| `aligned` | Page format matches dominant SERP intent for the keyword |
| `mismatched` | Different format or job (sales page vs how-to guide, features page vs tutorial) |

When `mismatched`, state in `limitations[]` and cap `citation_fit_for_keyword` at `partial` (usually `poor`).

## Overall information gain (rigorous v1.1)

Apply **after** dimension scores and citation/page fit:

| Overall | Rule |
|---------|------|
| `high` | ≥3 dimensions `high`, zero `low`, **and** `original_data` or `citable_specificity` is `high`, **and** `citation_fit_for_keyword` is `strong` or `partial`, **and** `page_keyword_fit` is `aligned` |
| `low` | ≥2 dimensions `low`; **or** all five `medium`; **or** `citation_fit_for_keyword` is `poor` and (`original_data` or `citable_specificity` is not `high`); **or** ≥1 `low` and no citation-core `high`; **or** `page_keyword_fit` is `mismatched` with ≥1 `low` and no citation-core `high` |
| `medium` | Everything else |

**Anti-inflation rules:**

- `novel_angle: high` requires `original_data`, `citable_specificity`, or `first_hand_experience` to also be `high`.
- `novel_angle` cannot be `high` when `citation_fit_for_keyword` is `poor` (business positioning ≠ citation gain).
- `overall: high` forbidden when `citation_fit_for_keyword` is `poor` or `page_keyword_fit` is `mismatched`.
- `citation_fit_for_keyword: strong` requires `original_data` or `citable_specificity` to be `high`.

## Baseline completeness

Separate from information gain — measures table-stakes coverage:

| Value | Rule |
|-------|------|
| `strong` | `baseline_coverage_pct` ≥ 80 |
| `adequate` | `baseline_coverage_pct` 50–79 |
| `weak` | `baseline_coverage_pct` < 50 |

Set `baseline_coverage_pct` = `round(100 × themes_covered / table_stakes.length)` where `themes_covered` counts how many `table_stakes` themes the target substantively addresses.

A page can be `high` information gain with `weak` baseline (novel but incomplete) or `low` gain with `strong` baseline (complete but generic).

## Handoff schema v1.1

```json
{
  "handoff_version": "1.1",
  "skill": "information-gain-evaluator",
  "skill_version": "1.1.0",
  "generated_at": "ISO-8601",
  "mode": "live_url | pinned_competitors | draft_content",
  "confidence": "high | low",
  "inputs": {
    "target_url": "string | null",
    "target_label": "string",
    "primary_keyword": "string",
    "competitor_urls": ["string"],
    "intent_lane": "primary_topic | tool_discovery | community | directory | null",
    "location_name": "string",
    "language_code": "string"
  },
  "serp_context": {
    "ai_overview_present": false,
    "people_also_ask": ["string"],
    "related_searches": ["string"],
    "intent_lanes_detected": ["string"],
    "intent_split": "single | mixed",
    "lane_counts": {}
  },
  "competitor_set": [
    {
      "url": "string",
      "domain": "string",
      "title": "string | null",
      "lane": "string | null",
      "fetch_status": "ok | partial | unfetchable"
    }
  ],
  "table_stakes": ["string"],
  "table_stakes_gaps": ["string"],
  "unique_strengths": ["string"],
  "dimensions": [
    {
      "id": "original_data | unique_framework | first_hand_experience | novel_angle | citable_specificity",
      "label": "string",
      "score": "high | medium | low",
      "finding": "string",
      "evidence_target": "string",
      "evidence_competitors": [
        { "url": "string", "snippet": "string" }
      ]
    }
  ],
  "baseline_coverage_pct": 0,
  "citation_fit_for_keyword": "strong | partial | poor",
  "page_keyword_fit": "aligned | mismatched",
  "citation_fit_rationale": "string",
  "overall": "high | medium | low",
  "baseline_completeness": "strong | adequate | weak",
  "recommendations": [
    {
      "dimension": "string",
      "action": "string",
      "example_artifact": "string"
    }
  ],
  "limitations": ["string"]
}
```

### Validation

```bash
node scripts/verify-handoff.mjs path/to/handoff.json
```

## Credit guidance

Typical run: **1** `serp_organic_live_advanced` + **6** WebFetch calls (1 target + 5 competitors). Pinned mode may skip SERP if user requests — note in `limitations[]`.

## Downstream consumers

| Consumer | Use fields |
|----------|------------|
| Human / strategist | markdown report sections |
| Content brief | `table_stakes_gaps`, `unique_strengths`, `recommendations` |
| Fan-out follow-up | `intent_lane`, `serp_context` |

Do not embed page templates or H2 mandates — package facts only.
