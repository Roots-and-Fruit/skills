# Requirements

Workflow for an AI agent. Does not fetch data on its own.

---

## The short version

| You have… | Mode | Skill usefulness |
|-----------|------|------------------|
| **Sitemap + WebFetch** | `sitemap_only` | Strong — full URL list + page types |
| **Sitemap + DataForSEO MCP** | `sitemap_enriched` | Full — signals + handoff v1.0 |
| **Domain only, no sitemap + MCP** | `labs_fallback` | Partial — ranked URLs only |
| **None of the above** | — | Not meaningful |

---

## Always required

- **Cursor** (or agent with skills + optional MCP)
- **Domain or sitemap URL** from the user — never from fixtures or workspace
- **WebFetch** for sitemap XML

**Optional:**

- Path **scope** prefix
- **DataForSEO MCP** for enriched mode or labs fallback
- **Node.js 18+** for regression scripts

---

## Option A — Sitemap + WebFetch (`sitemap_only`)

- Public sitemap or user-supplied sitemap URL
- Output: handoff with `discovered_only` rows; human markdown table optional

---

## Option B — DataForSEO + WebFetch (`sitemap_enriched`, recommended)

| Step | Tool |
|------|------|
| Sitemap | WebFetch |
| Keywords / ETV | `dataforseo_labs_google_ranked_keywords` |
| Backlinks | `backlinks_summary` |
| On-page | `on_page_content_parsing` |

See [`marketing/README.md`](../README.md#dataforseo-mcp-common-setup) for MCP config.

---

## Option C — Labs fallback (`labs_fallback`)

- `dataforseo_labs_google_keywords_for_site` when no sitemap
- `limitations[]` must warn inventory is incomplete

---

## Large sites

| Pages | Behavior |
|-------|----------|
| ≤100 | Enrich all (enriched mode) |
| 101–200 | Sample + `limitations[]` |
| >200 | Scope with user before deep enrichment |

---

## Regression

From `site-content-catalog/`:

```bash
node scripts/verify-scorecard.mjs
node scripts/verify-handoff.mjs
```

Golden fixture: `examples/example-saas.handoff.fixture.json`

---

## Downstream use

- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 1
- Cannibalization and gap workflows — page inventory input

Handoff schema: `REFERENCE.md` v1.0. **Do not assume `inbound_internal_links`** until handoff v1.1.
