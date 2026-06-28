---
name: Hub and Spoke Discovery and Recovery
type: playbook
description: >
  Use when recovering hub-and-spoke content architecture on a messy site — accidental
  hubs, hidden gems, legacy bloat, or onboarding a client without a designed pillar
  map. Use for organic architecture discovery, de facto pillar audit, GSC and GA4
  triangulation, or bottom-up cornerstone recovery. Triggers: "hub and spoke audit",
  "discover my real pillars", "accidental cornerstone", "hidden gem pages",
  "performance matrix content audit", "triangulate GSC and GA4 with keyword data".
version: 0.3.0
---

# Hub & Spoke Discovery & Recovery

## Overview

**Hub & Spoke** is the content architecture — one hub owns a topic cluster; spokes answer sub-intents and link up. **Cornerstone** is the quality bar for those pages (depth, intent, linking, fan-out, citability). This playbook is the **Discovery & Recovery** path for sites where reality does not match intent.

It evolves the discovery-first audit pattern: triangulate **first-party signals** (GSC impressions + GA4 business value) with **DataForSEO organic architecture** and **page inventory**, then audit and plan recovery without assuming which pages are hubs today.

**Not this playbook:** Top-down health check when cornerstones are already known → [Cornerstone Content Audit](../cornerstone-content-audit/SKILL.md).

**Packaging:** Tier **B** playbook per [`write-a-skill`](../../../utilities/write-a-skill/SKILL.md) — orchestrates children; triangulation rules in `REFERENCE.md`.

## Architecture

| Phase | Step | Skill / composite | Path |
|-------|------|-------------------|------|
| 1a | Performance matrix | Analytics and Search Console Performance Audit | `../../skills/analytics-and-searchconsole-performance-audit/SKILL.md` |
| 1b | Catalog + organic signals | Site Content Catalog + DataForSEO domain keywords | `../../skills/site-content-catalog/SKILL.md` |
| 1c | Triangulation merge | Playbook merge (this doc + `REFERENCE.md`) | — |
| 3b | Fan-out | Fan-Out Coverage Analysis | `../../skills/fan-out-coverage-analysis/SKILL.md` |
| 3c | Information gain | Information Gain Evaluator | `../../skills/information-gain-evaluator/SKILL.md` |
| 4a | Cannibalization | SEO Cannibalization Audit | `../../skills/seo-cannibalization-audit/SKILL.md` |
| 5h | Crawler policy | robots.txt Audit | `../../skills/robots-txt-audit/SKILL.md` |

Read each linked `SKILL.md` before calling it. Follow its workflow exactly. Do not re-implement child scoring inline.

## Input policy

Collect from the user:

1. **Domain** — required
2. **Scope** — `discovery-only` (Phases 1–2) or `full audit` (Phases 1–6)
3. **First-party data** — at least one of:
   - GSC page×query export (CSV) **or** GSC MCP when available
   - GA4 landing-page export (CSV) **or** GA4 MCP when available
4. **Conversion events** — 1–3 GA4 key event names when GA4 is provided and analysis mode is `discovery_plus_conversions`
5. **Analysis mode** — `discovery_only` or `discovery_plus_conversions` (ask once; see analytics skill Step 0.5)

**Optional:**

- `intended_hubs[]` — pages the business wants to rank (commercial hub + service LPs)
- `protected_pages[]` — never auto-recommend delete
- Location/language for DataForSEO (default US English)

**Degraded mode:** When GSC/GA4 is missing, Phase 1a runs partial matrix with `limitations[]`. When both first-party sources are missing, skip Phase 1a and run Phase 1b only (DataForSEO-only discovery — existing behavior preserved). Document all gaps in report `limitations[]`.

If domain is missing, ask once. Never invent URLs, metrics, or recommendations before tool results exist.

## First response rules

On the **first user-facing response**:

1. Name scope (`discovery-only` | `full audit`).
2. List which Phase 1 inputs are present vs missing.
3. Name child skills for that scope.
4. Preview deliverable shape: Performance Matrix → Topic Cluster Map → human checkpoint.
5. State Phase 2 is advisory — no auto-delete or auto-redirect execution.

Use `AskQuestion` for Phase 2 approval when available; otherwise wait for explicit confirmation.

---

## Phase 1: Triangulated discovery

### Phase 1a — Performance matrix (first-party)

**Call:** [Analytics and Search Console Performance Audit](../../skills/analytics-and-searchconsole-performance-audit/SKILL.md)

Pass:

- `domain`
- GSC page×query export (or MCP equivalent)
- GA4 landing-page export when available
- `conversion_events` when `discovery_plus_conversions`
- `intended_hubs[]`, `protected_pages[]` when provided

Receive **handoff JSON v1.0** (`REFERENCE.md` in analytics skill).

**Completion criterion:** Valid handoff with `pages[]`, `summary.quadrant_counts`, and `limitations[]` reflecting data mode (`full` | `gsc_only` | `ga4_only`).

**If skipped (no first-party data):** Set `matrix_handoff: null` and note in `limitations[]` — proceed to Phase 1b.

---

### Phase 1b — Catalog + organic architecture (DataForSEO)

Two calls — inventory first, then domain keyword universe.

#### 1b-i — Site content catalog

**Call:** [Site Content Catalog](../../skills/site-content-catalog/SKILL.md)

Pass sitemap URL or domain. Prefer `sitemap_enriched` when DataForSEO MCP is available.

Receive **handoff JSON v1.0** (`REFERENCE.md` in catalog skill).

If catalog returns >200 pages, scope down with the user before deep enrichment.

#### 1b-ii — Organic hub scoring

Pull domain-wide ranked keywords and derive de facto hub structure. Follow hub-scoring heuristics in `REFERENCE.md` § Organic hub scoring.

**Call:** `dataforseo_labs_google_keywords_for_site`

- `target`: domain
- `limit`: 1000, `order_by`: search volume desc
- Filter: rank position ≤ 100

For each URL: aggregate keyword count, total ETV, average rank, topic cluster assignment. Compute **hub_score** and classify: `de_facto_pillar` | `strong_spoke` | `weak_spoke` | `orphan`.

**Completion criterion:** Topic cluster map with de facto cornerstone per cluster + hub scores for top organic pages.

---

### Phase 1c — Triangulation merge

Join Phase 1a matrix pages, Phase 1b catalog pages, and Phase 1b hub scores on **canonical normalized URL** (`REFERENCE.md` § Join keys).

Per URL emit triangulation row:

| Field | Source |
|-------|--------|
| `matrix_quadrant` | Phase 1a `pages[].quadrant` (null if 1a skipped) |
| `hub_score` | Phase 1b organic scoring |
| `hub_type` | Phase 1a `hub_type_hint` or catalog `page_type` |
| `intended_match` | URL in `intended_hubs[]` |
| `triangulated_role` | Merged role per `REFERENCE.md` § Role assignment |
| `signal_conflicts[]` | Explicit mismatches (e.g. high ETV + low GSC clicks) |

**Triangulated role enum:** `intentional_hub` · `accidental_hub` · `hidden_gem` · `strong_spoke` · `orphan` · `unicorn` · `protected_review`

**Completion criterion:** Every URL in the union of catalog + matrix + top-50 organic pages has a triangulation row OR explicit `out_of_scope` note in `limitations[]`.

**Output:** Unified cluster map ready for Phase 2 human review.

---

## Phase 2: Confirm & decide

### Human checkpoint

Present **in this order**:

1. **Performance Matrix** (when Phase 1a ran) — quadrant summary + top URLs per quadrant
2. **Topic cluster map** — de facto pillars, hub scores, keyword counts
3. **Intended vs de facto** — gap table when `intended_hubs[]` provided
4. **Triangulation highlights** — accidental hubs, hidden gems, signal conflicts

```
## Performance Matrix — {domain}

| Quadrant | Count | Top URLs |
|----------|-------|----------|
| Unicorn | {n} | ... |
| Accidental hub | {n} | ... |
| Hidden gem | {n} | ... |
| Prune candidate | {n} | ... |

## Topic clusters

| Cluster | De facto hub | Hub score | Matrix quadrant | Triangulated role |
|---------|--------------|-----------|-----------------|-------------------|
| ...     | ...          | ...       | ...             | ...               |

## Intended vs de facto

| Intended hub | De facto match? | Triangulated role | Recommended review |
|--------------|-----------------|-------------------|--------------------|
| ...          | ...             | ...               | ...                |

**Signal conflicts**
- {conflict 1 — e.g. high DataForSEO ETV but low GSC clicks on /pricing/}
- {conflict 2 — e.g. high GSC impressions, zero GA4 conversions on /blog/...}

Which pages should I audit in depth?
A) De facto pillars (what ranks today)
B) Intended hubs (what you're building toward)
C) Both — compare clusters
D) Let me pick specific URLs
```

**Do not proceed to Phase 3 until the user confirms.** Matrix and triangulation are advisory — not auto-execution.

**Output:** Audit target list for Phases 3–5.

---

## Phase 3: Health audit (per target)

Run for each page in the audit target list (parallel OK).

### 3a: Traditional SEO scorecard

| Dimension | Source |
|-----------|--------|
| Rankings | Phase 1b keyword data or `dataforseo_labs_google_ranked_keywords` |
| Backlinks | `backlinks_summary` |
| Content | `on_page_content_parsing` or WebFetch |
| SERP features | `serp_organic_live_advanced` |

### 3b: Fan-out coverage

**Call:** [Fan-Out Coverage Analysis](../../skills/fan-out-coverage-analysis/SKILL.md)

Pass: `keyword`, `domain`, `anchor_url`.

### 3c: Information gain

**Call:** [Information Gain Evaluator](../../skills/information-gain-evaluator/SKILL.md)

Pass: `target_url`, `primary_keyword`.

### 3d: AI citability

1. `ai_opt_llm_ment_search` — domain mentions for primary keyword
2. `ai_opt_llm_ment_top_pages` — pages AI cites
3. Structure check (WebFetch): H2/H3 hierarchy, tables, FAQ, extractable passages
4. Lightweight robots check if already fetched — full policy in Phase 5h

### 3e: Scorecard template

Same format as [Cornerstone Content Audit](../cornerstone-content-audit/SKILL.md) Phase 3e.

---

## Phase 4: Cannibalization & pruning

### 4a: Cannibalization check

**Call:** [SEO Cannibalization Audit](../../skills/seo-cannibalization-audit/SKILL.md)

Focus on de facto pillars competing with intended hubs and blog posts outranking landing pages.

### 4b: Pruning candidates

From triangulation: `orphan`, `prune_candidate` (matrix), `weak_spoke`. Classify: **Consolidate** | **Improve** | **Deindex** | **Delete**.

**Never** recommend delete from matrix quadrant alone — require redirect target and human approval.

### 4c: Architecture conflicts

- Accidental pillar blocking intended hub
- Topic cluster with no pillar
- Pillar without spokes
- Spoke without pillar

---

## Phase 5: Enhancement & recovery plan

Map triangulation roles to existing recovery templates (no new phases):

| Triangulation / matrix signal | Recovery template | Action |
|------------------------------|-------------------|--------|
| **Unicorn** | 5a Content improvements | Protect + replicate pattern on adjacent clusters |
| **Hidden gem** | 5b Internal linking + 5e Fan-out gap content | Spoke creation, inbound link map toward hub |
| **Accidental hub** | 5f Transition decision tree | Spoke extraction, hub retrofit, or demote-to-spoke |
| **Prune candidate** | 5g Cannibalization + 5h Pruning | Redirect map only — no delete queue |

### 5f: Transition decision tree (accidental hub)

- De facto pillar **is** the right page → promote officially, strengthen
- De facto pillar **should be replaced** → content migration, link rerouting, eventual 301 when intended hub is strong enough
- **No pillar** for cluster → build intended hub, create spokes, establish links
- Accidental pillar has value → keep as spoke or consolidate into intended hub

### 5h: robots.txt and AI crawler policy

**Call:** [robots.txt Audit](../../skills/robots-txt-audit/SKILL.md)

Pass: `domain`, `key_pages` (audit targets), `crawl_policy` default `max_discovery`.

### Prioritization

- **Quick wins:** internal links to hidden gems, title/meta on accidental hubs, schema, robots fixes
- **Medium effort:** content improvements, information gain, begin intended hub builds, clear prune/redirect candidates
- **Strategic:** full architecture transition, new cluster content, major consolidations

---

## Phase 6: Report

```markdown
# Hub & Spoke Discovery & Recovery — {domain} — {date}

## Executive Summary
- {X} topic clusters, {Y} de facto hubs, {Z} intended-hub gaps
- Performance matrix: {quadrant counts when 1a ran}
- {N} quick wins, {M} strategic projects
- Data limitations: {from limitations[]}

## Performance Matrix
{From Phase 1a — before topic cluster map}
{Quadrant table + top 10 per quadrant}

## Topic Cluster Map
{From Phase 1b + 1c triangulation}

## Intended vs De Facto Architecture
{Gap table + triangulated roles}

## Signal Conflicts
{Explicit conflicts from Phase 1c}

## Cornerstone Scorecards
{Per-page from Phase 3}

## Cannibalization & Architecture Conflicts
{From Phase 4}

## Enhancement & Recovery Plan
### Quick Wins / Medium Effort / Strategic Projects
{Mapped from Phase 5 recovery table}

## New Content Opportunities
| Topic | Target Keyword | Volume | Parent Hub | Format |

## Pruning & Redirect Candidates
| URL | Triangulated role | Recommended action | Target URL | Reason |

## robots.txt & AI Crawler Policy
{From Phase 5h}

## Appendix: Triangulation table
| URL | Matrix quadrant | Hub score | Triangulated role | Flags |
```

---

## When to use which playbook

| Situation | Playbook |
|-----------|----------|
| Known cornerstones, health check only | [Cornerstone Content Audit](../cornerstone-content-audit/SKILL.md) |
| Messy site, accidental hubs, new client | **This playbook** |
| Have GSC/GA4 exports, need triage fast | **This playbook** Phases 1a–2 only |
| Single keyword / fan-out gap | [Fan-Out Coverage Analysis](../../skills/fan-out-coverage-analysis/SKILL.md) only |

---

## DataForSEO tools used

`dataforseo_labs_google_keywords_for_site`, `dataforseo_labs_google_ranked_keywords`, `dataforseo_labs_google_related_keywords`, `dataforseo_labs_google_keyword_suggestions`, `dataforseo_labs_google_keyword_ideas`, `backlinks_summary`, `serp_organic_live_advanced`, `on_page_content_parsing`, `ai_opt_llm_ment_search`, `ai_opt_llm_ment_top_pages`

**Requirements:** `REQUIREMENTS.md` · **Triangulation SSOT:** `REFERENCE.md` · **Future work:** `FUTURE-WORK.md`

## Done definition

- [ ] Domain and scope confirmed (`discovery-only` or `full audit`)
- [ ] Phase 1 inputs inventoried; degraded paths documented in `limitations[]`
- [ ] Phase 1a handoff JSON emitted when GSC and/or GA4 provided (analytics skill)
- [ ] Phase 1b catalog + organic hub scores complete (or limitations recorded)
- [ ] Phase 1c triangulation table produced with `triangulated_role` per URL
- [ ] Phase 2 human checkpoint presented — user approved targets before Phase 3+ (when scope includes Phase 3+)
- [ ] Report follows template order: Performance Matrix → Topic Cluster Map → Intended vs De Facto
- [ ] No auto-delete or auto-redirect execution — recommendations only, with target URLs where applicable
- [ ] Full audit scope: fan-out, information gain, cannibalization, and robots.txt phases called per architecture table
