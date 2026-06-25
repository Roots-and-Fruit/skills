# Information Gain Evaluator — Examples

**Illustrative shapes only.** All sample domains are fictional (`example.com`, `example-vendor.com`, `competitor-a.example`). **Do not** treat them as workspace defaults or run evaluations against them unless explicitly testing fixtures.

## Mode — live URL (report excerpt, v1.1)

```markdown
## Information Gain Report — https://example.com/guides/enterprise-sso
**Keyword:** enterprise SSO
**Mode:** live_url
**Evaluated against:** 3 competitors (high)
**Intent lane:** primary_topic

### Overall: medium Information Gain
**Citation fit for keyword:** partial
**Page–keyword fit:** aligned
**Baseline completeness:** adequate (60%)

### Dimension Scores
| Dimension | Score | Finding |
|-----------|-------|---------|
| Original Data | medium | Uncommon compliance detail but no first-party metrics |
| Unique Framework | medium | Clear phases but unnamed model |
| First-Hand Experience | high | Named customer outcome with measured result |
| Novel Angle | medium | Stronger compliance framing than most competitors |
| Citable Specificity | high | Multiple self-contained definitional passages |

### Table stakes (what SERP expects)
- SSO definition and core protocols
- IdP integration overview
- Security benefits and rollout steps

### Recommendations
1. Add first-party benchmark table (original_data) …

### Limitations
- Mixed SERP; competitor set limited to primary_topic lane
```

Sample handoff: `examples/enterprise-sso.handoff.fixture.json`

## Calibration archetype — commercial vs DIY SERP

When a **sales or service page** is evaluated on an **informational how-to** keyword, expect:

- `page_keyword_fit: mismatched`
- `citation_fit_for_keyword: poor`
- `overall: low` (rigorous v1.1 rules)
- `novel_angle` capped at `medium`

Fictional fixture: `examples/commercial-service-vs-diy.handoff.fixture.json`  
Scorecard: `examples/SCORECARD-commercial-vs-diy.md`

## Calibration archetype — aligned practitioner guide (live)

When a **how-to guide** competes on a **mixed SERP** where the handbook owns format syntax, expect:

- `page_keyword_fit: aligned`
- `citation_fit_for_keyword: partial` (handbook still primary cite for spec)
- `overall: high` when first-hand experience, novel angle, and citable specificity carry differentiation
- `baseline_coverage_pct` often ~50% — adequate, not weak

Live fixture: `examples/plugin-readme-practitioner.handoff.fixture.json` (example.com, keyword `WordPress plugin readme`)

## Mode — pinned competitors

Use when stabilizing tests — SERP drift does not change the competitive set.

```text
Run information gain evaluation. Target: {user URL}. Keyword: {user keyword}.
Pinned competitors: {url1}, {url2}, {url3}. Save handoff JSON.
```

## Mode — draft content

```markdown
**Mode:** draft_content
**Target:** pasted draft
**Evaluated against:** 3–5 competitors from SERP lane primary_topic
```

## Handoff minimum shape (v1.1)

See `REFERENCE.md` for full schema.

```json
{
  "handoff_version": "1.1",
  "skill": "information-gain-evaluator",
  "citation_fit_for_keyword": "partial",
  "page_keyword_fit": "aligned",
  "baseline_coverage_pct": 60,
  "overall": "medium",
  "baseline_completeness": "adequate",
  "dimensions": [],
  "recommendations": [],
  "limitations": []
}
```

## Regression testing

| Layer | What | Command |
|-------|------|---------|
| **Aligned fixture** | Informational page, partial citation | `node scripts/verify-handoff.mjs examples/enterprise-sso.handoff.fixture.json` |
| **Mismatch fixture** | Commercial vs DIY archetype | `node scripts/verify-handoff.mjs examples/commercial-service-vs-diy.handoff.fixture.json --gold commercial-vs-diy` |
| **Aligned-high fixture** | Practitioner guide vs handbook SERP | `node scripts/verify-handoff.mjs examples/plugin-readme-practitioner.handoff.fixture.json --gold plugin-readme-practitioner` |
| **Your live run** | Agent-produced handoff | `node scripts/verify-handoff.mjs path/to/your.handoff.json` |

**Ship gate:** all three example handoffs pass; agent runs pass G1–G14 + R1–R18.

## Downstream handoff

| Goal | Pass fields |
|------|-------------|
| Content brief | `table_stakes_gaps`, `unique_strengths`, `recommendations`, `citation_fit_for_keyword`, `inputs.primary_keyword` |
| After fan-out | Evaluate spoke URLs; pass `intent_lane` from fan-out handoff |

## Pair with fan-out

1. Fan-out → gaps and `intent_lane`
2. Information gain on anchor or priority spoke
3. Brief writer consumes both handoffs
