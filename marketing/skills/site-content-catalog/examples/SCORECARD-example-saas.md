# Regression scorecard — site content catalog

**Purpose:** Handoff schema v1.0 + deterministic page-type classification + WordPress sitemap child rules.  
**Handoff fixtures:** `example-saas.handoff.fixture.json`, `example-wp-flat.handoff.fixture.json`  
**Classification fixtures:** `sitemap-urls.fixture.json`, `wordpress-sitemap-urls.fixture.json`  
**WordPress index fixture:** `wordpress-sitemap-index.fixture.json`

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
```

**Ship gate:** all G1–G19 and T1–T15 + W1–W9 pass.

---

## Layer G — Handoff schema (G1–G19)

| ID | Criterion | Pass when |
|----|-----------|-----------|
| G1 | Version | `handoff_version` is `"1.0"` |
| G2 | Skill slug | `skill` is `site-content-catalog` |
| G3 | Mode | `mode` ∈ `sitemap_only`, `sitemap_enriched`, `labs_fallback` |
| G4 | Domain | `inputs.domain` non-empty string |
| G5 | Discovery summary | `total_discovered`, `enriched_count`, `discovery_source` set |
| G6 | Pages | `pages[]` length ≥ 1 |
| G7 | Page types | every page has `url` + `page_type` from enum |
| G8 | Enrichment status | every page has valid `enrichment_status` |
| G9 | Type summary | `type_summary` counts sum to `pages.length` |
| G10 | Count consistency | `total_discovered` matches `pages.length` or noted in `limitations` |
| G11 | Limitations | `limitations` is array |
| G12 | sitemap_only | all pages `enrichment_status: discovered_only` |
| G13 | sitemap_enriched | `enriched_count` ≥ 1 and ≥1 page `enriched` |
| G14 | labs_fallback | `discovery_source: labs_fallback` and ≥1 limitation |
| G15 | sitemap_index | `content_sitemaps[]` present when `discovery_source` is `sitemap_index` |
| G16 | content_sitemaps shape | each row has `sitemap_url`, `post_type`, `url_count` |
| G17 | post sitemap | `content_sitemaps` includes `post_type: post` when index-backed |
| G18 | sitemap typing | `page_type` matches `classify-page-type.mjs` when `sitemap_post_type` set |
| G19 | sitemap url_count sum | Σ `content_sitemaps[].url_count` equals `pages.length` when index-backed |

---

## Layer T — Page-type classification (T1–T15)

Verifier: `node scripts/verify-scorecard.mjs` · Logic SSOT: `scripts/classify-page-type.mjs`

| ID | URL pattern | Expected `page_type` |
|----|-------------|----------------------|
| T1 | `/blog/2024/...` | `blog_post` |
| T2 | `/pricing` | `product_page` |
| T3 | `/integrations/stripe` | `integration_page` |
| T4 | `/docs/api` | `documentation` |
| T5 | `/vs/competitor-a` | `comparison_page` |
| T6 | `/features/analytics` | `feature_page` |
| T7 | `/` (homepage) | `landing_page` |
| T8 | deep nested path | `other` |
| T9 | `/articles/guides` | `blog_post` (fixture round-trip) |
| T10 | flat slug + `sitemap_post_type: post` | `blog_post` |
| T11 | `/about` + `sitemap_post_type: page` | `landing_page` |
| T12 | flat slug, no sitemap hint | `landing_page` (legacy) |
| T13 | `/tips/...` + `sitemap_post_type: tips` | `other` |
| T14 | `wordpress-sitemap-urls.fixture.json` | all rows match |
| T15 | nested path + `sitemap_post_type: page` | `landing_page` (WP child page) |

---

## Layer W — WordPress sitemap children (W1–W9)

SSOT: `scripts/wordpress-sitemap.mjs`

| ID | Input | Pass when |
|----|-------|-----------|
| W1 | `post-sitemap.xml` | `post_type` is `post` |
| W2 | `post-sitemap2.xml` | `post_type` is `post` (paginated) |
| W3 | `page-sitemap.xml` | `post_type` is `page` |
| W4 | `category-sitemap.xml` | excluded |
| W5 | `attachment-sitemap.xml` | excluded |
| W6 | `wp-sitemap-posts-post-1.xml` | `post_type` is `post` (core) |
| W7 | `wp-sitemap-posts-page-1.xml` | `post_type` is `page` (core) |
| W8 | index fixture | includes post/page/CPT; excludes taxonomy/media/author |
| W9 | `ngl_*_category-sitemap.xml` | excluded (`*_category` suffix) |

---

## Version history

| Version | G/T/W | Notes |
|---------|-------|-------|
| 1.0.0 | — | SKILL + REQUIREMENTS only |
| 1.1.0 | G1–G14, T1–T9 | Handoff v1.0, classify script, verifiers |
| 1.2.0 | G1–G18, T1–T14, W1–W8 | WordPress child sitemap discovery + `sitemap_post_type` classification |
| 1.2.1 | G1–G19, T1–T15, W1–W9 | Exclude `*_category` taxonomies; nested WP pages; url_count reconciliation |
