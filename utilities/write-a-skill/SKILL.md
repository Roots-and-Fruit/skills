---
name: write-a-skill
description: >
  Use when creating or reviewing an agent skill, adapting an external skill for
  public release, reviewing SKILL.md quality, or choosing handoff JSON and verify
  scripts. Right-sized packaging with predictable process; regression gates only
  when needed.
version: 0.4.1
---

# Write a Skill

A skill wrangles **predictability** out of a stochastic system: same *process* every run, not the same *output*. **Right-size** the package — lean when prose suffices, **regression-gated** only when downstream skills or drift demand it.

**Vocabulary:** [`GLOSSARY.md`](GLOSSARY.md) · **Tiers & schemas:** [`REFERENCE.md`](REFERENCE.md) · **Patterns:** [`EXAMPLES.md`](EXAMPLES.md)

**Reference implementations:** `marketing/skills/fan-out-coverage-analysis/` (Tier C + normalize script) · `marketing/skills/information-gain-evaluator/` (Tier C + rigorous rules) · `marketing/skills/site-content-catalog/` (Tier C — first package-verifier golden case)

**Meta ship bar:** `node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json` (M1–M2 in `examples/SCORECARD-skill-packages.md`)

## Default behavior

- Public domain skills → `marketing/skills/{name}/` or `marketing/playbooks/{name}/`
- Meta skills → `utilities/{name}/`
- Project-local → `.cursor/skills/{name}/` when appropriate
- Fictional examples only (`example.com`) — no secrets or client PII
- **Do not default to Tier C.** Earn files with the tier decision in Step 1.

## Step 0 — Intake (ask once if missing)

1. **Job** — one sentence; split if triggers collide with another skill
2. **Branches** — distinct modes or paths
3. **Output** — prose only, prose + optional JSON, or playbook orchestration
4. **Consumer** — human only, or another skill/playbook needs structured fields
5. **Fragile logic** — scoring, tiering, classification agents get wrong repeatedly
6. **Data** — MCP, WebFetch, CSV (→ `REQUIREMENTS.md` if public `marketing/`)

**Completion criterion for intake:** you can name package **tier** (A/B/C) and **skill class** without guessing.

## Step 1 — Right-size (tier + class)

Use [`REFERENCE.md`](REFERENCE.md) tier matrix. Summary:

| Tier | Package | When |
|------|---------|------|
| **A — Lean** | `SKILL.md` (+ `REQUIREMENTS.md` if public marketing) | Judgment/copy; no downstream consumer; checkable done in prose |
| **B — Disclosed** | A + `REFERENCE.md` + `EXAMPLES.md` | MCP/API detail, rubrics, long reference; still no verifier |
| **C — Regression-gated** | B + fixtures + `SCORECARD` + `scripts/verify-*.mjs` (+ optional normalize script) | Playbook consumes handoff; proven agent drift on rules; deterministic classification |

**Over-engineering check:** if Tier C is selected, state *which* failure mode it prevents (e.g. score inflation, wrong tier labels, invalid handoff for Phase 2). If you cannot name one, drop to B or A.

| Class | Typical path | Default tier |
|-------|--------------|--------------|
| capability | `marketing/skills/{name}/` | A or B; C if emits handoff to playbook |
| composite | `marketing/skills/{name}/` | B or C |
| playbook | `marketing/playbooks/{name}/` | A or B — link children, don't duplicate |
| utility | `utilities/{name}/` | A or B |

Playbooks **link** to `../../skills/{child}/SKILL.md` — never re-implement child workflows inline.

## Step 2 — Write for predictability (all tiers)

When writing `SKILL.md`:

1. **Description (trigger layer)** — **first words:** `Use when` / `Use for` / `Use before` + **≥2 distinct user phrases**; optional short capability clause after. Rules: `REFERENCE.md` § Layer 0.
2. **Purpose** + "Not this skill" when boundaries matter
3. **Input policy** — user-supplied inputs only (public marketing skills)
4. **Quick start** — minimal happy path per branch
5. **Steps** — each ends with a **checkable completion criterion**
6. **Done definition** — checklist; exhaustive where it matters ("every URL classified", not "catalog complete")
7. **Context pointers** — `See REFERENCE.md` for API params, schemas, rubrics — keep `SKILL.md` legible

**Invocation note:** meta/authoring skills may set `disable-model-invocation: true` to save context load; domain skills stay model-invoked. See `REFERENCE.md`.

### Progressive disclosure — description is the trigger

Hosts (Cursor, Claude, etc.) load **only** frontmatter `description` before deciding whether to open the rest of the skill. No match → generic answers with no error.

| Layer | What loads | Authoring rule |
|-------|------------|----------------|
| **Trigger** | `description` only | **Lead with** `Use when …` (core job); pack alternate **user vocabulary** in the same opening line |
| **Body** | `SKILL.md` after match | Steps, criteria, pointers — **progressive disclosure** to `REFERENCE.md` |

**Durable fix:** widen the description with alternate phrases (`dossier` vs `expert profile`, `page inventory` vs `catalog this site`). **Quick fix for users:** name the skill in the prompt (`use the site content catalog skill to …`).

**Not duplication:** three trigger phrases in `description` for one branch. **Is duplication:** repeating the same instruction in `SKILL.md` and `REFERENCE.md`, or listing five synonyms for the same word with no new intent.

**Trigger audit (before ship):** for each branch, ask *"Would someone who didn't write this skill use different words?"* If yes, add those words to `description`, not the body.

Prune every edit: **relevance**, **no-op**, **duplication**, **sediment** — [`GLOSSARY.md`](GLOSSARY.md).

## Step 3 — Add files the tier requires

| File | Tier A | Tier B | Tier C |
|------|--------|--------|--------|
| `SKILL.md` | ✓ | ✓ | ✓ |
| `REQUIREMENTS.md` | public marketing | ✓ | ✓ |
| `REFERENCE.md` | | ✓ | ✓ |
| `EXAMPLES.md` | | ✓ | ✓ |
| `examples/*.fixture.json` | | | ✓ |
| `examples/SCORECARD-*.md` | | | ✓ |
| `scripts/verify-*.mjs` | | | ✓ |

Tier C only when Step 1 earned it:

1. Define `handoff_version` + schema in `REFERENCE.md`
2. Golden fixture — fictional domain
3. SCORECARD — binary IDs (G schema, R rules, S script output)
4. Verifier — Node 18+, stdlib only; exit 1 on fail
5. **Ship bar** line in `SKILL.md`: exact `node scripts/…` command

Extract **deterministic** transforms to `scripts/*.mjs` when agents re-derive them every run (fan-out `normalize-fanout.mjs` pattern).

## Step 4 — Index and closeout

- Update `marketing/README.md` or `utilities/README.md` when shipping publicly
- Bump `version` when schema, scorecard, or behaviour changes
- **Completion criterion for closeout:** changed paths listed; tier stated; run package verifier when tier A/B/C layout changed:

```bash
node scripts/verify-skill-package.mjs --path <skill-dir> --tier <A|B|C> [--public] [--run-verifiers]
```

Tier C public skills: include `--public --run-verifiers`. Tier C → child verifier PASS output required.

## Adapting external or monorepo skills

1. Strip internal monorepo paths, client overrides, and orchestrator-only references
2. Add input policy + branches
3. Replace inline orchestration with sibling links
4. **Re-tier** — do not copy internal file count blindly
5. Grep `marketing/` descriptions for trigger collision

## Failure modes (diagnose before adding files)

| Symptom | Likely mode | Fix (in order) |
|---------|-------------|----------------|
| Agent stops early | **Premature completion** | Sharpen completion criteria in `SKILL.md` |
| Agent invents domain/URL | Missing **input policy** | Add policy block; ask-once prompt |
| Downstream phase breaks on fields | Missing **handoff** | Tier B schema doc → Tier C fixture + verifier |
| Scores/tiers drift run to run | Judgment should be deterministic | `scripts/*.mjs` + SCORECARD S-layer |
| Schema passes, judgment wrong | **Over-engineering** the wrong layer | Strengthen rubric in REFERENCE + R-layer rules; prose first |
| `SKILL.md` unreadable | **Sprawl** | Progressive disclosure to `REFERENCE.md` |
| Stale contradictory rules | **Sediment** / **duplication** | Prune; single source of truth |
| Lines that change nothing | **No-op** | Delete sentence entirely |
| Too many files for a brief | **Over-engineering** | Drop to Tier A or B |
| Skill never loads | Thin or mismatched **description** (progressive disclosure) | Add ≥2 user phrases per branch in `description`; optional one-line "force-load" note in body; grep collision with sibling skills |

## Done definition

Another agent can run the skill cold: follow the same **process**, meet stated **completion criteria**, pass **ship bar** if Tier C, and a downstream consumer (if any) works without guessing field names.
