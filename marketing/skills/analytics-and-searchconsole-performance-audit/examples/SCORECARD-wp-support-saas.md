# SCORECARD — wp-support-saas (example-wp-support.io)

Fictional WordPress support SaaS fixture. Technical how-to posts (DNS, analytics tools) outrank the intentional commercial hub — a common hub-and-spoke discovery scenario.

**Regenerate:**

```bash
node scripts/build-matrix.mjs \
  --domain example-wp-support.io \
  --gsc examples/sample-wp-support-gsc-queries.csv \
  --ga4 examples/sample-wp-support-ga4-landing-pages.csv \
  --analysis-mode discovery_plus_conversions \
  --conversions demo_request,trial_signup \
  --intended https://example-wp-support.io/how-we-help/,https://example-wp-support.io/pricing/,https://example-wp-support.io/contact/,https://example-wp-support.io/support-plans/ \
  --protected https://example-wp-support.io/about/ \
  --date-range 2025-06-26/2026-06-25 \
  --out examples/wp-support-saas.handoff.fixture.json
```

## Expected quadrants (R-layer narrative)

| URL | Quadrant | Playbook signal |
|-----|----------|-----------------|
| `/how-to-transfer-your-domain-to-cloudflare` | `accidental_hub` or `unicorn`* | De facto DFS pillar; not intended commercial hub |
| `/google-tag-assistant` | `accidental_hub` or `unicorn`* | Technical traffic leader |
| `/how-we-help` | `hidden_gem` | Intended commercial hub; weak GSC visibility |
| `/pricing` | `unicorn` | intentional_hub |
| `/support-plans` | varies | false_hub_warning when high impr + low CTR |
| `/contact` | `hidden_gem` | Converts without search clicks |

\*Cohort-relative percentiles may label technical how-tos as `unicorn` while Phase 1c triangulation assigns `accidental_hub` — document the conflict.

## Triangulation roles (Phase 1c)

| URL | Expected triangulated role |
|-----|---------------------------|
| `/how-to-transfer-your-domain-to-cloudflare` | accidental_hub |
| `/google-tag-assistant` | accidental_hub |
| `/how-we-help` | hidden_gem |
| `/pricing` | intentional_hub |
| `/support-plans` | false_hub_warning |
