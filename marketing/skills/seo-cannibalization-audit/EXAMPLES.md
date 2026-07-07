# SEO Cannibalization Audit — Examples

**Illustrative only.** `example.com` fixtures are not default run targets.

---

## Step 0 — stop on non-200 URL

If any subject or intended-hub URL returns 404 (or any non-200), **stop immediately**. Do not call DataForSEO or emit handoff JSON.

```markdown
## Cannibalization audit — stopped (URLs not live)

I can't run a cannibalization audit until every subject URL returns HTTP 200.

| URL | Status |
|-----|--------|
| https://example.com/how-we-help/draft-page | 404 |

Replace with live URLs, remove the draft URL, or re-run after publish.
```

Re-run only after the user supplies live URLs.

---

## Playbook mode — blog outranking pricing (fixture)

**Scenario:** Hub & Spoke Discovery Phase 4a — blog guide ranks #8 for a commercial term; intended `/pricing` ranks #34.

**Handoff:** `examples/blog-vs-pricing.handoff.fixture.json`

| Signal | Value |
|--------|-------|
| `mode` | `playbook_hub_recovery` |
| `playbook_tension` | `blog_vs_landing` |
| `relationship` | `hub_spoke_ok` (types) — tension overrides naive "healthy" label |
| `resolution` | `needs_human_approval` |
| `recovery_phase` | `5f` |

**Report lead section:**

```markdown
## Playbook tensions — example.com

### Blog vs landing — "example saas pricing"
- **Accidental:** https://example.com/blog/saas-pricing-guide (#8, how-to)
- **Intended hub:** https://example.com/pricing (#34, product)
- **Resolution:** Needs human approval before any 301
- **Phase 5:** 5f transition — strengthen pricing hub, demote blog to spoke or migrate
```

---

## Targeted mode — healthy hub + spoke

**Handoff:** `examples/hub-spoke-ok.handoff.fixture.json`

- Feature hub + how-to spoke on related keyword
- No conflicts; one `healthy_relationships[]` row; `summary.healthy: 1`

---

## Zero SERP overlap — still healthy (NerdPress-style)

When Step 1 finds **no shared keywords** but intents are hub + spoke, still emit `healthy_relationships[]` (Step 4b).

**Handoff:** `examples/zero-overlap-hub-spoke-ok.handoff.fixture.json`

```bash
node scripts/build-healthy-relationship.mjs \
  --json examples/zero-overlap-hub-spoke-ok.pair.fixture.json \
  --keyword "wordpress core web vitals"
```

| Signal | Value |
|--------|-------|
| `conflicts_total` | 0 |
| `summary.healthy` | 1 |
| `healthy_relationships[0].relationship` | `hub_spoke_ok` |

Use the blog's top thematic keyword as the row label when the hub has zero rankings.

---

## Script checks

```bash
node scripts/classify-relationship.mjs --intent-a how_to --intent-b product
node scripts/classify-relationship.mjs --json examples/blog-vs-pricing.pair.fixture.json
node scripts/resolve-conflict.mjs --json examples/blog-vs-pricing.pair.fixture.json
```

---

## Regression

```bash
node scripts/verify-handoff.mjs
node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json --gold blog-vs-pricing
node scripts/verify-handoff.mjs examples/hub-spoke-ok.handoff.fixture.json --gold hub-spoke-ok
```

See `examples/SCORECARD-blog-vs-pricing.md`.

---

## Downstream

| Consumer | Pass |
|----------|------|
| [Hub & Spoke Discovery & Recovery](../../playbooks/hub-spoke-discovery-recovery/) Phase 4a | `mode: playbook_hub_recovery`, triangulation + intended hubs |
| [Cornerstone Content Audit](../../playbooks/cornerstone-content-audit/) Phase 4a | `mode: targeted`, cornerstone URLs as `subject_pages` |

---

## Tier note

**Tier C** — justified because:

1. Hub & Spoke playbook Phase 4–5 consumes `conflicts[]`, `recovery_phase`, `redirect_target`
2. Agents drift on hub-vs-hub vs hub-spoke and recommend 301 on protected/top-traffic URLs without guardrails
