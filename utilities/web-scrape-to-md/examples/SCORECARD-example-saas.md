# Regression scorecard — web-scrape-to-md

**Purpose:** Handoff schema v1.1 + efficiency (E) + page markdown quality (Q) + sitemap fallback (S).  
**Handoff fixtures:** `example-saas.handoff.fixture.json`, `example-sitemap-fail.handoff.fixture.json`  
**Page fixtures:** `good-page.md.fixture.md`, `bad-page-html-dump.md.fixture.md`

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
node scripts/wp-sitemap-fallback.mjs --domain example.com
```

**Ship gate:** all G1–G19, E1–E7 (when applicable), Q1–Q8, S1–S6 pass.

---

## Layer G — Handoff schema (G1–G19)

Verifier: `node scripts/verify-handoff.mjs` · SSOT: `REFERENCE.md` § Handoff JSON v1.1

| ID | Criterion | Pass when |
|----|-----------|-----------|
| G1 | Version | `handoff_version` ∈ `1.0`, `1.1` |
| G2 | Skill slug | `skill` is `web-scrape-to-md` |
| G3 | Mode | `mode` ∈ `corpus_run`, `summary_only` |
| G4 | Target | `inputs.domain` or `inputs.urls[]` set |
| G5 | Goal | `inputs.goal` + `inputs.coverage_target` set |
| G6 | Discovery summary | v1.1 fields including `sitemap_root_status`, `freshness_goal`, … |
| G7 | URL results | `url_results[]` length ≥ 1 |
| G8 | URL row shape | status, intent, source_tag on every row |
| G9 | OK rows | `final_url` + `fetch_format` when `status: ok` |
| G10 | Corpus array | `corpus_files` is array |
| G11 | Corpus rows | shape valid when `corpus_run` |
| G12 | Quality pass | ≥1 `quality_pass: true` when `corpus_run` |
| G13 | Recommendations | `recommended_keep` + `recommended_drop` arrays |
| G14 | Limitations | `limitations` is array |
| G15 | Llms checked | `llms_endpoints_checked` is true |
| G16 | Format counts | markdown/html counts match ok **page** `url_results` only |
| G17 | Completed ok | `completed_ok` equals ok `url_results` count |
| G18 | Completed total | `completed_total` equals `url_results.length` |
| G19 | Corpus parity | `corpus_files.length` equals ok count when `corpus_run` |

---

## Layer E — Efficiency (E1–E7)

Verifier: `node scripts/verify-scorecard.mjs` · SSOT: `REFERENCE.md` § Efficiency rubric

| ID | Rule | Pass when |
|----|------|-----------|
| E1 | Llms first | `llms_endpoints_checked` is true |
| E2 | Format semantics | `markdown_direct_count` + `html_fallback_count` = ok page fetches (not llms.txt) |
| E3 | Search discipline | `search_rounds` ≤ 2 when sitemap/archive already yielded URLs |
| E4 | Format mix | Same as E2 / G16 |
| E5 | Coverage honesty | `completed_ok` ≤ `coverage_target` unless exhaustive noted |
| E6 | Sitemap fallback | when `sitemap_root_status: http_error`, child URLs tried OR archive fetched OR noted |
| E7 | Freshness | when `freshness_goal`, `recent_posts_discovered` ≥ 1 OR no-blog noted |

---

## Layer Q — Page markdown quality (Q1–Q8)

| ID | Rule | Pass when |
|----|------|-----------|
| Q1–Q7 | Structure | `assess-page-md.mjs` on good fixture |
| Q*-bad | Negative | bad fixture fails Q2–Q7 |
| Q8 | Handoff flags | all `corpus_files[].quality_pass` true in example-saas |

---

## Layer S — Sitemap fallback script (S1–S6)

Verifier: `verify-scorecard.mjs` · SSOT: `scripts/wp-sitemap-fallback.mjs`

| ID | Check | Pass when |
|----|-------|-----------|
| S1 | Post child sitemap | Slim SEO post XML in child list |
| S2 | Page child sitemap | Slim SEO page XML in child list |
| S3 | Blog archive order | `/articles/` first archive candidate |
| S4 | Parse locs | `parseSitemapLocs` extracts `<loc>` |
| S5 | Archive detect | `/articles/` index yes; `/articles/launch/` no |
| S6 | Freshness heuristic | research+blog goal true; pricing-only false |

---

## Version history

| Version | Notes |
|---------|-------|
| 1.0.0 | Initial G/E/Q layers |
| 1.1.0 | Sitemap/blog fallbacks, freshness, G17–G19 count fix, S-layer, example-sitemap-fail fixture |
