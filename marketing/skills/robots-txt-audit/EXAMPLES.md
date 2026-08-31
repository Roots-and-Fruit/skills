# robots.txt Audit — Examples

## Example prompts

- *"Audit **robots.txt** for **example.com** — max discovery"*
- *"Check Cloudflare managed **robots.txt** for **example.com**"*
- *"Can AI crawlers reach our cornerstone pages on **example.com**?"*
- *"Does **robots.txt** block **llms.txt** on **example.com**?"*
- *"Check if we're blocking **GPTBot** but allowing **OAI-SearchBot** on **example.com**"*
- *"Generate **robots.txt** for **example.com** — max discovery policy, key pages: [urls]"*

---

## Sample layperson chat output (v1.8.0+)

**User sees only this in chat.** Bot tables, handoff JSON, and robots.txt copy go to `reports/{domain}-{date}-detail.md`. Each gap links to the [public reference guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/).

**Policy:** `max_discovery` + Cloudflare-managed. Training blocks at the edge are noted as **optional** — not a max-discovery requirement.

```markdown
# robots.txt check — example.com

## Verdict

**Not quite there yet.** Missing:

• No sitemap URL in robots.txt (search engines use this to find your pages) — [Why this matters](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#sitemap-declaration)
• Admin area (/wp-admin/) not blocked from crawlers — [Why this matters](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#path-hygiene)

## What's working

- robots.txt file is online and readable
- Cloudflare prepends managed AI bot rules at the edge (you still edit a small origin file)
- Cloudflare's edge layer also blocks some AI training crawlers (optional — not required for max discovery)
- Google, Bing, and AI answer bots can reach your public pages

## What still needs attention

- No sitemap URL in robots.txt (search engines use this to find your pages) — [Why this matters](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#sitemap-declaration)
- Admin area (/wp-admin/) not blocked from crawlers — [Why this matters](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#path-hygiene)

_Optional:_
- AI “answer” permission (ai-input signal) not declared at origin — optional for GEO alignment — [Why this matters](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#content-signal-alignment)

## What to do next

1. **Cloudflare + your host** — See **How to update (Cloudflare-managed)** below — dashboard toggle stays ON; edit the small origin file via SFTP/host (not the public merged file).
2. **You (website host / origin robots.txt)** — Paste the **origin-only** block below into your server file (SFTP/host).
3. **You (verification)** — Open https://example.com/robots.txt in a private window — you should see Cloudflare’s block, then your origin rules after END Cloudflare Managed Content.

---

Technical details (bot-by-bot tables, rubric scores, handoff JSON, robots.txt copy): **reports/example.com-2026-07-01-detail.md**

**Learn more:** [robots.txt audit reference guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/)
**Industry context (mid-2026):** [What AI crawlers want](https://technologychecker.io/blog/ai-crawler-statistics) · [Who gets blocked in robots.txt](https://technologychecker.io/blog/robots-txt-ai-crawlers-blocking-report)
**Need a hand?** [Growth marketing consulting](https://rootsandfruit.com) — Roots & Fruit helps WordPress and SaaS teams with crawl policy, GEO, and content operations.
```

For `block_training_allow_answers`, “AI training crawlers are blocked” may appear under **What's working** when the file or Cloudflare edge satisfies that policy.

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
| `example-good.robots.txt.fixture.txt` | Golden max_discovery robots.txt (discovery-only) |
| `example-good-block-training.robots.txt.fixture.txt` | Golden block_training_allow_answers robots.txt |
| `example-good-restrictive.robots.txt.fixture.txt` | Golden restrictive robots.txt (search only) |
| `example-audit.handoff.fixture.json` | Audit handoff G-layer |
| `example-recommend.handoff.fixture.json` | Recommend mode handoff |
| `example-generate.handoff.fixture.json` | Generate mode with `draft_robots_txt` |

See `examples/SCORECARD-example-saas.md` for regression IDs (S, P, G layers).

## max_discovery negative fixtures

| File | Purpose |
|------|---------|
| `example-bad-max-discovery.robots.txt.fixture.txt` | Reversed Google/OpenAI pairing, no sitemap |
| `example-audit-only.handoff.fixture.json` | `audit_only`, no key_pages, SM7 warn on sitemap 500 |
| `example-max-discovery-recommend.handoff.fixture.json` | WP open + `max_discovery` + `audit` when compliant — canonical `crawler_matrix` shape; SM7 warn drives hygiene note |
| `example-cloudflare-managed-origin-append.robots.txt.fixture.txt` | CF managed prepend + origin append (fictional `example.com`) |
| `example-cloudflare-managed-origin-append.handoff.fixture.json` | CF `recommend` handoff with `layer_assessment`, `origin_append_template`, `content_signals` |
| `example-llms-blocked.robots.txt.fixture.txt` | `*` Disallow `/llms.txt` while discovery crawlers remain allowed at `/` |
| `example-llms-as-sitemap.robots.txt.fixture.txt` | `Sitemap:` points at `/llms.txt` instead of XML |

## Handoff anti-patterns

| Bad | Why |
|-----|-----|
| `"crawler_matrix": "[see table above]"` | Fails **G26** — must be the full array from `assessRobotsTxtContent()` |
| Human per-bot table only, no `crawler_matrix` in JSON | Fails **G18** / **G26** — playbooks need machine-readable matrix |
| `crawl_policy: "audit_only"` when user asked for `max_discovery` | Skips `policy_compliance` gate (G21–G24) |
| `urls_checked` with only apex or only `www` | Fails **G27** — always fetch and record both canonical discovery URLs |
