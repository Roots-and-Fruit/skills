# Marketing Skills

Agent workflows for **Roots & Fruit** marketing work — SEO, content strategy, AI-search visibility (GEO), and research that feeds campaigns and briefs.

Skills live in subfolders under `marketing/`. Each folder is self-contained: read its `SKILL.md` for the agent workflow, `REQUIREMENTS.md` for data prerequisites, and `EXAMPLES.md` for sample output.

---

## Available skills

### Fan-Out Coverage Analysis

**Path:** [`fan-out-coverage-analysis/`](fan-out-coverage-analysis/)  
**Version:** 2.3.0 — lane-aware `serp_native` tiering; regression scorecard (`verify-scorecard.mjs`)

Teach your agent to **map how a search query fans out** into related sub-questions (like Google AI Overviews do), and optionally **check which sub-queries a site already ranks for**.

| Mode | You provide | You get |
|------|-------------|---------|
| **Domain coverage** | Keyword + domain (+ optional anchor URL) | Coverage map, gaps, hub/spoke notes, coverage % |
| **Keyword only** | Keyword only | Fan-out map, priority sub-queries, SERP context |

**Data required:** DataForSEO MCP, Ahrefs MCP, or local CSV/JSON exports — see [`fan-out-coverage-analysis/REQUIREMENTS.md`](fan-out-coverage-analysis/REQUIREMENTS.md).

**Install** (see root [`README.md`](../README.md) for full options):

```bash
# Recommended — global install via Skills CLI
npx skills add Roots-and-Fruit/skills -g -y
```

Or in Cursor: **Customize → Rules → Add Rule → Remote Rule (Github)** → `https://github.com/Roots-and-Fruit/skills`

**Example prompts:**

- *"Run fan-out coverage for **enterprise SSO** on **example.com**"*
- *"Fan-out analysis for **wordpress plugin marketing** — keyword only"*

**Live sample run:** [`fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md`](fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md)

---

### Information Gain Evaluator

**Path:** [`information-gain-evaluator/`](information-gain-evaluator/)  
**Version:** 1.1.0 — rigorous citation-fit scoring, handoff JSON v1.1 (G1–G14 + R1–R18)

Compare a **target page** (or draft) to SERP competitors. Scores **cite-worthy information gain** for the primary keyword — not just buyer positioning. Includes `citation_fit_for_keyword`, `page_keyword_fit`, and anti-inflation rules.

| Mode | You provide | You get |
|------|-------------|---------|
| **Live URL** | Keyword + target URL | Citation fit, dimension scores, table-stakes gaps, handoff JSON |
| **Pinned competitors** | Keyword + target + 3–5 competitor URLs | Same — stable set for regression testing |
| **Draft content** | Keyword + pasted draft + competitors or SERP | Pre-publish differentiation check |

**Data required:** DataForSEO MCP (one SERP call) + WebFetch, or pinned URLs only — see [`information-gain-evaluator/REQUIREMENTS.md`](information-gain-evaluator/REQUIREMENTS.md).

**Regression:**

```bash
node information-gain-evaluator/scripts/verify-handoff.mjs information-gain-evaluator/examples/enterprise-sso.handoff.fixture.json
node information-gain-evaluator/scripts/verify-handoff.mjs information-gain-evaluator/examples/commercial-service-vs-diy.handoff.fixture.json --gold commercial-vs-diy
node information-gain-evaluator/scripts/verify-handoff.mjs information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json --gold plugin-readme-practitioner
```

See [`information-gain-evaluator/examples/SCORECARD-enterprise-sso.md`](information-gain-evaluator/examples/SCORECARD-enterprise-sso.md) and [`SCORECARD-commercial-vs-diy.md`](information-gain-evaluator/examples/SCORECARD-commercial-vs-diy.md).

**Live sample run:** [`information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json`](information-gain-evaluator/examples/plugin-readme-practitioner.handoff.fixture.json) — aligned how-to on a mixed SERP (`high` overall, `partial` citation fit).

**Example prompts:**

- *"Evaluate information gain for **https://example.com/guides/enterprise-sso** on keyword **enterprise SSO**"*
- *"Pinned competitors mode — target [url], keyword [kw], competitors [url1], [url2], [url3]"*

**Pairs with:** Fan-Out Coverage Analysis (upstream gaps + `intent_lane`).

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

New marketing skills get their own folder under `marketing/` with at minimum:

- `SKILL.md` — agent workflow
- `REQUIREMENTS.md` — MCP, CSV, or other data dependencies
- `EXAMPLES.md` — sample shapes (generic domains only in public examples)

Update this README and the root [`README.md`](../README.md) index when you add one.
