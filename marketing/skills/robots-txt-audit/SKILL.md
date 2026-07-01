---
name: robots.txt-Audit
type: capability
description: >
  Use when auditing robots.txt, AI crawler permissions, GEO crawl policy,
  cornerstone path crawlability, or blocking/allowing GPTBot, PerplexityBot,
  OAI-SearchBot, and Google-Extended. Audits selective crawler rules per bot
  (training vs indexing crawl), validates Sitemap directives, and drafts
  policy-aligned robots.txt.
version: 1.4.6
---

# robots.txt Audit

## Purpose

Audit `/robots.txt` as the **authoritative crawl-permission file** for search and AI crawlers. For each bot, distinguish **indexing/answer crawl** (discovery) from **training crawl** (model corpus). Verify cornerstone URLs are crawlable, validate `Sitemap:` declarations, and recommend or draft selective rules.

**Not this skill:** deploying files, WAF/CDN configuration, server log analysis (note as follow-up), or treating `llms.txt` as a crawl-control mechanism.

**Reference:** [robots.txt audit reference guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/) (public SSOT) · `REFERENCE.md` (handoff + rubric) · **Requirements:** `REQUIREMENTS.md` · **Examples:** `EXAMPLES.md` · **Layperson output:** `LAYPERSON-OUTPUT.md` · **Re-audit:** `RECHECK.md` · **Maintainers:** `AGENTS.md` · **Skill repo:** [GitHub](https://github.com/Roots-and-Fruit/skills/tree/master/marketing/skills/robots-txt-audit)

**SSOT scripts:** `parse-robots-txt.mjs` · `crawler-registry.mjs` · `assess-policy.mjs` · `crawler-registry-cloudflare.mjs` · `content-signals-presets.mjs` · `build-layperson-summary.mjs` · `build-reaudit.mjs` · `audit-gap-registry.mjs` · `reference-links.mjs`

**Cloudflare companion:** `CLOUDFLARE-MANAGED.md` (invoked when managed markers detected — not a separate installable skill)

## Input policy (non-negotiable)

1. **Domain** — e.g. `example.com` (from user only)
2. **Key pages** (optional) — cornerstone or priority URLs to check for crawlability
3. **Crawl policy** (optional) — `max_discovery` | `block_training_allow_answers` | `restrictive` | `audit_only` (default: `audit_only` if missing). **`max_discovery` is an opt-in preset**, not an industry default — use only when the client chooses GEO + training blocks.
4. **`robots_deployment`** (optional) — `auto` | `origin_only` | `cloudflare_managed` (default: `auto`). Use `auto` unless the user overrides.

If domain is missing, ask once:

> *Which domain should I audit for robots.txt? (Optional: key page URLs and crawl policy — max discovery vs audit only.)*

Never infer domain from workspace or examples.

## Modes

| Mode | When | Output emphasis |
|------|------|-----------------|
| **audit** | `robots.txt` found | Rubric R1–R10 + per-bot matrix + sitemap validation |
| **recommend** | Policy gaps vs user `crawl_policy` | Targeted rule changes with rationale |
| **recheck** | User updated file and asks to verify | Before/after delta vs `reports/{domain}-latest-snapshot.json` — see `RECHECK.md` |
| **generate** | File missing or user requests full draft | Complete `draft_robots_txt` + deployment note |

**Completion criterion for mode:** `handoff.mode` matches what you did; `discovery.found` reflects WebFetch result.

## Quick start

1. Confirm **domain**, optional **key_pages**, optional **crawl_policy**.
2. **Step 1** — discover file (`REFERENCE.md` URLs).
3. **Found** → **Step 2** parse + audit using `assess-policy.mjs` (+ **Step 3** recommend if policy mismatch).
4. **Not found** → **Step 4** generate (or audit-only note if user only asked to check existence).
5. **Step 5** — **layperson summary in chat only** (`LAYPERSON-OUTPUT.md`) + write **detail report file**.
6. **Step 6** — emit **handoff JSON** inside the detail report (and optionally stdout for playbooks) — `REFERENCE.md`.

Does not deploy files. Playbooks pass `key_pages`; this skill returns policy assessment and handoff.

## Step 1 — Discover

WebFetch **both** canonical discovery URLs (always — even when the first returns 200):

- `https://{domain}/robots.txt`
- `https://www.{domain}/robots.txt`

Record **both** in `discovery.urls_checked` (apex first, then `www`). Set `discovery.resolved_url` to the URL that returned usable content; prefer apex when both succeed.

**Completion criterion:** `discovery.found` is boolean; `urls_checked` lists both URLs; never claim a file exists without a successful fetch.

**R1 edge cases:** If the response body looks like HTML (`<!DOCTYPE html`, `<html`), treat as **unfetchable** — same practical effect as many 4xx cases (Google may crawl as if no file). Set `audit_checks` R1 to `fail` and include `AF_R1_HTML` in `audit_findings`. Pass `options.discovery.fetch_suspect: true` into `assessRobotsTxtContent()` when detected.

## Step 1b — Cloudflare managed detection gate

After a successful fetch, inspect the edge response **before** treating the file as a single origin-owned document.

**Auto-detect** when **both** markers are present (case-insensitive):

- `# BEGIN Cloudflare Managed content`
- `# END Cloudflare Managed Content`

When detected:

1. Set `deployment.model: "cloudflare_managed"` in handoff.
2. Read **`CLOUDFLARE-MANAGED.md`** in full.
3. Run `assessRobotsTxtContent()` — it splits **cloudflare** / **origin** / **effective** layers via `parseRobotsTxtLayers()`.
4. Populate `layer_assessment`, `recommendations_split`, and `deployment.companion_module` per `REFERENCE.md`.

When markers are absent → `deployment.model: "origin_only"` — continue with the default workflow unchanged.

**Do not** recommend duplicating CF training-bot blocks at origin when the managed layer already blocks them.

## Step 1c — Re-audit (recheck) gate

When the user says they **updated** robots.txt or asks to **check again**:

1. Read **`RECHECK.md`** in full.
2. **Re-fetch** both discovery URLs — never trust prior chat or an old saved body.
3. Load `reports/{domain}-latest-snapshot.json`. If missing, run a normal first audit (baseline) and tell the user the next recheck will compare progress.
4. Run `writeAuditReports(..., { recheck: true })` or `build-layperson-summary.mjs ... --recheck`.
5. Chat output uses **re-check layout** (`LAYPERSON-OUTPUT.md`): progress, before/after table, fixed/still-open, downsides of stopping early — not the full first-audit essay.
6. Save a new snapshot after the run for the next comparison.

## Step 2 — Parse, assess policy, and audit

1. Parse with `scripts/parse-robots-txt.mjs` (`parseRobotsTxtLayers()` when CF managed).
2. Run `assessRobotsTxtContent(content, crawl_policy, domain, options)` from `scripts/assess-policy.mjs`.
3. **WebFetch each declared sitemap URL** and pass results as `options.sitemap_fetch_results` (e.g. `{ url, status }`). This powers **SM7 / R7e** endpoint health checks.
4. Populate handoff: `crawler_matrix`, `sitemap_validation`, and `policy_compliance` (when `crawl_policy` is `max_discovery`).

### Per-bot matrix (detail report only — not in chat)

For each registry token in `REFERENCE.md`, include in the **detail report file**:

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
| **R1 File accessible** | 200 at canonical host with robots.txt body (not HTML error page) |
| **R2 Syntax / structure** | Valid groups; no accidental global `Disallow: /` on search bots |
| **R3 Search crawlers** | `Googlebot`, `bingbot` can reach `/` and cornerstone paths |
| **R4 AI bot differentiation** | Training and answer bots not lumped into one wrong block |
| **R5 Cornerstone crawlability** | Each `key_pages` path allowed for discovery crawlers; `na` when no key_pages |
| **R6 Low-value path hygiene** | `/admin` or `/wp-admin`, `/cart`, `/checkout`, etc. restricted where applicable |
| **R7 Sitemap declaration** | See R7a–R7e below |
| **R8 Google token hygiene** | Training restriction uses `Google-Extended` not `Googlebot` |
| **R9 Wildcard vs specific** | `User-agent: *` rules do not silently block intentional AI allows |
| **R10 CDN caveat** | Note to verify live served file (CDN may override origin) |
| **R11 Content-Signal** | When CF managed: `search=yes`, `ai-train=no` on `User-agent: *`; else `na` |

### R7 — Sitemap declaration (all audits when `Sitemap:` present)

| ID | Check | Pass when |
|----|-------|-----------|
| **R7a** | Present | At least one `Sitemap:` line |
| **R7b** | Absolute URL | Each value is full `https://` URL (not relative) |
| **R7c** | Host match | Sitemap host is `{domain}` or `www.{domain}` (warn if off-host — Google allows off-host sitemaps) |
| **R7d** | Sitemap shape | Path contains `sitemap` or ends in `.xml` (warn if unusual) |
| **R7e** | Sitemap endpoint fetch | WebFetch each declared URL; warn on HTTP 4xx/5xx (**SM7**) |

Use `validateSitemaps()` from `assess-policy.mjs` with `sitemap_fetch_results`. Populate `sitemap_validation` in handoff including `endpoint_fetch[]`.

**R7 overall:** `pass` when declaration checks pass and endpoint fetch succeeds; `warn` when declaration passes but SM4/SM7 fires; `fail` when SM1–SM2 fail (SM4 off-host alone is **warn**, not fail).

### audit_only severity (when `policy_compliance` is null)

Populate `audit_findings[]` from `buildAuditFindings()` / `assessment.audit_findings`:

| Tier | When | Examples |
|------|------|----------|
| **fail** | Clear crawl/indexing risk | R1 HTML-as-200, reversed Google/OpenAI pairing |
| **warn** | Informational gap or hygiene | Inherited training-bot allow, SM7 sitemap 5xx, off-host SM4 |
| **info** | Document only | Reserved for future low-priority notes |

Do **not** fail `audit_only` audits solely because training bots inherit `User-agent: *` allow.

### max_discovery compliance

When `crawl_policy` is `max_discovery`, run `assessMaxDiscovery()` / `assessMaxDiscoveryLayered()` — populate `policy_compliance` in handoff:

- `compliant: true` only when all MD checks pass **and** sitemap validation passes
- List each violation with token, expected, actual, path, message, and **`layer`** (`cloudflare` · `origin` · `effective`) when `deployment.model` is `cloudflare_managed`

**Completion criterion:** every rubric row in `audit_checks[]`; `policy_compliance` when policy is `max_discovery`.

## Step 3 — Recommend

When live policy conflicts with `crawl_policy`, output **before/after snippets** per bot or path. Use `REFERENCE.md` templates.

When `deployment.model` is `cloudflare_managed`, use **`recommendations_split`** (dashboard vs origin vs enforcement) from `CLOUDFLARE-MANAGED.md` — do not tell the user to rewrite training blocks CF already maintains.

When `crawl_policy` is `max_discovery` and CF managed is detected, include **`origin_append_template`** and **`content_signals`** in the **detail report** and handoff — not as a long fenced block in chat.

Common fixes (translate to layperson steps in chat; technical snippets go in detail file):

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

## Step 5 — Layperson summary (chat) + detail report (file)

**Read `LAYPERSON-OUTPUT.md` in full.** The user-facing response is **only** a quick plain-language summary.

### Chat structure (required)

```markdown
# robots.txt check — {domain}

## Verdict
{Pass or not quite there yet — then bullet list of EXACTLY what is missing, lay terms}

## What's working
- {short bullets}

## What still needs attention
- {same missing items, or "Nothing flagged"}

## What to do next
1. **{Who}** — {action}
2. ...

## Changes
- {imperative bullets}

## Copy-paste: your updated robots.txt
{paste note}
```text
{full recommended robots.txt}
```

Technical details: {path to detail report file}
```

**Forbidden in chat:** per-bot matrix, rubric tables, handoff JSON, violation IDs (`MD_*`).

**Required in chat when fixes needed:** `## Changes` bullets + (if CF managed) `## How to update (Cloudflare-managed)` + **origin-only** copy-paste from `recommendedRobotsPasteText()` — never the merged edge file in chat.

### Detail report file (required)

After `assessRobotsTxtContent()`:

1. Run `writeAuditReports(domain, robotsContent, crawl_policy, { fetchedUrls })` from `scripts/build-layperson-summary.mjs`, **or** write `reports/{domain}-{YYYY-MM-DD}-detail.md` with the same sections.
2. Include: fetched robots.txt, layer assessment, crawler matrix, sitemap validation, audit findings, recommendations_split, origin_append_template, handoff JSON.
3. Link the file path once at the bottom of the chat summary.

Default path: `marketing/skills/robots-txt-audit/reports/{domain}-{date}-detail.md` (or client workspace `reports/` when auditing in a client folder).

### Tone

Plain English. No jargon without a one-line explanation. Frame limits honestly: robots.txt is a polite request to crawlers — not a guarantee of Google ranking, AI citations, or security. On **first audit**, link each gap to the [public reference guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/) via `reference-links.mjs`. Close with `buildLearnMoreFooter()` (article + [Roots & Fruit consulting](https://rootsandfruit.com)).

**Generate mode chat:** short verdict + publish steps + link to detail file containing full draft.

## Step 6 — Handoff JSON

Emit v1.0 per `REFERENCE.md` **inside the detail report file** (section `## Handoff JSON`). Playbooks may read that file or a separate `.json` export if the operator saves one.

**`crawler_matrix` is machine data, not prose.** Copy the full array from `assessRobotsTxtContent()` → `assessment.crawler_matrix` (same rows as the human per-bot table). Each object needs `token`, `roles`, `rule_source`, `indexing_crawl`, `training_crawl`, `max_discovery_expectation`, etc.

**Forbidden in handoff JSON:**

```json
"crawler_matrix": "[see per-bot table above]"
```

That placeholder fails **G26** and breaks downstream playbooks. If the human table exists but `crawler_matrix` is missing or a string, the handoff is incomplete.

## Done definition

- [ ] Domain from user; **both** apex and `www` discovery URLs in `urls_checked` (G27)
- [ ] Mode matches audit / recommend / generate path
- [ ] Recheck requests → `RECHECK.md` followed; fresh fetch; delta vs `reports/{domain}-latest-snapshot.json`
- [ ] First audit with fixes → **Changes** + **copy-paste robots.txt** in chat; snapshot saved to `reports/{domain}-latest-snapshot.json`
- [ ] Verdict lists **only required** gaps; optional items under _Optional_ in “What still needs attention”
- [ ] Detail report file written under `reports/{domain}-{date}-detail.md` with matrix + handoff JSON
- [ ] Per-bot matrix in **detail file** and full `crawler_matrix` **array** in handoff (never a string placeholder)
- [ ] R7a–R7e reflected in `sitemap_validation`, `endpoint_fetch`, and `audit_checks`
- [ ] No key_pages → `fully_crawlable: null`, R5 `na`
- [ ] `max_discovery` → `policy_compliance.compliant` matches `assessMaxDiscovery()` output
- [ ] Cloudflare managed → read `CLOUDFLARE-MANAGED.md`; `layer_assessment` + `recommendations_split` (G28–G30)
- [ ] Cloudflare managed + `max_discovery` → `origin_append_template` + `content_signals` in handoff (G33)
- [ ] `generate` draft passes P-layer when policy is `max_discovery`
- [ ] `deployment_note` present; no deployment performed

**Ship bar (Tier C):**

```bash
cd marketing/skills/robots-txt-audit
node scripts/verify-robots-structure.mjs
node scripts/verify-max-discovery.mjs
node scripts/verify-max-discovery-contract.mjs
node scripts/verify-handoff.mjs
node scripts/verify-v1_3-changes.mjs
node scripts/verify-cloudflare-layers.mjs
node scripts/verify-layperson-summary.mjs
node scripts/verify-reaudit.mjs
node scripts/verify-reference-links.mjs
```

## Pairs with

- [Site Content Catalog](../site-content-catalog/) — sitemap cross-check when catalog handoff available
- [Cornerstone Content Audit](../playbooks/cornerstone-content-audit/) — Phase 5h
