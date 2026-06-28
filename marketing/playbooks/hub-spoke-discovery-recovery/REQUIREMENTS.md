# Requirements

This playbook is a **workflow for an AI agent**. It orchestrates marketing skills under `marketing/skills/` and triangulates first-party analytics with DataForSEO organic discovery.

**Status:** v0.3.0 — public playbook; MCP CSV bypass optional future work.

---

## The short version

| Scope | Phases | Minimum data |
|-------|--------|--------------|
| **Discovery-only** | 1–2 | Domain + DataForSEO MCP (Phase 1b). GSC and/or GA4 strongly recommended for Phase 1a. |
| **Full audit** | 1–6 | All discovery inputs + fan-out, information gain, SERP/backlink APIs |

---

## Always required

- **Domain** from the user — never inferred
- **Scope** — `discovery-only` or `full audit` (default: ask if unclear)

---

## First-party data (Phase 1a)

At least one source recommended. Both enable full triangulation.

| Source | Minimum fields | Format |
|--------|----------------|--------|
| **GSC** | page, query, impressions, clicks, position | CSV export (6–12 months) or GSC MCP |
| **GA4** | landing page, sessions | CSV export or GA4 MCP |

When GA4 is used with `discovery_plus_conversions`:

- **Conversion events** — 1–3 GA4 key event names (required)

See [`analytics-and-searchconsole-performance-audit`](../../skills/analytics-and-searchconsole-performance-audit/REQUIREMENTS.md) for column aliases and partial modes.

**Optional user context:**

- `intended_hubs[]` — commercial hub + service/product LPs
- `protected_pages[]` — exclude from prune recommendations
- Date range for exports

---

## Degraded modes

| Condition | Behavior |
|-----------|----------|
| GSC only | Phase 1a partial (`gsc_only`); value quadrants unavailable |
| GA4 only | Phase 1a partial (`ga4_only`); visibility quadrants unavailable |
| No GSC/GA4 | Skip Phase 1a; Phase 1b DataForSEO-only (legacy discovery path) |
| No DataForSEO MCP | Cannot run Phase 1b-ii hub scoring — ask user to enable MCP or provide ranked-keyword export |

Document every degraded path in report `limitations[]`.

---

## Skills this playbook calls

| Phase | Skill | Path |
|-------|-------|------|
| 1a | Analytics and Search Console Performance Audit | `../../skills/analytics-and-searchconsole-performance-audit/SKILL.md` |
| 1b-i | Site Content Catalog | `../../skills/site-content-catalog/SKILL.md` |
| 1b-ii | Organic hub scoring | DataForSEO `keywords_for_site` (see playbook `REFERENCE.md`) |
| 1c | Triangulation merge | Playbook `REFERENCE.md` |
| 3b | Fan-Out Coverage Analysis | `../../skills/fan-out-coverage-analysis/SKILL.md` |
| 3c | Information Gain Evaluator | `../../skills/information-gain-evaluator/SKILL.md` |
| 4a | SEO Cannibalization Audit | `../../skills/seo-cannibalization-audit/SKILL.md` |
| 5h | robots.txt Audit | `../../skills/robots-txt-audit/SKILL.md` |

---

## DataForSEO MCP

Phase 1b and full audit use Labs, SERP, backlink, and optional AI-optimization endpoints. Configure MCP per [`marketing/README.md`](../../README.md#dataforseo-mcp-common-setup).

---

## Human checkpoints

- **Phase 2:** User must approve audit targets before Phase 3+. Performance matrix is advisory.
- **Phase 4 retire/301:** Never recommend retiring a protected page or top-traffic URL without explicit approval.
- **Prune candidates:** Matrix quadrant alone is never sufficient for delete — require redirect target and human sign-off.

---

## Relationship to Cornerstone Content Audit

| Playbook | Direction | When |
|----------|-----------|------|
| Cornerstone Content Audit | Top-down | Known cornerstones, health check |
| Hub & Spoke Discovery & Recovery | Bottom-up + triangulation | Messy architecture, accidental hubs |

Cornerstone remains the **quality standard** for hub and spoke pages — not a separate architecture.
