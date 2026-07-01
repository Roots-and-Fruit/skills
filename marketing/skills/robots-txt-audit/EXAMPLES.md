# robots.txt Audit — Examples

## Example prompts

- *"Audit **robots.txt** for **example.com** — max discovery"*
- *"Check Cloudflare managed **robots.txt** for **example.com**"*
- *"Can AI crawlers reach our cornerstone pages on **example.com**?"*
- *"Check if we're blocking **GPTBot** but allowing **OAI-SearchBot** on **example.com**"*
- *"Generate **robots.txt** for **example.com** — max discovery policy, key pages: [urls]"*

---

## Sample layperson chat output (v1.4.2+)

**User sees only this in chat.** Bot tables, handoff JSON, and robots.txt copy go to `reports/{domain}-{date}-detail.md`.

```markdown
# robots.txt check — example.com

## Verdict

**Not quite there yet.** Missing:

• No sitemap URL in robots.txt (search engines use this to find your pages)
• Admin area (/wp-admin/) not blocked from crawlers
• Cart pages not blocked from crawlers

## What's working

- robots.txt file is online and readable
- Cloudflare is managing AI training blocks for you (GPTBot, Google-Extended, etc.)
- Major AI training crawlers are blocked
- Search and AI answer crawlers are not accidentally blocked

## What still needs attention

- No sitemap URL in robots.txt (search engines use this to find your pages)
- Admin area (/wp-admin/) not blocked from crawlers
- Cart pages not blocked from crawlers

## What to do next

1. **You (Cloudflare dashboard)** — Leave “Instruct AI bot traffic with robots.txt” turned ON…
2. **You (website host / origin robots.txt)** — Paste the origin robots.txt block from the detail report…
3. **You (verification)** — Open https://example.com/robots.txt in a private browser window…

---

Technical details (bot-by-bot tables, rubric scores, handoff JSON, robots.txt copy): **reports/example.com-2026-07-01-detail.md**
```

See `LAYPERSON-OUTPUT.md` for the full contract.

---

## Sample audit summary (legacy technical format — detail file only)

## robots.txt Audit — example.com — 2026-06-26

**Status:** Found at https://example.com/robots.txt  
**Policy:** max_discovery (requested)

| Check | Status | Note |
|-------|--------|------|
| R3 Search crawlers | pass | Googlebot and bingbot reach `/` |
| R4 AI differentiation | pass | GPTBot blocked; OAI-SearchBot allowed |
| R5 Cornerstone crawlability | pass | All 3 key pages crawlable |
| R7 Sitemap directive | pass | Points to sitemap.xml |
| R10 CDN caveat | warn | Verify live file after Cloudflare changes |

**Cornerstone crawlability**

| URL | Googlebot | OAI-SearchBot | PerplexityBot |
|-----|-----------|---------------|---------------|
| /pricing | allowed | allowed | allowed |
| /guides/enterprise-sso | allowed | allowed | allowed |

---

## Fixtures

| File | Purpose |
|------|---------|
| `example-good.robots.txt.fixture.txt` | Golden robots.txt for S-layer |
| `example-audit.handoff.fixture.json` | Audit handoff G-layer |
| `example-recommend.handoff.fixture.json` | Recommend mode handoff |
| `example-generate.handoff.fixture.json` | Generate mode with `draft_robots_txt` |

See `examples/SCORECARD-example-saas.md` for regression IDs (S, P, G layers).

## max_discovery negative fixtures

| File | Purpose |
|------|---------|
| `example-bad-max-discovery.robots.txt.fixture.txt` | Reversed Google/OpenAI pairing, no sitemap |
| `example-audit-only.handoff.fixture.json` | `audit_only`, no key_pages, SM7 warn on sitemap 500 |
| `example-max-discovery-recommend.handoff.fixture.json` | WP open file + `max_discovery` + `recommend` — canonical `crawler_matrix` shape |
| `example-cloudflare-managed-origin-append.robots.txt.fixture.txt` | CF managed prepend + origin append (fictional `example.com`) |
| `example-cloudflare-managed-origin-append.handoff.fixture.json` | CF `recommend` handoff with `layer_assessment`, `origin_append_template`, `content_signals` |

## Handoff anti-patterns

| Bad | Why |
|-----|-----|
| `"crawler_matrix": "[see table above]"` | Fails **G26** — must be the full array from `assessRobotsTxtContent()` |
| Human per-bot table only, no `crawler_matrix` in JSON | Fails **G18** / **G26** — playbooks need machine-readable matrix |
| `crawl_policy: "audit_only"` when user asked for `max_discovery` | Skips `policy_compliance` gate (G21–G24) |
| `urls_checked` with only apex or only `www` | Fails **G27** — always fetch and record both canonical discovery URLs |
