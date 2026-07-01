# Contributing to Roots & Fruit skills

This repo is **public**. Client work, internal orchestrator paths, and live scraped corpora belong in private workspaces — not here.

**Skill names:** frontmatter `name` must be a single token (hyphens, no spaces) so `/slash` invocation works — see [`utilities/write-a-skill/REFERENCE.md`](utilities/write-a-skill/REFERENCE.md) § Name (slash invocation).

## Public vs private

| Belongs in **this repo** | Keep **out** of this repo |
|--------------------------|---------------------------|
| Fictional fixtures (`*.handoff.fixture.json`) | Client deliverables and internal roadmaps (`ROADMAP.md`) |
| `FUTURE-WORK.md` (public-safe planning — no client slugs or private paths) | Live GSC/GA4 exports and client override files |
| `example.com`, `acme.io`, `example-*` SaaS domains | Real client domains, slugs, or product names in fixtures |
| Playbook `SKILL.md`, `EXAMPLES.md`, `REFERENCE.md` | `GROOT`, `CLIENTS/`, `_ORCHESTRATOR`, `groot.config` references |
| Skill verifiers and SCORECARDs | Scraped site corpora under `research/` |

## Promotion workflow (from a private monorepo)

1. Finish the skill or playbook in your private workspace.
2. **Anonymize** — replace real domains, client names, and live handoffs with fictional fixtures.
3. Copy only the public package into `marketing/` or `utilities/`.
4. For Tier C skills, run the skill’s own `scripts/verify-*.mjs` ship bar.
5. Open a PR.

## Fixtures and live runs

- Checked-in handoffs under `examples/` must include `.fixture.` in the filename.
- Live agent handoffs (`live-run-*.handoff.json`) are gitignored — promote to a fictional fixture manually after review.
- `research/` is gitignored for local scrape corpora; never `git add -f research/`.

## Questions

Open an issue on GitHub or follow the packaging standard in [`utilities/write-a-skill/`](utilities/write-a-skill/).
