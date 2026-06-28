# Web Scrape to Markdown — Examples

**Illustrative only.** `example.com` fixtures are not default run targets.

## Mode — corpus_run

User prompt:

> Scrape example.com for competitor positioning — top 5 pages. Save to `research/corpus/example-com/`.

Agent flow:

1. Check llms + sitemap before HTML.
2. Curate five URLs with intent tags.
3. Parallel WebFetch; prefer markdown page endpoints.
4. Write per-page `.md` + `INDEX.md`.
5. Emit handoff JSON v1.1.

Handoff fixture: `examples/example-saas.handoff.fixture.json`

## Mode — summary_only with sitemap failure

User prompt:

> Research corpus for example.com — include latest blog posts.

When `/sitemap.xml` returns HTTP 500 to WebFetch:

1. llms.txt seeds core pages + **blog archive URL from llms** (any path — not assumed).
2. `extractArchivePostUrls()` on archive fetch response before slug guessing.
3. Child sitemap may succeed when root fails.
4. `freshness_goal: true` → `recent_posts_discovered[]` populated.

Handoff fixture: `examples/example-sitemap-fail.handoff.fixture.json`

## Sitemap fallback script

```bash
node scripts/wp-sitemap-fallback.mjs --domain example.com
node scripts/wp-sitemap-fallback.mjs --domain example.com --blog-archive
```

Pass llms archive seeds in code via `blogArchiveCandidates(domain, [seedUrl])` — seeds are tried before generic `/blog/`, `/news/`, etc.

## Archive link extraction

```bash
node -e "import { extractArchivePostUrls } from './scripts/wp-sitemap-fallback.mjs'; console.log(extractArchivePostUrls('<a href=\"https://example.com/blog/post-one/\">', 'https://example.com/blog/', 'example.com'));"
```

## Page markdown — good example

Fixture: `examples/good-page.md.fixture.md`

```bash
node scripts/assess-page-md.mjs --file examples/good-page.md.fixture.md
```

## Regression

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
```

## Downstream

Pass corpus folder + handoff JSON to research workflows. Read `limitations[]` and `recent_posts_discovered[]` before assuming blog completeness.

## Tier note (authoring)

**Tier C** — E-layer, Q-layer, G-layer, S-layer (`wp-sitemap-fallback.mjs` including link extraction).

See `utilities/write-a-skill/REFERENCE.md` for tier definitions.
