# write-a-skill — Examples

Illustrative only. Live references: `marketing/skills/site-content-catalog/`, `marketing/skills/fan-out-coverage-analysis/`, `marketing/skills/information-gain-evaluator/`.

---

## Example 1 — Tier A (lean): campaign brief

**Job:** one-page campaign brief for humans. **Consumer:** none. **Fragile logic:** none.

```text
marketing/skills/campaign-brief-generator/
├── SKILL.md
└── REQUIREMENTS.md
```

**SKILL.md completion criterion (excerpt):**

```markdown
## Done definition
- [ ] Brief includes goal, ICP, offer, channels, timeline, and one measurable KPI
- [ ] No fabricated budget numbers — assumptions labeled
```

**Why not Tier B?** No MCP matrix or rubric too large for one file yet.  
**Why not Tier C?** No handoff consumer; verifier would only check headings exist (false rigor).

---

## Example 2 — Tier C (regression-gated): site content catalog

**Job:** page inventory + handoff for cornerstone playbook. **Tier:** C (package verifier golden case M1).

```text
marketing/skills/site-content-catalog/
├── SKILL.md
├── REQUIREMENTS.md
├── REFERENCE.md
├── EXAMPLES.md
├── examples/SCORECARD-example-saas.md
├── examples/example-saas.handoff.fixture.json
├── scripts/classify-page-type.mjs
├── scripts/verify-handoff.mjs
└── scripts/verify-scorecard.mjs
```

**Failure modes prevented:** invalid handoff for Phase 1; page-type label drift (T-layer).

```bash
node utilities/write-a-skill/scripts/verify-skill-package.mjs \
  --path marketing/skills/site-content-catalog --tier C --public --run-verifiers
```

---

## Example 3 — Tier C (regression-gated): information gain

**Job:** SERP-comparative citation scoring. **Consumer:** briefs, playbooks. **Fragile logic:** score inflation (proven → R1–R18).

```text
marketing/skills/information-gain-evaluator/
├── SKILL.md          # Ship bar: node scripts/verify-handoff.mjs
├── REFERENCE.md      # handoff v1.1, dimension rubric
├── examples/enterprise-sso.handoff.fixture.json
├── examples/SCORECARD-enterprise-sso.md
└── scripts/verify-handoff.mjs
```

**Failure mode prevented:** `overall: high` on mismatched commercial pages.

---

## Example 4 — Tier C + normalize script: fan-out

**Job:** fan-out tiering. **Fragile logic:** facet drift on mixed SERP (proven → S1–S8).

```text
marketing/skills/fan-out-coverage-analysis/
├── scripts/normalize-fanout.mjs
├── scripts/verify-scorecard.mjs
├── examples/merged-keywords.fixture.json
└── examples/SCORECARD-wordpress-plugin-marketing.md
```

**Why script?** Tier labels are deterministic; agent re-derivation failed before v2.3.

---

## Example 5 — Tier A/B playbook

**Job:** orchestrate children. **Tier:** A or B — not C unless report shape needs verifier.

```markdown
| Phase 1 | Site Content Catalog | `../../skills/site-content-catalog/SKILL.md` |
| Phase 3b | Fan-Out Coverage Analysis | `../../skills/fan-out-coverage-analysis/SKILL.md` |
```

**Human checkpoint completion criterion:**

```markdown
Do not start Phase 3 until the user explicitly approves the nominated cornerstone list.
```

---

## Example 6 — Package verifier (meta)

After authoring or upgrading any skill:

```bash
cd utilities/write-a-skill
node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json
```

- **M1** — `site-content-catalog` Tier C (+ child verifiers)
- **M2** — `write-a-skill` Tier B layout

---

---

## Description trigger — thin vs wide

Hosts match **only** frontmatter `description` before loading the skill body. No match → generic answer, no error.

```yaml
# ❌ Thin — capability first; trigger buried; user says "page inventory" and skill never fires
description: >
  Crawl sitemaps and build inventories. Use for cataloging sites.

# ❌ Wrong order — same failure mode
description: >
  Author agent skills with predictable process. Use when creating a skill.

# ✅ Trigger first — alternate vocabulary on the opening line
description: >
  Use when cataloging a site, building a page inventory, crawling a sitemap, or
  listing all pages. Structured URL inventory with SEO signals and page-type labels.
```

**User quick fix:** `use the site content catalog skill to build a page inventory for example.com`

---

## Failure mode → fix (worked examples)

| Situation | Wrong fix | Right fix |
|-----------|-----------|-----------|
| Agent skips enrichment on large sites | Add 50-line REFERENCE | Sharpen done definition: "state batch cap in `limitations[]`" |
| Playbook can't read catalog output | Tier A markdown only | Tier B handoff schema → Tier C fixture |
| Agent promotes wrong keywords to `serp_native` | More prose in SKILL.md | `normalize-fanout.mjs` + S-layer scorecard |
| 400-line SKILL.md | Add EXAMPLES | Progressive disclosure to REFERENCE |
| "Helps with SEO" description | Add verify script | Widen `description` with ≥2 user phrases; keep body lean (progressive disclosure) |
| Empty REQUIREMENTS + full MCP workflow | Tier A | Tier B minimum for public marketing |
| Skill folder missing SCORECARD at Tier C | Ship anyway | `verify-skill-package.mjs --tier C` |

---

## Intake prompt (copy to user)

1. One-sentence job?
2. Branches/modes?
3. Human-only output, or downstream consumer?
4. What went wrong in past runs (if anything)?
5. MCP/data required?
6. Proposed tier (A/B/C) — which failure mode does C prevent?
7. Path: `marketing/`, `playbooks/`, `utilities/`, project-local?

---

## Description — good vs weak

**Good (one branch each):**

```text
Crawl a sitemap or domain and build a structured page inventory with SEO signals.
Use for catalog this site, inventory pages, crawl sitemap, or list all pages.
```

**Weak:**

```text
Helps with SEO audits and content strategy and site reviews.
```

**Weak (duplication — two names for one branch):**

```text
Use for cornerstone audit, pillar content review, content architecture audit, and identifying your most important pages.
```

Collapse to one leading phrase unless branches genuinely differ.
