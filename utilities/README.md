# Utilities

Meta-skills and authoring tools for building skills in this repo. Not domain workflows — these teach agents **how to create and ship** skills that match Roots & Fruit conventions.

| Utility | Purpose |
|---------|---------|
| [write-a-skill](write-a-skill/) | Author skills with **predictability**, **right-sized** tiers (A/B/C), and regression gates only when earned |
| [web-scrape-to-md](web-scrape-to-md/) | WebSearch/WebFetch corpus builder — llms-first, sitemap/blog fallbacks, freshness pass, handoff v1.1 (Tier C) |

**Package:** `SKILL.md` · `GLOSSARY.md` · `REFERENCE.md` · `EXAMPLES.md` · `scripts/verify-skill-package.mjs`

**Meta regression:** `node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json`

Domain skills live under [`marketing/`](../marketing/) and [`product-dev/`](../product-dev/).
