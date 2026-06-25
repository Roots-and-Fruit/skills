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

**Install:**

```bash
cp -r marketing/fan-out-coverage-analysis ~/.cursor/skills/fan-out-coverage-analysis
```

**Example prompts:**

- *"Run fan-out coverage for **enterprise SSO** on **example.com**"*
- *"Fan-out analysis for **wordpress plugin marketing** — keyword only"*

**Live sample run:** [`fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md`](fan-out-coverage-analysis/examples/wordpress-plugin-marketing-keyword-only-2026-06-24.md)

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
