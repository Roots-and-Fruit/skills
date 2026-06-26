# robots.txt Audit — Reference

Crawler registry SSOT (`scripts/crawler-registry.mjs`), policy assessment (`scripts/assess-policy.mjs`), audit rubric, handoff schema **v1.0**, and crawlability rules.

## What robots.txt controls

Plain text at the domain root (e.g. `https://example.com/robots.txt`) that tells **compliant crawlers** which URL paths they may **request** ([RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309)).

| robots.txt does | robots.txt does not |
|-----------------|---------------------|
| Allow or block **crawling** per user-agent | Guarantee **indexing** (use `noindex` meta/header) |
| Separate **training** vs **discovery** bots | Secure private content |
| Point crawlers to sitemaps via `Sitemap:` | Remove content already collected |
| Restrict low-value paths | Guarantee AI citations |

**Crawl ≠ index:** A crawler must be allowed to fetch a URL to read a `noindex` tag. Blocking in robots.txt can prevent deindexing signals from being seen.

Also check `https://www.{domain}/robots.txt` when bare domain fails.

**SSOT parser:** `scripts/parse-robots-txt.mjs`  
**SSOT registry:** `scripts/crawler-registry.mjs`  
**SSOT policy tests:** `scripts/assess-policy.mjs` · regression: `scripts/verify-max-discovery.mjs` + `scripts/verify-max-discovery-contract.mjs`

## Training vs indexing crawl (per bot)

Optimize robots.txt **per user-agent**, not as one “AI” bucket. Each token may govern one or both postures:

| Posture | What it means | robots.txt lever |
|---------|---------------|------------------|
| **Indexing / answer crawl** | Bot fetches pages for search results or AI answer retrieval/citation | `Allow` / `Disallow` paths for that token |
| **Training crawl** | Bot fetches pages for model training or corpus building | Separate token (e.g. `GPTBot`, `Google-Extended`) |

### Decision matrix (common tokens)

| Token | Indexing / answer crawl | Training crawl | Do not confuse with |
|-------|-------------------------|----------------|---------------------|
| `Googlebot` | **Allow** for public SEO pages | n/a (use `Google-Extended` for training) | `Google-Extended` |
| `Google-Extended` | n/a (robots.txt token only) | **Block** if training reuse unwanted | `Googlebot` |
| `bingbot` | **Allow** for Bing indexing | n/a | — |
| `OAI-SearchBot` | **Allow** for ChatGPT search/citation | n/a | `GPTBot` |
| `GPTBot` | n/a | **Block** if training reuse unwanted | `OAI-SearchBot` |
| `PerplexityBot` | **Allow** for Perplexity discovery | n/a | `Perplexity-User` |
| `CCBot` | n/a | **Block** if Common Crawl inclusion unwanted | — |
| `Applebot` | **Allow** for Apple search/assistant | n/a | `Applebot-Extended` |
| `Applebot-Extended` | n/a | **Block** if Apple FM training unwanted | `Applebot` |
| `ChatGPT-User` | User-triggered fetch | n/a | May not respect robots like crawlers |
| `Perplexity-User` | User-triggered fetch | n/a | May not respect robots like crawlers |

**How to optimize per crawler:**

1. List which bots matter for **search indexing**, **AI answers**, and **training**.
2. Add a **dedicated `User-agent` group** per token you need to control (do not rely on `*` alone when AI rules differ).
3. Use `Disallow: /` only on **training** tokens when blocking training site-wide.
4. Use explicit `Allow: /` on **answer/search** tokens when wildcard rules are complex.
5. Never block `Googlebot` when the goal is only to limit **Google generative training** — use `Google-Extended`.

Full registry: `scripts/crawler-registry.mjs` (verify against provider docs before production).

**Discovery crawlers for R5 cornerstone checks:** `Googlebot`, `OAI-SearchBot`, `PerplexityBot`

## Crawl policy presets

| `crawl_policy` | Intent |
|----------------|--------|
| `max_discovery` | Allow search + answer bots; block common training bots; restrict admin/cart/checkout; **valid sitemap required** |
| `block_training_allow_answers` | Same operational rules as max_discovery |
| `restrictive` | Block training bots; document tradeoff on AI citations |
| `audit_only` | Report current state; recommend only on clear risks — **no** max_discovery compliance gate |

## max_discovery compliance (P-layer)

`assessMaxDiscovery()` checks (automated in `verify-max-discovery.mjs` and `verify-max-discovery-contract.mjs`):

| ID | Requirement |
|----|-------------|
| MD_GPTBot | `GPTBot` blocked at `/` |
| MD_Google_Extended | `Google-Extended` blocked at `/` |
| MD_CCBot | `CCBot` blocked at `/` |
| MD_OAI_SearchBot | `OAI-SearchBot` allowed at `/` |
| MD_PerplexityBot | `PerplexityBot` allowed at `/` |
| MD_Googlebot | `Googlebot` allowed at `/` |
| MD_bingbot | `bingbot` allowed at `/` |
| MD_GOOGLE_PAIRING | Not: Googlebot blocked + Google-Extended allowed |
| MD_OPENAI_PAIRING | Not: OAI-SearchBot blocked + GPTBot allowed |
| MD_PATH_* | `*` blocks `/admin/`, `/cart/`, `/checkout/` |
| MD_SITEMAP_PRESENT | At least one `Sitemap:` line |
| MD_SITEMAP_VALID | Sitemap passes `validateSitemaps()` |

## Sitemap declaration rules (R7)

`validateSitemaps(sitemaps, domain)` in `assess-policy.mjs`:

| ID | Rule |
|----|------|
| SM1 | At least one `Sitemap:` directive |
| SM2 | Each URL is absolute `http(s)://` |
| SM3 | Prefer `https://` (warn on `http://`) |
| SM4 | Host matches `{domain}` or `www.{domain}` |
| SM5 | Path contains `sitemap` or ends in `.xml` (warn if unusual) |
| SM6 | Optional: expected URL from user/catalog not declared (warn) |
| SM7 | WebFetch declared URL; warn on HTTP 4xx/5xx |

Populate `endpoint_fetch[]` in handoff: `{ url, status, ok }` per declared sitemap.

**Canonical form:**

```text
Sitemap: https://example.com/sitemap.xml
```

For large or multilingual sites, a sitemap index is valid:

```text
Sitemap: https://example.com/sitemap_index.xml
```

Do not list sitemap URLs that point at another domain. Do not use relative paths (`Sitemap: /sitemap.xml` → fail SM2).

## Policy template — max_discovery

Replace `example.com` with live domain. Test before publishing.

```text
# Allow search and AI answer crawlers; block common training crawlers
# Policy: max_discovery

User-agent: GPTBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Googlebot
Allow: /

User-agent: bingbot
Allow: /

User-agent: *
Disallow: /admin/
Disallow: /cart/
Disallow: /checkout/
Allow: /

Sitemap: https://example.com/sitemap.xml
```

## Audit rubric (R-layer)

Emit one row per check in `audit_checks[]`:

| ID | Check | Pass when | Fail when |
|----|-------|-----------|-----------|
| R1 | File accessible | 200 at canonical host | Missing or unreachable |
| R2 | Syntax / structure | Parseable groups; no duplicate catastrophic blocks | Broken groups or `Disallow: /` on wrong agent |
| R3 | Search crawlers | `Googlebot`, `bingbot` reach `/` and key paths | Site-wide block on search bots |
| R4 | AI bot differentiation | Training vs answer bots handled distinctly | Single blunt AI block or contradictory rules |
| R5 | Cornerstone crawlability | All `key_pages` allowed for discovery crawlers | Any cornerstone blocked — list in `crawlability` |
| R6 | Low-value path hygiene | Admin/cart/checkout restricted for `*` where applicable | Obvious noise paths wide open (warn if N/A) |
| R7 | Sitemap declaration | R7a–R7d pass via `validateSitemaps()` | Missing, relative, or wrong-host sitemap |
| R7a | Sitemap present | ≥1 `Sitemap:` line | SM1 fail |
| R7b | Absolute URL | Full `https://` URL | SM2 fail |
| R7c | Host match | Host is site domain | SM4 fail |
| R7d | Sitemap shape | `.xml` or `sitemap` in path | SM5 warn |
| R7e | Sitemap endpoint fetch | WebFetch returns 2xx | SM7 warn on 4xx/5xx |
| R8 | Google token hygiene | Training restriction uses `Google-Extended` | `Googlebot` blocked when only generative training was intended |
| R9 | Wildcard vs specific | Explicit AI allows not overridden by `*` | Answer bots blocked by catch-all |
| R10 | CDN caveat | Note to verify live public file | `na` if user confirmed CDN |

**Status values:** `pass` · `fail` · `warn` · `na`

### Crawlability math

Use `assessCrawlability(groups, key_pages, discoveryCrawlers)` from parser:

```
fully_crawlable = key_pages.length - blocked_key_pages.length
```

Populate `crawler_rules[]` with effective access per major token.

### policy_summary values

Use: `allowed` · `blocked` · `mixed` · `ambiguous`

## Generate mode

When file not found:

1. Pick template from `crawl_policy`
2. Set `mode: "generate"`, `discovery.found: false`, full `draft_robots_txt`
3. Note in `limitations[]` that user-agent list must be re-verified at deploy time

**No key pages:** still generate policy template; R5 → `na` or `warn`.

## Handoff schema v1.0

```json
{
  "handoff_version": "1.0",
  "skill": "robots-txt-audit",
  "skill_version": "1.2.0",
  "mode": "audit",
  "inputs": {
    "domain": "example.com",
    "key_pages": ["https://example.com/pricing"],
    "crawl_policy": "max_discovery"
  },
  "discovery": {
    "found": true,
    "urls_checked": [
      "https://example.com/robots.txt",
      "https://www.example.com/robots.txt"
    ],
    "resolved_url": "https://example.com/robots.txt"
  },
  "parsed": {
    "group_count": 8,
    "rule_count": 12,
    "user_agent_tokens": ["Googlebot", "GPTBot", "*"],
    "sitemap_directives": ["https://example.com/sitemap.xml"]
  },
  "policy_summary": {
    "search_bots": "allowed",
    "ai_answer_bots": "allowed",
    "ai_training_bots": "blocked"
  },
  "crawlability": {
    "key_pages_provided": 1,
    "fully_crawlable": 1,
    "blocked_key_pages": []
  },
  "crawler_matrix": [],
  "crawler_rules": [
    {
      "user_agent": "GPTBot",
      "effective_access": "blocked",
      "rules": ["Disallow: /"]
    }
  ],
  "audit_checks": [
    { "id": "R1", "name": "File accessible", "status": "pass", "note": "" }
  ],
  "sitemap_validation": {
    "present": true,
    "urls": ["https://example.com/sitemap.xml"],
    "valid_urls": ["https://example.com/sitemap.xml"],
    "host_match": true,
    "absolute_urls": true,
    "status": "pass",
    "issues": [],
    "endpoint_fetch": [{ "url": "https://example.com/sitemap.xml", "status": 200, "ok": true }]
  },
  "policy_compliance": {
    "policy": "max_discovery",
    "compliant": true,
    "violations": []
  },
  "draft_robots_txt": null,
  "deployment_note": "Place at https://example.com/robots.txt",
  "limitations": []
}
```

| Field | Rules |
|-------|--------|
| `mode` | `audit` · `recommend` · `generate` |
| `draft_robots_txt` | `null` on audit-only; required string on `generate` |
| `parsed.*` | Fill from `parseRobotsTxt()` on live file or draft |
| `crawler_matrix` | Required when `discovery.found` and mode is `audit` or `recommend` — full JSON array from `buildCrawlerMatrix()` / `assessRobotsTxtContent()`. **Never** a string pointer to the human table (fails G26). |
| `crawlability.fully_crawlable` | `null` when `key_pages_provided` is 0; otherwise non-negative integer |
| `sitemap_validation` | Required when `discovery.found`; include `endpoint_fetch[]` after WebFetch |
| `policy_compliance` | Required when `crawl_policy` is `max_discovery` — from `assessMaxDiscovery()` |
| `discovery.urls_checked` | Always both `https://{domain}/robots.txt` and `https://www.{domain}/robots.txt` (apex first) — fails **G27** if either is missing |
| `limitations[]` | CDN unverified, stale crawler registry, no catalog for sitemap cross-check |

## Post-deploy verification (human)

1. Fetch live `https://{domain}/robots.txt` from public URL (not only origin)
2. Google Search Console robots tester or Bing equivalent
3. Monitor server logs 48h for unexpected blocks on cornerstone paths
4. Keep rollback copy of previous file
