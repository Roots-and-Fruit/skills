# Marketing Skills

Agent workflows for **Roots & Fruit** marketing work — SEO, content strategy, AI-search visibility (GEO), and research that feeds campaigns and briefs.

Skills live in subfolders under `marketing/skills/`. Each folder is self-contained: read its `SKILL.md` for the agent workflow, `REQUIREMENTS.md` for data prerequisites, and `EXAMPLES.md` for sample output.

Playbooks live under [`playbooks/`](playbooks/).

---

## Available skills

### Site Content Catalog

**Path:** [`skills/site-content-catalog/`](skills/site-content-catalog/)  
**Version:** 1.1.0 — modes, handoff v1.0, page-type classifier + regression (G1–G14, T1–T9)

Build a page inventory (URL, `page_type`, optional SEO signals) for audits and playbooks.

| Mode | You provide | You get |
|------|-------------|---------|
| **sitemap_only** | Sitemap or domain + WebFetch | URLs, types, lastmod — handoff v1.0 |
| **sitemap_enriched** | + DataForSEO MCP | + keywords, ETV, backlinks, depth counts |
| **labs_fallback** | Domain, no sitemap + MCP | Ranked URLs only + limitations |

**Data required:** see [`skills/site-content-catalog/REQUIREMENTS.md`](skills/site-content-catalog/REQUIREMENTS.md).

**Regression:**

```bash
node skills/site-content-catalog/scripts/verify-scorecard.mjs
node skills/site-content-catalog/scripts/verify-handoff.mjs
```

**Example prompts:**

- *"Catalog **example.com** — sitemap at **https://example.com/sitemap.xml**"*
- *"Inventory all pages under **/blog/** on **example.com** — sitemap only"*

**Pairs with:** [Cornerstone Content Audit](playbooks/cornerstone-content-audit/) (Phase 1).

---

### Analytics and Search Console Performance Audit

**Path:** [`skills/analytics-and-searchconsole-performance-audit/`](skills/analytics-and-searchconsole-performance-audit/)  
**Version:** 1.3.1 — report template hardening, intended-hub parity checks, intent classifier regression (I1–I7)

Audits landing-page **Google Analytics (GA4)** vs **Google Search Console** exports. Surfaces accidental hubs, hidden gems, and prune review candidates. **Not** full hub discovery — Phase 1a input for hub-and-spoke recovery playbook.

| Mode | You provide | You get |
|------|-------------|---------|
| **full** | GSC page+query CSV + GA4 landing-page CSV + conversion event names | Performance quadrant matrix + handoff v1.0 |
| **gsc_only** | GSC export only | Visibility split + limitations |
| **ga4_only** | GA4 export only | Value split + traffic/intended-hub report (no GSC chase) |

**Data required:** user-supplied CSV exports — see [`skills/analytics-and-searchconsole-performance-audit/REQUIREMENTS.md`](skills/analytics-and-searchconsole-performance-audit/REQUIREMENTS.md).

**Regression:**

```bash
node skills/analytics-and-searchconsole-performance-audit/scripts/refresh-handoff-fixtures.mjs
node skills/analytics-and-searchconsole-performance-audit/scripts/verify-handoff.mjs
node skills/analytics-and-searchconsole-performance-audit/scripts/verify-scorecard.mjs
```

**Example prompts (agent):**

- *"Audit GA4 and Search Console exports for **example.com** — conversions: **demo_request**"*
- *"Which landing pages are accidental hubs vs hidden gems on **example.com**?"*

**Pairs with:** [Hub & Spoke Discovery & Recovery](playbooks/hub-spoke-discovery-recovery/) (Phase 1a).

---

### SEO Cannibalization Audit

**Path:** [`skills/seo-cannibalization-audit/`](skills/seo-cannibalization-audit/)  
**Version:** 1.0.0 — same-domain keyword overlap, intent comparison, resolution recommendations

Detect when multiple pages compete for the same keywords; output conflicts, hub/spoke checks, and retire/differentiate/301 guidance.

**Data required:** DataForSEO MCP — see [`skills/seo-cannibalization-audit/REQUIREMENTS.md`](skills/seo-cannibalization-audit/REQUIREMENTS.md).

**Example prompts:**

- *"Check cannibalization on **example.com** for **https://example.com/pricing**"*
- *"Which pages on **example.com** compete for **enterprise SSO**?"*

**Pairs with:** [Cornerstone Content Audit](playbooks/cornerstone-content-audit/) (Phase 4a).

---

### robots.txt Audit

**Path:** [`skills/robots-txt-audit/`](skills/robots-txt-audit/)  
**Version:** 1.4.5 — layperson-first output, re-audit snapshots, Cloudflare origin vs edge guidance, ContentSignals.org presets

**Data required:** WebFetch; optional key page URLs, crawl policy, and `robots_deployment` — see [`skills/robots-txt-audit/REQUIREMENTS.md`](skills/robots-txt-audit/REQUIREMENTS.md).

**Example prompts:**

- *"Audit **robots.txt** for **example.com**"*
- *"Check if AI crawlers can reach our cornerstone pages on **example.com**"*
- *"Generate **robots.txt** for **example.com** — max discovery policy"*

**Pairs with:** [Cornerstone Content Audit](playbooks/cornerstone-content-audit/) (Phase 5h).

---

### Fan-Out Coverage Analysis

**Path:** [`skills/fan-out-coverage-analysis/`](skills/fan-out-coverage-analysis/)  
**Version:** 2.3.0 — lane-aware `serp_native` tiering; regression scorecard (`verify-scorecard.mjs`)

Teach your agent to **map how a search query fans out** into related sub-questions (like Google AI Overviews do), and optionally **check which sub-queries a site already ranks for**.

| Mode | You provide | You get |
|------|-------------|---------|
| **Domain coverage** | Keyword + domain (+ optional anchor URL) | Coverage map, gaps, hub/spoke notes, coverage % |
| **Keyword only** | Keyword only | Fan-out map, priority sub-queries, SERP context |

**Data required:** DataForSEO MCP, Ahrefs MCP, or local CSV/JSON exports — see [`skills/fan-out-coverage-analysis/REQUIREMENTS.md`](skills/fan-out-coverage-analysis/REQUIREMENTS.md).

**Install** (see root [`README.md`](../README.md) for full options):

```bash
# Recommended — global install via Skills CLI
npx skills add Roots-and-Fruit/skills -g -y
```

Or in Cursor: **Customize → Rules → Add Rule → Remote Rule (Github)** → `https://github.com/Roots-and-Fruit/skills`

**Example prompts:**

- *"Run fan-out coverage for **enterprise SSO** on **example.com**"*
- *"Fan-out analysis for **wordpress plugin marketing** — keyword only"*

**Live sample run:** [`skills/fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md`](skills/fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md)

---

### Information Gain Evaluator

**Path:** [`skills/information-gain-evaluator/`](skills/information-gain-evaluator/)  
**Version:** 1.1.0 — rigorous citation-fit scoring, handoff JSON v1.1 (G1–G14 + R1–R18)

Compare a **target page** (or draft) to SERP competitors. Scores **cite-worthy information gain** for the primary keyword — not just buyer positioning. Includes `citation_fit_for_keyword`, `page_keyword_fit`, and anti-inflation rules.

| Mode | You provide | You get |
|------|-------------|---------|
| **Live URL** | Keyword + target URL | Citation fit, dimension scores, table-stakes gaps, handoff JSON |
| **Pinned competitors** | Keyword + target + 3–5 competitor URLs | Same — stable set for regression testing |
| **Draft content** | Keyword + pasted draft + competitors or SERP | Pre-publish differentiation check |

**Data required:** DataForSEO MCP (one SERP call) + WebFetch, or pinned URLs only — see [`skills/information-gain-evaluator/REQUIREMENTS.md`](skills/information-gain-evaluator/REQUIREMENTS.md).

**Regression:**

```bash
node skills/information-gain-evaluator/scripts/verify-handoff.mjs skills/information-gain-evaluator/examples/enterprise-sso.handoff.fixture.json
node skills/information-gain-evaluator/scripts/verify-handoff.mjs skills/information-gain-evaluator/examples/commercial-service-vs-diy.handoff.fixture.json --gold commercial-vs-diy
node skills/information-gain-evaluator/scripts/verify-handoff.mjs skills/information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json --gold plugin-readme-practitioner
```

See [`skills/information-gain-evaluator/examples/SCORECARD-enterprise-sso.md`](skills/information-gain-evaluator/examples/SCORECARD-enterprise-sso.md) and [`SCORECARD-commercial-vs-diy.md`](skills/information-gain-evaluator/examples/SCORECARD-commercial-vs-diy.md).

**Aligned-high fixture:** [`skills/information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json`](skills/information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json) — practitioner guide vs handbook SERP on `example.com` (`high` overall, `partial` citation fit).

**Example prompts:**

- *"Evaluate information gain for **https://example.com/guides/enterprise-sso** on keyword **enterprise SSO**"*
- *"Pinned competitors mode — target [url], keyword [kw], competitors [url1], [url2], [url3]"*

**Pairs with:** Fan-Out Coverage Analysis (upstream gaps + `intent_lane`).

---

## Playbooks (in progress)

Multi-phase orchestrators live under [`playbooks/`](playbooks/). Not yet in the root install index.

**Vocabulary:** **Hub & Spoke** = architecture; **Cornerstone** = quality bar for hub/spoke pages; **Discovery & Recovery** = bottom-up triangulation when the site is messy.

| Playbook | Path | When |
|----------|------|------|
| Cornerstone Content Audit | [`playbooks/cornerstone-content-audit/`](playbooks/cornerstone-content-audit/) | Top-down — known cornerstones, health check |
| Hub & Spoke Discovery & Recovery | [`playbooks/hub-spoke-discovery-recovery/`](playbooks/hub-spoke-discovery-recovery/) | Bottom-up — accidental hubs, GSC/GA4 triangulation, new client onboarding (v0.3.0) |

See [`playbooks/README.md`](playbooks/README.md) for the full decision table.

---

## DataForSEO MCP (common setup)

Many marketing skills use DataForSEO. Minimal Cursor MCP config:

```json
{
  "mcpServers": {
    "dataforseo": {
      "command": "npx",
      "args": ["-y", "dataforseo-mcp-server"],
      "env": {
        "DATAFORSEO_LOGIN": "your_login",
        "DATAFORSEO_PASSWORD": "your_api_password"
      }
    }
  }
}
```

Use environment variables or Cursor secrets — **do not commit credentials**.

---

## Adding skills

New marketing skills get their own folder under `marketing/skills/` with at minimum:

- `SKILL.md` — agent workflow
- `REQUIREMENTS.md` — MCP, CSV, or other data dependencies
- `EXAMPLES.md` — sample shapes (generic domains only in public examples)
- `AGENTS.md` — repo-root maintainer rules (see [`AGENTS.md`](../AGENTS.md))

Update this README and the root [`README.md`](../README.md) index when you add one.
