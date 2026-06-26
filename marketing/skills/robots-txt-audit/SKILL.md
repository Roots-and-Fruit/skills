---
name: robots.txt Audit
type: capability
description: >
  Use when auditing robots.txt, AI crawler permissions, GEO crawl policy,
  cornerstone path crawlability, or blocking/allowing GPTBot, PerplexityBot,
  OAI-SearchBot, and Google-Extended. Audits selective crawler rules per bot
  (training vs indexing crawl), validates Sitemap directives, and drafts
  policy-aligned robots.txt.
version: 1.2.0
---

# robots.txt Audit

## Purpose

Audit `/robots.txt` as the **authoritative crawl-permission file** for search and AI crawlers. For each bot, distinguish **indexing/answer crawl** (discovery) from **training crawl** (model corpus). Verify cornerstone URLs are crawlable, validate `Sitemap:` declarations, and recommend or draft selective rules.

**Not this skill:** deploying files, WAF/CDN configuration, server log analysis (note as follow-up), or treating `llms.txt` as a crawl-control mechanism.

**Reference:** `REFERENCE.md` · **Requirements:** `REQUIREMENTS.md` · **Examples:** `EXAMPLES.md`

**SSOT scripts:** `parse-robots-txt.mjs` · `crawler-registry.mjs` · `assess-policy.mjs`

## Input policy (non-negotiable)

1. **Domain** — e.g. `example.com` (from user only)
2. **Key pages** (optional) — cornerstone or priority URLs to check for crawlability
3. **Crawl policy** (optional) — `max_discovery` | `block_training_allow_answers` | `restrictive` | `audit_only` (default: `audit_only` if missing)

If domain is missing, ask once:

> *Which domain should I audit for robots.txt? (Optional: key page URLs and crawl policy — max discovery vs audit only.)*

Never infer domain from workspace or examples.

## Modes

| Mode | When | Output emphasis |
|------|------|-----------------|
| **audit** | `robots.txt` found | Rubric R1–R10 + per-bot matrix + sitemap validation |
| **recommend** | Policy gaps vs user `crawl_policy` | Targeted rule changes with rationale |
| **generate** | File missing or user requests full draft | Complete `draft_robots_txt` + deployment note |

**Completion criterion for mode:** `handoff.mode` matches what you did; `discovery.found` reflects WebFetch result.

## Quick start

1. Confirm **domain**, optional **key_pages**, optional **crawl_policy**.
2. **Step 1** — discover file (`REFERENCE.md` URLs).
3. **Found** → **Step 2** parse + audit using `assess-policy.mjs` (+ **Step 3** recommend if policy mismatch).
4. **Not found** → **Step 4** generate (or audit-only note if user only asked to check existence).
5. **Step 5** — human markdown summary (include per-bot matrix when useful).
6. **Step 6** — emit **handoff JSON** v1.0 (`REFERENCE.md`).

Does not deploy files. Playbooks pass `key_pages`; this skill returns policy assessment and handoff.

## Step 1 — Discover

WebFetch **both** canonical discovery URLs (always — even when the first returns 200):

- `https://{domain}/robots.txt`
- `https://www.{domain}/robots.txt`

Record **both** in `discovery.urls_checked` (apex first, then `www`). Set `discovery.resolved_url` to the URL that returned usable content; prefer apex when both succeed.

**Completion criterion:** `discovery.found` is boolean; `urls_checked` lists both URLs; never claim a file exists without a successful fetch.

## Step 2 — Parse, assess policy, and audit

1. Parse with `scripts/parse-robots-txt.mjs`.
2. Run `assessRobotsTxtContent(content, crawl_policy, domain, options)` from `scripts/assess-policy.mjs`.
3. **WebFetch each declared sitemap URL** and pass results as `options.sitemap_fetch_results` (e.g. `{ url, status }`). This powers **SM7 / R7e** endpoint health checks.
4. Populate handoff: `crawler_matrix`, `sitemap_validation`, and `policy_compliance` (when `crawl_policy` is `max_discovery`).

### Per-bot matrix (required in human output for full audits)

For each registry token in `REFERENCE.md`, report:

| Column | Meaning |
|--------|---------|
| **Token** | Official user-agent or robots token |
| **Role** | indexing · ai_answer · ai_training · user_triggered |
| **Indexing / answer crawl** | `allowed` · `blocked` · `ambiguous` · `na` at `/` |
| **Training crawl** | `allowed` · `blocked` · `ambiguous` · `na` at `/` |
| **rule_source** | `explicit` or `inherits_user_agent_star` |

| **max_discovery expectation** | Target when policy is `max_discovery` |

Bots without a dedicated `User-agent` group inherit `User-agent: *` rules — set `rule_source: inherits_user_agent_star` and say so in notes.

**Critical pairings** — flag when reversed:

- `Googlebot` (indexing) blocked but `Google-Extended` (training token) allowed
- `OAI-SearchBot` (answer) blocked but `GPTBot` (training) allowed

See `REFERENCE.md` **Training vs indexing crawl** for what each bot controls.

### Rubric R1–R10

| Check | What to look for |
|-------|------------------|
| **R1 File accessible** | 200 at canonical host |
| **R2 Syntax / structure** | Valid groups; no accidental global `Disallow: /` on search bots |
| **R3 Search crawlers** | `Googlebot`, `bingbot` can reach `/` and cornerstone paths |
| **R4 AI bot differentiation** | Training and answer bots not lumped into one wrong block |
| **R5 Cornerstone crawlability** | Each `key_pages` path allowed for discovery crawlers; `na` when no key_pages |
| **R6 Low-value path hygiene** | `/admin`, `/cart`, `/checkout`, etc. restricted where applicable |
| **R7 Sitemap declaration** | See R7a–R7e below |
| **R8 Google token hygiene** | Training restriction uses `Google-Extended` not `Googlebot` |
| **R9 Wildcard vs specific** | `User-agent: *` rules do not silently block intentional AI allows |
| **R10 CDN caveat** | Note to verify live served file (CDN may override origin) |

### R7 — Sitemap declaration (all audits when `Sitemap:` present)

| ID | Check | Pass when |
|----|-------|-----------|
| **R7a** | Present | At least one `Sitemap:` line |
| **R7b** | Absolute URL | Each value is full `https://` URL (not relative) |
| **R7c** | Host match | Sitemap host is `{domain}` or `www.{domain}` |
| **R7d** | Sitemap shape | Path contains `sitemap` or ends in `.xml` (warn if unusual) |
| **R7e** | Sitemap endpoint fetch | WebFetch each declared URL; warn on HTTP 4xx/5xx (**SM7**) |

Use `validateSitemaps()` from `assess-policy.mjs` with `sitemap_fetch_results`. Populate `sitemap_validation` in handoff including `endpoint_fetch[]`.

**R7 overall:** `pass` when declaration checks pass and endpoint fetch succeeds; `warn` when declaration passes but SM7 fires; `fail` when SM1–SM6 fail.

When catalog handoff available: warn if sitemap lists URLs blocked by `Disallow`.

### max_discovery compliance

When `crawl_policy` is `max_discovery`, run `assessMaxDiscovery()` — populate `policy_compliance` in handoff:

- `compliant: true` only when all MD checks pass **and** sitemap validation passes
- List each violation with token, expected, actual, path, message

**Completion criterion:** every rubric row in `audit_checks[]`; `policy_compliance` when policy is `max_discovery`.

## Step 3 — Recommend

When live policy conflicts with `crawl_policy`, output **before/after snippets** per bot or path. Use `REFERENCE.md` templates.

Common fixes:

- Unblock `Googlebot` / `bingbot`; block `Google-Extended` instead for training-only restriction
- Unblock `OAI-SearchBot` / `PerplexityBot`; keep `GPTBot` blocked
- Add explicit `Allow: /` for answer bots under complex wildcard rules
- Fix cornerstone path blocked by overly broad `Disallow`
- Add or fix `Sitemap: https://{domain}/sitemap.xml` (absolute, correct host)

Set `mode: "recommend"` when primary deliverable is policy change guidance.

## Step 4 — Generate

When file not found or user requests a draft, build from `REFERENCE.md` policy template matching `crawl_policy`:

- **`max_discovery`:** allow search + answer bots; block `GPTBot`, `Google-Extended`, `CCBot`; restrict admin/cart/checkout; declare sitemap
- Include comments explaining each blocked agent
- `Sitemap: https://{domain}/sitemap.xml` unless user provides another canonical sitemap URL

Run `assessRobotsTxtContent(draft, crawl_policy, domain)` before handoff — `policy_compliance.compliant` must be `true` for `max_discovery`.

**Completion criterion:** `mode` is `generate`; `draft_robots_txt` passes P-layer checks; `deployment_note` names root URL and verification steps.

## Step 5 — Human output

**Audit:** per-bot matrix + sitemap validation table + findings.

**Recommend:** prioritized snippets grouped by bot role (indexing vs training).

**Generate:** full draft in fenced plain text + placement and verification instructions.

Frame limits honestly: robots.txt controls **crawl permission**, not indexing (`noindex` is separate), security, or guaranteed AI citation.

## Step 6 — Handoff JSON

Emit v1.0 per `REFERENCE.md`. **Always** include `crawler_matrix` when `discovery.found` and mode is `audit` or `recommend`. Include `sitemap_validation` (with `endpoint_fetch`) whenever a file was found.

**`crawler_matrix` is machine data, not prose.** Copy the full array from `assessRobotsTxtContent()` → `assessment.crawler_matrix` (same rows as the human per-bot table). Each object needs `token`, `roles`, `rule_source`, `indexing_crawl`, `training_crawl`, `max_discovery_expectation`, etc.

**Forbidden in handoff JSON:**

```json
"crawler_matrix": "[see per-bot table above]"
```

That placeholder fails **G26** and breaks downstream playbooks. If the human table exists but `crawler_matrix` is missing or a string, the handoff is incomplete.

## Done definition

- [ ] Domain from user; **both** apex and `www` discovery URLs in `urls_checked` (G27)
- [ ] Mode matches audit / recommend / generate path
- [ ] Per-bot matrix in human output **and** full `crawler_matrix` **array** in handoff (never a string placeholder)
- [ ] R7a–R7e reflected in `sitemap_validation`, `endpoint_fetch`, and `audit_checks`
- [ ] No key_pages → `fully_crawlable: null`, R5 `na`
- [ ] `max_discovery` → `policy_compliance.compliant` matches `assessMaxDiscovery()` output
- [ ] `generate` draft passes P-layer when policy is `max_discovery`
- [ ] `deployment_note` present; no deployment performed

**Ship bar (Tier C):**

```bash
cd marketing/skills/robots-txt-audit
node scripts/verify-robots-structure.mjs
node scripts/verify-max-discovery.mjs
node scripts/verify-max-discovery-contract.mjs
node scripts/verify-handoff.mjs
```

## Pairs with

- [Site Content Catalog](../site-content-catalog/) — sitemap cross-check when catalog handoff available
- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 5h
