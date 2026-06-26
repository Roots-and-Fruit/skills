---
name: Analytics and Search Console Performance Audit
type: composite
description: >
  Use when triaging landing pages with Google Analytics (GA4) and Google Search Console
  exports — query intent and landing-page discovery, optional conversion quadrants,
  accidental hubs, or prune review before hub-and-spoke recovery. Ask whether the audit
  should be discovery-only or discovery-plus-conversions. Works in GA4-only or GSC-only
  partial mode when one source is missing. Domain-agnostic; CSV or API-shaped tables.
version: 1.3.1
---

# Analytics and Search Console Performance Audit

## Human-facing summary

**What this is:** An audit that answers **“Is organic search sending the right kind of traffic to the right pages?”** using GSC page×query data (required for discovery) and optional GA4 landing-page data.

**Two analysis modes** (ask the user which they want):

| Mode | Best for | GA4 conversions |
|------|----------|-----------------|
| **`discovery_only`** | Services, publishers, low-volume sites — query intent and landing alignment | Optional (sessions for context only) |
| **`discovery_plus_conversions`** | Sites with meaningful key-event volume — discovery **plus** visibility×value quadrants | Required when GA4 is provided |

**Partial runs are valid:** If only GA4 or only GSC is available, run the matching partial data mode; do not chase missing data.

**Not this skill:** Full hub discovery, keyword research, site remediation playbooks, or third-party rank data as a GSC substitute. **Do not** output numbered “what to fix on the site” recommendations — point to the Hub & Spoke Discovery playbook for next steps.

**Packaging:** Tier **C** ([`write-a-skill`](../../../utilities/write-a-skill/SKILL.md))

**Reference:** `REFERENCE.md` · **Requirements:** `REQUIREMENTS.md` · **Examples:** `EXAMPLES.md`

Force-load: *"Use the analytics and Search Console performance audit skill to …"*

## Step 0 — Available data first (mandatory)

Before fetching anything, determine what the user **already provided** or **explicitly asked you to pull**:

| Available | Data mode | Action |
|-----------|-----------|--------|
| GSC page+query **and** GA4 landing pages | `full` | Score per analysis mode |
| GA4 only | `ga4_only` | Ship partial audit — no GSC discovery |
| GSC only | `gsc_only` | Ship partial audit — discovery from GSC only |
| Neither | — | Ask once for at least one source |

**Forbidden when a source is missing:** npm installs (`googleapis`, etc.), DataForSEO/Ahrefs as GSC substitutes, inventing exports.

**Completion criterion:** `handoff.mode` matches available inputs; `limitations[]` states what is unknown.

## Step 0.5 — Analysis mode (mandatory)

Ask once if not specified:

> *Should this audit be **discovery-only** (query intent and landing-page alignment — best for services/low conversion volume) or **discovery-plus-conversions** (adds conversion/value quadrants)?*

| User choice | `inputs.analysis_mode` | Requirements |
|-------------|------------------------|--------------|
| Discovery only / right traffic / no conversions focus | `discovery_only` | **GSC page×query required** for discovery summary; GA4 optional |
| Both discovery and conversions / full matrix | `discovery_plus_conversions` | GSC + GA4; **conversion events required** when GA4 present |

Do not default silently — record the choice in handoff `inputs.analysis_mode`.

**Completion criterion:** `handoff.inputs.analysis_mode` is set.

## Input policy

1. **Domain** — e.g. `example.com` (required)
2. **Analysis mode** — `discovery_only` or `discovery_plus_conversions` (required — ask in Step 0.5)
3. **GSC** — page + query export or equivalent (required for discovery summary)
4. **GA4** — landing-page export (optional in `discovery_only`; required for full value matrix in `discovery_plus_conversions`)
5. **Conversion events** — 1–3 GA4 key event names (**only** when `discovery_plus_conversions` and GA4 provided)

**Optional:** date range, intended hubs (every URL must appear in report + `discovery.intended_hubs[]`), protected pages

Never infer domain, mode, exports, or conversion events from fixtures or prior runs.

## Data modes vs analysis modes

**Data mode** (`handoff.mode`) — what sources exist: `full` | `gsc_only` | `ga4_only`

**Analysis mode** (`inputs.analysis_mode`) — how to interpret:

| analysis_mode | Quadrants (when GSC present) | Discovery block |
|---------------|-------------------------------|-----------------|
| `discovery_only` | Visibility only (`high_visibility_unvalued` / `low_visibility_unvalued`; `indexing_noise` → `accidental_hub`) | **Required** |
| `discovery_plus_conversions` | Full matrix when GSC+GA4 | **Required** when GSC page×query available |

## Quick start

```bash
node scripts/build-matrix.mjs \
  --domain example.com \
  --gsc path/to/gsc-queries.csv \
  --ga4 path/to/ga4-landing-pages.csv \
  --analysis-mode discovery_plus_conversions \
  --conversions demo_request,newsletter_signup \
  --intended https://example.com/,https://example.com/pricing \
  --date-range 2025-12-01/2026-05-31
```

Discovery-only (GSC required; omit `--conversions`):

```bash
node scripts/build-matrix.mjs \
  --domain example.com \
  --gsc path/to/gsc-queries.csv \
  --analysis-mode discovery_only \
  --intended https://example.com/pricing
```

## Step 4 — Human report

Use **`handoff.discovery`** and `handoff.pages[]` as sources. **Mandatory section order** when GSC discovery is present (do not put strategic synthesis before evidence tables):

1. **Banner** — mode, date range, data sources
2. **Query intent split** — `discovery.intent_split` (clicks + impressions per intent)
3. **Intended hub discovery table** — every `inputs.intended_hubs[]` URL; verdict, top queries, GSC + GA4 session metrics
4. **Misalignments** — `discovery.misalignments` (state “none” if empty)
5. **Indexing noise** — `discovery.indexing_noise_urls` / `indexing_noise` flags (state “none” if empty)
6. **Strategic read** — one direct answer: *Are keywords driving the right kind of traffic?* Synthesize §2–5 only
7. **Mode-specific sections** (below)
8. **Limitations**
9. **Closeout** (one or two lines max) — playbook pointer and/or optional `discovery_plus_conversions` upgrade. **No site fix list.**

Quadrant counts are **secondary** in `discovery_only`.

### `discovery_only` report (§7)

1. **Visibility quadrant split** — `high_visibility_unvalued` vs `low_visibility_unvalued` (+ `accidental_hub` only for `indexing_noise` URLs)
2. **Top pages by GSC clicks** — columns: URL, clicks, impressions, **`hub_type_hint`**, **`flags`** (from matching `pages[]` row)
3. **High-impression / low-CTR landings** (if any) — DIY or commercial queries with weak CTR; label by **intent**, not “accidental hub,” unless `indexing_noise`
4. **GA4 landing context** (if GA4 provided) — top pages by **organic** sessions when channel filter is available; otherwise all sessions; **no** converter leaderboard

**Forbidden in `discovery_only` reports:**

- Unicorn / hidden gem / prune / top-converters sections
- Numbered site recommendations (content plans, meta rewrites, internal linking tasks)
- Strategic read before §2 query intent split

### `discovery_plus_conversions` report (§7)

1. **Conversion context** — site-wide key events; note when volume is low (quadrants are cohort-relative)
2. **Performance quadrants** — summary → accidental hubs → hidden gems → protected review
3. **Intended hubs** — quadrant + flags + absolute GSC/GA4 metrics

When key events are sparse: *treat discovery sections (§2–6) as primary; quadrants are triage only.*

### Partial data modes

**`ga4_only`:** Sessions/intended hubs; no discovery block; upgrade line for GSC.

**`gsc_only`:** Sections §2–6 + visibility quadrants; upgrade line for GA4.

## Step 5 — Handoff JSON

Emit `handoff_version: "1.0"` per `REFERENCE.md`. Include `discovery` when GSC page×query rows were parsed. Every `inputs.intended_hubs[]` URL must appear in `discovery.intended_hubs[]`.

## Done definition

- [ ] Step 0.5 — `inputs.analysis_mode` set from user choice
- [ ] Report section order §1–9 when GSC available
- [ ] Every intended hub in report table and `discovery.intended_hubs[]`
- [ ] Top GSC pages table includes `hub_type_hint` and `flags`
- [ ] No site remediation list in `discovery_only`
- [ ] `node scripts/verify-handoff.mjs` passes
- [ ] `node scripts/verify-scorecard.mjs` passes
- [ ] `node scripts/verify-intent-classifier.mjs` passes

## Ship bar (Tier C)

```bash
node scripts/refresh-handoff-fixtures.mjs
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
node scripts/verify-intent-classifier.mjs
```

## Playbook consumer

[Hub & Spoke Discovery & Recovery](../../playbooks/hub-spoke-discovery-recovery/) — Phase 1a. Close reports with a pointer here — not inline remediation.

## Maintainers

Follow [`write-a-skill`](../../../utilities/write-a-skill/SKILL.md). After scoring, discovery, or flag changes: refresh fixture, run all verifiers, update `examples/SCORECARD-example-saas.md`.
