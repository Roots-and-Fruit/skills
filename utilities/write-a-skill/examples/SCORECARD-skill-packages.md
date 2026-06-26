# Regression scorecard — write-a-skill (meta)

**Purpose:** Verify declared package tiers match folder layout; dogfood Tier C child skills.  
**Fixture:** `skill-packages.fixture.json`  
**Verifier:**

```bash
node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json
```

**Ship gate:** all M1 + M2 package checks pass (M1 includes child verifiers).

---

## Package checks (P-layer)

Applied per package by `verify-skill-package.mjs`:

| ID | Criterion | Tier |
|----|-----------|------|
| P1 | `SKILL.md` exists | all |
| P2 | Frontmatter `description` | all |
| P13 | Description **starts with** `Use when` / `Use for` / `Use before` | model-invoked |
| P14 | ≥2 user phrases on trigger line | model-invoked |
| P3 | `## Done definition` section | all |
| P4 | `REQUIREMENTS.md` when `--public` or marketing B/C | public / marketing B+ |
| P5 | `## Input policy` for `marketing/` domain | B/C marketing |
| P6 | `REFERENCE.md` | B/C |
| P7 | `EXAMPLES.md` | B/C |
| P8 | `examples/SCORECARD-*.md` | C |
| P9 | `examples/*fixture*.json` | C |
| P10 | `scripts/verify-*.mjs` (not package verifier) | C |
| P11 | Ship bar documented in `SKILL.md` | C |
| P12 | Child verifiers exit 0 | C when `run_verifiers: true` |

---

## Meta fixtures (M-layer)

| ID | Package | Tier | Pass when |
|----|---------|------|-----------|
| M1 | `marketing/site-content-catalog` | C | P1–P14 + P12 (handoff + scorecard scripts) |
| M2 | `utilities/write-a-skill` | B | P1–P3, P6–P7, P13–P14 (no Tier C artifacts on meta skill) |

---

## Version history

| Version | Notes |
|---------|-------|
| 0.2.0 | Package verifier + M1/M2 fixture |
| 0.3.0 | Ship bar on write-a-skill; SCORECARD added |
| 0.4.0 | Progressive-disclosure trigger guidance; P13–P14 description checks |
| 0.4.1 | Trigger-first descriptions; strip internal monorepo refs from public copy; P13 requires leading `Use when/for/before` |
