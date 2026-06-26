# Examples

## Prompts

**Discovery + conversions (default golden fixture):**

> Run an analytics and Search Console performance audit on **example.com** in **discovery-plus-conversions** mode. GSC page+query and GA4 landing-page exports attached. Count **demo_request** and **newsletter_signup** as conversions. Intended hubs: homepage, **/features/analytics**, **/pricing**. Protect **/about/security**.

**Discovery only (services / low conversion volume):**

> Run the audit on **example.com** in **discovery-only** mode. GSC page+query export attached. Are we getting the right kind of organic traffic to intended hubs **/pricing** and **/features/analytics**?

## Sample exports

| File | Role |
|------|------|
| `sample-gsc-queries.csv` | Page × query GSC export |
| `sample-ga4-landing-pages.csv` | Landing pages + sessions + events |
| `example-saas.handoff.fixture.json` | Expected handoff output |

## Regenerate fixture

```bash
node scripts/refresh-handoff-fixtures.mjs
node scripts/verify-handoff.mjs
node scripts/verify-scorecard.mjs
node scripts/verify-intent-classifier.mjs
```

Scorecard: `examples/SCORECARD-example-saas.md`

## Expected quadrant story (example.com)

| URL | Quadrant | Why |
|-----|----------|-----|
| `/blog/how-to-configure-sso` | `accidental_hub` | High GSC visibility, low conversions |
| `/features/analytics` | `unicorn` | Strong search + demo requests |
| `/` | `unicorn` | Intended hub; solid on both axes |
| `/pricing` | `hidden_gem` | High conversions, moderate GSC visibility; `building_toward_intent` |
| `/contact` | `hidden_gem` | Converts without meaningful GSC clicks |
| `/docs/api-reference` | `prune_candidate` | Weak visibility and value |
| `/blog/legacy-feature-announcement` | `prune_candidate` | Legacy post; near-zero signals |
| `/about/security` | `protected_review` | Protected; low signals but not auto-prune |

See `SCORECARD-example-saas.md` for narrative review notes.

## CLI

**discovery_plus_conversions:**

```bash
node scripts/build-matrix.mjs \
  --domain example.com \
  --gsc examples/sample-gsc-queries.csv \
  --ga4 examples/sample-ga4-landing-pages.csv \
  --analysis-mode discovery_plus_conversions \
  --conversions demo_request,newsletter_signup \
  --intended https://example.com/,https://example.com/features/analytics,https://example.com/pricing \
  --protected https://example.com/about/security \
  --date-range 2025-12-01/2026-05-31
```

**discovery_only:**

```bash
node scripts/build-matrix.mjs \
  --domain example.com \
  --gsc examples/sample-gsc-queries.csv \
  --analysis-mode discovery_only \
  --intended https://example.com/pricing \
  --date-range 2025-12-01/2026-05-31
```

## Agent-only workflow (no local files)

1. User pastes or uploads CSV contents.
2. Agent parses using the same column aliases as `scripts/parse-csv.mjs`.
3. Agent applies scoring rules from `REFERENCE.md`.
4. Agent returns handoff JSON + optional markdown table.
5. Agent states `limitations[]` if exports are truncated or partial.

## Partial data examples

### GSC only

```json
{
  "mode": "gsc_only",
  "limitations": ["No GA4 data — business value unknown; GSC-only partial labels only."]
}
```

Quadrants: `high_visibility_unvalued` / `low_visibility_unvalued` only. Do not assign `accidental_hub` until GA4 is added.

### GA4 only

```bash
node scripts/build-matrix.mjs \
  --domain example.com \
  --ga4 examples/sample-ga4-landing-pages.csv \
  --conversions demo_request,newsletter_signup \
  --intended https://example.com/,https://example.com/pricing \
  --date-range 2025-12-01/2026-05-31
```

```json
{
  "mode": "ga4_only",
  "limitations": ["No GSC data — visibility unknown; do not label accidental hubs or hidden gems."]
}
```

Quadrants: `high_value_untracked` / `low_value_untracked` only. Report uses the `ga4_only` template in `SKILL.md` (traffic concentration, intended hubs, top converters). No `converts_without_search_clicks` flags — GSC baseline required.

---
