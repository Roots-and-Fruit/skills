# Site Content Catalog — Examples

**Illustrative only.** `example.com` fixtures are not default run targets.

## Mode — sitemap_enriched (report excerpt)

```markdown
## Site Content Catalog — example.com — 2026-06-25

**Mode:** sitemap_enriched · **Discovered:** 8 · **Enriched:** 8

| URL | Title | Type | Top Keyword | ETV | Backlinks | Last Modified |
| https://example.com/pricing | Pricing | product_page | example saas pricing | 310 | 22 | 2026-02-15 |
```

Handoff: `examples/example-saas.handoff.fixture.json`

## Mode — sitemap_only

- All pages `enrichment_status: discovered_only`
- Keyword/ETV/backlink columns null in handoff
- `limitations[]` may note "MCP not used"

## Mode — labs_fallback

- `discovery_source: labs_fallback`
- `limitations[]` must include incomplete inventory warning
- Recommend user provide sitemap URL on next run

## Classification examples

Run:

```bash
node scripts/classify-page-type.mjs --url "https://example.com/blog/2024/post"
node scripts/classify-page-type.mjs --file examples/sitemap-urls.fixture.json
node scripts/wordpress-sitemap.mjs --child "https://example.com/post-sitemap.xml"
node scripts/wordpress-sitemap.mjs --file examples/wordpress-sitemap-index.fixture.json
```

Regression: `node scripts/verify-scorecard.mjs`

## Downstream

Pass handoff JSON to [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) Phase 1. Read `limitations[]` before assuming internal-link or depth fields exist.

## Tier note (authoring)

This skill is **Tier C** — justified by:

1. Playbook consumer needs stable handoff fields
2. Page-type labels drifted without `classify-page-type.mjs` (T-layer)

See `utilities/write-a-skill/REFERENCE.md` for tier definitions.
