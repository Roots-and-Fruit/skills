# Re-audit (recheck) flow

**Trigger:** User says they updated robots.txt, asks to “check again,” “verify,” or “re-run the audit.”

## Non-negotiables

1. **Fresh fetch** — Re-download `https://{domain}/robots.txt` and `https://www.{domain}/robots.txt`. Never reuse prior chat assessment or an old saved robots.txt body.
2. **Load prior snapshot** — Read `reports/{domain}-latest-snapshot.json` from the last audit on this domain (same `crawl_policy` if known). If missing, run a normal first audit and save the snapshot; tell the user this is the baseline for next time.
3. **Compare before/after** — Use `compareGapSnapshots()` / `--recheck` on `build-layperson-summary.mjs`. Track **required** gaps only in the verdict; optional gaps in a separate section.
4. **Cloudflare lag** — If the user just published and nothing changed, say edge merge may take a few minutes; suggest private-window recheck.
5. **Update snapshot** — After every run (first audit or recheck), write a new `reports/{domain}-latest-snapshot.json` for the next comparison.

## Chat output (recheck mode)

Use **re-check** layout from `LAYPERSON-OUTPUT.md` — not the full first-audit template.

Lead with:

- **Progress since last check** — encouragement tied to how many required items were fixed
- **Before/after table** — narrow rows (`Sitemap listed`, `Admin blocked`, etc.)
- **Fixed — nice work** — only items that moved from ❌ to ✅
- **Still to do** — each with _Why it matters:_ one-line downside
- **If you stop here** — combined risk of leaving remaining required gaps open
- **What to do next** — shortened (skip repeating Cloudflare dashboard lecture)
- **Copy-paste block** — only if required gaps remain

**Footer:** Include `buildLearnMoreFooter()` (article + [Roots & Fruit consulting](https://rootsandfruit.com)). Do **not** repeat per-gap `[Why this matters]` article links on recheck — downsides stay inline in **Still to do**.

Do **not** re-dump the full “What’s working” essay unless something regressed (new required gap).

## SSOT commands

```bash
# First audit (writes snapshot + detail report)
node scripts/build-layperson-summary.mjs path/to/fetched.robots.txt max_discovery example.com

# Re-check after user updates (loads prior snapshot, delta output)
node scripts/build-layperson-summary.mjs path/to/fetched.robots.txt max_discovery example.com reports --recheck
```

## Regression

```bash
node scripts/verify-reaudit.mjs
```
