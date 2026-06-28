# Contributing to Roots & Fruit skills

This repo is **public**. Client work, internal orchestrator paths, and live scraped corpora belong in private workspaces — not here.

## Before you commit or open a PR

```bash
node scripts/verify-public-hygiene.mjs
```

CI runs the same check on every push and pull request to `master`.

Optional local hook (run once per clone):

```bash
git config core.hooksPath .githooks
```

## Public vs private

| Belongs in **this repo** | Keep **out** of this repo |
|--------------------------|---------------------------|
| Fictional fixtures (`*.handoff.fixture.json`) | Client deliverables and roadmaps (`ROADMAP.md`) |
| `example.com`, `acme.io`, `example-*` SaaS domains | Real client domains, slugs, or product names in fixtures |
| Playbook `SKILL.md`, `EXAMPLES.md`, `REFERENCE.md` | `GROOT`, `CLIENTS/`, `_ORCHESTRATOR`, `groot.config` references |
| Skill verifiers and SCORECARDs | Scraped site corpora under `research/` |

## Promotion workflow (from a private monorepo)

1. Finish the skill or playbook in your private workspace.
2. **Anonymize** — replace real domains, client names, and live handoffs with fictional fixtures.
3. Copy only the public package into `marketing/` or `utilities/`.
4. Run `node scripts/verify-public-hygiene.mjs`.
5. For Tier C skills, run the skill’s own `scripts/verify-*.mjs` ship bar.
6. Open a PR; wait for **Public hygiene** CI.

## Fixtures and live runs

- Checked-in handoffs under `examples/` must include `.fixture.` in the filename.
- Live agent handoffs (`live-run-*.handoff.json`) are gitignored — promote to a fictional fixture manually after review.
- `research/` is gitignored for local scrape corpora; never `git add -f research/`.

## Extending the gate

Banned patterns live in [`scripts/banned-patterns.json`](scripts/banned-patterns.json). Add client slugs or internal path tokens there when you discover new leak vectors — then run the verifier locally before pushing.

## Questions

Open an issue on GitHub or follow the packaging standard in [`utilities/write-a-skill/`](utilities/write-a-skill/).
