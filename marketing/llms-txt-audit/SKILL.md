---
name: llms.txt Audit
type: capability
description: >
  Use when auditing llms.txt, generating llms.txt, or reviewing an AI visibility
  file for a domain. Checks presence, audits contents, and drafts updates from
  key pages.
version: 1.0.0
---

# llms.txt Audit

## Purpose

Check whether a domain publishes `llms.txt`, audit it against the spec, and generate or recommend updates from key pages.

## Input policy (non-negotiable)

1. **Domain** — e.g. `example.com` (from user only)
2. **Key pages** (optional) — URLs that should appear (e.g. cornerstones from a playbook)

If domain is missing, ask once. Never infer domain from workspace or examples.

## Quick start

1. WebFetch `https://{domain}/llms.txt` and `https://www.{domain}/llms.txt`
2. **Found** → audit (Step 2)
3. **Not found** → generate (Step 3)
4. Return audit findings or draft file + deployment note (do not deploy)

**Requirements:** `REQUIREMENTS.md`

## Step 2: Audit existing file

| Check | What to look for |
|-------|------------------|
| **H1** | `#` business/project name |
| **Blockquote summary** | `>` 1–3 sentence description |
| **Sections** | `##` categorized links |
| **Link format** | `- [Title](URL): Description` |
| **Cornerstone coverage** | Key pages listed when provided |
| **Freshness** | Links live, descriptions current |
| **Completeness** | Major topic areas represented |

When **key pages** are provided: list missing cornerstones; flag listed URLs not in the key set.

Output: checklist with pass/fail/recommendation per row.

## Step 3: Generate

```markdown
# {Business Name}

> {1–3 sentence description of what this site does and who it serves.}

## Key Pages

- [Page Title](URL): What this page covers and why it matters.

## Optional

- [Lower Priority Page](URL): Description.
```

- **Key pages provided:** use as `## Key Pages`, ordered by importance; descriptions from WebFetch or catalog data
- **No key pages:** recommend [Site Content Catalog](../site-content-catalog/) or cornerstone identification first; optional draft from `dataforseo_labs_google_keywords_for_site` top URLs

## Step 4: Output

- **Audit:** findings + specific update recommendations
- **Generate:** full draft ready for domain root + placement instructions (`/llms.txt` at site root)

## Notes

- Does not deploy the file
- Adoption is still early — frame as forward-looking AI visibility, not urgent SEO fix
- Playbooks pass `key_pages`; this skill returns content; playbook handles report placement

## Pairs with

- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 5h
