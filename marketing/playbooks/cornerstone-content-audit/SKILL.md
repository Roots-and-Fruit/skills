---
name: Cornerstone Content Audit
type: playbook
description: >
  Use when running a cornerstone content audit, pillar content review, or content
  architecture audit. End-to-end: discover pages, identify cornerstones, health
  audit, cannibalization check, and enhancement plan.
version: 0.1.0
---

# Cornerstone Content Audit

## Overview

Audits a site's most important content — the 3–7 cornerstone pages that should rank highest, attract links, and be cited by AI search. Identifies those pages, evaluates health across traditional and AI-era dimensions, detects cannibalization and pruning opportunities, and produces a prioritized enhancement plan.

## Architecture

| Step | Skill | Location |
|------|-------|----------|
| Phase 1 | Site Content Catalog | `../../site-content-catalog/SKILL.md` |
| Phase 3b | Fan-Out Coverage Analysis | `../../fan-out-coverage-analysis/SKILL.md` |
| Phase 3c | Information Gain Evaluator | `../../information-gain-evaluator/SKILL.md` |
| Phase 4a | SEO Cannibalization Audit | `../../seo-cannibalization-audit/SKILL.md` |
| Phase 5h | llms.txt Audit | `../../llms-txt-audit/SKILL.md` |

Read each linked `SKILL.md` before calling it. Follow its workflow exactly.

## Input policy (non-negotiable)

Collect from the user:

1. **Domain or sitemap URL** — required
2. **Scope** — `quick scan` (Phases 1–2), `single-page cornerstone review` (Phase 3 for one URL), or `full audit` (Phases 1–6)
3. **Known cornerstones** (optional) — skip Phase 2 nomination when provided
4. **Optional context** — protected pages, topic clusters, architecture notes (never from workspace or examples)

If domain/sitemap is missing, ask once. Do not invent URLs, metrics, or recommendations before tool results exist.

## First response rules

On the **first user-facing response**:

1. Name the scope (`quick scan` | `single-page` | `full audit`).
2. Name exact skills for that scope (see Architecture).
3. Preview deliverable shape for that scope.
4. State the Phase 2 approval checkpoint when nomination is involved.
5. Frame recommendations around audit dimensions (rankings, fan-out, information gain, AI citability, cannibalization, pruning, `llms.txt`).

Use `AskQuestion` for Phase 2 approval when available; otherwise wait for explicit user confirmation.

---

## Phase 1: Discovery & catalog

**Call:** [Site Content Catalog](../../site-content-catalog/SKILL.md)

Pass sitemap URL or domain. Receive **handoff JSON v1.0** (`REFERENCE.md` in catalog skill). Read `limitations[]` — v1.0 does not include inbound internal link counts.

If the catalog returns >200 pages, scope down with the user (path prefix, page type, or top traffic).

**Output:** Validated page catalog ready for cornerstone scoring.

---

## Phase 2: Cornerstone identification

**Goal:** 3–7 cornerstones grouped by topic cluster.

### Step 2a: Topic clusters

From the Phase 1 catalog:

- Group by URL path, title themes, keyword clusters
- Target 3–7 distinct topic areas with a clear head topic each

### Step 2b: Score candidates

Per cluster, score top 3–5 candidates:

| Signal | Source | Weight |
|--------|--------|--------|
| Keyword authority | `dataforseo_labs_google_ranked_keywords` — volume sum for top-20 ranks | High |
| Estimated traffic value | Same — ETV | High |
| Backlink authority | `backlinks_summary` — referring domains | High |
| Internal link gravity | Catalog — inbound internal links | Medium |
| Content depth | Catalog — length, headings | Medium |
| Navigation prominence | Top nav? Clicks from homepage? | Medium |
| Freshness | Catalog last modified | Low |

### Step 2c: Nominate

Per cluster, nominate highest scorer. Flag flat scores, wrong-page cornerstones (blog beats LP), or competing pages.

### Human checkpoint

Present nominations with URL, score, and rationale. **Do not proceed to Phase 3 until the user approves or adjusts.**

**Output:** Confirmed 3–7 cornerstones with topic clusters and primary keywords.

---

## Phase 3: Health audit

Run for **each confirmed cornerstone** (parallel OK).

### 3a: Traditional SEO scorecard

| Dimension | Source |
|-----------|--------|
| Rankings | `dataforseo_labs_google_ranked_keywords` |
| Backlinks | `backlinks_summary` |
| Internal links | Phase 1 catalog |
| Content | `on_page_content_parsing` or WebFetch |
| SERP features | `serp_organic_live_advanced` |

### 3b: Fan-out coverage

**Call:** [Fan-Out Coverage Analysis](../../fan-out-coverage-analysis/SKILL.md)

Pass: `keyword`, `domain`, `anchor_url` (cornerstone URL).

### 3c: Information gain

**Call:** [Information Gain Evaluator](../../information-gain-evaluator/SKILL.md)

Pass: `target_url`, `primary_keyword`.

### 3d: AI citability

1. `ai_opt_llm_ment_search` — domain in LLM mentions for primary keyword
2. `ai_opt_llm_ment_top_pages` — pages AI cites for keyword
3. Structure check (WebFetch): H2/H3 hierarchy, data tables, FAQ blocks, extractable passages

### 3e: Scorecard template

```markdown
## Scorecard: {cornerstone URL}
**Topic cluster:** {name}
**Primary keyword:** {kw} | Rank: #{pos} | Volume: {vol}/mo

### Traditional SEO
- Rankings: {top-20 count, ETV}
- Backlinks: {referring domains}
- Internal links: {inbound, outbound}
- Content: {words, headings, last updated}
- SERP features: {snippet, PAA, sitelinks}

### Fan-Out Coverage: {X}% ({covered}/{total})
### Information Gain: {High/Medium/Low}
### AI Citability: {mentions, competing pages, structure}
```

---

## Phase 4: Cannibalization & pruning

### 4a: Cannibalization check

**Call:** [SEO Cannibalization Audit](../../seo-cannibalization-audit/SKILL.md)

Pass cornerstone URLs, primary keywords, domain, and optional protected pages from user context.

### 4b: Pruning candidates

From Phase 1 catalog, flag pages with:

- Zero ranked keywords
- Near-zero backlinks
- Thin content (<300 words)
- Topical overlap with a cornerstone

Classify: **Consolidate** | **Improve** | **Deindex** | **Delete**

**Output:** Cannibalization conflicts + pruning list.

---

## Phase 5: Enhancement plan

Synthesize Phases 3–4. Per cornerstone: content (from 3c), internal links (from 3b), keyword realignment, SERP features, fan-out gap content, cannibalization fixes, pruning.

### 5h: llms.txt

**Call:** [llms.txt Audit](../../llms-txt-audit/SKILL.md)

Pass `domain` and `key_pages` (confirmed cornerstone URLs from Phase 2).

### Prioritization

- **Quick wins:** internal links, title/meta/H1, schema, `llms.txt`
- **Medium effort:** freshness, information gain, heading structure, clear pruning
- **Strategic:** new cluster content, major rewrites, architecture changes

---

## Phase 6: Report

```markdown
# Cornerstone Content Audit — {domain} — {date}

## Executive Summary
## Topic Cluster Map
## Cornerstone Scorecards
## Cannibalization & Pruning
## Enhancement Plan
### Quick Wins / Medium Effort / Strategic Projects
## New Content Opportunities
## llms.txt Recommendation
## Appendix: Full Page Catalog
```

---

## Scope options

| User says | Phases |
|-----------|--------|
| Quick scan / identify cornerstones | 1–2 |
| Audit {URL} | 3 only |
| Full audit | 1–6 |
| Fan-out for {keyword} | Fan-out skill only |
| Information gain on {URL} | Information gain skill only |

---

## DataForSEO tools used

`dataforseo_labs_google_keywords_for_site`, `dataforseo_labs_google_ranked_keywords`, `dataforseo_labs_google_relevant_pages`, `dataforseo_labs_google_related_keywords`, `dataforseo_labs_google_keyword_suggestions`, `dataforseo_labs_google_keyword_ideas`, `backlinks_summary`, `serp_organic_live_advanced`, `on_page_content_parsing`, `ai_opt_llm_ment_search`, `ai_opt_llm_ment_top_pages`

## Research basis

Cornerstone content practice (Yoast, HubSpot, etc.) plus 2025–2026 GEO: AI Overview fan-out, information gain for citations, `llms.txt`, content pruning impact, structured-content citation lift.

**Requirements:** `REQUIREMENTS.md`
