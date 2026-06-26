---
name: Site Content Catalog
type: capability
description: >
  Use when cataloging a site, building a page inventory, crawling a sitemap, or
  listing all pages. Structured URL inventory with SEO signals and page-type labels
  from sitemaps or domain discovery.
version: 1.2.1
---

# Site Content Catalog

## Purpose

Produce a structured **catalog** — URL inventory plus optional SEO signals and `page_type` labels. Foundational input for playbooks and audits.

**Not this skill:** cornerstone scoring, cannibalization, or change recommendations.

**Reference:** `REFERENCE.md` · **Requirements:** `REQUIREMENTS.md` · **Examples:** `EXAMPLES.md`

## Input policy (non-negotiable)

- **Sitemap URL or domain** — from the user only. Never infer from workspace, examples, or prior runs.
- **Scope** (optional) — path prefix such as `/blog/` or `/features/`.
- If missing, ask once:

  > *Which domain or sitemap URL should I catalog? (Optional: limit to a path prefix.)*

## Modes

| Mode | When | Data |
|------|------|------|
| **sitemap_only** | Sitemap + WebFetch; no MCP | URLs, lastmod, `page_type`; signals null |
| **sitemap_enriched** | Sitemap + DataForSEO MCP (default full catalog) | + keywords, ETV, backlinks, word/heading counts when available |
| **labs_fallback** | No sitemap; domain + MCP | Ranked URLs only; `limitations[]` required |

**Completion criterion for mode:** `handoff.mode` matches actual discovery path; `limitations[]` states any batch cap or partial enrichment.

## Quick start

1. Confirm **domain** or **sitemap URL**, optional **scope**, and **mode**.
2. **Step 1** — discover pages (`REFERENCE.md`).
3. **Step 2** — enrich per mode and site size rules.
4. **Step 3** — assign `page_type` via `classify-page-type.mjs` rules (do not invent types).
5. **Step 4** — human markdown table (optional).
6. **Step 5** — emit **handoff JSON** v1.0 (`REFERENCE.md`).

Offer to save handoff JSON for [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) or other downstream skills.

## Step 1 — Discover pages

**Sitemap URL:** WebFetch XML; parse `<loc>`, `<lastmod>`, `<priority>`; recurse sitemap indexes.

**WordPress / Yoast / core (mandatory when index children match):**

1. Parse each child sitemap URL with `scripts/wordpress-sitemap.mjs` (`parseChildSitemapPostType`, `shouldIncludeChildSitemap`).
2. **Include** all content post-type child sitemaps — at minimum **`post-sitemap`** (posts) and **`page-sitemap`** (pages), plus custom CPT sitemaps (e.g. `tips-sitemap.xml`).
3. **Exclude** taxonomy/media/author sitemaps (category, tag, attachment, author, `*_cat`, `*_tag`) per script defaults.
4. Fetch every included child sitemap; tag each discovered URL with `sitemap_post_type` from its source child sitemap.
5. Populate `discovery_summary.content_sitemaps[]` when `discovery_source` is `sitemap_index` (one row per included child: `sitemap_url`, `post_type`, `url_count` **after dedupe** — each `url_count` must match `pages[]` rows with that `sitemap_post_type`; see G19).

**Domain only:** try `/sitemap.xml` and `/sitemap_index.xml`; if missing → `labs_fallback` mode with `dataforseo_labs_google_keywords_for_site`.

Apply **scope** filter after discovery.

**Completion criterion:** every in-scope URL listed once (dedupe www/non-www trailing slashes per `REFERENCE.md`). WordPress indexes must not omit `post` (or core `wp-sitemap-posts-post-*`) child sitemaps when present in the index.

## Step 2 — Enrich with signals

| Signal | Source | Mode |
|--------|--------|------|
| Ranked keywords / ETV | `dataforseo_labs_google_ranked_keywords` | enriched |
| Backlinks | `backlinks_summary` | enriched |
| Title / H1 / depth | `on_page_content_parsing` or WebFetch | enriched |
| Last modified | sitemap or headers | all |

**Large sites** (`REFERENCE.md`): batch enrichment; document cap in `limitations[]`.

**Completion criterion:** each page has `enrichment_status` (`discovered_only` | `enriched` | `unfetchable`); enriched fields null only when `discovered_only`.

## Step 3 — Classify page types

Run `scripts/classify-page-type.mjs` rules (`REFERENCE.md`). Pass `sitemap_post_type` when known from WordPress child sitemaps. First match wins.

**Completion criterion:** every page has `page_type` from the enum; `type_summary` counts match `pages.length`. Flat-permalink posts from `post` sitemaps must be `blog_post`, not `landing_page`.

## Step 4 — Human report (optional)

```markdown
## Site Content Catalog — {domain} — {date}

**Mode:** {mode} · **Discovered:** X · **Enriched:** Y · **Scope:** {all | prefix}

**Discovery:** {sitemap index children included — e.g. post, page, tips — or single sitemap}

| URL | Title | Type | Sitemap PT | Top Keyword | ETV | Backlinks | Last Modified |
| ... |
```

## Step 5 — Handoff JSON

Emit `handoff_version: "1.0"` per `REFERENCE.md`. When a playbook calls this skill, return handoff directly (playbook formats the report).

## Done definition

**All modes**

- [ ] Step 1 complete — deduped URL list; scope applied
- [ ] Every page has `page_type` and `enrichment_status`
- [ ] `type_summary` sums to `pages.length`
- [ ] `limitations[]` lists batch caps, labs fallback, or missing v1.0 fields
- [ ] Handoff validates: `node scripts/verify-handoff.mjs` (G1–G19)
- [ ] Page types validate: `node scripts/verify-scorecard.mjs` (T1–T15, W1–W9)

**sitemap_enriched additionally**

- [ ] `enriched_count` reflects pages with MCP signals
- [ ] No fake ETV/backlink values on `discovered_only` rows

**Playbook consumer:** [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) Phase 1 — do not assume `inbound_internal_links` (not in v1.0; see `limitations`).

## Maintainers

After classification or handoff schema changes:

```bash
node scripts/verify-scorecard.mjs
node scripts/verify-handoff.mjs
```
