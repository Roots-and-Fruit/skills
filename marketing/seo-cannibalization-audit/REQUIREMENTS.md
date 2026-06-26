# Requirements

Workflow for an AI agent. Does not fetch data on its own.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **DataForSEO MCP** | Full workflow |
| **Subject URLs + pinned overlap data (CSV)** | Partial — agent follows same logic on supplied rankings |
| **None of the above** | Not meaningful |

---

## Always required

- **Domain** and **subject URL(s)** from the user
- **DataForSEO MCP** (recommended) for overlap detection and backlink checks before 301s
- **WebFetch** optional for title/H1 comparison when on-page API unavailable

**Optional:**

- Primary keywords per subject page
- Protected pages list
- Site architecture notes (hubs, cornerstones)

---

## DataForSEO calls

| Step | Tool |
|------|------|
| Per-subject keywords | `dataforseo_labs_google_ranked_keywords` |
| Same-domain overlap | `dataforseo_labs_google_relevant_pages` |
| Pre-redirect check | `backlinks_summary` |

See [`marketing/README.md`](../README.md#dataforseo-mcp-common-setup) for MCP setup.

---

## Downstream use

[Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) calls this skill in Phase 4a with confirmed cornerstone URLs and primary keywords.
