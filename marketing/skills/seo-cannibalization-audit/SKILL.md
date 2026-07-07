---
name: SEO-Cannibalization-Audit
type: composite
description: >
  Use when auditing keyword cannibalization, same-domain page overlap, or hub-vs-hub
  conflicts before consolidation. Use for accidental hub vs intended hub, blog post
  outranking a landing page, or internal competition diluting rankings on one domain.
version: 2.0.2
---

# SEO Cannibalization Audit

## Purpose

Find when **two or more pages on the same domain compete for the same keywords**, classify whether the overlap is healthy (hub + spoke) or harmful, and recommend a **concrete resolution** — differentiate, consolidate, or human-reviewed redirect — with playbook-ready handoff JSON.

**Not this skill:** keyword research, off-site competitor analysis, or auto-executing 301s.

**Packaging:** Tier **C** ([`write-a-skill`](../../../utilities/write-a-skill/SKILL.md)) — playbook consumes handoff; relationship and resolution rules drift without regression gates.

**Reference:** `REFERENCE.md` · **Requirements:** `REQUIREMENTS.md` · **Examples:** `EXAMPLES.md`

Force-load: *"Use the SEO cannibalization audit skill to …"*

## Playbook role (Hub & Spoke Discovery & Recovery)

Discovery (Phases 1–2) labels **accidental hubs**, **intended hubs**, and signal conflicts. This skill **proves** whether two of your pages are fighting for the same search and names **who should win**.

Pass from the playbook:

- `mode`: `playbook_hub_recovery`
- `subject_pages[]` — audit targets (prioritize `accidental_hub`, `intentional_hub`, de facto pillars)
- `intended_hubs[]`, `protected_pages[]` from Phase 1
- `triangulation_context[]` — `{ url, triangulated_role, cluster }` from Phase 1c

Emit `recovery_phase` (`5f` | `5g` | `none`) so Phase 5 maps actions without re-deriving logic.

## Input policy (non-negotiable)

1. **Domain** — from user only
2. **Subject page(s)** — URL(s) to audit
3. **Scope** — `targeted` (named URLs) or `full_site` (key pages list)

**Optional:**

- `primary_keywords` — per-URL map when known
- `intended_hubs[]` — pages the business wants to own a cluster
- `protected_pages[]` — never recommend retire/301 without explicit approval
- `triangulation_context[]` — playbook roles per URL
- Site architecture notes

Never infer domain or URLs from workspace, examples, or prior runs.

**Live URLs only:** Every URL in `subject_pages[]` (and every URL in `intended_hubs[]` when provided) must return **HTTP 200** before any other step. See Step 0.

## Modes

| Mode | When | Focus |
|------|------|-------|
| `targeted` | Standalone or Cornerstone playbook | Subject URLs + overlap detection |
| `playbook_hub_recovery` | Hub & Spoke Discovery playbook Phase 4a | Accidental vs intended, blog vs LP tensions first |
| `full_site` | Periodic architecture audit | Broader subject set from catalog |

**Completion criterion:** `handoff.mode` matches the invocation path.

## Quick start

1. Confirm **domain**, **subject_pages**, and **mode**.
2. **Step 0** — validate every subject URL returns HTTP 200 (**hard stop** if not).
3. **Step 1** — keyword overlap detection (DataForSEO).
4. **Step 2** — intent + relationship (`classify-relationship.mjs` rules).
5. **Step 3** — title/meta overlap (WebFetch or on-page).
6. **Step 4** — resolution (`resolve-conflict.mjs` rules + guardrails).
7. **Step 4b** — `healthy_relationships[]` when no conflicts and pair is `hub_spoke_ok`.
8. **Step 5** — architecture conflicts (playbook mode only).
9. **Step 6** — human report + **handoff JSON v1.0**.

In `playbook_hub_recovery`, list **playbook tensions first** in the report, then other conflicts.

## Step 0 — URL validation (mandatory, hard stop)

Before **any** DataForSEO call, overlap logic, title/meta fetch, handoff JSON, or recommendations:

1. WebFetch (or equivalent HTTP HEAD/GET) **every** URL in `subject_pages[]`.
2. If `intended_hubs[]` is provided, validate **every** URL there too (even when not listed in `subject_pages[]`).

**Pass:** HTTP status **200** and response is a real HTML page (not a soft-404 error page with 200 — if obvious, treat as fail).

**Fail:** Any status other than 200 (404, 403, 410, 5xx, timeout, unfetchable).

### On fail — stop immediately

Do **not** proceed to Steps 1–6. Do **not** call DataForSEO. Do **not** emit handoff JSON. Do **not** infer content from repo drafts, sitemaps, or cached copy.

Respond to the user once with:

```markdown
## Cannibalization audit — stopped (URLs not live)

I can't run a cannibalization audit until every subject URL returns HTTP 200.

| URL | Status | Issue |
|-----|--------|-------|
| {url} | {code} | {brief note} |

This skill compares **live** pages that both rank in search. Unpublished, draft, or missing URLs need to be fixed or swapped before overlap detection means anything.

**What would you like to do?**
A) Replace the non-200 URL(s) with live published URL(s) and re-run
B) Remove the non-200 URL(s) and audit the remaining live pair(s) only
C) Cancel — run again after the page(s) are published
```

Use `AskQuestion` when available; otherwise wait for explicit user choice.

**Completion criterion:** All subject (and intended hub) URLs return 200, **or** the run ends at this step with no further work.

## Step 1 — Keyword overlap detection

For each subject page:

1. `dataforseo_labs_google_ranked_keywords` — limit 30, search volume desc
2. For each keyword, `dataforseo_labs_google_relevant_pages` on the domain — flag when **two+ same-domain URLs** appear in top 50

**Playbook priority:** When `triangulation_context` is provided, check overlap keywords for pairs where one URL is `accidental_hub` / `de_facto_pillar` and another is in `intended_hubs[]` first.

### Severity

| Signal | `severity` |
|--------|------------|
| Both rank ≤ 20 | `active` |
| Both in top 50 | `emerging` |
| New page vs existing top 10 | `pre_publish_risk` |

**Completion criterion:** Every flagged keyword has `severity` and at least two `pages[]` rows with ranks.

## Step 2 — Intent and relationship

Classify each page `intent` per `REFERENCE.md`. Run relationship rules:

```bash
node scripts/classify-relationship.mjs --intent-a how_to --intent-b product
```

Or batch via `--json` pair fixture shape (`REFERENCE.md`).

Set `playbook_tension` via `detectPlaybookTension` when `intended_hubs` or `triangulation_context` present.

**Completion criterion:** Every conflict has `relationship` and `playbook_tension`.

## Step 3 — Title/meta conflict

Compare titles, meta descriptions, and H1s (WebFetch or `on_page_content_parsing`). Set `title_meta_overlap: true` when overlapping title keywords **and** same commercial intent.

**Completion criterion:** `title_meta_overlap` set on each conflict (boolean).

## Step 4 — Resolution

Apply `resolve-conflict.mjs` rules. Always `backlinks_summary` on weaker URL before `redirect_301`.

```bash
node scripts/resolve-conflict.mjs --json examples/blog-vs-pricing.pair.fixture.json
```

### Guardrails

- Protected URL → `protected_review` only
- Top-10 / meaningful volume → `needs_human_approval`, not silent 301
- `hub_spoke_ok` → keep both pages
- Playbook tension → `recovery_phase: 5f`

**Completion criterion:** Every conflict has `resolution`, `recovery_phase`, `recommended_action`, and `redirect_target` when required.

## Step 4b — Healthy relationships (when `conflicts[]` is empty)

When Steps 1–4 produce **no** `conflicts[]` rows and `subject_pages[]` has **two or more** URLs:

1. Classify each audited pair with `classify-relationship.mjs`.
2. When `relationship` is **`hub_spoke_ok`**, emit one `healthy_relationships[]` row per such pair using `build-healthy-relationship.mjs`:

```bash
node scripts/build-healthy-relationship.mjs --json path/to/pair.json --keyword "wordpress core web vitals"
```

**Keyword for the row** (pick first available):

1. A **shared** keyword from Step 1 (if any were found but did not meet conflict thresholds), else
2. `inputs.primary_keywords` for the **hub** URL in the pair, else
3. The **highest-volume ranked keyword** from either page in Step 1 that thematically labels the cluster (informational spoke term is OK when hub has zero rankings).

Set `summary.healthy` to `healthy_relationships.length`.

**Do not** emit a healthy row when `relationship` is not `hub_spoke_ok`, or when a matching pair already appears in `conflicts[]`.

**Completion criterion:** `conflicts.length === 0` and two+ subject pages with `hub_spoke_ok` pair → `healthy_relationships.length >= 1` and `summary.healthy` matches.

## Step 5 — Architecture conflicts (playbook mode)

When `mode` is `playbook_hub_recovery`, emit `architecture_conflicts[]` for Phase 4c:

- Accidental pillar blocking intended hub
- Cluster with no pillar
- Pillar without spokes (in subject set)
- Spoke without pillar

**Completion criterion:** `architecture_conflicts[]` populated when structural gaps exist; empty array otherwise.

## Step 6 — Output

**Human report** — sections per `REFERENCE.md`. In playbook mode, lead with playbook tensions.

**Handoff JSON** — `handoff_version: "1.0"` per `REFERENCE.md`. Return handoff directly when a playbook calls this skill.

## Done definition

- [ ] **Step 0 passed** — every `subject_pages[]` and `intended_hubs[]` URL returned HTTP 200, **or** run stopped with user prompt (no Steps 1–6)
- [ ] Input policy satisfied — no inferred domain/URLs
- [ ] Every overlap has `severity`, `relationship`, `playbook_tension`, `resolution`, `recovery_phase`
- [ ] Protected pages → `protected_review` only
- [ ] `redirect_301` / `consolidate` include `redirect_target`
- [ ] Playbook mode: tensions prioritized in report; `architecture_conflicts[]` when applicable
- [ ] **Step 4b** — zero conflicts + `hub_spoke_ok` pair → `healthy_relationships[]` populated; `summary.healthy === healthy_relationships.length`
- [ ] `limitations[]` states partial data or API caps
- [ ] Handoff validates:

```bash
node scripts/verify-handoff.mjs
node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json --gold blog-vs-pricing
node scripts/verify-handoff.mjs examples/hub-spoke-ok.handoff.fixture.json --gold hub-spoke-ok
node scripts/verify-handoff.mjs examples/zero-overlap-hub-spoke-ok.handoff.fixture.json --gold zero-overlap-hub-spoke-ok
```

## Ship bar (Tier C)

```bash
node scripts/verify-handoff.mjs
```

## Playbook consumers

- [Hub & Spoke Discovery & Recovery](../../playbooks/hub-spoke-discovery-recovery/) — Phase 4a
- [Cornerstone Content Audit](../../playbooks/cornerstone-content-audit/) — Phase 4a (`mode: targeted`)

## Maintainers

After relationship, resolution, or schema changes: update fixtures, run verifiers, bump `skill_version` in frontmatter and golden fixtures.
