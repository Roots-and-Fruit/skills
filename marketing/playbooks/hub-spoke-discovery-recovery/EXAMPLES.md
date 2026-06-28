# Hub & Spoke Discovery & Recovery — Examples

**Illustrative shapes only.** Use fictional domains in public examples; do not paste client exports into this repo.

## Scope: discovery-only (Phases 1–2)

**Prompt:**

> Run a **hub and spoke discovery** on **example-photo.io**. Scope: discovery-only. Attached GSC page×query and GA4 landing-page exports. Conversion events: **trial_signup**, **purchase**. Intended hubs: **/pro**, **/blog/what-is-photo-proofing**. Stop after Phase 2 checkpoint.

**Phase 1a fixture:** [`../../skills/analytics-and-searchconsole-performance-audit/examples/photography-saas.handoff.fixture.json`](../../skills/analytics-and-searchconsole-performance-audit/examples/photography-saas.handoff.fixture.json) — photography SaaS pattern (competitor blog accidental hub vs intended proofing hub).

**Expected Phase 2 preview excerpt:**

```markdown
## Performance Matrix (Phase 1a)
| Quadrant | Count | Example URL |
| accidental_hub | 1 | /blog/competitor-a-review |
| unicorn | 1 | /pro |
| hidden_gem | 2 | /blog/what-is-photo-proofing, /pricing |

## Intended vs De Facto (Phase 1c)
| URL | Matrix | Triangulated role |
| /blog/competitor-a-review | accidental_hub | accidental_hub |
| /pro | unicorn | intentional_hub |
| /blog/what-is-photo-proofing | hidden_gem | hidden_gem |
```

## Scope: full audit

**Prompt:**

> Full **hub and spoke discovery and recovery** on **example.com** with GSC + GA4 exports, DataForSEO MCP enabled. Conversion events: **demo_request**. Intended hub: **/pricing**. Run through enhancement plan and robots.txt.

Use the generic SaaS fixture: [`../../skills/analytics-and-searchconsole-performance-audit/examples/example-saas.handoff.fixture.json`](../../skills/analytics-and-searchconsole-performance-audit/examples/example-saas.handoff.fixture.json).

## When to use the other playbook

| Situation | Playbook |
|-----------|----------|
| Cornerstones already known — health check only | [Cornerstone Content Audit](../cornerstone-content-audit/SKILL.md) |
| Messy site, accidental hubs, new client | **This playbook** |
| GSC/GA4 exports, triage only | **This playbook** Phases 1a–2 |
| Single keyword / fan-out gap | [Fan-Out Coverage Analysis](../../skills/fan-out-coverage-analysis/SKILL.md) |

## Vocabulary (reuse everywhere)

**Hub & Spoke** is the content architecture — one hub owns a topic cluster; spokes answer sub-intents and link up. **Cornerstone** is the quality standard for those pages (depth, intent, linking, fan-out, citability) — not a separate architecture. **Discovery & Recovery** is the bottom-up path when reality does not match intent.
