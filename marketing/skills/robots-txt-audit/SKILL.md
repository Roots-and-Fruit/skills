---
name: robots.txt-Audit
type: capability
description: >
  Use when auditing robots.txt, AI crawler permissions, GEO crawl policy,
  whether robots.txt blocks llms.txt, cornerstone path crawlability, or
  blocking/allowing GPTBot, PerplexityBot, OAI-SearchBot, and Google-Extended.
  Audits selective crawler rules per bot (training vs indexing crawl),
  validates Sitemap directives, checks llms.txt companion crawlability,
  and drafts policy-aligned robots.txt.
version: 1.8.0
---

# robots.txt Audit

## Purpose

Audit `/robots.txt` as the **authoritative crawl-permission file** for search and AI crawlers. Distinguish **indexing/answer crawl** from **training crawl** per bot; validate `Sitemap:`; check that `/llms.txt` is not blocked for answer bots; recommend or draft policy-aligned rules.

**Not this skill:** deploying files, WAF/CDN config, log analysis, or **authoring / content-auditing** `llms.txt`. That file is an inference-time guide ([llmstxt.org](https://llmstxt.org/) v2) — **not crawl control**.

**Docs:** [Public guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/) · `REFERENCE.md` (rubric R1–R11, handoff schema, templates, llms.txt companion) · `REQUIREMENTS.md` · `EXAMPLES.md` · `LAYPERSON-OUTPUT.md` (chat contract) · `RECHECK.md` · `AGENTS.md`

**SSOT scripts:** `run-audit.mjs` (primary) · `assess-policy.mjs` · `assess-llms-txt.mjs` · `build-handoff.mjs` · `build-layperson-summary.mjs` · `parse-robots-txt.mjs` · `syntax-validation.mjs` · `crawler-registry.mjs`

**Cloudflare:** `CLOUDFLARE-MANAGED.md` when managed markers detected.

## Input policy

1. **Domain** — from user only (never infer from workspace)
2. **Key pages** (optional) — cornerstone URLs
3. **Crawl policy** (optional) — `max_discovery` | `block_training_allow_answers` | `restrictive` | `audit_only` (default `audit_only`). `max_discovery` is **discovery-only** — training blocks are optional.
4. **`robots_deployment`** (optional) — `auto` | `origin_only` | `cloudflare_managed`

If domain missing, ask once. Never infer domain from examples.

## Modes

| Mode | When |
|------|------|
| **audit** | File found, compliant or audit_only |
| **recommend** | Policy gaps vs `crawl_policy` |
| **recheck** | User updated file — see `RECHECK.md` |
| **generate** | File missing or user requests draft |

## Primary path (use this)

1. WebFetch **both** `https://{domain}/robots.txt` and `https://www.{domain}/robots.txt`.
2. WebFetch declared sitemap URLs → save as JSON `[{ "url", "status" }]`.
3. WebFetch `https://{domain}/llms.txt` (and `/llms-full.txt` if linked) → `[{ "url", "status" }]`. Missing file is fine — still check robots.txt does not `Disallow` those paths for discovery crawlers allowed at `/`. Never list `llms.txt` on a `Sitemap:` line.
4. Optionally WebFetch cart/checkout probes → `index_control_results`.
5. Save fetched body to a temp file, then:

```bash
cd marketing/skills/robots-txt-audit
node scripts/run-audit.mjs \
  --robots path/to/fetched.txt \
  --domain example.com \
  --policy max_discovery \
  --sitemap-fetch path/to/sitemap-fetches.json \
  --llms-fetch path/to/llms-fetches.json
```

PowerShell (use `;` instead of `&&`):

```powershell
Set-Location marketing/skills/robots-txt-audit; node scripts/run-audit.mjs --robots path/to/fetched.txt --domain example.com --policy audit_only --sitemap-fetch path/to/sitemap-fetches.json --llms-fetch path/to/llms-fetches.json
```

6. **Paste stdout to chat** (layperson summary). Link the detail report path from stderr.
7. Do **not** hand-build `audit_checks` or handoff JSON — `build-handoff.mjs` produces G-valid handoff inside the detail file.

**Recheck:** add `--recheck` (reads `reports/{domain}-latest-snapshot.json`). See `RECHECK.md`.

**Forbidden in chat:** per-bot matrix, rubric tables, handoff JSON, `MD_*` IDs. See `LAYPERSON-OUTPUT.md`.

## Gates (read when triggered)

### Discover (Step 1)

- Record both URLs in `discovery.urls_checked`; set `discovery.resolved_url`.
- HTML-as-200 → unfetchable; pass `discovery.fetch_suspect: true` to assess.

### Cloudflare managed (Step 1b)

Both markers present → read `CLOUDFLARE-MANAGED.md` full; `deployment.model: cloudflare_managed`; use layer split. Do not duplicate CF training blocks at origin.

### Assess (Step 2)

Run `assessRobotsTxtContent(content, crawl_policy, domain, options)` with:

- `sitemap_fetch_results` — required when sitemaps declared
- `llms_txt_results` — when `/llms.txt` was fetched
- `index_control_results` — when cart/checkout probed
- Read `syntax_validation` from output — **do not re-lint in prose**

Rubric, per-bot matrix columns, R7 sub-checks, llms.txt companion, policy presets, and `audit_findings` tiers: **`REFERENCE.md`** (not repeated here).

### Recommend / Generate (Steps 3–4)

Templates and draft rules: `REFERENCE.md`. `generate` drafts must pass `policy_compliance` for the chosen preset.

### Handoff (Step 6)

Full schema and field rules: `REFERENCE.md`. `crawler_matrix` must be a JSON **array** from assessment (never a string placeholder — fails G26).

## Done definition

- [ ] Domain from user; apex + `www` in `urls_checked` (G27)
- [ ] Used `run-audit.mjs` or equivalent `writeAuditReports` with fetch options forwarded
- [ ] Chat = layperson summary only (`LAYPERSON-OUTPUT.md`)
- [ ] Detail report + handoff JSON written under `reports/{domain}-{date}-detail.md`
- [ ] Recheck → `RECHECK.md`; snapshot updated
- [ ] CF managed → `CLOUDFLARE-MANAGED.md`; G28–G33 fields when applicable
- [ ] No deployment performed
- [ ] Did not treat `llms.txt` as crawl control; flagged `Disallow` of `/llms.txt` for answer bots when applicable

**Ship bar:**

```bash
cd marketing/skills/robots-txt-audit
node scripts/verify-all.mjs
```

## Pairs with

- [Site Content Catalog](../site-content-catalog/) — sitemap cross-check
- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 5h
