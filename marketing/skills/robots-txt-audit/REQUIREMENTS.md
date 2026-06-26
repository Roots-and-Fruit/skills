# Requirements

Workflow for an AI agent. Does not deploy files or fetch data on its own.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **Domain + WebFetch** | Check existence or audit crawler policy |
| **Domain + key page URLs + WebFetch** | Audit cornerstone path crawlability |
| **Crawl policy + WebFetch** | Recommend or generate policy-aligned robots.txt |
| **Site catalog handoff** (optional) | Cross-check sitemap URLs vs Disallow rules |
| **None of the above** | Not meaningful |

---

## Always required

- **Domain** from the user
- **WebFetch** (or equivalent) for `https://{domain}/robots.txt`, `https://www.{domain}/robots.txt`, and **each declared sitemap URL** (for SM7 / R7e)

**Optional:**

- **Key page URLs** — cornerstones or priority pages for crawlability check
- **`crawl_policy`** — `max_discovery`, `block_training_allow_answers`, `restrictive`, or `audit_only`
- **Site Content Catalog handoff** — sitemap cross-check in R7

---

## Outputs

| Deliverable | When |
|-------------|------|
| Human markdown audit, recommend, or draft | Every run |
| Handoff JSON v1.0 | Every run — see `REFERENCE.md` |

Regression (maintainers):

```bash
node scripts/verify-robots-structure.mjs
node scripts/verify-max-discovery.mjs
node scripts/verify-max-discovery-contract.mjs
node scripts/verify-handoff.mjs
```

`verify-max-discovery.mjs` and `verify-max-discovery-contract.mjs` are required when changing `max_discovery` rules, crawler registry, sitemap validation, or handoff contract for `max_discovery` runs.

---

## Downstream use

[Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) passes confirmed cornerstone URLs as `key_pages` and typically `crawl_policy: max_discovery` in Phase 5h. Playbook embeds human sections from this skill's handoff and draft.
