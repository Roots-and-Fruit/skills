# robots.txt Audit — Regression scorecard

Fictional domain: `example.com`. Run verifiers from `marketing/skills/robots-txt-audit/`.

## S-layer (structure)

| ID | Check | Fixture |
|----|-------|---------|
| S1–S8 | Golden max_discovery file structure | `example-good.robots.txt.fixture.txt` |

## P-layer (max_discovery + SM7)

| ID | Check | Fixture |
|----|-------|---------|
| P1–P8 | Good file is max_discovery compliant | `example-good.robots.txt.fixture.txt` |
| P9–P13 | Bad policy fails compliance | `example-bad-max-discovery.robots.txt.fixture.txt` |
| P14–P16 | Off-host sitemap warns (SM4); does not fail max_discovery | `example-bad-sitemap.robots.txt.fixture.txt` |
| P19–P21 | SM7 pass on 200; warn on 500 without breaking max_discovery | synthetic fetch results |
| P17–P18 | Generate handoff draft passes | `example-generate.handoff.fixture.json` |

## PC-layer (max_discovery contract)

SSOT expectations: `scripts/max-discovery-expectations.mjs`

| ID | Check | Fixture |
|----|-------|---------|
| PC1–PC4 | Per-fixture compliant flag + violation ID sets | good, bad-max-discovery, wp-open |
| PC5–PC8 | Sitemap fetch status (200 pass / 500 warn + SM7) | good, wp-open |
| PC9–PC12 | Matrix training/discovery tokens + `rule_source` | good, wp-open |
| PC13–PC15 | Violation object shape + training-block count | wp-open |
| PC16–PC18 | `audit_only` → `policy_compliance: null`; max_discovery populated | wp-open |
| PC19–PC21 | Required crawler tokens in matrix + training violation IDs | wp-open |
| PC22–PC25 | Handoff fixture matches live `assessMaxDiscovery()` output | `example-max-discovery-recommend.handoff.fixture.json` |

## G-layer (handoff)

| ID | Check | Fixtures |
|----|-------|----------|
| G16 | `policy_compliance` when `max_discovery` | audit, generate, max-discovery-recommend |
| G17 | `sitemap_validation` + `endpoint_fetch` when file found | all found |
| G18 | `crawler_matrix` when `audit`/`recommend` and found | audit, audit-only, recommend, max-discovery-recommend |
| G19 | `fully_crawlable: null` when no key_pages | `example-audit-only.handoff.fixture.json` |
| G20 | `R7e` in `audit_checks` when sitemap declared + fetch run | audit, audit-only, max-discovery-recommend |
| G21 | `policy_compliance.policy === max_discovery` when inputs say so | max-discovery-recommend, generate |
| G22 | Non-compliant max_discovery has ≥1 violation | max-discovery-recommend |
| G23 | Non-compliant max_discovery → `mode: recommend` | max-discovery-recommend |
| G24 | Non-compliant max_discovery → R4 `fail` | max-discovery-recommend |
| G25 | `audit_only` → `policy_compliance: null` | audit-only |
| G26 | `crawler_matrix` is a JSON array, not `null` or a string placeholder | all found audit/recommend |
| G27 | `urls_checked` includes apex + `www` robots.txt for `inputs.domain` | all handoffs |

## Run

```bash
cd marketing/skills/robots-txt-audit
node scripts/verify-robots-structure.mjs
node scripts/verify-max-discovery.mjs
node scripts/verify-max-discovery-contract.mjs
node scripts/verify-handoff.mjs
node scripts/verify-v1_3-changes.mjs
```

Maintain fixtures: `node scripts/refresh-handoff-fixtures.mjs`
