# Hub & Spoke Discovery & Recovery — Future work

**Playbook version:** v0.3.0  
**Public ship status:** Steps 1–3 complete (2026-06-28)  
**Last updated:** 2026-06-28

This file replaces internal `ROADMAP.md` planning docs. It is **public-safe**: no client names, private monorepo paths, or live export data. Client-specific proofs and overrides stay in your private workspace.

**Operational docs:** `SKILL.md` · `REQUIREMENTS.md` · `REFERENCE.md` · `EXAMPLES.md`

---

## Why this playbook exists

[Cornerstone Content Audit](../cornerstone-content-audit/SKILL.md) (top-down) and this playbook (bottom-up) cover most of a hub-and-spoke recovery workflow. The gap this package closes is **first-party triangulation** — GSC visibility plus GA4 business value — merged with DataForSEO discovery, fan-out coverage, information gain, and human checkpoints.

This playbook **evolves discovery**; it does not replace cornerstone as a quality standard or fork a second end-to-end workflow.

---

## Shipped (public repo)

### Step 1 — `analytics-and-searchconsole-performance-audit` (v1.3.1)

Tier **C** composite skill: GSC + GA4 page-level inputs → performance quadrants → handoff JSON v1.0.

- Fixtures: `example-saas`, `photography-saas`, `wp-support-saas` (fictional domains only)
- Verifier: `node scripts/verify-handoff.mjs` + scorecard in skill package

### Step 2 — Playbook triangulation (v0.3.0)

- Phase 1a — performance matrix (analytics skill)
- Phase 1b — catalog + organic hub scoring (DataForSEO)
- Phase 1c — triangulation merge (`REFERENCE.md` join keys)
- Phases 2–6 — human checkpoint, health audit, cannibalization, recovery plan, report

### Step 3 — Public packaging

- README indexes (`marketing/playbooks/README.md`, `marketing/README.md`, root `README.md`)
- Vocabulary locked: **Hub & Spoke** = architecture; **Cornerstone** = quality bar; **Discovery & Recovery** = messy-site path
- `cornerstone-discovery-audit/` redirect stub → this playbook
- Tier B package: `Done definition` + `EXAMPLES.md`

**Minimum shippable slice:** Steps 1–3 + `photography-saas` fixture — **done**.

---

## Vocabulary (do not drift)

| Term | Meaning |
|------|---------|
| **Hub & Spoke** | One hub per topic cluster; spokes answer sub-intents and link up |
| **Cornerstone** | Quality standard for hub and spoke pages (depth, intent, linking, fan-out, citability) |
| **Discovery & Recovery** | Bottom-up path for accidental hubs, hidden gems, legacy bloat |
| **Performance Matrix** | 2×2: GSC visibility × GA4 business value, human-reviewed |
| **Intended hubs** | Pages the business *wants* to rank (commercial LPs, product hubs) |
| **De facto hubs** | Pages search *currently* treats as cluster owners |

---

## Optional future work

### Step 4 — MCP wrappers (CSV → API path)

**Status:** Not started — deferred  
**Goal:** When GA4/GSC MCP is enabled in the agent environment, run Phase 1a without manual CSV exports. Playbook logic unchanged; only the analytics skill input branch expands.

| Track | Tasks |
|-------|--------|
| **GA4 MCP** | Document MCP tool names + params for landing-page + conversion reports; add `ga4-mcp` branch in analytics skill that emits the same handoff JSON shape as CSV |
| **GSC MCP** | Document Search Analytics row caps / sampling; add `gsc-mcp` branch; degraded fallback prompts for CSV when MCP returns truncated data |
| **Done when** | Phase 1a handoff JSON is identical whether sourced from MCP or file |

### Step 5 — Playbook handoff schema

**Status:** Not started  
**Goal:** Versioned playbook-level handoff JSON (today: Phase 1a uses analytics skill handoff; triangulation is playbook-internal).

- [ ] Define `hub-spoke-discovery-recovery` handoff v1.0 (`triangulation_pages[]`, scope, limitations)
- [ ] `scripts/verify-handoff.mjs` + SCORECARD layer in playbook `examples/`
- [ ] Document join to child skill handoffs in `REFERENCE.md`

### Step 6 — Cornerstone Content Audit parity

**Status:** In progress (playbook v0.1.0)

- [ ] Tier B package complete (`EXAMPLES.md`, fictional fixtures)
- [ ] Cross-link recovery sections with this playbook’s Phase 5 mapping table
- [ ] Shared report appendix templates between top-down and bottom-up paths

### Step 7 — Percentile calibration

**Status:** Open  
**Goal:** Site-size buckets for matrix quadrant thresholds (small blog vs large support KB).

- Revisit after multiple full-audit runs across fictional fixture patterns
- Document bucket rules in analytics skill `REFERENCE.md` when stable

---

## Out of scope for this public repo

| Item | Where it belongs |
|------|------------------|
| Live GSC/GA4 exports | Private workspace only |
| Client overrides (`intended_hubs`, conversion events, protected pages) | Private client tool folder |
| Phase 1a–2 deliverable write-ups for real domains | Client `company-docs/` or analytics reference folder |
| Capability registry / orchestrator sync | Private monorepo orchestrator |

Use fictional fixtures (`wp-support-saas`, `photography-saas`) to teach the pattern without publishing client data.

---

## Cross-cutting guardrails (all future steps)

- **`write-a-skill` gate** — read [`utilities/write-a-skill/SKILL.md`](../../../utilities/write-a-skill/SKILL.md) before any skill or playbook edit
- **Human checkpoint** after Phase 2 — matrix is advisory, not auto-execution
- **No delete queue** — only consolidate / redirect / improve / deindex recommendations with target URL
- **No authority-transfer promises** — internal links = discovery + topical association language only
- **GEO stack** — fan-out, information gain, AI citability, robots.txt remain required in full audit scope
- **Multi-hub sites** — label hub type (commercial, technical, trust, product); never force a single mega-hub model

---

## Execution order

```text
Step 1 (analytics skill) ──► Step 2 (playbook) ──► Step 3 (README + fixtures)  ✓  PUBLIC SHIP
        │                                                              │
        │                                                              ▼
        │                                                    Step 4 (MCP, optional)
        ▼
Private client proof runs — optional, not a public-repo gate
```

---

## Open decisions

| Decision | Status | Notes |
|----------|--------|-------|
| Public folder name | Resolved | `hub-spoke-discovery-recovery/` |
| Percentile thresholds | Open | Site-size buckets — revisit after Step 7 |
| Public fixtures | Resolved | Fictional SaaS domains only in this repo |
| Playbook handoff schema | Open | Step 5 |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-06-26 | Initial build plan from hub-spoke strategy review |
| 2026-06-26 | Analytics skill renamed; Tier C scorecard added |
| 2026-06-28 | Steps 1–3 shipped; playbook v0.3.0; internal `ROADMAP.md` retired |
| 2026-06-28 | Replaced with public `FUTURE-WORK.md` |

---

## Skill authoring closeout (every change)

```bash
node scripts/verify-public-hygiene.mjs
cd utilities/write-a-skill
node scripts/verify-skill-package.mjs --path ../../marketing/skills/analytics-and-searchconsole-performance-audit --tier C --public --run-verifiers
```

Update `marketing/README.md` and root `README.md` when shipping new public capabilities.
