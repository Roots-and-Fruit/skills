---
name: SEO-Cannibalization-Audit
type: composite
description: >
  Use when auditing keyword cannibalization, page overlap, or consolidation,
  before publishing new content, when rankings decline, or to find which pages
  compete on the same domain.
version: 1.0.0
---

# SEO Cannibalization Audit

## Purpose

Detect when multiple pages on the same domain compete for the same keywords, diluting rankings and confusing which page to surface. Works with hub-and-spoke, flat, siloed, or hybrid architectures.

## Input policy (non-negotiable)

Collect before running:

1. **Domain** — e.g. `example.com` (from user only)
2. **Subject page(s)** — URL(s) to audit
3. **Primary keyword(s)** — what each page targets (when known)
4. **Scope** — full audit (key pages) or targeted (specific overlap concern)

**Optional user context** (ask once if relevant):

- Site architecture notes (cornerstones, hubs, silos)
- **Protected pages** — never recommend retire without explicit approval

Never infer domain or URLs from workspace, examples, or prior runs.

## When to use

- Before publishing a new page
- Periodic page-architecture audit
- Rankings decline on a page — suspect internal competition
- New landing or use-case pages
- Merging or retiring pages

## When NOT to use

- Blog posts on purely informational keywords with no commercial overlap
- Single-partner integration pages
- Alternative/comparison pages with distinct intent

## Step 1: Keyword overlap detection

For each subject page:

1. `dataforseo_labs_google_ranked_keywords` — sort by search volume desc, limit 30
2. For each keyword, `dataforseo_labs_google_relevant_pages` on the domain — flag keywords where **two+ same-domain pages** appear in top 50

### Red flags

- Both in top 20 → **active cannibalization**
- Both in top 50, one declining → **emerging cannibalization**
- New page vs existing top 10 → **pre-publish risk**

## Step 2: Intent comparison

For each flagged keyword, classify each competing page:

- **Hub/routing** (cornerstone or category LP)
- **Feature** — how something works
- **How-to** — educational
- **Integration** — specific tool/partner
- **Product** — what the product is
- **Alternative/comparison**
- **Use-case LP**

Intent rules:

- Hub + spoke → **OK**
- Hub + hub → **cannibalization**
- Spoke + spoke → **review**
- Hub + same-intent page → retire weaker or differentiate

Use user architecture notes when provided; otherwise infer from content.

## Step 3: Title/meta conflict

Compare titles, meta descriptions, and H1s. Overlapping title keywords **and** same intent → conflict.

## Step 4: Resolution

```
Weaker page meaningful rankings (top 20, >10/mo)?
├── NO → Retire (301 to stronger)
├── YES → Intents distinct?
│   ├── YES → Differentiate titles/metas, anchor text, cross-links
│   └── NO → Backlinks worth preserving?
│       ├── YES → 301 redirect
│       └── NO → Retire or merge into stronger page
```

### Guardrails

- Never retire top-10 pages (>20/mo volume) without explicit user approval
- Always `backlinks_summary` before 301
- Update internal links to retired URLs before redirect
- Honor **protected pages** — flag, do not recommend retire

## Step 5: Output

```markdown
## Cannibalization Report — {domain} — {date}

### Conflict: {keyword}
- Page A: {URL} | Rank #{X} | Type: {type} | ETV: {X}
- Page B: {URL} | Rank #{Y} | Type: {type} | ETV: {Y}

Resolution: {Retire / Differentiate / Hub+spoke OK}
Action items:
- [ ] ...
```

Report sections:

1. Active cannibalization
2. Pre-publish risks
3. Healthy complementary relationships
4. Consolidation candidates (zero or near-zero rankings)

## DataForSEO tools used

- `dataforseo_labs_google_ranked_keywords`
- `dataforseo_labs_google_relevant_pages`
- `backlinks_summary`
- `serp_organic_live_advanced` (optional validation)

## Pairs with

- [Site Content Catalog](../site-content-catalog/) — page inventory
- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 4a

**Requirements:** `REQUIREMENTS.md`
