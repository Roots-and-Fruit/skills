# Hub & Spoke Discovery & Recovery — Reference

Triangulation join keys, organic hub scoring SSOT, role assignment, and signal-conflict rules for Phase 1c.

## Join keys (canonical URL)

Normalize every URL from Phase 1a, 1b catalog, and Phase 1b organic scoring **before** join:

1. Force `https://` scheme
2. Strip trailing slash on path (except `/`)
3. Strip `www.` when `inputs.domain` is provided without `www`
4. GA4 path-only values (`/pricing`) → `https://{domain}/pricing`
5. Drop URL fragments (`#section`)

**Join field:** normalized URL string (full URL after rules above).

**SSOT alignment:**

- Analytics skill: `scripts/normalize-url.mjs` in `analytics-and-searchconsole-performance-audit`
- Catalog skill: `REFERENCE.md` § URL normalization in `site-content-catalog`

Record merged/dropped row counts in playbook `limitations[]` when non-trivial.

## Phase 1b organic hub scoring

Apply these rules inline after `dataforseo_labs_google_keywords_for_site`:

### Per-URL aggregates

| Field | Calculation |
|-------|-------------|
| `keyword_count` | Distinct keywords ranking for URL |
| `total_etv` | Sum of ETV across keywords |
| `avg_rank` | Mean rank position |
| `keyword_diversity` | Distinct topic stems or cluster themes |

### Hub score formula

| Signal | Weight |
|--------|--------|
| Keyword breadth (normalized 0–1 vs domain max) | 30% |
| Traffic weight — total ETV (normalized) | 30% |
| Rank quality — inverse avg rank (normalized) | 20% |
| Keyword diversity (normalized) | 20% |

### Organic classification

| Classification | Criteria |
|----------------|----------|
| `de_facto_pillar` | Hub score top 20% **and** ≥15 ranked keywords |
| `strong_spoke` | Hub score 40th–80th percentile |
| `weak_spoke` | Ranks for keywords, low hub score |
| `orphan` | <3 keywords and minimal ETV |

Per topic cluster, highest hub score = **de facto cornerstone**.

## Triangulation row schema

Phase 1c produces `triangulation_pages[]` (playbook-internal; not a separate handoff version yet):

```json
{
  "url": "https://example.com/blog/guide",
  "normalized_path": "/blog/guide",
  "matrix_quadrant": "accidental_hub",
  "hub_score": 0.72,
  "organic_classification": "de_facto_pillar",
  "hub_type": "technical",
  "page_type": "blog_post",
  "intended_match": false,
  "triangulated_role": "accidental_hub",
  "signal_conflicts": ["high_etv_low_gsc_clicks"],
  "flags": ["query_breadth_warning"],
  "recommended_review": "Evaluate spoke extraction or hub retrofit per Phase 5f."
}
```

## Triangulated role assignment

Evaluate in order; first strong match wins unless conflicts force `protected_review`:

| Role | Assignment rule |
|------|-----------------|
| `protected_review` | URL in `protected_pages[]` **or** matrix `protected_review` |
| `unicorn` | Matrix `unicorn` **and** (`de_facto_pillar` or `intended_match`) |
| `intentional_hub` | `intended_match` **and** (`hidden_gem` or `discovering` verdict or building visibility flags) |
| `accidental_hub` | Matrix `accidental_hub` **or** (`de_facto_pillar` **and not** `intended_match`) |
| `hidden_gem` | Matrix `hidden_gem` **or** (`intended_match` **and** low visibility quadrant) |
| `strong_spoke` | `strong_spoke` organic class **and** supports a cluster pillar |
| `orphan` | Organic `orphan` **and** (`prune_candidate` or no matrix signal) |

When matrix is skipped (no Phase 1a), derive roles from organic classification + `intended_match` only. Note `limitations[]`: `triangulation_first_party_missing`.

## Signal conflicts (surface explicitly)

Emit `signal_conflicts[]` when any condition holds:

| ID | Condition | Interpretation |
|----|-----------|----------------|
| `high_etv_low_gsc_clicks` | `total_etv` top quartile **and** GSC clicks bottom quartile | DataForSEO values page; Search Console sends little traffic — verify cannibalization or SERP mismatch |
| `high_gsc_impressions_zero_conversions` | GSC impressions top quartile **and** GA4 `conversion_total === 0` (when conversions expected) | Traffic without business outcome — accidental hub or wrong intent |
| `intended_invisible` | `intended_match` **and** matrix `invisible` / `no_gsc_data` verdict | Planned hub not discoverable in search |
| `pillar_prune_tension` | `de_facto_pillar` **and** matrix `prune_candidate` | Do not prune — resolve via 5f transition tree |
| `false_hub_breadth` | `query_breadth` high **and** `avg_position > 20` | Broad impressions, weak positions — likely not a real hub |
| `converts_without_search_clicks` | GA4 conversions present **and** no GSC rows | Direct/referral value — not organic hub signal |

Never auto-resolve conflicts — list in Phase 2 checkpoint and report § Signal Conflicts.

## Recovery mapping (Phase 5)

| `triangulated_role` / matrix | Phase 5 section | Allowed actions |
|------------------------------|-----------------|-----------------|
| `unicorn` | 5a | Protect, replicate pattern |
| `hidden_gem` | 5b, 5e | Inbound links, new spokes |
| `accidental_hub` | 5f | Extract spoke, retrofit hub, demote |
| `prune_candidate` / `orphan` | 5g, 5h | Redirect map, consolidate — **no delete queue** |

## Playbook consumer notes

- Phase 1a handoff: `analytics-and-searchconsole-performance-audit` v1.0 — read `pages[]`, `discovery`, `limitations[]`
- Phase 1b catalog handoff: `site-content-catalog` v1.0 — read `pages[]`, `page_type`, enriched ETV when present
- Phase 1b organic: hub scores keyed by `url` matching join rules above

Future: formal `triangulation_handoff` v1.0 if a verifier is added (Tier C escalation).
