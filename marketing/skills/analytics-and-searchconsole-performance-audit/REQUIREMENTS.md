# Requirements

Workflow for an AI agent. Does not call Google APIs on its own in v1.0.

---

## The short version

| You have… | Data mode | Ask user: analysis mode |
|-----------|-----------|-------------------------|
| **GSC page×query** (+ optional GA4) | `full` or `gsc_only` | `discovery_only` **or** `discovery_plus_conversions` |
| **GA4 only** | `ga4_only` | Partial — no query discovery; recommend adding GSC |
| **Neither** | — | Not meaningful — ask for exports or MCP tables |

**Analysis modes:**

| Mode | GSC | GA4 | Conversions |
|------|-----|-----|-------------|
| `discovery_only` | **Required** for discovery summary | Optional (sessions context) | Not used for quadrants |
| `discovery_plus_conversions` | Required for full matrix | Required for value quadrants | **Required** when GA4 provided |

---

## Always required

- **Cursor** (or agent with skills)
- **Domain** from the user
- **Analysis mode** — ask: `discovery_only` or `discovery_plus_conversions`
- **User-defined conversion events** (1–3) when `discovery_plus_conversions` and GA4 are provided

**Optional:**

- **Node.js 18+** for `build-matrix.mjs` and regression scripts
- **Intended hub URLs** and **protected pages** from user context

### GA4 channel filter (recommended for discovery)

When GA4 MCP or Explore is available, prefer **organic search** landing pages for §7 session context — not all-channel sessions. Record in `limitations[]` if organic filter was applied or unavailable.

---

## GSC export (page + query)

**Where:** Google Search Console → Performance → Search results.

**Export shape:** One row per **page × query** (not the Pages summary export alone).

**Minimum columns:**

| Column | Aliases accepted |
|--------|------------------|
| Page URL | `Page`, `Top pages`, `Landing page` |
| Query | `Query`, `Top queries` |
| Impressions | `Impressions` |
| Clicks | `Clicks` |
| Position | `Position`, `Average position` |

**Date range:** 6–12 months recommended. Record in `inputs.date_range`.

**Known limits:**

- GSC exports cap rows — document truncation in `limitations[]`
- Heavy URLs with thousands of queries may be under-sampled in UI exports

---

## GA4 export (landing pages)

**Where:** GA4 → Explore or standard Landing page report with events.

**Minimum columns:**

| Column | Aliases accepted |
|--------|------------------|
| Landing page | `Landing page`, `Page path`, `Page path and screen class` |
| Sessions | `Sessions` |

**Conversion columns:** One numeric column per event in `conversion_events` (header must match event name or normalized snake_case).

**Optional:**

- `Engagement rate` — used only as tie-breaker; not a substitute for conversion events

---

## Conversion events

Required **only** when `inputs.analysis_mode === "discovery_plus_conversions"` and GA4 is provided.

Examples:
- Custom key events: `demo_request`, `trial_start`

Do not assume default events from fixtures or industry templates.

---

## Degraded modes

| Missing | Behavior |
|---------|----------|
| GA4 | `gsc_only` — visibility split only; do not fetch GA4 via package installs |
| GSC | `ga4_only` — value split only; do not fetch GSC via package installs or third-party rank data |
| Conversion events + GA4 | Value score uses sessions only; `limitations[]` required |

### Available data first (agent)

1. Detect what the user supplied (CSV, paste, MCP/API table) **before** any fetch.
2. Lock `mode` immediately — partial runs are **complete** deliverables.
3. **Forbidden when a source is missing:**
   - Installing npm packages (`googleapis`, etc.)
   - Substituting DataForSEO, Ahrefs, or similar for GSC
   - Full-mode quadrant labels in partial modes
   - Flag `converts_without_search_clicks` when GSC is absent

Optional one-line upgrade at report end: user may add the missing export later.

---

## Regression

From `analytics-and-searchconsole-performance-audit/`:

```bash
node scripts/refresh-handoff-fixtures.mjs
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
node scripts/verify-intent-classifier.mjs
```

Scorecard IDs: `examples/SCORECARD-example-saas.md`

Sample CSVs: `examples/sample-gsc-queries.csv`, `examples/sample-ga4-landing-pages.csv`

---

## Downstream use

- Hub & Spoke Discovery & Recovery playbook — Phase 1a
- Triangulation with `site-content-catalog` and organic keyword discovery (playbook Phase 1b–1c)

Handoff schema: `REFERENCE.md` v1.0.

---

## Future (not in v1.0)

- GSC Search Analytics API via MCP
- GA4 Data API via MCP
- Site-size-aware percentile buckets (`<100` vs `100–500` URLs)
