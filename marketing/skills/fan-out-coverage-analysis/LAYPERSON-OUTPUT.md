# Layperson output contract

**Mandatory for every user-facing fan-out response.** Technical tables, tier columns, and handoff JSON live in the **detail report file**, not in chat.

## Chat deliverable (strict)

**Paste only the stdout block** from:

```bash
node scripts/run-fanout.mjs ... --write-reports --output handoff.json
# or
node scripts/build-layperson-summary.mjs path/to/handoff.json
```

Do **not** paraphrase, extend, or wrap that block. Do **not** append anything after it except a single optional follow-up question.

### Forbidden in chat

- Full `sub_queries[]` tables or `relevance_tier` / tier columns
- Handoff JSON or partial handoff snippets
- Verifier output (`PASS`/`FAIL`, `node scripts/verify-*`)
- MCP call logs, skill usage logs, or “deliverables” tables
- API / pipeline step lists (those belong in the detail report or agent notes only)

Script stderr (detail report path) is for the agent — not for the user.

## What the user sees in chat (script stdout only)

1. **Verdict** — One plain-language headline. Prefer outcomes over metrics:
   - *Visible on the main topic, gaps on follow-up questions*
   - *Fan-out map ready (keyword-only — no site checked)*
   - Avoid leading with **0% coverage** without explaining live SERP vs database lag.
2. **Coverage story** — 1–3 bullets: live anchor rank (if known), indexed coverage %, low-confidence notes for thin seeds.
3. **What's working** — Short bullets (anchor ranks, lane focus, SERP signals captured).
4. **What still needs attention** — High-priority content gaps in plain language (“Answer *What is go-to-market?* — people ask this on Google”).
5. **Not priority (optional)** — Facet-drift / wrong-lane terms the user can ignore.
6. **What to write next** — Numbered content actions (not API steps).
7. **One link** to the local detail report file.

## Detail report file (local)

After the run, write **`reports/{domain-or-keyword-slug}-{YYYY-MM-DD}-detail.md`** (create `reports/` under the skill folder, or the user's client workspace).

```bash
node scripts/build-layperson-summary.mjs path/to/handoff.json [output_dir]
# or
node scripts/run-fanout.mjs ... --write-reports --output path/to/handoff.json
```

The detail file contains:

- SERP context JSON
- Coverage summary (Labs + optional live anchor rank)
- Full sub-query table with tiers and status
- `priority_sub_queries[]`, `gaps[]`, `hub_spoke_map`
- Full handoff JSON for playbooks

In chat, link with a relative or absolute path.

## SSOT script

```bash
node scripts/build-layperson-summary.mjs examples/wordpress-plugin-marketing-v2.3.handoff.fixture.json
```

`writeFanoutReports()` prints the layperson summary to **stdout** and writes the detail file; script logs the detail path on **stderr**.

## Layperson phrasing guide

| Technical | Say instead |
|-----------|-------------|
| `serp_native` / PAA | “People ask this directly on Google” |
| `facet_drift` | “Different search intent — safe to ignore unless you pivot” |
| `coverage_rate_pct: 0` + live rank #4 | “Visible on the main topic; database hasn't linked follow-up questions yet” |
| `intent_split: mixed` | “This search mixes plugin-builder advice and generic business guides” |
| `hub_serp_only` | “Your page ranks live for this term; tools haven't indexed it yet” |
| `keyword_only` mode | “Fan-out map only — no site coverage measured” |

## Domain vs keyword-only

| Mode | Verdict tone |
|------|----------------|
| `domain_coverage` | Lead with **content gaps** and optional live rank |
| `keyword_only` | Lead with **fan-out map ready**; never imply site coverage |

## Primary agent entry (pipeline)

```bash
# 1. Flatten MCP exports
node scripts/ingest-mcp-export.mjs --serp raw-serp.json --labs related-raw.json:related -o merged.json --intent-out intents.json

# 2. Normalize → priority → coverage → reports
node scripts/run-fanout.mjs \
  --seed "wordpress product go to market" \
  --lane primary_topic \
  --intent-split mixed \
  --merged merged.json \
  --ranked-file ranked.json \
  --partial path/to/handoff-partial.json \
  --output path/to/handoff.json \
  --write-reports
```

Agent still owns MCP calls (SERP, Labs, ranked_keywords). `run-fanout.mjs` chains normalize → apply-priority → apply-coverage → optional layperson reports.

## Regression

```bash
node scripts/verify-layperson-summary.mjs
node scripts/verify-merge-expansion.mjs
node scripts/verify-apply-coverage.mjs
node scripts/verify-ingest-mcp.mjs
```

LP1–LP10 on golden handoff fixture; M1–M5 merge; C1–C11 coverage; I1–I6 ingest.
