---
name: web-scrape-to-md
type: capability
description: >
  Use when scraping a site to markdown, building a research corpus, checking llms.txt,
  or preparing lower-token source files from WebSearch/WebFetch. Discovers URLs,
  prefers markdown-native endpoints, recovers from sitemap failures, and emits
  efficient high-signal page files plus a structured run handoff.
version: 1.1.0
---

# Web Scrape to Markdown

## Purpose

Collect **high-signal website content** into local markdown files using **WebSearch** and **WebFetch** — markdown-first, goal-aligned extraction, minimal token waste.

**Not this skill:**

- **Site inventory only** — use [Site Content Catalog](../../marketing/skills/site-content-catalog/) for URL lists, `page_type` labels, and SEO signals without full content extraction.
- **Batch reproducible crawls** — use a dedicated scraper CLI when you need `raw/`, `manifest.jsonl`, or resume logic at hundreds of URLs.
- **Live SERP scoring** — use [Information Gain Evaluator](../../marketing/skills/information-gain-evaluator/) for citation-fit analysis.

**Reference:** `REFERENCE.md` · **Examples:** `EXAMPLES.md`

## Input policy (non-negotiable)

- **Domain or URL list** — from the user only. Never infer from workspace, examples, or prior runs.
- **Goal** — from the user (audit, research, brief, competitor analysis, corpus). If missing, ask once.
- **Coverage target** — user number or default **10** pages.
- **Output directory** — user path when saving files; if omitted, return handoff + page markdown in chat only.

If missing domain/URLs, ask once:

> *Which domain or URLs should I scrape? What is the goal, and how many pages should I target? (Optional: output folder path.)*

## Modes

| Mode | When | Output |
|------|------|--------|
| **corpus_run** | User wants local `.md` files | Per-page files + `INDEX.md` + handoff JSON |
| **summary_only** | Quick triage, no files | Handoff JSON + run summary in chat |

**Completion criterion for mode:** `handoff.mode` matches what you did; `corpus_files[]` populated only in `corpus_run`.

## Quick start

1. Confirm **domain/URLs**, **goal**, **coverage target**, **mode**, optional **output_dir**.
2. **Step 1** — markdown-first discovery + sitemap/blog fallbacks (`REFERENCE.md`).
3. **Step 1b** — freshness pass when goal requires recent posts (`REFERENCE.md` § Freshness).
4. **Step 2** — curate URL set with intent + source tags.
5. **Step 3** — fetch with WebFetch tactics; batch parallel independent URLs.
6. **Step 4** — write page markdown per template; assess quality (Q-layer).
7. **Step 5** — emit handoff JSON v1.1 + `INDEX.md` when `corpus_run`.

## Workflow

```text
Web Scrape to MD Progress
- [ ] Step 1: Markdown-first discovery (+ sitemap/blog fallbacks)
- [ ] Step 1b: Freshness pass (when goal requires)
- [ ] Step 2: URL curation
- [ ] Step 3: Fetch (efficient, parallel)
- [ ] Step 4: Page markdown + quality pass
- [ ] Step 5: Handoff + INDEX
```

### Step 1 — Markdown-first discovery

Before bulk HTML page fetches:

1. `WebFetch` in order: `/llms.txt`, `/llms-full.txt`, `/llms.md`, `/sitemap.xml`.
2. Record `discovery_summary.llms_endpoints_checked: true` and `sitemap_root_status` (`ok` | `http_error` | `missing`).
3. **Sitemap root failure** — if `/sitemap.xml` returns HTTP error, try child sitemaps from `node scripts/wp-sitemap-fallback.mjs --domain <domain>` (`REFERENCE.md` § Sitemap fallback).
4. **llms.txt blog/archive links** — when llms lists a Blog/articles archive URL, **fetch that index for child post links** even though other archive indexes are normally excluded (`REFERENCE.md` § llms archive rule).
5. **Blog archive fallback** — when root + child sitemaps fail or omit posts, `WebFetch` archive candidates (`--blog-archive` flag on fallback script).
6. `WebSearch` only when llms, sitemap, and archive passes still leave gaps.

**Completion criterion:** `sitemap_child_urls_tried[]` populated when root sitemap failed; llms-seeded archive URLs fetched for discovery when present.

### Step 1b — Freshness pass (when required)

Set `discovery_summary.freshness_goal: true` when the goal mentions blog, articles, corpus, research, content, publish, recent, or latest (`scripts/wp-sitemap-fallback.mjs` `goalNeedsFreshness()`).

When `freshness_goal` is true:

1. Prefer **newest posts** from child post sitemap `<lastmod>` order or archive index (top **3** by default).
2. Add discovered post URLs to `recent_posts_discovered[]` and the curated fetch set.
3. Do **not** skip the archive index solely as "low-signal" when freshness is required.

**Completion criterion:** `recent_posts_discovered[]` has ≥1 URL when freshness_goal is true and the site publishes posts.

### Step 2 — URL curation

- Dedupe URLs; tag **source** and **intent** (`REFERENCE.md`).
- Exclude tag/author archives, auth/checkout, faceted noise — **except** llms-seeded blog indexes and URLs needed for `freshness_goal`.
- Trim to **coverage target** — highest-signal URLs first; include newest posts when freshness_goal.

**Completion criterion:** every planned fetch URL has `source_tag` + `intent`; `completed_total` equals curated attempt count.

### Step 3 — Fetch (efficient, parallel)

Apply `REFERENCE.md` § WebFetch:

- Batch independent URLs in **parallel** WebFetch calls; retry individually if a batch times out.
- Follow redirects; store `final_url`.
- Prefer markdown **page** variants when llms or sitemap hints allow.
- Set `fetch_format` per **page** fetch only (`markdown` | `html`).
- Status: `ok` | `http_error` | `blocked_or_empty` | `unresolved` (after one retry + alternative path).

**Completion criterion:** each `url_results[]` row has `status`, `fetch_format` when `ok`, and `final_url` when `ok`.

### Step 4 — Page markdown + quality pass

For `corpus_run`, one file per page (`{slug}.md`) using `REFERENCE.md` template.

- Extract for the **declared goal** — not full page dumps.
- Q-layer checklist in `REFERENCE.md`.
- Cap ~80–120 lines per page unless user requests full capture.

**Completion criterion:** every `ok` URL in `corpus_run` has a `corpus_files[]` entry passing Q-layer.

### Step 5 — Handoff + INDEX

Emit **handoff JSON** v1.1 (`REFERENCE.md`). Reconcile counts:

- `completed_ok` = count of `url_results` with `status: ok`
- `completed_total` = `url_results.length`
- `markdown_direct_count` / `html_fallback_count` = ok page fetches by `fetch_format` only (**not** llms.txt discovery)

For `corpus_run`, write `INDEX.md`. Every `recommended_keep` URL should appear in successful `url_results` or be documented in `limitations[]`.

Return in chat: attempted vs succeeded, efficiency summary, keep/drop, next step.

## Decision rules

- **WebSearch/WebFetch default** for quick and medium runs.
- **Skip extra search rounds** when llms + sitemap + archive already map the goal-aligned set.
- **Never skip an llms.txt Blog/archive link** without fetching it once for child URLs.
- **Escalate to programmatic scraping** only for large page counts, resume needs, or explicit batch artifact requests.
- **Do not claim full-site coverage** unless planned URL classes were attempted.

## Quality guardrails

- Separate **found URL** from **successfully fetched content**.
- Do not treat discovery snippets as page body.
- If a URL fails twice, mark `unresolved` and document one alternative in `limitations[]`.

## Ship bar (regression)

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
node scripts/wp-sitemap-fallback.mjs --domain example.com
```

Golden fixtures: `examples/example-saas.handoff.fixture.json`, `examples/example-sitemap-fail.handoff.fixture.json`. See `examples/SCORECARD-example-saas.md`.

## Done definition

- [ ] User inputs echoed in `handoff.inputs` — no invented domain
- [ ] `llms_endpoints_checked` true; `sitemap_root_status` recorded
- [ ] Sitemap root HTTP error → child sitemaps tried and/or blog archive fetched
- [ ] `freshness_goal` true → `recent_posts_discovered[]` populated when posts exist
- [ ] Every curated URL in `url_results[]`; counts reconciled (`completed_ok`, format counts)
- [ ] `markdown_direct_count` counts **page fetches** only — not llms.txt
- [ ] `corpus_run`: each `ok` URL has corpus file meeting Q-layer
- [ ] Child verifiers exit 0 on golden fixtures
