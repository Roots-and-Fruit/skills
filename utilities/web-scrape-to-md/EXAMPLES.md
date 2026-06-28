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

Simulated run when `/sitemap.xml` returns HTTP 500 to WebFetch:

1. llms.txt seeds core pages + `/articles/` archive link.
2. Child sitemap `sitemap-post-type-post.xml` succeeds → newest posts discovered.
3. Archive index fetched (llms archive rule) — not skipped as low-signal.
4. `freshness_goal: true` → `recent_posts_discovered[]` populated.
5. `markdown_direct_count` stays 0 when all page fetches are HTML.

Handoff fixture: `examples/example-sitemap-fail.handoff.fixture.json`

## Sitemap fallback script

```bash
node scripts/wp-sitemap-fallback.mjs --domain example.com
node scripts/wp-sitemap-fallback.mjs --domain example.com --blog-archive
```

## Page markdown — good example

Fixture: `examples/good-page.md.fixture.md`

```bash
node scripts/assess-page-md.mjs --file examples/good-page.md.fixture.md
```

## Page markdown — bad patterns (avoid)

Fixture: `examples/bad-page-html-dump.md.fixture.md` — fails Q2–Q7.

## Regression

```bash
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
```

## Downstream

Pass corpus folder + handoff JSON to research workflows, content briefs, or positioning audits. Read `limitations[]` and `recent_posts_discovered[]` before assuming blog completeness.

## Tier note (authoring)

**Tier C** — E-layer (efficiency + fallbacks), Q-layer (page MD), G-layer (handoff v1.1), S-layer (`wp-sitemap-fallback.mjs`).

See `utilities/write-a-skill/REFERENCE.md` for tier definitions.
