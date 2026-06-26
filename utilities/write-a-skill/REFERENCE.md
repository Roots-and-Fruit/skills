# write-a-skill — Reference

Tier decision matrix, authoring craft checklist, R&F regression patterns, and templates.

**Glossary:** [`GLOSSARY.md`](GLOSSARY.md)

---

## Package tiers (right-sizing)

Choose the **lowest** tier that satisfies the job. Escalate only when a named failure mode appears in production or review.

### Tier A — Lean

```text
skill-name/
├── SKILL.md
└── REQUIREMENTS.md    # required for public marketing/ skills only
```

**Use when:**

- Output is prose or markdown for humans
- No skill/playbook consumes structured fields
- Completion is checkable in prose ("brief includes KPI section")
- Judgment is the product (strategy, copy, brainstorming)

**Ship bar:** quality checklist in Step 2 — no verifier.

**Examples:** campaign brief generator, lightweight utility meta-skills.

### Tier B — Disclosed

```text
skill-name/
├── SKILL.md
├── REQUIREMENTS.md
├── REFERENCE.md
└── EXAMPLES.md
```

**Use when:**

- MCP tool names, API params, or scoring rubrics would bloat `SKILL.md`
- Agent needs on-demand reference (enums, lane rules, report sections)
- Optional handoff documented but not yet machine-validated
- Early public skill before drift is proven

**Ship bar:** REFERENCE is SSOT for rubrics; EXAMPLES are fictional; done-definition checklist passes.

**Do not add Tier C** until you observe drift, playbook integration, or invalid JSON breaking downstream work.

### Tier C — Regression-gated

```text
marketing/skills/skill-name/
├── SKILL.md
├── REQUIREMENTS.md
├── REFERENCE.md
├── EXAMPLES.md
├── examples/
│   ├── SCORECARD-{case}.md
│   └── {case}.handoff.fixture.json
└── scripts/
    ├── verify-handoff.mjs    # and/or verify-scorecard.mjs
    └── {normalize}.mjs       # optional
```

**Use when (need at least one):**

- Playbook or composite **requires** handoff JSON with stable field names
- Agents repeatedly violate scoring/tiering/classification rules (proven — not hypothetical)
- Deterministic normalizer replaces fragile agent re-derivation each run
- Version bumps must not silently break consumers

**Ship bar:** `node scripts/verify-*.mjs` exits 0 on golden fixture; SCORECARD documents every automated ID.

**Reference:** `marketing/skills/information-gain-evaluator/`, `marketing/skills/fan-out-coverage-analysis/`

### Tier escalation path

```text
Draft → Tier A (ship fast)
  ↓ sprawl or MCP detail
Tier B (+ REFERENCE, EXAMPLES)
  ↓ drift / downstream consumer / bad handoffs
Tier C (+ fixture, SCORECARD, verifier)
```

Never skip A/B discipline and jump to C "because fan-out does it."

---

## Tier decision worksheet

Answer before adding files:

| Question | Yes → |
|----------|--------|
| Does another skill/playbook parse your output fields? | At least Tier B schema; likely Tier C |
| Did agents get the same task wrong twice with different wrong answers? | Consider normalize script + S-layer |
| Is output prose-only for a human? | Tier A |
| Would a verifier only check JSON keys, not judgment quality? | Tier B rubric first; don't fake rigor with C |
| Is the skill a playbook? | Tier A/B; children own Tier C |
| Are you adding files because a template says so? | **Over-engineering** — stop |

---

## Layer 0 — Authoring craft (all tiers)

Apply while writing `SKILL.md`.

### Description (trigger layer)

The `description` is the **only** preloaded routing signal on model-invoked skills. Mismatched vocabulary → skill never opens → generic answers with no error.

- **First words:** `Use when …`, `Use for …`, or `Use before …` (core job — not a capability paragraph first)
- **Same opening line:** **≥2 distinct user phrases** (alternate vocabulary users say)
- Optional second sentence: short capability summary
- Third person; max 1024 chars
- Include **alternate vocabulary** (`page inventory`, `dossier`, `crawl sitemap`) — not body **duplication**
- **Do not** open with a capability-only paragraph and bury `Use when` later
- Optional in `SKILL.md` body: users can force-load by naming the skill in the prompt

**Verifier (model-invoked):** P13 description **starts with** trigger line; P14 ≥2 phrases on that line (`verify-skill-package.mjs`).

### Body duplication vs trigger vocabulary

| OK in `description` | Not OK anywhere |
|-----------------------|-----------------|
| `catalog site`, `page inventory`, `list all URLs` | Same step copied in `SKILL.md` and `REFERENCE.md` |
| Two branches with distinct `Use when` clauses | Five rephrasings of one instruction in the body |

### Information hierarchy

1. **In-skill steps** — primary; each with **completion criterion**
2. **In-skill reference** — short rules inline when every branch needs them
3. **External reference** — `REFERENCE.md`, `EXAMPLES.md`, `GLOSSARY.md` via context pointers

Push down the ladder before adding files. Split by **branch** so each path carries only what it needs.

### Completion criteria

| Quality | Example |
|---------|---------|
| Weak | "understanding reached", "catalog complete" |
| Checkable | "handoff includes `mode` and `limitations[]`" |
| Exhaustive | "every URL in sitemap has `page_type` from enum" |

**Premature completion defence:** sharpen criterion first; split sequence second; Tier C verifier last (only when checkable objectively).

### Pruning pass (every edit)

For each line:

1. **Relevance** — does it bear on the skill's job today?
2. **No-op** — does it change behaviour vs model default?
3. **Duplication** — is meaning authoritative elsewhere?
4. **Sediment** — is it stale? delete.

### Invocation

| Style | When | Frontmatter |
|-------|------|-------------|
| Model-invoked | Agent should discover skill from task | `description` with triggers (default domain skills) |
| User-invoked | Human-only or meta authoring | `disable-model-invocation: true`; description is human summary |

`write-a-skill` may be user-invoked in personal installs to save **context load**. In this repo it stays model-invoked for "create a skill" tasks.

---

## Layer 1 — R&F public marketing conventions

### Input policy (public `marketing/` skills)

```markdown
## Input policy (non-negotiable)

- **{input}** — from the user only. Never infer from workspace, examples, or prior runs.
- If missing, ask once: > *{prompt}*
```

### Skill classes

| `type` | Handoff | Typical tier |
|--------|---------|--------------|
| `capability` | optional | A–C |
| `composite` | expected at B+ | B–C |
| `playbook` | aggregates children | A–B |

### Playbook rules

- `marketing/playbooks/{name}/SKILL.md` + `REQUIREMENTS.md`
- Phase table links to `../../skills/{child}/SKILL.md`
- Human checkpoints with checkable criteria ("user approved cornerstone list")
- Pruning/classification logic stays in child skills

### Handoff JSON (Tier B doc / Tier C enforce)

| Field | Purpose |
|-------|---------|
| `handoff_version` | `"1.0"`, `"1.1"`, … |
| `skill` | folder slug |
| `skill_version` | frontmatter version |
| `generated_at` | ISO 8601 |
| `mode` | branch id |
| `inputs` | echo user inputs only |
| `limitations[]` | caps, partial data, confidence |

Full schema in skill's `REFERENCE.md`. Golden fixture at Tier C.

### Scorecard layers

| Layer | IDs | Purpose |
|-------|-----|---------|
| **G** | G1–Gn | Schema shape, required fields, enums |
| **R** | R1–Rn | Rubric anti-inflation, caps (information-gain pattern) |
| **S** | S1–Sn | Deterministic script output (fan-out pattern) |

Document every automated ID in `examples/SCORECARD-*.md` with version history when rules change.

### Verifier conventions

- Node 18+, stdlib only
- `PASS` / `FAIL` per check ID
- Exit code 1 on any failure
- Default fixture path documented in script header

### REQUIREMENTS.md sections

1. Short version table (what you have → usefulness)
2. Always required
3. Option A / B data paths
4. Regression commands (Tier C only)
5. Downstream consumers

---

## Internal monorepo → public migration

- [ ] Strip internal paths, client overrides, and orchestrator-only references
- [ ] Add input policy + branches
- [ ] **Re-tier** — many internal tools start Tier B, earn Tier C
- [ ] Playbook → `marketing/playbooks/`
- [ ] Grep trigger collision
- [ ] Update `marketing/README.md`

---

## Pre-ship rubric (all tiers)

**All tiers**

- [ ] Description: **starts with** `Use when` / `Use for` / `Use before`; ≥2 user phrases on trigger line; grep sibling collision
- [ ] Steps have checkable completion criteria
- [ ] Input policy on public marketing skills
- [ ] Tier choice documented (A/B/C) with rationale
- [ ] No secrets in examples
- [ ] Pruning pass done
- [ ] **Package layout:** `node scripts/verify-skill-package.mjs --path … --tier …` passes

**Tier B+**

- [ ] REFERENCE is SSOT for API/rubric
- [ ] EXAMPLES fictional only

**Tier C only**

- [ ] Named failure mode justified escalation from B
- [ ] Child verifier passes on golden fixture (`--run-verifiers`)
- [ ] SCORECARD matches verifier IDs
- [ ] Ship bar in SKILL.md
- [ ] README regression command

---

## Package verifier (meta)

Validate folder layout matches declared tier:

```bash
# From utilities/write-a-skill/
node scripts/verify-skill-package.mjs --path ../../marketing/skills/site-content-catalog --tier C --public --run-verifiers
node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json
```

**P-layer checks:** `examples/SCORECARD-skill-packages.md`  
**Golden fixture:** `examples/skill-packages.fixture.json` (M1 catalog Tier C, M2 write-a-skill Tier B)
