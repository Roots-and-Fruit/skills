# web-scrape-to-md — Reference

SSOT for handoff schema v1.1, WebFetch tactics, sitemap/blog fallbacks, efficiency rubric, and page markdown quality.

---

## Boundary vs site content catalog

| Need | Skill |
|------|-------|
| URL inventory, `page_type`, SEO signals, playbook input | [site-content-catalog](../../marketing/skills/site-content-catalog/) |
| **Page body extraction** into analysis-ready markdown | **web-scrape-to-md** |

You may run catalog first, then pass a URL shortlist into this skill.

---

## Discovery order (efficiency)

Attempt **before** wide HTML page scraping:

| Order | URL | Purpose |
|-------|-----|---------|
| 1 | `https://{domain}/llms.txt` | Curated URL list + markdown hints |
| 2 | `https://{domain}/llms-full.txt` | Extended list |
| 3 | `https://{domain}/llms.md` | Site summary in markdown |
| 4 | `https://{domain}/sitemap.xml` | URL discovery; record `sitemap_root_status` |

**When step 4 returns HTTP error** — do not stop discovery. Run sitemap fallback (`§ Sitemap fallback`).

Then **WebSearch** only for remaining gaps (goal-driven queries below).

**Efficiency rule:** when llms + sitemap + archive passes cover the goal-aligned set, prefer curation over additional search rounds (`search_rounds` ≤ 2).

### llms.txt archive rule (non-negotiable)

When `llms.txt` (or llms-full) links a **Blog / articles archive** index (e.g. `/articles/`, `/blog/`):

1. **Fetch that URL once** for child post link discovery.
2. Tag discovered posts `source_tag: archive_discovered` (or `sitemap_child_discovered` if also in sitemap).
3. Do **not** add the archive index itself to `recommended_drop` without fetching it when llms listed it as a Key Resource.

Other archive indexes (tag, author, date) remain excluded unless the user requests them.

---

## Sitemap fallback

When `sitemap_root_status` is `http_error` or `missing`:

1. Try child sitemap URLs (Slim SEO, Yoast, core WordPress patterns):

```bash
node scripts/wp-sitemap-fallback.mjs --domain {domain}
```

Default candidates:

- `/sitemap-post-type-post.xml`
- `/sitemap-post-type-page.xml`
- `/post-sitemap.xml`, `/page-sitemap.xml`
- `/wp-sitemap-posts-post-1.xml`, `/wp-sitemap-posts-page-1.xml`

2. Record every attempted URL in `discovery_summary.sitemap_child_urls_tried[]`.
3. Parse `<loc>` entries with `parseSitemapLocs()` in the same script (or equivalent).
4. Prefer **post** child sitemap for blog freshness; **page** child for marketing pages.

If child sitemaps also fail → blog archive fallback (`§ Blog archive fallback`).

**Note:** Root sitemap may work in a browser but return HTTP 500 to WebFetch (CDN/WAF). Child URLs often succeed — always try them before giving up.

---

## Blog archive fallback

When sitemap discovery is incomplete or failed:

```bash
node scripts/wp-sitemap-fallback.mjs --domain {domain} --blog-archive
```

Try in order: `/articles/`, `/blog/`, `/news/`.

1. `WebFetch` the first that returns content.
2. Set `blog_archive_fetched: true` and `blog_archive_url`.
3. Extract up to **3** newest post links from index copy (top of page = recency heuristic).
4. Add posts to curated URL set — do not bulk-fetch the full archive listing page unless user asks.

---

## Freshness

Set `discovery_summary.freshness_goal: true` when the user goal implies blog/content recency. Heuristic (also in `goalNeedsFreshness()`):

`blog`, `article`, `post`, `corpus`, `research`, `content`, `publish`, `recent`, `latest`, `news`

When `freshness_goal` is true:

| Step | Action |
|------|--------|
| 1 | Sort post URLs by sitemap `<lastmod>` when available |
| 2 | Else use order from archive index fetch |
| 3 | Include top **3** posts in curated set (or fewer if coverage cap tight) |
| 4 | Populate `recent_posts_discovered[]` with those URLs |

**Completion:** at least one recent post URL discovered when the site has a public blog and discovery tools partially work.

---

## WebFetch tactics (Step 3)

Apply on every **page** fetch:

1. **Section scope** — long docs: TOC first, then `#anchor` sections.
2. **Parallel batching** — independent URLs in one turn; **retry individually** if a batch times out.
3. **Redirects** — re-fetch final URL; store in `final_url`.
4. **Factual extraction** — quote or lightly summarize; flag ambiguity.
5. **Citations** — claims traceable to `final_url`.
6. **Context engineering** — headings, paragraphs, tables; drop nav/footer boilerplate.

---

## URL tags

### Source tags (`source_tag`)

| Value | Meaning |
|-------|---------|
| `llms_seed` | From llms.txt / llms-full.txt (page URL, not the txt file itself) |
| `sitemap_discovered` | From root sitemap.xml |
| `sitemap_child_discovered` | From child sitemap XML |
| `archive_discovered` | Post URL found via blog/articles archive index |
| `search_discovered` | From WebSearch |
| `nav_discovered` | From fetched page navigation |

### Intent tags (`intent`)

| Value | Use for |
|-------|---------|
| `identity` | Product/site positioning, homepage hero |
| `value` | Pricing, plans, limits, offers |
| `evidence` | Case studies, testimonials, reviews |
| `reference` | Docs, specs, how-tos, blog posts |
| `general` | Fallback |

### Fetch status (`status`)

`ok` | `http_error` | `blocked_or_empty` | `unresolved`

### Fetch format (`fetch_format`)

`markdown` | `html` — **page content fetches only.** The llms.txt endpoint is discovery metadata; it does **not** increment `markdown_direct_count`.

---

## Count semantics (G16)

| Field | Counts |
|-------|--------|
| `markdown_direct_count` | `url_results` where `status: ok` and `fetch_format: markdown` |
| `html_fallback_count` | `url_results` where `status: ok` and `fetch_format: html` |
| `completed_ok` | `url_results` where `status: ok` |
| `completed_total` | `url_results.length` |

Do **not** count llms.txt, sitemap XML, or archive index discovery fetches in format mix fields unless those URLs are also curated **content** pages in `url_results`.

---

## Page markdown template (`corpus_run`)

Filename: `{slug}.md` (slug from path or label).

```markdown
# {Page title}

- **URL:** {final_url}
- **Fetched:** {ISO date}
- **Status:** ok | partial | failed
- **Intent:** {intent}

## Summary
One to three sentences — goal-aligned takeaway.

## Key content
Goal-aligned bullets, quotes, or tables.

## Notable gaps
Fetch limits, thin sections, paywall, missing data.
```

**Line budget:** default 80–120 lines per file.

---

## Page markdown quality (Q-layer)

`node scripts/assess-page-md.mjs --file <path>`

| ID | Rule | Pass when |
|----|------|-----------|
| Q1 | Title | `# ` heading |
| Q2 | Source | `**URL:**` with http(s) |
| Q3 | Provenance | `**Fetched:**` or `**Status:**` |
| Q4 | No HTML dump | No HTML element tags |
| Q5 | Line budget | 5–120 lines (default) |
| Q6 | Structure | ≥1 `## ` section |
| Q7 | Signal density | ≥3 non-header content lines |

---

## Efficiency rubric (E-layer)

| ID | Rule | Pass when |
|----|------|-----------|
| E1 | Llms first | `llms_endpoints_checked` is true |
| E2 | Format semantics | `markdown_direct_count` + `html_fallback_count` = ok `url_results` count (page fetches only) |
| E3 | Search discipline | `search_rounds` ≤ 2 when sitemap or archive already yielded ≥3 goal URLs |
| E4 | Format mix | Same as E2 / G16 |
| E5 | Coverage honesty | `completed_ok` ≤ `coverage_target` unless exhaustive noted |
| E6 | Sitemap fallback | When `sitemap_root_status` is `http_error`, `sitemap_child_urls_tried.length` ≥ 1 OR `blog_archive_fetched` OR noted in `limitations` |
| E7 | Freshness | When `freshness_goal`, `recent_posts_discovered.length` ≥ 1 OR blog absence noted in `limitations` |

---

## Handoff JSON schema v1.1

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `handoff_version` | string | yes | `"1.1"` |
| `skill` | string | yes | `"web-scrape-to-md"` |
| `skill_version` | string | yes | From SKILL.md frontmatter |
| `generated_at` | string | yes | ISO 8601 |
| `mode` | string | yes | `corpus_run` \| `summary_only` |
| `inputs` | object | yes | See below |
| `discovery_summary` | object | yes | See below |
| `url_results` | array | yes | One row per curated URL attempted |
| `corpus_files` | array | yes | Empty when `summary_only` |
| `recommended_keep` | string[] | yes | Subset of successful fetches or documented gaps |
| `recommended_drop` | string[] | yes | May be empty |
| `limitations` | string[] | yes | May be empty |
| `efficiency_notes` | string[] | no | Human-readable wins |

### `discovery_summary` (v1.1)

| Field | Type | Required |
|-------|------|----------|
| `llms_endpoints_checked` | boolean | yes |
| `llms_txt_status` | string | yes — `found` \| `missing` \| `not_checked` |
| `sitemap_checked` | boolean | yes |
| `sitemap_root_status` | string | yes — `ok` \| `http_error` \| `missing` \| `not_fetched` |
| `sitemap_child_urls_tried` | string[] | yes — may be empty when root ok |
| `blog_archive_fetched` | boolean | yes |
| `blog_archive_url` | string | when `blog_archive_fetched` |
| `freshness_goal` | boolean | yes |
| `recent_posts_discovered` | string[] | yes — may be empty |
| `search_rounds` | number | yes |
| `markdown_direct_count` | number | yes |
| `html_fallback_count` | number | yes |
| `discovery_sources` | string[] | yes |
| `completed_ok` | number | yes |
| `completed_total` | number | yes |

### `url_results[]` / `corpus_files[]`

Unchanged from v1.0 — see prior fields in package v1.0.0 docs; `source_tag` enum expanded above.

---

## INDEX.md (`corpus_run`)

```markdown
# Corpus index — {domain}

| Label | URL | Status | Intent | File |
|-------|-----|--------|--------|------|
| Pricing | https://example.com/pricing | ok | value | pricing.md |
```

---

## Version history

| Version | Notes |
|---------|-------|
| 1.0.0 | Initial public handoff; Q/E/G layers |
| 1.1.0 | Sitemap/blog fallbacks, freshness pass, llms archive rule, count semantics, handoff v1.1 |
