# Marketing Playbooks

Multi-phase workflows that orchestrate skills under `marketing/skills/`. Each playbook folder contains a `SKILL.md` plus `REQUIREMENTS.md` (Tier B playbooks may also include `REFERENCE.md` and `EXAMPLES.md`).

Playbooks **call** capability and composite skills (catalog, fan-out, information gain, cannibalization, robots.txt) rather than duplicating their logic.

## Vocabulary

| Term | Meaning |
|------|---------|
| **Hub & Spoke** | Content architecture — one hub per topic cluster; spokes answer sub-intents and link up |
| **Cornerstone** | Quality standard for hub and spoke pages — not a separate architecture |
| **Discovery & Recovery** | Bottom-up path when the site grew organically and first-party + keyword data must triangulate reality |

## Which playbook?

| Situation | Playbook |
|-----------|----------|
| Known cornerstones, health check only | [Cornerstone Content Audit](cornerstone-content-audit/) |
| Messy site, accidental hubs, new client | [Hub & Spoke Discovery & Recovery](hub-spoke-discovery-recovery/) |
| Have GSC/GA4 exports, need triage fast | [Hub & Spoke Discovery & Recovery](hub-spoke-discovery-recovery/) — Phases 1a–2 |
| Single keyword / fan-out gap | [`fan-out-coverage-analysis`](../skills/fan-out-coverage-analysis/) skill only |

**Relationship:** Cornerstone Content Audit is **top-down** (nominate then audit). Hub & Spoke Discovery & Recovery is **bottom-up** (discover de facto hubs, triangulate GSC/GA4, then recover). Both use the same cornerstone **quality bar** in Phases 3–6.

| Playbook | Status |
|----------|--------|
| [Cornerstone Content Audit](cornerstone-content-audit/) | v0.1.0 — top-down audit; in progress |
| [Hub & Spoke Discovery & Recovery](hub-spoke-discovery-recovery/) | v0.3.0 — triangulation playbook (Phase 1a–1c + recovery mapping) · [future work](hub-spoke-discovery-recovery/FUTURE-WORK.md) |

**Legacy path:** [cornerstone-discovery-audit/](cornerstone-discovery-audit/) redirects to Hub & Spoke Discovery & Recovery.
