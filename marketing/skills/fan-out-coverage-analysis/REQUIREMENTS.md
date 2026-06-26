# Requirements

This skill is a **workflow for an AI agent**. It does not fetch data on its own.

**You need at least one live or local data source** before the skill is useful. Without keyword, SERP, or ranking data, the agent has nothing to fan out or measure coverage against.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **DataForSEO MCP** | Full workflow — best documented path (`REFERENCE.md` uses these tool names) |
| **Ahrefs MCP** | Full workflow — map equivalent Ahrefs calls to the same steps |
| **Local CSV / exports** | Partial or full workflow — you supply the data; agent follows the same logic |
| **None of the above** | Skill will not produce meaningful results |

Pick **one** path. You do not need all three.

---

## Always required

- **Cursor** (or similar agent with skills + optional MCP)
- **Primary keyword** in your prompt
- **One data source** from the options below

### Ambiguous seeds

Some keywords map to **multiple SERP intents** (e.g. “market your product” vs “best tools for X”). The skill (v2.2+) classifies SERP lanes in Step 0.5 and may ask which lane to prioritize. Plan for a one-line answer, or say **report both**.

**Optional (domain mode only):**

- Domain to check (never inferred — you must provide it)
- Anchor URL for hub/spoke link checks

**Optional (all modes):**

- **Node.js 18+** — only if you use `scripts/normalize-fanout.mjs`

---

## Option A — DataForSEO MCP (recommended)

**Best fit** for this repo. API names and parameters are spelled out in `REFERENCE.md`.

### What you need

- Active [DataForSEO](https://dataforseo.com) account with API credits
- DataForSEO MCP server connected in Cursor (`mcp.json`)
- Credentials via env vars (never commit them)

### What it covers

| Workflow step | DataForSEO MCP |
|---------------|----------------|
| SERP seed (PAA, related, AI Overview) | `serp_organic_live_advanced` |
| Keyword expansion | Labs related keywords, suggestions, ideas |
| Search intent | `dataforseo_labs_search_intent` |
| Domain coverage | `dataforseo_labs_google_ranked_keywords` |
| Optional: who ranks on seed | `dataforseo_labs_google_serp_competitors` |
| Optional: LLM citations | `ai_opt_llm_ment_search` |

### Setup pointer

See root `README.md` → **Connect DataForSEO MCP**.

---

## Option B — Ahrefs MCP

Use this if you already pay for Ahrefs and have their MCP connected instead of DataForSEO.

The **skill steps stay the same**; only the tool calls change. Ask the agent to follow `SKILL.md` and substitute Ahrefs MCP tools for the equivalent data:

| Workflow step | Ahrefs equivalent (conceptual) |
|---------------|--------------------------------|
| SERP seed | SERP overview / SERP features export for the primary keyword |
| Keyword expansion | Matching terms, related terms, or questions for the seed keyword |
| Search intent | Intent classification if your Ahrefs export or MCP exposes it; otherwise infer from SERP features and keyword modifiers |
| Domain coverage | Organic keywords or site explorer rankings for your domain, filtered to fan-out terms |
| Optional: competitors | Organic competitors or SERP comparison for the seed keyword |

**Caveats:**

- Ahrefs MCP tool names vary by server implementation — the agent must read your MCP tool list and map fields to this skill’s handoff schema.
- Not every DataForSEO optional enrichment (e.g. LLM mention tracking) has a 1:1 Ahrefs equivalent. Note gaps in `limitations[]` in the output JSON.

If both DataForSEO and Ahrefs are available, **prefer DataForSEO** for this skill unless you standardize on Ahrefs elsewhere.

---

## Option C — Local CSV or exported files

Use this when you have **no MCP** but already exported data from Ahrefs, Semrush, DataForSEO, GSC, or manual SERP research.

The agent runs the **same fan-out logic** using your files instead of live API calls.

### Minimum for keyword-only mode

At least one file that expands the seed into sub-queries, for example:

| Column / field | Purpose |
|----------------|---------|
| `keyword` | Sub-query text |
| `search_volume` | Optional; used for priority |
| `source` | e.g. `serp_paa`, `related`, `suggestions`, `manual` |

You can merge exports into one file and run:

```bash
node scripts/normalize-fanout.mjs --seed "your keyword" --file merged-keywords.json
```

Input shape: `{ "items": [ { "keyword": "...", "search_volume": 0, "source": "..." } ] }`

### Additional for domain coverage mode

Ranking data for **your** domain, e.g.:

| Column / field | Purpose |
|----------------|---------|
| `keyword` | Sub-query |
| `url` | Ranking page on your site |
| `rank` or `position` | Organic position |
| `domain` | Optional filter — must match the domain you provided |

### SERP context (strongly recommended)

A separate note, sheet, or CSV capturing:

- People Also Ask questions from the seed SERP
- Related searches
- Whether an AI Overview appeared (yes/no)

Without SERP seed data, fan-out leans on keyword lists only and may miss PAA-driven gaps.

### How to tell the agent

Example prompts:

- *"Run fan-out coverage for **enterprise SSO** on **example.com** using the CSV at `./data/sso-keywords.csv` and rankings at `./data/example-rankings.csv`"*
- *"Keyword-only fan-out for **best crm software** — use attached `merged-keywords.json`, no MCP"*

The agent should:

1. Read and validate your files before reporting
2. State in `limitations[]` that results are export-based (stale date, incomplete SERP, etc.)
3. Emit the same handoff JSON shapes as live runs (`REFERENCE.md`)

---

## What does *not* count as a data source

- The skill files alone (`SKILL.md`, examples)
- Asking the model to "guess" keywords or rankings without data
- General web search substituted for structured keyword/SERP/ranking data (may supplement context but does not replace a source above)

---

## Quick decision guide

```
Do you have DataForSEO MCP?
  yes → Use Option A (REFERENCE.md)
  no ↓

Do you have Ahrefs MCP?
  yes → Use Option B (map tools to SKILL steps)
  no ↓

Do you have CSV / JSON exports?
  yes → Use Option C (attach paths in your prompt)
  no ↓

Install a data source first — skill is not useful yet.
```

---

## Related docs

| File | Contents |
|------|----------|
| `README.md` | Install, DataForSEO MCP example, example prompts |
| `SKILL.md` | Agent workflow (both modes) |
| `REFERENCE.md` | DataForSEO tool IDs, filters, JSON schemas |
| `EXAMPLES.md` | Sample report and handoff shapes |
