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
| `example-saas.handoff.fixture.json` | Expected handoff output (generic SaaS) |
| `sample-photography-gsc-queries.csv` | Photography SaaS GSC sample |
| `sample-photography-ga4-landing-pages.csv` | Photography SaaS GA4 sample |
| `photography-saas.handoff.fixture.json` | Hub-and-spoke discovery pattern (fictional `example-photo.io`) |
| `sample-wp-support-gsc-queries.csv` | WP support SaaS GSC sample |
| `sample-wp-support-ga4-landing-pages.csv` | WP support SaaS GA4 sample |
| `wp-support-saas.handoff.fixture.json` | WP support SaaS hub-and-spoke scenario (fictional `example-wp-support.io`) |

Scorecards: `examples/SCORECARD-example-saas.md` · `examples/SCORECARD-photography-saas.md` · `examples/SCORECARD-wp-support-saas.md`

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

## Photography SaaS pattern (hub-and-spoke discovery)

Fictional domain **`example-photo.io`** — competitor-intent blog posts outrank intended proofing hubs. Mirrors common messy-site patterns without client data.

**Prompt:**

> Audit GA4 and Search Console for **example-photo.io** — conversions: **trial_signup**, **purchase**. Intended hubs: **/pro**, **/blog/what-is-photo-proofing**.

```bash
node scripts/build-matrix.mjs \
  --domain example-photo.io \
  --gsc examples/sample-photography-gsc-queries.csv \
  --ga4 examples/sample-photography-ga4-landing-pages.csv \
  --analysis-mode discovery_plus_conversions \
  --conversions trial_signup,purchase \
  --intended https://example-photo.io/pro,https://example-photo.io/blog/what-is-photo-proofing \
  --date-range 2026-01-01/2026-06-28 \
  --out examples/photography-saas.handoff.fixture.json
```

| URL | Quadrant | Playbook signal |
|-----|----------|-----------------|
| `/blog/competitor-a-review` | `accidental_hub` | De facto pillar; route to product |
| `/pro` | `unicorn` | Intended commercial hub |
| `/blog/what-is-photo-proofing` | `hidden_gem` | Intended proofing hub; needs visibility |
| `/pricing` | `hidden_gem` | Converts without GSC presence |

See `SCORECARD-photography-saas.md` and [Hub & Spoke Discovery & Recovery](../../playbooks/hub-spoke-discovery-recovery/SKILL.md).

## WP support SaaS pattern (hub-and-spoke discovery)

Fictional domain **`example-wp-support.io`** — technical how-tos outrank intentional `/how-we-help/` hub.

```bash
node scripts/build-matrix.mjs \
  --domain example-wp-support.io \
  --gsc examples/sample-wp-support-gsc-queries.csv \
  --ga4 examples/sample-wp-support-ga4-landing-pages.csv \
  --analysis-mode discovery_plus_conversions \
  --conversions demo_request,trial_signup \
  --intended https://example-wp-support.io/how-we-help/,https://example-wp-support.io/pricing/,https://example-wp-support.io/contact/,https://example-wp-support.io/support-plans/ \
  --date-range 2025-06-26/2026-06-25 \
  --out examples/wp-support-saas.handoff.fixture.json
```

See `SCORECARD-wp-support-saas.md` for triangulation role expectations.

## Regenerate fixture

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
