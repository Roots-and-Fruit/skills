# Fan-Out Coverage — Examples

**Illustrative shapes only.** Do not treat sample domains or keywords here as workspace defaults.

## Mode A — Domain coverage (report excerpt)

```markdown
## Fan-Out Coverage Report — "enterprise SSO" on example.com

**Mode:** domain_coverage
**Overall coverage:** 12/28 (43%)
**SERP intent:** single — primary_topic
**SERP context:** AI Overview present (live SERP); 6 PAA questions

### Coverage map
| Sub-query | Vol | Tier | Dimension | Intent | Status | URL | Rank |
| sso providers | 1200 | core | core_variant | commercial | hub | /sso/ | 4 |
| sso vs oauth | 320 | serp_native | question | informational | gap | — | — |
```

Sample: `examples/domain-coverage.handoff.sample.json` (handoff v1.1)

## Mode B — Keyword-only (report excerpt)

```markdown
## Keyword Fan-Out Report — "enterprise SSO"

**Mode:** keyword_only
**Sub-queries mapped:** 26
**SERP intent:** single — primary_topic
**SERP context:** AI Overview (live SERP); 6 PAA

### Fan-out map (by tier)
**SERP-native**
| sso vs oauth | 320 | serp_native | question | high | serp_paa |

**Core**
| sso providers | 1200 | core | core_variant | high | suggestions |
```

Sample: `examples/keyword-only.handoff.sample.json` (handoff v1.1)

## Case study — mixed SERP (regression-gated)

**Keyword:** `wordpress plugin marketing`  
**Scorecard:** `examples/SCORECARD-wordpress-plugin-marketing.md`

| Version | Issue | Status |
|---------|-------|--------|
| 2.1.0 | Volume-led priorities; mailpoet medium | Historical — `wordpress-plugin-marketing-keyword-only-2026-06-24.md` |
| 2.2.0 | Email `serp_related` in `serp_native` tier | Fixed in 2.3.0 |
| 2.3.0 | Lane-aware facet drift on seed SERP | **Verify:** `node scripts/verify-scorecard.mjs` |

### v2.3 expected (lane `primary_topic`)

- **SERP-native:** promote (PAA), strategy / free / best (related), GTM questions — **not** email/newsletter related searches
- **Facet drift:** `wordpress email marketing plugin free`, newsletter variants — on SERP related but tier `facet_drift`
- **Adjacent:** mailpoet, platform-meta PAA — excluded or low tier

Historical handoff (v2.2 illustration): `wordpress-plugin-marketing-v2.2.handoff.sample.json`

## What a good v2.3 run produces

| Mode | Human report | Handoff |
|------|--------------|---------|
| **domain_coverage** | SERP intent note, tier column, lane-aware gaps | `handoff_version: "1.1"`, extended `serp_context` |
| **keyword_only** | Fan-out grouped by tier | `priority_sub_queries[]` tier-ordered |

## Normalize script

```bash
node scripts/normalize-fanout.mjs \
  --seed "wordpress plugin marketing" \
  --lane primary_topic \
  --file merged-keywords.json
```

Merged input should include SERP items with `source: "serp_paa"` and `source: "serp_related"`.

Fixture + regression: `examples/merged-keywords.fixture.json` · `node scripts/verify-scorecard.mjs`

## Downstream handoff

| Goal | Mode | Pass to |
|------|------|---------|
| Draft copy for gaps | domain | Writer + `gaps[]` (lane-filtered) + `serp_context` |
| Content plan, no site | keyword_only | Brief workflow + `priority_sub_queries[]` |
| Product page audit | domain | LP audit + `hub_spoke_map` |

The skill packages facts only — it does not choose the downstream path.
