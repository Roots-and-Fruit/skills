# Calibration scorecard — commercial page vs DIY SERP

**Purpose:** Regression archetype for rigorous information-gain scoring when page format does not match informational SERP intent.  
**Fixture:** `commercial-service-vs-diy.handoff.fixture.json` (fictional domains only)  
**Gold profile:** `commercial-vs-diy`

## Verifier commands

```bash
# Golden aligned case (informational page, partial citation fit)
node scripts/verify-handoff.mjs examples/enterprise-sso.handoff.fixture.json

# Calibration case (commercial vs DIY — must score low citation fit)
node scripts/verify-handoff.mjs examples/commercial-service-vs-diy.handoff.fixture.json --gold commercial-vs-diy
```

---

## Archetype under test

| Signal | Expected |
|--------|----------|
| Page type | Commercial managed-service / sales cornerstone |
| SERP intent | DIY how-to optimization guides |
| `page_keyword_fit` | `mismatched` |
| `citation_fit_for_keyword` | `poor` |
| `overall` | `low` (not medium) |
| `novel_angle` | ≤ `medium` (positioning ≠ citation novelty) |
| `baseline_completeness` | `weak` |

**Anti-pattern:** Scoring `novel_angle: high` and `overall: medium` because the page "sounds different" from competitors — that inflates buyer differentiation into information gain.

---

## Gold profile — `commercial-vs-diy`

| Field / dimension | Expected |
|-------------------|----------|
| `page_keyword_fit` | `mismatched` |
| `citation_fit_for_keyword` | `poor` |
| `overall` | `low` |
| `baseline_completeness` | `weak` |
| `original_data` | `low` |
| `novel_angle` | ≤ `medium` |

---

## Live MCP test (your domain)

Use **your** target URL and keyword — never copy fixture domains into a live run.

```text
Use information-gain-evaluator skill v1.1.

Target: {your URL}
Keyword: {your keyword}
Location: United States, English

Emit handoff_version 1.1 with citation_fit_for_keyword, page_keyword_fit,
baseline_coverage_pct, and citation_fit_rationale.

Save handoff JSON and validate:
node scripts/verify-handoff.mjs path/to/your.handoff.json
```

If your page matches the commercial-vs-DIY archetype, compare against this gold profile manually.

---

## Ship gate

1. `enterprise-sso.handoff.fixture.json` — passes G1–G14 + R1–R18  
2. `commercial-service-vs-diy.handoff.fixture.json` — passes G + R + `--gold commercial-vs-diy`  
3. At least one live run on a real URL passes G + R (gold optional unless archetype matches)
