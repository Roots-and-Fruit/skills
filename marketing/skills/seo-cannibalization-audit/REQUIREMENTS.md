# Requirements

Workflow for an AI agent. Does not fetch data on its own.

**Version:** 2.0.2 — Tier C with handoff JSON v1.0 for playbook consumers.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **Live subject URLs (HTTP 200)** + DataForSEO MCP | Full workflow + handoff JSON |
| **Any subject or intended-hub URL non-200** | **Stop** — ask user to fix URLs first; no audit |
| **Playbook context** (intended hubs, triangulation roles) | `playbook_hub_recovery` mode — prioritized tensions |
| **Subject URLs + pinned overlap CSV** | Partial — same logic on supplied rankings |
| **None of the above** | Not meaningful |

---

## Always required

- **Domain** and **subject URL(s)** from the user
- **Every subject URL returns HTTP 200** — validated in Step 0 before any other work
- **DataForSEO MCP** (recommended) for overlap detection and backlink checks before 301s
- **WebFetch** for Step 0 URL validation and title/H1 comparison in later steps

**Optional:**

- `mode` — `targeted` (default), `playbook_hub_recovery`, `full_site`
- `primary_keywords` map per URL
- `intended_hubs[]` — commercial/product hubs the business wants to own
- `protected_pages[]` — never auto-recommend retire/301
- `triangulation_context[]` — `{ url, triangulated_role, cluster }` from Hub & Spoke playbook Phase 1c
- Site architecture notes

---

## DataForSEO calls

| Step | Tool |
|------|------|
| Per-subject keywords | `dataforseo_labs_google_ranked_keywords` |
| Same-domain overlap | `dataforseo_labs_google_relevant_pages` |
| Pre-redirect check | `backlinks_summary` |
| Optional intent check | `serp_organic_live_advanced` |

See [`marketing/README.md`](../README.md#dataforseo-mcp-common-setup) for MCP setup.

---

## Regression (Tier C)

```bash
cd marketing/skills/seo-cannibalization-audit
node scripts/verify-handoff.mjs
node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json --gold blog-vs-pricing
node scripts/verify-handoff.mjs examples/hub-spoke-ok.handoff.fixture.json --gold hub-spoke-ok
node scripts/verify-handoff.mjs examples/zero-overlap-hub-spoke-ok.handoff.fixture.json --gold zero-overlap-hub-spoke-ok
```

Scorecard: `examples/SCORECARD-blog-vs-pricing.md`

---

## Downstream consumers

| Playbook | Phase | Mode |
|----------|-------|------|
| [Hub & Spoke Discovery & Recovery](../playbooks/hub-spoke-discovery-recovery/) | 4a | `playbook_hub_recovery` |
| [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) | 4a | `targeted` |

Pass `conflicts[]`, `architecture_conflicts[]`, and `summary` into Phase 5 recovery mapping and final report § Cannibalization.
