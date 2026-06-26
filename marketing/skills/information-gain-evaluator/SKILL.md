---
name: Information Gain Evaluator
type: composite
description: >
  Use when evaluating information gain, content uniqueness, SERP differentiation,
  or what makes a page worth citing. Scores unique value vs what already ranks
  for the same keyword.
version: 1.1.0
---

# Information Gain Evaluator

## Purpose

Compare a target page to SERP competitors and score cite-worthy **information gain** for the **primary keyword**.

**Not this skill:** publish-readiness gates, HTML audit deliverables, or brief-fidelity checks.

## Input policy (non-negotiable)

- **Target** — URL or pasted draft content; must come from the user. Never infer from workspace, project config, examples, or prior runs.
- **Primary keyword** — required; confirm if ambiguous.
- **Competitor URLs** — optional override. If omitted, auto-select from SERP (see `REFERENCE.md`).
- **Location / language** — default US English; user may override.
- **Own domain** — when auto-selecting competitors, exclude URLs on the target's domain.

If the user did not supply a target, ask once:

> *Which URL (or draft content) should I evaluate, and for which primary keyword?*

## Quick start

1. Confirm **mode** (live URL, draft content, or pinned competitors).
2. Resolve **primary keyword** and **target**.
3. **Step 0** — SERP context + competitor set (`REFERENCE.md`).
4. **Steps 1–2** — fetch target + competitors; record `fetch_status`.
5. **Steps 3–4** — comparative analysis with cited evidence per dimension.
6. **Step 5** — table-stakes gaps vs unique strengths.
7. **Step 6** — citation fit + page–keyword fit + recommendations + human report + handoff JSON (`handoff_version: "1.1"`).
8. Offer to save handoff JSON for downstream briefs or fan-out follow-ups.

**Reference:** `REFERENCE.md` — SERP params, lane rules, dimension rubric, rigorous scoring, handoff schema v1.1  
**Requirements:** `REQUIREMENTS.md`  
**Examples:** `EXAMPLES.md`  
**Regression:** `examples/SCORECARD-enterprise-sso.md` · `examples/SCORECARD-commercial-vs-diy.md` · `node scripts/verify-handoff.mjs`

## Modes

| Mode | When | Competitor source |
|------|------|-------------------|
| **live_url** (default) | Published page | SERP top 5 (lane-filtered) or user pins |
| **pinned_competitors** | User lists 3–5 URLs | User list only — skip SERP for competitor pick |
| **draft_content** | Pre-publish markdown/HTML | SERP top 5 or user pins; target is pasted content |

## Shared steps

### Step 0 — SERP context and competitor set

**If mode is `pinned_competitors`:** use user URLs only; still run one SERP call when possible for `serp_context` (lane, PAA, related) unless user says skip SERP.

**Otherwise:**

1. `serp_organic_live_advanced` per `REFERENCE.md`.
2. **Step 0.5 — Lane classification** on top 8–10 organic results (same lanes as fan-out: `primary_topic`, `tool_discovery`, `community`, `directory`).
3. If `intent_split` is `mixed`, ask once which lane defines the competitor set — unless user already stated intent or passed `intent_lane` from an upstream fan-out handoff.
4. Select up to **5** organic article URLs in the chosen lane. Exclude target domain, forums, marketplaces, and pure video/carousel slots unless user requests them.

Record `serp_context` in handoff (see `REFERENCE.md`).

### Step 1 — Fetch content

- **live_url:** WebFetch target + each competitor.
- **draft_content:** use pasted content as target; WebFetch competitors.
- **pinned_competitors:** WebFetch all URLs.

For each URL record `fetch_status`: `ok` | `partial` | `unfetchable`.

Extract: headings, body text, data points, quotes, statistics, frameworks, FAQ blocks.

**Hard rule:** never invent competitor or target content when fetch fails. Score only from available text; add `limitations[]`.

If fewer than **3** fetchable competitors (`ok` or `partial`), set `confidence: low`.

**Do not** cite `unfetchable` URLs in `evidence_competitors[]`. Remove unfetchable URLs from the scored competitor set or keep them in `competitor_set` with status only — never score from invented content.

### Step 2 — Table stakes vs differentiation

Before dimension scoring, list:

- **Table stakes** — at least **5** themes most competitors share (baseline coverage).
- **Target gaps** — table stakes the target misses (`table_stakes_gaps`, ≥1).
- **Unique strengths** — at least **2** specific differentiators (not generic marketing).
- **`baseline_coverage_pct`** — `round(100 × themes_covered / table_stakes.length)` per `REFERENCE.md`.

### Step 3 — Page–keyword fit and citation fit (before overall)

1. **`page_keyword_fit`:** `aligned` or `mismatched` (commercial page on DIY SERP = `mismatched`).
2. **`citation_fit_for_keyword`:** `strong` | `partial` | `poor` — would an AI answering the **primary keyword** cite this page as a primary source?
3. **`citation_fit_rationale`:** one honest sentence (≥30 characters).

When `mismatched`, `citation_fit` is usually `poor` unless an informational asset is what you're evaluating.

### Step 4 — Comparative analysis (five dimensions)

Score each dimension `high` | `medium` | `low` with:

- **finding** — one-sentence verdict
- **evidence_target** — quote or tight paraphrase from target (≥40 characters)
- **evidence_competitors** — array of `{ url, snippet }` (≥40 characters each) from **fetchable** competitors only

**Novel angle rule:** a different business model or page type alone is **not** `high` — score informational novelty for the keyword. `novel_angle: high` requires another dimension at `high` among `original_data`, `citable_specificity`, `first_hand_experience`.

Dimension definitions and anchors: `REFERENCE.md` § Dimensions.

### Step 5 — Overall information gain

Apply **rigorous** rules in `REFERENCE.md` § Overall information gain — after citation fit and page–keyword fit, not from dimension counts alone.

Set `baseline_completeness` from `baseline_coverage_pct`.

### Step 6 — Recommendations

For each dimension scored `medium` or `low`, one recommendation with:

- `dimension`
- `action` — specific artifact (table, framework name, case study structure)
- `example_artifact` — concrete illustration using the **user's** topic only (never reuse names, brands, or URLs from skill examples)

Also recommend fixes for critical **table-stakes gaps** even when differentiation is high.

### Step 7 — Output

**Human report** (markdown):

```markdown
## Information Gain Report — {target label}
**Keyword:** {primary keyword}
**Mode:** {live_url | pinned_competitors | draft_content}
**Evaluated against:** {n} competitors ({confidence})
**Intent lane:** {lane or "not classified"}

### Overall: {high|medium|low} Information Gain
**Citation fit for keyword:** {strong|partial|poor}
**Page–keyword fit:** {aligned|mismatched}
**Baseline completeness:** {strong|adequate|weak} ({baseline_coverage_pct}%)

### Dimension Scores
| Dimension | Score | Finding |
|-----------|-------|---------|
| ... | ... | ... |

### Table stakes (what SERP expects)
- ...

### What competitors cover that you don't
- ...

### What you have that competitors don't
- ...

### Recommendations
1. ...

### Limitations
- ...
```

**Handoff JSON:** emit `handoff_version: "1.1"` per `REFERENCE.md`. Validate before closeout:

```bash
node scripts/verify-handoff.mjs path/to/handoff.json
```

## Optional upstream / downstream

| Partner skill | Relationship |
|---------------|--------------|
| **fan-out-coverage-analysis** | Upstream — pass `intent_lane`, weak spoke URLs to evaluate |
| **Content brief / writer** | Downstream — consume handoff `recommendations`, `unique_strengths`, `table_stakes_gaps` |

## Done definition

- [ ] Input policy satisfied (no inferred target/keyword)
- [ ] Competitor set documented with URLs, lane, and fetch_status
- [ ] ≥5 table stakes; ≥2 unique strengths; `baseline_coverage_pct` computed
- [ ] `citation_fit_for_keyword`, `page_keyword_fit`, `citation_fit_rationale` set
- [ ] Each dimension has score + finding + evidence (≥40 chars); no unfetchable URLs in evidence
- [ ] Overall matches rigorous rules including citation/page fit caps
- [ ] Anti-inflation rules satisfied (`novel_angle`, `citation_fit: strong`, etc.)
- [ ] `limitations[]` populated when fetches fail, confidence low, or page–keyword mismatched
- [ ] Handoff JSON passes: `node scripts/verify-handoff.mjs path/to/handoff.json` (G1–G14 + R1–R18)
- [ ] Recommendations are specific artifacts, not "add more data"

## Notes

- One SERP call + WebFetch is the default cost path.
- Information gain is **relative to the chosen competitor set**. Changing lanes or pins can change the verdict.
- Re-run after major content updates or when SERP intent shifts.
