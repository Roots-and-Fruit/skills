# Requirements

This playbook is a **workflow for an AI agent**. It orchestrates other marketing skills under `marketing/`.

**Not published in the root install index yet** — work in progress under `marketing/playbooks/`.

---

## The short version

| Scope | Phases | Minimum data |
|-------|--------|--------------|
| **Quick scan** | 1–2 | Sitemap or domain + catalog path (WebFetch or DataForSEO) |
| **Single-page review** | 3 | Target URL + primary keyword + MCP/WebFetch |
| **Full audit** | 1–6 | All of the above + fan-out + information gain + SERP/backlink APIs |

---

## Always required

- **Domain or sitemap URL** from the user — never inferred
- **Scope** — quick scan, single-page, or full audit (default: ask if unclear)
- **WebFetch** for sitemaps and page content

**Optional user context** (ask once if relevant):

- Known cornerstone URLs (skips nomination)
- Protected pages (never recommend retire without approval)
- Topic cluster map or site architecture notes

---

## Skills this playbook calls

| Phase | Skill | Path |
|-------|-------|------|
| 1 | Site Content Catalog | `../../site-content-catalog/SKILL.md` |
| 3b | Fan-Out Coverage Analysis | `../../fan-out-coverage-analysis/SKILL.md` |
| 3c | Information Gain Evaluator | `../../information-gain-evaluator/SKILL.md` |
| 4a | SEO Cannibalization Audit | `../../seo-cannibalization-audit/SKILL.md` |
| 5h | robots.txt Audit | `../../robots-txt-audit/SKILL.md` |

---

## DataForSEO MCP

Full audit uses many Labs, SERP, backlink, and optional AI-optimization endpoints. See playbook **DataForSEO tools used** section.

Configure MCP per [`marketing/README.md`](../README.md#dataforseo-mcp-common-setup).

---

## Human checkpoints

- **Phase 2:** User must approve nominated cornerstones before Phase 3+ (full audit).
- **Phase 4 retire/301:** Never recommend retiring a top-10 page (>20/mo volume) without explicit approval.
