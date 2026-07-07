# robots.txt Audit — Regression scorecard

Fictional domain: `example.com`. Run verifiers from `marketing/skills/robots-txt-audit/`.

## S-layer (structure)

| ID | Check | Fixture |
|----|-------|---------|
| S1–S8 | Golden max_discovery file structure | `example-good.robots.txt.fixture.txt`, `example-good-block-training.robots.txt.fixture.txt`, `example-good-restrictive.robots.txt.fixture.txt` |

## P-layer (discovery presets + SM7)

| ID | Check | Fixture |
|----|-------|---------|
| P1–P8 | Good file is max_discovery compliant | `example-good.robots.txt.fixture.txt` |
| P4b–P6b | Good block_training file is compliant | `example-good-block-training.robots.txt.fixture.txt` |
| P9–P13 | Bad policy fails compliance | `example-bad-max-discovery.robots.txt.fixture.txt` |
| P14–P16 | Off-host sitemap warns (SM4); does not fail max_discovery | `example-bad-sitemap.robots.txt.fixture.txt` |
| P19–P21 | SM7 pass on 200; warn on 500 without breaking max_discovery | synthetic fetch results |
| P17–P18 | Generate handoff draft passes | `example-generate.handoff.fixture.json` |

## PC-layer (max_discovery contract)

SSOT expectations: `scripts/max-discovery-expectations.mjs`

| ID | Check | Fixture |
|----|-------|---------|
| PC1–PC4 | Per-fixture compliant flag + violation ID sets | good, good-block-training, bad-max-discovery, wp-open |
| PC5–PC8 | Sitemap fetch status (200 pass / 500 warn + SM7) | good, wp-open |
| PC9–PC12 | Matrix training/discovery tokens + `rule_source` | good, wp-open |
| PC13–PC15 | Violation object shape + training-block count | wp-open (`block_training_allow_answers`) |
| PC16–PC18 | `audit_only` → `policy_compliance: null`; max_discovery populated | wp-open |
| PC19–PC21 | Required crawler tokens in matrix; training violations under `block_training_allow_answers` | wp-open |
| PC22–PC25 | Handoff fixture matches live `assessRobotsTxtContent()` output | `example-max-discovery-recommend.handoff.fixture.json` |

**PC25:** `compliant: true` → `mode: audit`; `compliant: false` → `mode: recommend`.

## SY-layer (syntax validation)

| ID | Check | Fixture |
|----|-------|---------|
| SX1–SX12 | GSC-like lint: SM8, SY1 unknown Host, SY2 malformed, CF Content-Signal pass | `example-schemamap-typo`, `example-syntax-unknown-host`, `example-syntax-malformed-line`, CF fixture |

## PR-layer (restrictive)

| ID | Check | Fixture |
|----|-------|---------|
| PR1–PR12 | Restrictive compliant; search allowed; answer + training blocked | `example-good-restrictive.robots.txt.fixture.txt` |

## SY-layer (sitemap directive typos)

| ID | Check | Fixture |
|----|-------|---------|
| SY1–SY8 | SM8 Schemamap typo detection; SM1 message enhancement | `example-schemamap-typo.robots.txt.fixture.txt` |

## G-layer (handoff)

| ID | Check | Fixtures |
|----|-------|----------|
| G16 | `policy_compliance` when compliance preset (`max_discovery`, `block_training_allow_answers`, `restrictive`) | audit, generate, recommend, max-discovery-recommend |
| G17 | `sitemap_validation` + `endpoint_fetch` when file found | all found |
| G18 | `crawler_matrix` when `audit`/`recommend` and found | audit, audit-only, recommend, max-discovery-recommend |
| G19 | `fully_crawlable: null` when no key_pages | `example-audit-only.handoff.fixture.json` |
| G20 | `R7e` in `audit_checks` when sitemap declared + fetch run | audit, audit-only, max-discovery-recommend |
| G21 | `policy_compliance.policy` matches `inputs.crawl_policy` for discovery presets | max-discovery-recommend, generate, recommend |
| G22 | Non-compliant discovery preset has ≥1 violation | recommend, max-discovery-recommend (vacuous when compliant) |
| G23 | Non-compliant discovery preset → `mode: recommend` | recommend |
| G24 | Non-compliant discovery preset → R4 `fail` (origin-only CF exception) | recommend |
| G25 | `audit_only` → `policy_compliance: null` | audit-only |
| G26 | `crawler_matrix` is a JSON array, not `null` or a string placeholder | all found audit/recommend |
| G27 | `urls_checked` includes apex + `www` robots.txt for `inputs.domain` | all handoffs |
| G28 | `layer_assessment` when `deployment.model` is `cloudflare_managed` | CF handoff |
| G29 | `recommendations_split` when CF + `max_discovery` | CF handoff |
| G30 | `companion_module` is `CLOUDFLARE-MANAGED.md` when CF managed | CF handoff |
| G31 | `violations[].layer` when `policy_compliance.layered` | CF handoff |
| G32 | No `layer_assessment` on `origin_only` handoffs | non-CF handoffs |
| G33 | `origin_append_template` + `content_signals.preset` when CF + discovery preset | CF handoff |

## CF-layer

| ID | Check | Fixture |
|----|-------|---------|
| CF1–CF25 | Layer split, CF credit, origin gaps, Content-Signal origin append | `example-cloudflare-managed-origin-append.robots.txt.fixture.txt` |

## RL / LP / RA layers

| Script | IDs |
|--------|-----|
| `verify-reference-links.mjs` | RL1–RL6, RL-gap-* |
| `verify-layperson-summary.mjs` | LP1–LP20b |
| `verify-reaudit.mjs` | RA1–RA12 |

## Run

```bash
cd marketing/skills/robots-txt-audit
node scripts/verify-robots-structure.mjs
node scripts/verify-max-discovery.mjs
node scripts/verify-max-discovery-contract.mjs
node scripts/verify-schemamap.mjs
node scripts/verify-syntax.mjs
node scripts/verify-restrictive.mjs
node scripts/verify-handoff.mjs
node scripts/verify-v1_3-changes.mjs
node scripts/verify-cloudflare-layers.mjs
node scripts/verify-layperson-summary.mjs
node scripts/verify-reaudit.mjs
node scripts/verify-reference-links.mjs
```

Maintain fixtures: `node scripts/refresh-handoff-fixtures.mjs`
