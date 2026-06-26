# Glossary — write-a-skill

Vocabulary for authoring skills in this repo. **Predictability** is the root virtue: the agent follows the same *process* every run, not the same *output*.

**Bold terms** below are defined here.

---

## Predictability

Same *process* every run — same steps, same gates, same field names — even when tokens differ. The goal of every lever in this glossary.

## Right-sizing

Choosing the **smallest package tier** that still meets the skill's job. **Over-engineering** is its failure mode.

## Over-engineering

_Failure mode._ Adding handoff JSON, verifiers, or extra files when a lean skill with sharp **completion criteria** would suffice. Costs maintenance, context load, and false confidence ("verified" schema, wrong judgment).

## Package tier

How much structure the skill ships with. See `REFERENCE.md` — **Tier A (lean)**, **Tier B (disclosed)**, **Tier C (regression-gated)**.

## Skill class

| Class | Role |
|-------|------|
| **capability** | One atomic job |
| **composite** | Multi-step; often emits **handoff** |
| **playbook** | Orchestrates other skills via links |
| **utility** | Meta (e.g. this skill) |

Class suggests default tier; **right-sizing** can downgrade (e.g. composite prose-only → Tier B not C).

## Leading word

A compact pretrained concept repeated in the skill body and **description** to anchor behaviour (`predictability`, `fan-out`, `handoff`, `legwork`). One strong **leading word** in the capability sentence; alternate **user phrases** in the trigger line are encouraged (they are not duplication).

## Description

The `description` is the **only** preloaded routing signal. **First words must be** `Use when …`, `Use for …`, or `Use before …` (the core job trigger). Follow with **≥2 distinct user phrases**; optional one-sentence capability after. Max 1024 chars; third person. Skills with `disable-model-invocation: true` use description as a human summary only.

## Branch

A distinct path through the skill (e.g. with domain vs keyword-only). Inline what every branch needs; **progressive disclosure** for branch-only detail.

## Steps

Ordered actions in `SKILL.md`. Each step ends with a **completion criterion**.

## Completion criterion

Checkable condition for "done" on a step or the whole skill. Sharpen this *before* adding files or splitting skills (**premature completion** defence).

Examples:
- Weak: "produce a catalog"
- Strong: "every discovered URL has `page_type` from the enum; `limitations[]` lists any enrichment batch cap"

## Legwork

Reading, MCP calls, exploration within a step — not written as its own step. Raised by exhaustive completion criteria and **input policy** (never guess missing inputs).

## Premature completion

_Failure mode._ Agent declares done before the criterion is met. **Cures (in order):** sharpen criterion → hide **post-completion steps** via split → add verifier only when criterion is objectively checkable.

## Progressive disclosure

Push **reference** below `SKILL.md` behind **context pointers** (`REFERENCE.md`, `EXAMPLES.md`). Protects the **information hierarchy**; not primarily a file-count exercise.

## Context pointer

Wording that tells the agent when to load out-of-band material. Weak pointer on must-have rules → variance bug; fix wording before inlining.

## Input policy

R&F rule block: required inputs come from the user only — never workspace, examples, or prior runs.

## Handoff

Machine-readable JSON (`handoff_version`, `mode`, `inputs`, …) for downstream skills/playbooks. Tier C when a consumer depends on field names.

## Ship bar

Automated gate: `node scripts/verify-*.mjs` passes on golden fixture. Only for Tier C — not a default virtue.

## Scorecard

Human-readable binary checks (`SCORECARD-*.md`) mirroring the verifier (G/R/S layers). Documents what regression protects.

## Duplication

_Failure mode._ Same meaning in two places. Violates **single source of truth**; inflates prominence. Distinct from intentional **leading word** repetition.

## Sediment

_Failure mode._ Stale lines never removed. Prune on every edit: **relevance** test + **no-op** test.

## No-op

_Failure mode._ Instruction the model already follows by default. Test: does this line change behaviour vs default?

## Sprawl

_Failure mode._ `SKILL.md` too long even if every line is live. Cure: disclosure + split by branch, not automatic Tier C.

## Single source of truth

Each meaning lives in one authoritative place — usually rubric/schema in `REFERENCE.md`, steps in `SKILL.md`.
