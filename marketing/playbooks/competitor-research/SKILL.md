---
name: Competitor-Research-to-Positioning
type: playbook
description: >
  Use when you need evidence-backed competitor research and positioning — full-set
  competitive alternatives, battlecards, anti-positioning, or a signed positioning
  statement. Use for "who do we compete with", competitor evidence packs, pricing and
  sentiment lenses, or "run a full set competitor analysis for example.com". Not for
  SEO hub/spoke recovery or channel planning before positioning is signed.
version: 1.0.0
---

# Competitor Research → Positioning

**Purpose:** Same *process* every engagement: frame → set → evidence → lenses → statement. Not a one-shot AI summary of brands you already dislike.

**Packaging:** Tier **B** playbook. Phases are **inline** in this file (no child skills yet). Templates: [`templates/`](templates/) · rubrics & lens prompts: [`REFERENCE.md`](REFERENCE.md) · sample prompts: [`EXAMPLES.md`](EXAMPLES.md) · data/tools: [`REQUIREMENTS.md`](REQUIREMENTS.md).

**Not this playbook:** SEO hub/spoke recovery, site content catalog alone, SERP information-gain scoring, or distribution/channel planning before a signed positioning file exists.


**Tooling this stab (allowed capture backends):**

| Backend | Use for | Notes |
| --- | --- | --- |
| **headed_browser** | Default after any 403/challenge; interactive pricing | `playwright-cli` and/or Chrome DevTools MCP |
| **http_ua** | Soft docs, WP.org, help centers | Desktop User-Agent fetch |
| **webfetch** | Soft targets only | Do **not** retry the same host after 403 in one run |
| **cloud_browser** | Optional batch (e.g. Cloudflare Browser Run) | Never assume it beats bot walls; “well-behaved bot” mode may still block |
| **notebooklm** | Optional Phase 3 volume | If user already uses NotebookLM |

**Hard ban:** inventing pricing, feature lists, or review quotes from model memory when capture failed. **No Crawl4AI (or other batch crawler) required.** Crawlers do not replace lenses, scorecards, or judgment. ---

## Architecture

| Phase | Internal skill (name) | Job | Status |
| --- | --- | --- | --- |
| 0 | `competitive-frame` | Lock alternatives vs phantoms vs status quo | Inline |
| 1 | `fan-out-paths` | ICP search paths that define the shortlist | Inline |
| 2 | `competitor-set` | Name 3–5 + exclusions + **depth tier** + **platform gravity** | Inline |
| 3 | `competitor-evidence` | Durable corpus per competitor (files, not chat) | Inline · optional NotebookLM SOP |
| 4 | `positioning-lenses` | Identity · sentiment · pricing · four pillars | Inline |
| 5 | `competitor-battlecard` | Per-competitor synthesis for the human | Inline |
| 5b | `set-overview` | Cross-set lane map + pack scorecard | Inline |
| 6 | `positioning-statement` | Statement + anti-positioning + identity pressure-test | Inline |
| 7 | `marketing-gate` | Block volume work until the statement is signed | Inline |

Do not skip phases. Do not run Phase 6 from memory of the market. Do not start Phase 7 until Phase 6 has a saved, client-approved file.

---

## Run modes

Choose one at the start of the run (state it in the first response):

| Mode | When | What you do | Stop before |
| --- | --- | --- | --- |
| **`single_competitor`** | User names one domain / “start with X” | Draft Phases 0–2 → full Phases 3–5 for **that** slug only | Phase 5b / 6 |
| **`full_set`** | User wants the engagement statement | Draft Phases 0–2 → **hard stop for human confirm** → Phases 3–5 for every **required** include → **5b scorecard** → Phase 6 → 7 | — |

**`full_set` hard stop (non-negotiable):**

1. After draft `00-competitive-frame.md`, `fan-out-paths.md`, and `competitor-set.md` (`Status: draft`), **stop the turn**.  
2. End the user-facing message with an explicit line: **waiting on set confirm; not starting Phase 3.**  
3. Do **not** open competitor URLs, create packs, write lenses/battlecards, scorecard, SET-OVERVIEW, statement, or marketing-gate until the human replies `keep` / edits the table.  
4. On that reply, set `Status: confirmed` + `Confirmed by:` + date, **then** start Phase 3.  
5. **Ban:** “proceeding on draft through evidence,” inventing playbook exceptions, or packing “while you review.” Throughput does not override this stop.

**`single_competitor` rules:**

1. Still write draft `00-competitive-frame.md`, `fan-out-paths.md`, and `competitor-set.md` so the named brand has a set context.  
2. Mark Phase 2 status as **`draft`** (not confirmed) unless the human confirms in-thread.  
3. Complete Phases 3–5 for the named competitor only (**this** is the only mode that may pack before full-set confirm).  
4. **Do not** run Phase 5b for the full set, and **do not** write Phase 6 or 7 files. Say what remains (confirm set + N other packs + scorecard).  

**Phase 6 entry gate (hard):**

1. Phase 2 status is **`confirmed`**, **and**  
2. `{output_dir}/pack-scorecard.md` exists with `Status: ready_for_phase_6` **or** `ready_for_phase_6_with_waivers`, **and**  
3. Every **required** row on that scorecard is `pass` or human-`waived` (see human-only waivers below), **and**  
4. `SET-OVERVIEW.md` (Phase 5b) is saved.

**Human-only waivers:** A row may be `waived` only when the human says so **in this thread** (e.g. “waive acme-peer sentiment”). Record `waived by: {name}` + date + reason on the scorecard. **Ban:** `pending: Name`, agent-proposed waives, or marking `ready_for_phase_6_with_waivers` before that reply. Without a human waive, the row stays `fail` and scorecard status stays `draft`.

**Statement / gate filenames (hard):**

| Condition | Allowed files | Forbidden |
| --- | --- | --- |
| Phase 2 still `draft`, **or** scorecard not ready / has required `fail` | `positioning-statement.DRAFT.md` only (coaching) | `positioning-statement.md`, `marketing-gate.md` |
| Phase 6 entry gate met | `positioning-statement.md`, then Phase 7 `marketing-gate.md` | Treating a DRAFT as signed |

**Coaching draft (soft):** If gates are not met, you may save `positioning-statement.DRAFT.md` for call prep. Do **not** treat it as Phase 6 complete. Do not start Phase 7.

Default **N**: all required includes in the confirmed set. Do not treat “folders exist” or “battlecards exist” as statement-ready without a passing scorecard.

---

## Inputs (from the user / engagement only)

Collect once before Phase 0 completes:

1. **Product name** — the brand being positioned  
2. **One-line category** — mental folder (what buyers call this)  
3. **ICP one-liner** — who buys, in their words if possible  
4. **Primary need / job** — what they hire a solution for  
5. **Working output directory** — where packs will live this run  
6. **Run mode** — `single_competitor` or `full_set` (infer from the prompt if obvious; state it)

Optional later:

- Suspected competitor domains (hypotheses only until Phase 2)  
- “Never compete with” constraints already decided  
- Preferred Phase 3 capture backend (`headed_browser` | `http_ua` | `webfetch` | `cloud_browser` | `notebooklm`)  
- Our product’s **platform gravity** (`wordpress` | `woo` | `shopify` | `multi` | `unknown`) when known  
- Pointer to an engagement brief the user wants used (path or paste)

**Input rule:** Domains, product names, and competitor lists come from the user or Phase 1–2 work in *this* run. Do not invent a shortlist from workspace examples, prior clients, or method-folder fixtures.

**Engagement-brief rule:** You may use facts from a client brief, SNAPSHOT, CONTEXT, meeting notes, or a **test prompt** **only when the user points at that path or pastes the content** for this run. Do not silently harvest the workspace for ICP, wedges, exclusions, competitor hypotheses, or output paths.

### Prior-run fence (hard)

Unless the user explicitly cites the path, **do not open or follow** prior `dry-runs/`, fixture packs, or other products' positioning folders as if they were this engagement's evidence. Finding those files via Glob is **not** permission. The SoR for a normal run is this `SKILL.md` plus `templates/` / `REFERENCE.md`.

### Short prompt bootstrap

A normal ask looks like: *“run a full set competitor analysis for example.com”* (product URL or name + mode). That is enough to start. Do **not** require a filled engagement table.

| Missing field | What to do |
| --- | --- |
| Product name | Infer from domain / homepage title |
| Run mode | Infer (`full_set` / `single_competitor`); state it |
| Output directory | Default: `./competitor-positioning/{slug}-{YYYY-MM-DD}/` under the project workspace (or a path the user names) |
| Category, ICP, primary job, platform gravity | **Either** ask once in the first reply **or** capture the product homepage once (prefer `headed_browser`), draft provisional one-liners labeled `assumed`, and ask the human to confirm/edit those assumptions when they confirm the Phase 2 set |

Do not block Phase 0–1 on a perfect ICP. Provisional inputs must be visible in `00-competitive-frame.md` as assumed vs given.

Competitor names in the user’s short prompt are hypotheses only. Competitor names that appear only inside an uncited `test-prompts/` file are **out of bounds**.

### Tool scope

Stay on capture backends in the Tooling table above + normal file writes under the output directory. Do **not** load unrelated skills (HTML report builders, generic scrape pipelines) unless the user asked for that artifact or you are using optional NotebookLM.

---

## First response

On the first user-facing response:

1. Restate product, ICP (or `assumed` ICP), output directory, and **run mode**.  
2. Name the phase you will start (usually 0).  
3. Preview deliverables for that mode (single pack vs full statement).  
4. State the gate: no Phase 6 until confirmed set + **passing pack scorecard** (`ready_for_phase_6` or `ready_for_phase_6_with_waivers`) + SET-OVERVIEW; DRAFT statement OK for coaching only; no distribution tactics until Phase 6 is signed.  
5. State the **capture backend** you will start with for Phase 3 (usually `headed_browser`). Do **not** create an empty `CAPTURE-LOG.md` until Phase 3 actually starts.  
6. If you used short-prompt bootstrap assumptions, list them in one short block and say they will be reconfirmed with the Phase 2 set.  
7. **`full_set` only:** After Phase 0–2 drafts are saved, this response (or the next if 0–2 span turns) **must** end with **waiting on set confirm; not starting Phase 3.** Continuing into packs without a human confirm is a playbook violation.

---

## Deliverables (engagement done)

1. Competitor set (3–5) + depth tiers + “not competing with” list  
2. Per-competitor evidence pack (saved files)  
3. Lens outputs + four-pillars summary  
4. Per-competitor battlecards  
5. `SET-OVERVIEW.md` + `pack-scorecard.md`  
6. Positioning statement (template; dual primary when needed)  
7. Anti-positioning (by lane)  
8. Marketing gate file  

---

## Phase 0 — `competitive-frame`

Lock three ideas with the human before naming brands:

1. **Competitive alternatives, not “competitors.”** Ask: *What would the customer do if we vanished?*  
2. **Status quo is usually #1.** Spreadsheets, DIY, “good enough,” no decision.  
3. **Ignore phantoms.** Brands the ICP does not shortlist dilute the message.

**Completion criterion:** Written answers to the three ideas exist in the output directory (short note is enough). No competitor deep-dive has started.

---

## Phase 1 — `fan-out-paths`

Write **3–4 search paths** the ideal buyer actually uses. These paths define who belongs in the set.

Typical shape (adapt labels; do not force all four):

| Path | Intent |
| --- | --- |
| A | Category / partner / “tools like …” search |
| B | Acute pain search |
| C | High-stakes / specialist search |
| D | Known-alternative comparison search |

For each path: 2–5 example queries in the buyer’s language (not marketer-ese).

**Completion criterion:** A saved `fan-out-paths.md` (or equivalent) lists paths + example queries. Phantoms spotted here are noted for Phase 2 exclusion.

---

## Phase 2 — `competitor-set`

From Phase 0–1, name **3–5** real alternatives. Include status quo as a row when it is honest.

Also write the **not competing with** list (phantoms, adjacent lanes you refuse, aspirational giants the ICP never shortlists).

| Field | Required |
| --- | --- |
| Name | Yes |
| Why in set (one line, tied to a fan-out path) | Yes |
| Primary domain (if a product) | Yes, when applicable |
| Folder slug | Yes |
| Depth tier | Yes — `primary_peer` \| `adjacent` \| `status_quo` \| `boundary` |
| **Platform gravity** | Yes — `wordpress` \| `woo` \| `shopify` \| `multi` \| `unknown` (where their GTM / App Store / docs live) |
| Required for Phase 6? | Yes — `required` \| `optional` \| `boundary` |

**Depth tier guidance (portable):**

| Tier | Use when | Evidence expectation |
| --- | --- | --- |
| `primary_peer` | Buyer shortlists them next to us in-category | Full Phase 3–5; strict sentiment bar |
| `adjacent` | Honest alternative in another lane (we bless or anti-position) | Full homepage/pricing + lighter sentiment bar |
| `status_quo` | Inertia / “do nothing / keep default” | Light note schema (see Phase 3) |
| `boundary` | Mention for exclusion clarity only | Explicit waiver; no full pack |

**Platform gravity:** If a peer’s `platform_gravity` differs from **our** product platform (e.g. Shopify-first peer while we are Woo), Phase 4B must either (a) meet the sentiment bar with **our-platform** review/community sources, or (b) use the **cross-platform sentiment** escape in Phase 4B, or (c) mark `sentiment_incomplete` and seek a human waive. Do not freeze the whole run hoping a WP.org page appears for a Shopify app.

At the top of `competitor-set.md`, set:

```text
Status: draft | confirmed
Confirmed by: (name or “pending”)
Date:
```

In `single_competitor` mode, keep `Status: draft` until the human confirms; still list the full intended set so research order is clear.

**Completion criterion (draft):** Saved `competitor-set.md` with 3–5 includes, exclusions, slug + depth tier + platform gravity + required tag per include. In `full_set`, **stop here** until human confirm (see Run modes).

**Completion criterion (confirmed):** Human has replied keep / edited the table; `Status: confirmed` + `Confirmed by:` + date. **Required before any Phase 3 pack in `full_set`.** Not required before a `single_competitor` Phase 3–5 pack.

---

## Phase 3 — `competitor-evidence`

**Rule:** one evidence pack per competitor. Chat summaries alone do not count.

### Phase 3 start checklist (echo before first competitor URL)

Before the first competitor fetch in this run, verify and state:

1. Run mode  
2. `competitor-set.md` status is **`confirmed`** (`full_set`) **or** `draft` allowed (`single_competitor` only)  
3. Capture backend for this Phase 3 start  
4. `{output_dir}/CAPTURE-LOG.md` created **now** (empty table header OK)

If `full_set` and status is still `draft`, **do not start Phase 3**.

### Capture backend ladder (do this first)

At the start of Phase 3 (and again when a host fails), **create or append** `{output_dir}/CAPTURE-LOG.md`. Do not create this file during Phase 0–2.

**Per-URL rows (required):** one row per attempt — time, tool/backend, **exact URL**, result (`saved` + relative path, or `touched_not_saved` + HTTP status), lesson. Ban three-line summary logs that omit URLs. Batch screenshot scripts still need one log row per URL.

**Order:**

1. **`headed_browser`** — Playwright CLI and/or Chrome DevTools MCP. **Default** after any HTTP **403**, CAPTCHA, empty shell, or bot challenge on that host.  
2. **`http_ua`** — desktop User-Agent fetch for soft docs (WP.org, help centers, first-party docs).  
3. **`webfetch`** — soft marketing pages only.  
4. **`cloud_browser`** — optional Cloudflare Browser Run (or similar) for batch screenshot/markdown. Do not treat it as stealth.  
5. **`notebooklm`** — optional volume research after first-party homepage/pricing are already `saved`.

**Rules:**

- **First successful headed save wins** for that URL. Do **not** retry WebFetch on the same host after a 403 in the same run.  
- Prefer **screenshot PNG + text extract** (`document.body.innerText` or equivalent) together. Screenshot alone is not enough for pricing/feature claims.  
- **Discover pricing from on-site nav** (“Pricing” / “Plans” link) before guessing `/pricing`. Record wrong guesses as `touched_not_saved` with status code (404/403).  
- **Interactive pricing:** after capture, log control state (order volume selected, monthly/annual toggle, currency, dismissed promo modal). Re-capture after changing the control if the DOM prices change.  
- Never invent prices when capture fails. Stop that competitor’s pricing claims and gap-fill.

### Minimum first-party saves

For every `primary_peer` and `adjacent` competitor:

1. Homepage — **text extract** under `03-raw-sources/` **and** screenshot PNG path (linked in the md or sibling `screenshots/`)  
2. Pricing (or packing/plans) — same pairing, including control state when interactive  

Scorecard Home+price is `pass` only when **both** exist (or documented absence with reason). `status_quo` is exempt from the PNG pair.

Then add third-party signal scaled to the **depth tier** (Phase 4B). Prefer fewer strong sources over many thin listicles.

For `status_quo`: a single light note is enough (what buyers do, why it wins, why people leave, implication for us). No fake vendor homepage required.

### Citation integrity (hard)

1. Every pack has `{slug}/02-url-manifests/` with every URL labeled **`saved`** (file under `03-raw-sources/` or `01-exports/`) or **`touched_not_saved`** (include HTTP status when known). Scorecard Manifest `pass` requires this file.  
2. Phase 4–5 may **only** assert facts that appear in a **`saved`** file (quote, paraphrase, or table row).  
3. If a claim needs a `touched_not_saved` URL, **save it first** (full page or dated clip), then cite. Do not promote touched-only URLs into lenses.  
4. Marketing pages used for identity/pricing (feature, vs-, ICP, FAQ, performance proof) that you rely on must be saved — not merely listed.

### Recommended local folder (research)

```text
{output_dir}/{competitor_slug}/
  01-exports/          # research reports, Deep Research dumps, NotebookLM exports
  02-url-manifests/    # every URL touched; mark saved vs touched_not_saved
  03-raw-sources/      # homepage.md, pricing.md, review clips, etc.
  04-normalized/       # optional cleanup
  05-analysis/         # Phase 4 lens outputs (+ limitations.md when needed)
  06-battlecard/       # Phase 5
```

### Client-facing tidy mirror (optional)

```text
Competitor Analysis/
  {Brand}/
    Positioning
    Feature Set
    Pricing Tiers
    Customer Sentiment
    Marketing Disconnect   # claim vs reality
```

### Evidence workflow (per competitor)

1. Broad seed — official, reviews, comparisons, community  
2. Gap-fill — one source family per pass  
3. Curate — keep / review / drop  
4. Capture **full URL manifest** (cited and uncited; saved vs touched_not_saved)  
5. Ensure homepage + pricing exist under `03-raw-sources/` (tiers that require them)  
6. Save any page you will cite in Phase 4  
7. Stop when Phase 4 can be answered from **saved** files only  

**Optional backend:** NotebookLM Deep Research (if available). One notebook per competitor; export into `01-exports/`. Does not replace the capture ladder for homepage/pricing.

**Crawler note:** Batch crawlers (including Crawl4AI) are **out of scope for this stab**. Do not delay lenses waiting on crawler setup. Prefer headed browser when fetch fails.

**Completion criterion (per competitor):** Tier minimums met; `CAPTURE-LOG.md` updated for failures/escalations; manifest labels present; every Phase 4 citation target is `saved`.

In `full_set` mode, repeat Phase 3–5 for each **required** competitor, then Phase 5b. In `single_competitor` mode, stop after that slug’s Phase 5.

---

## Phase 4 — `positioning-lenses`

Run **every** lens on each `primary_peer` and `adjacent` competitor, grounded only in that competitor’s **saved** pack. Lens prompt detail: see [REFERENCE.md](REFERENCE.md) § Lens prompts.

`status_quo` / `boundary`: skip full lenses; keep the light note / waiver only.

### A. Identity (four questions)

1. What identity / tribe does this brand sell?  
2. What does choosing them signal about the customer?  
3. What fears do they reduce?  
4. What aspiration / future self do they amplify?  

End with a **Strategic Gap** for *our* brand (one short section).

### B. Customer sentiment

- Emotional vocabulary (verbatim where possible)  
- **Tension Matrix:** Brand Claim · Customer Reality · Tension  
- **#1 broken promise** we could own  

**Sentiment minimum by depth tier:**

| Depth tier | Default bar | Escape hatch |
| --- | --- | --- |
| `primary_peer` | **≥8** distinct verbatim (or near-verbatim) snippets from **saved** review/community sources, **≥2** emotions | `limitations.md` + human waive for Phase 6 |
| `adjacent` | **≥4** snippets, **≥2** emotions, same source rule | `limitations.md` + human waive for Phase 6 |
| `status_quo` / `boundary` | No full sentiment lens | n/a |

**Sentiment source allowlist** (snippets must come from saved pages in these classes):

- WP.org plugin reviews / support threads  
- Shopify App Store (or peer’s main marketplace) reviews  
- G2 / Capterra / Trustpilot / similar review platforms (saved page, not a vendor badge)  
- Independent forums, Reddit, Stack Exchange, agency blogs with dated user quotes  
- App Store / Play Store reviews when relevant  

**Sentiment source denylist** (do **not** count toward the tier bar):

- Homepage testimonials / social-proof carousels  
- Vendor case-study proof stacks and metric banners  
- First-party “member stories” marketing pages used as if they were reviews  
- Vendor claims about G2/Capterra ratings **without** a saved review-site capture  

Identity and pricing lenses may still cite first-party marketing; **sentiment bar may not**.

**Cross-platform sentiment escape:** When a peer’s `platform_gravity` ≠ our product platform and our-platform review corpus is thin, you may set `sentiment_cross_platform: true` in `limitations.md` and meet the snippet bar from **allowlisted** sources on **their** main marketplace / community (e.g. Shopify App Store for a Shopify-first peer). Add a one-line **our-platform path note** (install URL, 404, thin WP.org page, etc.). Scorecard may mark Sentiment `pass (cross_platform)` only with allowlisted saved snippets. Prefer this over inventing our-platform reviews that do not exist. Denylist sources do not become valid via this escape.

If incomplete: write `{slug}/05-analysis/limitations.md` with `sentiment_incomplete: true` and what is missing. You may draft other lenses and a **provisional** battlecard (`provisional_sentiment: true`). That row stays `fail` on the scorecard until gap-fill, valid cross-platform escape, or **human** waive.

### C. Pricing vs value

Value metric, hook/paywall, anchoring, hidden friction, price sentiment, **three** pricing-positioning implications for us.

### D. Four pillars (client-facing summary)

| Pillar | Job |
| --- | --- |
| Pricing | Value-bracket signal (not the cause of positioning) |
| Features | Table stakes vs unique value |
| Positioning | How they talk + category they claim |
| Sentiment | Patterned gaps/hooks — not the loudest 1% |

Save lens outputs under `{slug}/05-analysis/`.

**Completion criterion:** Tier-appropriate lens files exist; every factual claim cites a saved source; sentiment meets the tier bar **or** `limitations.md` records `sentiment_incomplete`. No lens is answered from model priors alone.

---

## Phase 5 — `competitor-battlecard`

Per `primary_peer` / `adjacent` competitor, synthesize a short human-facing card:

- One-line positioning (theirs)  
- Who they win  
- Who they lose / broken promises  
- Table stakes vs claimed uniqueness  
- Pricing posture (one paragraph)  
- **Implications for us** (3 bullets max)  

**Recommended:** `06-battlecard/marketing-disconnect.md` (or a section on the card) when claim vs reality tensions exist. Prefer a dedicated file when more than one tension appears.

Optional: claim map, experience-gap map.

If Phase 4B is incomplete, title or frontmatter must say **provisional** and point at `limitations.md`.

**Completion criterion:** `{slug}/06-battlecard/` contains a readable card that cites **saved** pack evidence only. Provisional cards do not score `pass` on sentiment-dependent rows until resolved.

---

## Phase 5b — `set-overview` + pack scorecard

**Required in `full_set` mode before Phase 6.** Skip in `single_competitor` mode.

### SET-OVERVIEW.md

Save `{output_dir}/SET-OVERVIEW.md`:

| Competitor | Depth tier | Their one-liner | Lane | Implication for us |
| --- | --- | --- | --- | --- |
| … | … | … | primary fight / bless / heavy / inertia | … |

Name the **default peer fight** and the **status-quo fight** explicitly (feeds dual primary in Phase 6).

### pack-scorecard.md

Follow [templates/pack-scorecard.md](templates/pack-scorecard.md) in this package. Score every set row.

| Scorecard status | When |
| --- | --- |
| `draft` | Work in progress, Phase 2 still draft, **or** any required row `fail` / agent-only “pending” waive |
| `ready_for_phase_6` | Phase 2 **confirmed**; every **required** row is `pass` (no waivers) |
| `ready_for_phase_6_with_waivers` | Phase 2 **confirmed**; every **required** row is `pass` or human-`waived` with `waived by` + date on the card |
| (stop) | Any required row still `fail` |

If any required row is `fail`, **stop** formal Phase 6. List gap-fills. You may still write `positioning-statement.DRAFT.md` for coaching (see Run modes). Do not set a ready status and do not write `positioning-statement.md` or `marketing-gate.md`.

**Completion criterion:** Both files saved; scorecard status is `ready_for_phase_6` or `ready_for_phase_6_with_waivers` (or run stops with failures listed + optional DRAFT).

---

## Phase 6 — `positioning-statement`

**Enter only when** the Phase 6 entry gate in **Run modes** is met (includes **confirmed** set + passing scorecard + SET-OVERVIEW). If the human asks for a statement early: paste scorecard failures, offer gap-fill / human waive, and optionally write `positioning-statement.DRAFT.md` for coaching. Do not claim Phase 6 complete. Do not create `positioning-statement.md` until the gate is met.

Use [templates/positioning-statement.md](templates/positioning-statement.md) in this package. Prefer the **dual primary alternative** form when Phase 5b shows both a peer-switch lane and a status-quo lane.

Also write:

**Anti-positioning by lane** (not one mushy paragraph): peers, adjacent, heavy/platform, status quo as applicable.

**Identity pressure-test** on *our* brand (same four questions as Phase 4A).

**Baseline (optional):** table stakes everyone claims.

**Completion criterion:** Saved positioning file; anti-positioning by lane; primary alternative(s) from the confirmed set; dual form used when SET-OVERVIEW requires it; human reviewed or signed.

---

## Phase 7 — `marketing-gate`

Positioning is a **gate**, not a suggestion.

Write `marketing-gate.md` **only after** `positioning-statement.md` exists under the Phase 6 entry gate (not beside a DRAFT). Do **not** start distribution volume, channel matrices, “get noisier,” or campaign creative until Phase 6 is signed as a file.

Hand-off note (short): which wedge the statement owns, which alternatives to name in public, which phantoms to ignore.

**Completion criterion:** Explicit “signed / approved” status recorded with date, **or** explicit deferral with reason. Marketing tasks reference the positioning file path.

---

## Operating rhythm

| Cadence | What |
| --- | --- |
| `single_competitor` | Draft 0–2 → 3–5 for one slug → stop |
| `full_set` after Phase 2 draft | **Hard stop** — waiting on set confirm; not starting Phase 3 |
| Per required competitor (`full_set`, after confirm) | Phase 3 start checklist → 3 → 4 → 5 |
| Before statement | Phase 5b SET-OVERVIEW + pack scorecard |
| After scorecard ready + confirmed set | `positioning-statement.md` → `marketing-gate.md` |
| Typical calendar | ~1 focused week for 3–5 competitors when evidence tooling is ready |
| Lighter coaching homework | Identity one-liners only while heavy evidence runs offline |

---

## Done checklist

- [ ] Run mode stated (`single_competitor` \| `full_set`)  
- [ ] Inputs from user prompt / short-prompt bootstrap only (no uncited prior dry-runs or fixture packs)  
- [ ] (`full_set`) Hard stop after Phase 2 draft; human confirm before Phase 3  
- [ ] Phase 3 start checklist echoed; per-URL `CAPTURE-LOG.md` (not created empty in Phase 0–2)  
- [ ] Phase 0 frame note saved  
- [ ] Phase 1 fan-out paths saved  
- [ ] Phase 2 set with depth tiers **and platform gravity** (`draft` or `confirmed`)  
- [ ] (Phase 6 only) Phase 2 **confirmed**  
- [ ] Every pack has `02-url-manifests/`; Home+price = text + PNG (peers/adjacent)  
- [ ] Lens claims cite saved files only  
- [ ] Sentiment snippets from **allowlist** only; denylist not counted; cross-platform escape or human waive if incomplete  
- [ ] Battlecards exist (provisional labeled if needed)  
- [ ] (Phase 6 only) `SET-OVERVIEW.md` + scorecard ready status; waives have `waived by` + date  
- [ ] Formal statement is `positioning-statement.md` only post-gate; pre-gate uses `.DRAFT.md` only  
- [ ] `marketing-gate.md` only after formal Phase 6 file exists  

---
