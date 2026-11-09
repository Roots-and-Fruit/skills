# Examples — Competitor Research → Positioning

Fictional domains only. Real product URLs belong in live user prompts.

## Short prompt — full set

```text
Run the competitor research → positioning playbook on a full set for example-saas.com
```

**Expected first arc:** Phase 0–2 drafts under `./competitor-positioning/example-saas-{date}/`, assumed ICP labeled, then stop with **waiting on set confirm; not starting Phase 3.**

## Short prompt — single competitor

```text
Use competitor research → positioning; start with rival.example.com only
```

**Expected:** `single_competitor` mode; draft set for context; full Phase 3–5 for `rival` only; no Phase 5b/6.

## After confirm

```text
keep
```

or

```text
keep, but drop boundary-tool and mark status-quo required
```

**Expected:** `competitor-set.md` → `Status: confirmed`; Phase 3 start checklist; per-URL `CAPTURE-LOG.md`; packs for required rows.

## Early statement request (should soft-fail)

```text
Write the positioning statement now
```

**Expected:** If gates unmet → scorecard gaps + optional `positioning-statement.DRAFT.md` only. No `positioning-statement.md` / `marketing-gate.md`.

## Human waive

```text
waive acme-peer sentiment for Phase 6 — Shopify reviews only, Woo corpus thin
```

**Expected:** Scorecard row `waived` with `waived by` + date; only then may status become `ready_for_phase_6_with_waivers`.
