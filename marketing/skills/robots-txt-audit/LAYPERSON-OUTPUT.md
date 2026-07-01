# Layperson output contract

**Mandatory for every user-facing audit response.** Technical collectors and playbook consumers still use handoff JSON — but that lives in the **detail report file**, not in chat.

## What the user sees in chat (only this)

1. **Verdict** — One line pass/fail, then a **bullet list of exactly what is missing** (plain language). No bot names unless unavoidable; prefer outcomes (“sitemap not listed”, “admin area not blocked”).
2. **What's working** — Short bullets, non-technical.
3. **What still needs attention** — Same as missing list if not compliant; “Nothing flagged” if compliant.
4. **What to do next** — Numbered steps: who acts (Cloudflare dashboard vs your robots.txt file vs optional enforcement) and what to do.
5. **Changes** — Short bullet list of what to add or keep (when fixes are needed).
6. **Copy-paste block** — **Origin-only** file for SFTP/host when Cloudflare-managed; full file when not. Preceded by **How to update (Cloudflare-managed)** (3 bullets) when CF detected.
7. **One link** to the local detail report file.

**Do not include in chat:** per-bot matrix tables, rubric R1–R11, handoff JSON, or other long technical appendices (those stay in the detail file).

## Detail report file (local)

After Step 2 assessment, write **`reports/{domain}-{YYYY-MM-DD}-detail.md`** (create `reports/` under the skill folder, or client workspace if the user scoped a client path).

Use `scripts/build-layperson-summary.mjs` → `writeAuditReports()` or assemble the same sections manually.

The detail file contains:

- Fetched robots.txt body
- Layer assessment, policy compliance, crawler matrix
- Sitemap validation, audit findings
- `recommendations_split`, `origin_append_template`, `content_signals`
- Full handoff JSON for playbooks

In chat, link with a relative or absolute path: `marketing/skills/robots-txt-audit/reports/example.com-2026-07-01-detail.md`

## SSOT script

```bash
node scripts/build-layperson-summary.mjs path/to/robots.txt max_discovery example.com
```

`writeAuditReports()` uses `buildCloudflareUpdateGuidance()` + `recommendedRobotsPasteText()` — chat shows **origin-only** for CF; merged edge file stays in the detail report.

### Cloudflare-managed (succinct — required when `deployment.model` is `cloudflare_managed`)

```markdown
## How to update (Cloudflare-managed)
- **Dashboard** — Keep “Instruct AI bot traffic with robots.txt” ON …
- **SFTP / host** — Tiny origin file is normal …
- **Verify** — Private window on live URL …

## Copy-paste: origin robots.txt (your server file)
{origin-only block — not the merged public file}
```

Detail report may include the **merged edge preview** for verification; do not put that merged file in chat.

## Layperson phrasing guide

| Technical | Say instead |
|-----------|-------------|
| GPTBot / Google-Extended blocked | AI training crawlers are blocked |
| OAI-SearchBot allowed | AI answer/search bots can read your pages |
| MD_SITEMAP_PRESENT | No sitemap URL in robots.txt |
| origin layer | The part of robots.txt you edit on your server (below Cloudflare’s section) |
| Content-Signal ai-input=yes | Declared permission for AI answer tools to use your content |
| policy_compliance.compliant false | Doesn’t fully match your max discovery goal yet |
| inherits_user_agent_star | Uses the general “all crawlers” rule |

## Generate mode

Chat: what the draft is for, numbered steps to publish, link to detail file with full `draft_robots_txt` and handoff.

## Re-audit (recheck) mode

When the user updated robots.txt or asks to verify again. **Read `RECHECK.md`.**

### Chat structure (recheck — replaces first-audit template)

```markdown
# robots.txt re-check — {domain}

## Progress since last check
{encouragement — fixed N of M, almost there, or CF cache note}

| Item | Last check | Now |
|------|------------|-----|
| Sitemap listed | ❌ | ✅ |
...

## Fixed — nice work
- ✅ {short labels}

## Still to do
- {gap}
  - _Why it matters:_ {one-line downside}

## If you stop here
{bulleted risks for remaining required gaps}

## What to do next
{shortened steps — skip CF dashboard repeat}

## Remaining changes + copy-paste block
{only if required gaps remain}
```

**Skip on recheck unless something regressed:** full “What’s working” list, per-bot matrix, handoff JSON in chat.

Snapshots: `reports/{domain}-latest-snapshot.json` (written after every audit).
