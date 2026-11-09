# Requirements — Competitor Research → Positioning

Tier **B** playbook. Phases are inline in [`SKILL.md`](SKILL.md). No child marketing skills are required.

## Always required

| Input | Notes |
| --- | --- |
| **Product** | Name and/or primary domain (e.g. `example.com`) |
| **Run mode** | `full_set` or `single_competitor` (infer from prompt when obvious) |
| **Output directory** | User path, or default `./competitor-positioning/{slug}-{YYYY-MM-DD}/` |

## Soft-required (short-prompt bootstrap)

Category, ICP, primary job, and platform gravity may be **assumed** from one product-homepage capture and reconfirmed with the Phase 2 set. Ask once if bootstrap capture fails.

## Capture tooling

At least one path that can save **page text** for homepage/pricing:

| Backend | Typical tools |
| --- | --- |
| `headed_browser` | Playwright CLI, Chrome DevTools MCP |
| `http_ua` | Desktop User-Agent HTTP fetch (docs, WP.org) |
| `webfetch` | Soft marketing pages only — do not retry after 403 on same host |
| `cloud_browser` | Optional batch browser (may still hit bot walls) |

**Hard ban:** inventing prices, feature lists, or review quotes when capture failed.

## Optional

- NotebookLM (or similar) for volume research **after** first-party homepage/pricing are saved
- Suspected competitor domains (hypotheses until Phase 2)
- Explicit “never compete with” constraints

## Not required

- Batch crawlers (Crawl4AI, etc.)
- DataForSEO / Ahrefs (this playbook is first-party + review corpora, not SERP scoring)
- Prior dry-run folders or fixture packs
