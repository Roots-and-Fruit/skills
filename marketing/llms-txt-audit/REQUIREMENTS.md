# Requirements

Workflow for an AI agent. Does not deploy files or fetch data on its own.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **Domain + WebFetch** | Audit or check existence |
| **Domain + key page URLs + WebFetch** | Audit coverage or generate draft |
| **DataForSEO MCP** (no key pages) | Basic generate from top ranked URLs |
| **None of the above** | Not meaningful |

---

## Always required

- **Domain** from the user
- **WebFetch** (or equivalent) for `https://{domain}/llms.txt`

**Optional:**

- **Key page URLs** — cornerstones or priority pages for coverage check / generate
- **DataForSEO MCP** — `dataforseo_labs_google_keywords_for_site` when no key pages supplied

---

## Downstream use

[Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) passes confirmed cornerstone URLs as `key_pages` in Phase 5h.
