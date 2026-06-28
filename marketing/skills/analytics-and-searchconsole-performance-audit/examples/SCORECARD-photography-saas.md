# SCORECARD — photography-saas (example-photo.io)

Fictional photography SaaS fixture. **Competitor-intent blog posts** outrank **intended proofing hubs** — common hub-and-spoke discovery scenario.

**Regenerate:**

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

## Expected quadrants (R-layer narrative)

| URL | Quadrant | Why |
|-----|----------|-----|
| `/blog/competitor-a-review` | `accidental_hub` | Massive GSC impressions on competitor query; minimal conversions |
| `/pro` | `unicorn` | Intended commercial hub; strongest conversion volume |
| `/blog/what-is-photo-proofing` | `hidden_gem` | Intended proofing hub; converts but weak visibility / CTR |
| `/pricing` | `hidden_gem` | GA4-only page; converts without GSC presence |
| `/blog/competitor-b-alternatives` | `prune_candidate` | Moderate traffic; weak on both axes after percentile split |
| `/blog/legacy-selling-photos-post` | `prune_candidate` | Legacy cluster; near-zero value |

## Playbook tie-in

Use with [Hub & Spoke Discovery & Recovery](../../../playbooks/hub-spoke-discovery-recovery/SKILL.md) Phase 1a. Phase 1c should label `/blog/competitor-a-review` as `accidental_hub` and `/blog/what-is-photo-proofing` as `hidden_gem` or `intentional_hub` depending on DFS hub score.
