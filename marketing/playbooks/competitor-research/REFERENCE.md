# Reference — Competitor Research → Positioning

Companion to [`SKILL.md`](SKILL.md). Templates live in [`templates/`](templates/).

## Lens prompts (Phase 4)

Ground every answer in **saved** pack files only. Substitute the current competitor name/slug.

### Identity

1. What identity / tribe does this brand sell?  
2. What does choosing them signal about the customer?  
3. What fears do they reduce?  
4. What aspiration / future self do they amplify?  

End with **Strategic Gap** for *our* brand (short).

### Sentiment

- Emotional vocabulary (verbatim where possible)  
- Tension matrix: Brand Claim · Customer Reality · Tension  
- **#1 broken promise** we could own  

Enforce tier bars + allowlist/denylist in `SKILL.md` Phase 4B.

### Pricing vs value

Value metric, hook/paywall, anchoring, hidden friction, price sentiment, **three** pricing-positioning implications for us.

### Four pillars summary

| Pillar | Job |
| --- | --- |
| Pricing | Value-bracket signal |
| Features | Table stakes vs unique value |
| Positioning | How they talk + category claimed |
| Sentiment | Patterned gaps/hooks |

## Scorecard statuses

| Status | Meaning |
| --- | --- |
| `draft` | Incomplete, Phase 2 still draft, required fails, or agent-only “pending” waive |
| `ready_for_phase_6` | Phase 2 confirmed; every required row `pass` |
| `ready_for_phase_6_with_waivers` | Phase 2 confirmed; required rows `pass` or human-`waived` with `waived by` + date |

See [`templates/pack-scorecard.md`](templates/pack-scorecard.md).

## Statement forms

See [`templates/positioning-statement.md`](templates/positioning-statement.md) for single and dual-primary forms.

## Capture log row shape

```text
| Time | Backend | URL | Result | Lesson |
| --- | --- | --- | --- | --- |
| ISO or local | headed_browser | https://… | saved → relative/path.md | … |
| … | http_ua | https://… | touched_not_saved 403 | no WebFetch retry |
```

One row per URL attempt. Ban summary-only logs.
