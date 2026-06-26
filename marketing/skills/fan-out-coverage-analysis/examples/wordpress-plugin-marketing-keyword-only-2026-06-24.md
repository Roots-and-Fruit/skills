# Keyword Fan-Out Report — "wordpress plugin marketing"

> **Historical run (skill v2.1.0).** For v2.2 lane classification, facet-drift tagging, and tier-based priority, see `EXAMPLES.md` case study and `wordpress-plugin-marketing-v2.2.handoff.sample.json`.

**Run date:** 2026-06-24  
**Mode:** keyword_only  
**Primary keyword:** wordpress plugin marketing  
**Domain:** none (keyword-only)  
**Locale:** United States / en  
**Data source:** DataForSEO MCP (SERP live, Labs related/suggestions, search intent)  
**Skill version:** 2.1.0

---

## Summary

| Metric | Value |
|--------|-------|
| **Sub-queries mapped** | 25 |
| **Seed volume** | ~30/mo (commercial; thin SERP ~123 results) |
| **SERP context** | PAA (8 at click depth 2); 5 related searches; video pack |
| **AI Overview** | Not in live SERP pull; Labs index flags `ai_overview` intermittently |

### Head-term context

- **wordpress plugin marketing** ≈ **30/mo** US, commercial intent (~97%), low competition
- YoY trend down ~75%; quarterly down ~67% — volatile, low-volume head term
- SERP is thin — mixed intent between **plugin developer GTM** and **martech plugin listicles**

---

## SERP ambiguity (key finding)

Page-one results split two intents:

1. **Plugin developer GTM** — how to market *your* plugin (Reddit, Freemius, CMinds)
2. **Martech listicles** — best marketing *plugins for* WordPress sites (WPBeginner, HubSpot, Customers.ai)

Labs expansion drifts heavily into intent #2 (email/affiliate/newsletter plugins). High-volume email-plugin terms are **facet drift**, not core fan-out for developer marketing.

---

## Fan-out map

| Sub-query | Vol/mo | Dimension | Intent | Priority | Source |
|-----------|--------|-----------|--------|----------|--------|
| mailpoet | 1,000 | adjacent_topic | navigational | medium | related |
| wordpress affiliate marketing plugin | 320 | detail_drill | commercial | high | suggestions |
| wordpress email marketing plugin | 210 | detail_drill | commercial | high | suggestions |
| wordpress plugin for affiliate marketing | 70 | detail_drill | commercial | medium | suggestions |
| best affiliate marketing wordpress plugin | 50 | detail_drill | commercial | medium | suggestions |
| wordpress plugin marketing | 30 | core_variant | commercial | high | seed |
| marketing wordpress plugin | 30 | core_variant | commercial | high | suggestions |
| wordpress marketing plugin | 30 | core_variant | commercial | high | suggestions |
| referral marketing wordpress plugin | 30 | detail_drill | commercial | medium | suggestions |
| wordpress plugin marketing strategy | — | detail_drill | commercial | high | related + SERP |
| how to promote a wordpress plugin | — | question | informational | high | serp_paa |
| best newsletter plugin for wordpress | — | detail_drill | commercial | high | related |
| best newsletter plugin for wordpress free | 20 | detail_drill | commercial | medium | related |
| wordpress email list plugin free | 20 | detail_drill | navigational | medium | related |
| wordpress newsletter plugin | — | detail_drill | commercial | high | related |
| best email marketing plugin for wordpress | — | detail_drill | commercial | high | inferred |
| free wordpress plugin marketing | — | detail_drill | commercial | high | related |
| best wordpress plugin marketing | — | detail_drill | commercial | high | related |
| wordpress email marketing plugin free | 10 | detail_drill | commercial | medium | related |
| best free email plugin for wordpress | 10 | detail_drill | commercial | medium | related |
| can i earn money by making a wordpress plugin | — | question | commercial | high | serp_paa |
| mailpoet vs mailchimp | — | adjacent_topic | commercial | low | related nested |
| mailpoet pricing | — | adjacent_topic | commercial | low | related nested |
| is wordpress outdated in 2026 | — | adjacent_topic | informational | low | serp_paa |
| why are people moving away from wordpress | — | adjacent_topic | commercial | low | serp_paa |

---

## Priority sub-queries (developer-marketing angle)

1. **how to promote a wordpress plugin** — PAA on seed SERP; procedural GTM intent
2. **wordpress plugin marketing strategy** — related search; strategy/evaluation
3. **free wordpress plugin marketing** — related search; freemium/distribution
4. **best wordpress plugin marketing** — related search; channel comparison
5. **can i earn money by making a wordpress plugin** — PAA; monetization + distribution
6. **wordpress plugin marketing** (seed) — head term; commercial, low volume
7. **wordpress affiliate marketing plugin** — highest Labs volume; facet drift but commercially strong

---

## Seed SERP notes — who ranks

| Rank | Domain | Angle |
|------|--------|-------|
| 1 | reddit.com | Practitioner thread — plugin sales tactics |
| 2 | freemius.com | Developer marketing handbook |
| 3 | wordpress.org | Plugin tag directory (marketing) |
| 4 | cminds.com | Market a plugin / increase sales |
| 5 | agilecrm.com | Listicle — marketing plugins for WP sites |
| 6 | wpbeginner.com | Listicle — plugins marketers use |
| 7 | customers.ai | Listicle — digital marketing plugins |
| 8 | blog.hubspot.com | Listicle — plugins for marketers |

**Related searches:** wordpress plugin marketing strategy · free wordpress plugin marketing · best wordpress plugin marketing · best newsletter plugin for wordpress · WordPress Newsletter plugin

**PAA (relevant):** How to promote a WordPress plugin? · Can I earn money by making a WordPress plugin?

**PAA (adjacent / filtered low):** Is WordPress outdated in 2026? · Why are people moving away from WordPress?

---

## Limitations

- Fan-out approximates AI/SERP decomposition; not a literal AI Overview trace
- Labs suggestions overweight email/affiliate/newsletter variants (token overlap with seed)
- PAA includes platform-health questions weakly related to plugin GTM
- Volumes are US monthly estimates; seed term low-volume and declining
- Keyword-only mode — no domain coverage checked

---

## Handoff

Structured JSON: `wordpress-plugin-marketing-keyword-only-2026-06-24.handoff.json`
