# Pack completeness scorecard

*One row per competitor in the confirmed set. Save as `{output_dir}/pack-scorecard.md` before Phase 6. Formal Phase 6 is blocked until every **required** row is `pass` or human-`waived`.*

## How to score

| Field | Pass when |
| --- | --- |
| Homepage + pricing | **Text extract + screenshot PNG** both saved under `03-raw-sources/` (or documented absence). Interactive pricing includes control state. `status_quo` exempt from PNG pair. |
| Manifest | `{slug}/02-url-manifests/` exists; every URL labeled `saved` or `touched_not_saved` (include HTTP status when known). Match rows in root `CAPTURE-LOG.md`. |
| Citation integrity | No Phase 4–5 claim depends on `touched_not_saved` only |
| Sentiment | Meets **tier** bar from PLAYBOOK **allowlisted** sources only, **or** `pass (cross_platform)` with allowlisted corpus + `sentiment_cross_platform: true`, **or** `sentiment_incomplete` **and** human `waived` (`waived by` + date). Denylist sources (homepage testimonials, case-study stacks, unsaved G2 badges) never count. |
| Lenses | identity, sentiment, pricing, four-pillars files present (`status_quo`: light note only) |
| Battlecard | Present; `provisional` only if limitations allow |

**Depth tiers** (set in Phase 2):

| Tier | Typical role | Sentiment default bar |
| --- | --- | --- |
| `primary_peer` | Direct shortlist fight | ≥8 snippets, ≥2 emotions |
| `adjacent` | Bless / anti-position (e.g. SaaS, heavy platform) | ≥4 snippets, ≥2 emotions |
| `status_quo` | Inertia alternative | Light note schema; no full sentiment bar |
| `boundary` | Analyze lightly / waive | Explicit human waiver in scorecard |

Also record **platform gravity** per row (`wordpress` \| `woo` \| `shopify` \| `multi` \| `unknown`) from Phase 2.

## Scorecard table

```text
Status: draft | ready_for_phase_6 | ready_for_phase_6_with_waivers
Date:
Phase 2 status: confirmed (required for any ready_* status)
Capture backend (primary): headed_browser | http_ua | webfetch | cloud_browser | notebooklm
CAPTURE-LOG: {output_dir}/CAPTURE-LOG.md

Waived rows (if any) — human reply in-thread only; ban "pending: Matt":
- slug — reason — waived by: {name} — date: YYYY-MM-DD

| Slug | Depth tier | Platform gravity | Required? | Home+price | Manifest | Citations OK | Sentiment | Lenses | Battlecard | Row result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| example-a | primary_peer | wordpress | required | pass | pass | pass | pass \| pass (cross_platform) \| incomplete+waived | pass | pass | pass \| fail \| waived |
```

| Status | Meaning |
| --- | --- |
| `ready_for_phase_6` | Phase 2 confirmed; every required row is `pass` (no waivers) |
| `ready_for_phase_6_with_waivers` | Phase 2 confirmed; every required row is `pass` or human-`waived` with `waived by` + date filled above |
| `draft` | Still working; Phase 2 still draft; required `fail` rows; or agent-only pending waive. Optional file: `positioning-statement.DRAFT.md` only — never `positioning-statement.md` or `marketing-gate.md` |
