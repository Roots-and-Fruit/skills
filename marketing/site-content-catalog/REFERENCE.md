# Site Content Catalog — Reference

API contracts, classification SSOT, handoff schema **v1.0**, and batching rules.

## MCP tool names (DataForSEO)

| Step | Tool |
|------|------|
| Fallback discovery | `dataforseo_labs_google_keywords_for_site` |
| Per-URL keywords / ETV | `dataforseo_labs_google_ranked_keywords` |
| Backlinks | `backlinks_summary` |
| Title / H1 / depth | `on_page_content_parsing` |

**Page content fallback:** WebFetch when on-page API unavailable.

Default locale: `location_name: "United States"`, `language_code: "en"`.

## URL normalization (discovery)

Before dedupe:

- Prefer HTTPS canonical host (strip trailing slash on path except `/`)
- Treat `www.example.com` and `example.com` as one host when user supplied `example.com`
- Drop fragment-only duplicates (`#section`)

Record dedupe count in `limitations[]` when >0 URLs merged.

## WordPress sitemap discovery

SSOT: `scripts/wordpress-sitemap.mjs`

When the sitemap index lists Yoast-style `{post_type}-sitemap.xml` or core `wp-sitemap-posts-{post_type}-N.xml` children:

| Action | Rule |
|--------|------|
| **Always include** | `post` (blog posts), `page` (static pages), and other CPT content sitemaps (e.g. `tips`, `newsletterglue`) |
| **Always exclude** | `attachment`, `category`, `post_tag`, `author`, taxonomy suffixes `*_cat`, `*_tag`, `*_category` |
| **Per URL** | Set `sitemap_post_type` on each `pages[]` row from the child sitemap that listed the URL |
| **Summary** | When `discovery_source` is `sitemap_index`, set `discovery_summary.content_sitemaps[]` |

Agent: filter child sitemaps with `shouldIncludeChildSitemap` — do not skip `post-sitemap` on flat-permalink sites.

## Large-site batching

| Pages discovered | Enrichment |
|------------------|------------|
| ≤100 | Enrich all when mode is `sitemap_enriched` |
| 101–200 | Top pages by sitemap priority or user slice; note in `limitations[]` |
| >200 | Ask user to scope by path prefix before deep enrichment |

`discovery_summary.total_discovered` = full discovered count. `pages[]` may be a subset if truncated — then `limitations[]` must say so (G10).

## Page-type enum

`blog_post` · `landing_page` · `product_page` · `feature_page` · `integration_page` · `comparison_page` · `documentation` · `other`

### Classification order (first match wins)

SSOT: `scripts/classify-page-type.mjs` — keep in sync. Optional third argument / `sitemap_post_type` field: WordPress child sitemap slug.

| Order | `page_type` | Heuristic |
|-------|-------------|-----------|
| 1 | `documentation` | `/docs/`, `/help/`, `/support/`, `/documentation/` |
| 2 | `blog_post` | `/blog/`, `/articles/`, `/posts/`, `/news/`, `YYYY/MM` or `YYYY-MM` in path, **or `sitemap_post_type: post`** |
| 3 | `integration_page` | `/integrations/`, `/integrates/` |
| 4 | `comparison_page` | `/vs/`, `/versus/`, `/alternative(s)/`, `/compare/`, `-vs-`, or "vs" in title |
| 5 | `product_page` | `/pricing/`, `/products/`, `/product/` |
| 6 | `feature_page` | `/features/`, `/feature/` |
| 7 | `landing_page` | homepage `/`, single path segment (when not CPT `other`), `sitemap_post_type: page` (including nested WP pages), or `/solutions/`, `/platform/` |
| 8 | `other` | custom CPT paths (`sitemap_post_type` not `post`/`page`), or deep unmatched paths |

Agent: use script rules; pass `sitemap_post_type` when discovered from WordPress child sitemaps.

## Handoff schema v1.0

```json
{
  "handoff_version": "1.0",
  "skill": "site-content-catalog",
  "skill_version": "1.2.1",
  "generated_at": "<ISO 8601>",
  "mode": "sitemap_only | sitemap_enriched | labs_fallback",
  "inputs": {
    "domain": "example.com",
    "sitemap_url": null,
    "scope_prefix": null,
    "location_name": "United States",
    "language_code": "en"
  },
  "discovery_summary": {
    "total_discovered": 0,
    "enriched_count": 0,
    "discovery_source": "sitemap | sitemap_index | labs_fallback",
    "scope_applied": null,
    "content_sitemaps": [
      {
        "sitemap_url": "https://example.com/post-sitemap.xml",
        "post_type": "post",
        "url_count": 0
      }
    ]
  },
  "type_summary": {
    "blog_post": 0,
    "landing_page": 0,
    "product_page": 0,
    "feature_page": 0,
    "integration_page": 0,
    "comparison_page": 0,
    "documentation": 0,
    "other": 0
  },
  "pages": [
    {
      "url": "https://example.com/pricing",
      "title": "Pricing",
      "page_type": "product_page",
      "sitemap_post_type": null,
      "top_keyword": null,
      "etv": null,
      "backlinks_referring_domains": null,
      "word_count": null,
      "heading_count": null,
      "last_modified": null,
      "enrichment_status": "discovered_only | enriched | unfetchable"
    }
  ],
  "limitations": []
}
```

### Field notes

| Field | Rule |
|-------|------|
| `sitemap_post_type` | WordPress child sitemap slug when known (`post`, `page`, CPT slug); omit or null otherwise |
| `discovery_summary.content_sitemaps` | Required when `discovery_source` is `sitemap_index`; `url_count` per row must match pages in `pages[]` with that `sitemap_post_type` (G19) |
| `top_keyword` / `etv` / backlinks / counts | Populated only when `enrichment_status` is `enriched` |
| `limitations[]` | Required for `labs_fallback`; batch caps; explicit v1.0 omissions |
| **Not in v1.0** | `inbound_internal_links` — cornerstone must not assume; add in v1.1 if needed |

## Playbook consumer contract

[Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) Phase 1 reads:

- `pages[]` for URL, `page_type`, keyword/ETV/backlinks when enriched
- `discovery_summary` for scale decisions (>200 flow)
- `limitations[]` for honest gaps

## Regression

- Golden handoff: `examples/example-saas.handoff.fixture.json`, `examples/example-wp-flat.handoff.fixture.json`
- Classification: `examples/sitemap-urls.fixture.json`, `examples/wordpress-sitemap-urls.fixture.json`
- WordPress index: `examples/wordpress-sitemap-index.fixture.json`
- Scorecard: `examples/SCORECARD-example-saas.md`

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
```
