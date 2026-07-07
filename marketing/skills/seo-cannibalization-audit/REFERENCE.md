# SEO Cannibalization Audit — Reference

SSOT for handoff schema, page-intent enums, relationship rules, resolution rubric, DataForSEO params, and playbook consumer fields.

---

## Handoff schema v1.0

```json
{
  "handoff_version": "1.0",
  "skill": "seo-cannibalization-audit",
  "skill_version": "2.0.0",
  "generated_at": "ISO-8601",
  "mode": "targeted | playbook_hub_recovery | full_site",
  "inputs": {
    "domain": "example.com",
    "subject_pages": ["https://example.com/pricing"],
    "primary_keywords": { "https://example.com/pricing": "example saas pricing" },
    "intended_hubs": ["https://example.com/pricing"],
    "protected_pages": [],
    "triangulation_context": [
      { "url": "https://example.com/blog/saas-pricing-guide", "triangulated_role": "accidental_hub", "cluster": "pricing" }
    ],
    "scope": "targeted | full_site"
  },
  "summary": {
    "conflicts_total": 2,
    "active": 1,
    "emerging": 0,
    "pre_publish_risk": 0,
    "healthy": 1,
    "protected_review": 0,
    "needs_human_approval": 1
  },
  "conflicts": [],
  "healthy_relationships": [],
  "architecture_conflicts": [],
  "limitations": []
}
```

### `conflicts[]` row

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Stable id, e.g. `conflict-pricing-blog` |
| `keyword` | string | yes | Shared ranking keyword |
| `severity` | enum | yes | `active` · `emerging` · `pre_publish_risk` |
| `relationship` | enum | yes | See § Relationship classification |
| `playbook_tension` | enum | yes | `accidental_vs_intended` · `blog_vs_landing` · `none` |
| `pages` | array | yes | 2+ same-domain URLs with ranks |
| `resolution` | enum | yes | See § Resolution enum |
| `redirect_target` | string \| null | yes | Required when `resolution` is `redirect_301` or `consolidate` |
| `recovery_phase` | enum | yes | `5f` · `5g` · `none` |
| `recommended_action` | string | yes | Actionable sentence for recovery plan |
| `title_meta_overlap` | boolean | no | Step 3 signal |

### `pages[]` entry (within a conflict)

| Field | Type | Required |
|-------|------|----------|
| `url` | string | yes |
| `rank` | number | yes |
| `intent` | enum | yes |
| `etv` | number \| null | no |
| `monthly_volume` | number \| null | no |
| `triangulated_role` | string \| null | no |

### `healthy_relationships[]` row

| Field | Type |
|-------|------|
| `keyword` | string — shared term, hub primary keyword, or best thematic label from Step 1 |
| `hub_url` | string — hub-intent URL (`hub_routing`, `product`, `use_case_lp`) |
| `spoke_url` | string — spoke-intent URL |
| `relationship` | `hub_spoke_ok` |

**When to emit (Step 4b):** `conflicts[]` is empty, `subject_pages.length >= 2`, and `classifyRelationship` returns `hub_spoke_ok` for the pair. Zero shared SERP keywords is **not** a reason to omit the row — structural hub+spoke with no overlap still gets a healthy row.

**Script SSOT:** `scripts/build-healthy-relationship.mjs` — assigns `hub_url` / `spoke_url` from intents.

**Summary:** `summary.healthy` must equal `healthy_relationships.length`.

### `architecture_conflicts[]` row (playbook Phase 4c)

| `type` | When |
|--------|------|
| `accidental_pillar_blocks_intended` | Playbook tension with active/emerging severity |
| `cluster_no_pillar` | Intended hub invisible; no de facto pillar |
| `pillar_without_spokes` | Hub with no supporting spokes in subject set |
| `spoke_without_pillar` | Spoke ranks without cluster hub in set |

---

## Page intent enum

| `intent` | Typical page |
|----------|--------------|
| `hub_routing` | Category hub, cornerstone |
| `product` | Pricing, product overview |
| `use_case_lp` | Solution landing page |
| `how_to` | Blog guide, tutorial |
| `feature` | Feature deep-dive |
| `integration` | Partner integration page |
| `alternative_comparison` | vs competitor page |

**Script SSOT:** `scripts/classify-relationship.mjs`.

---

## Relationship classification

| `relationship` | Rule |
|----------------|------|
| `hub_spoke_ok` | Hub intent + spoke intent |
| `hub_vs_hub` | Hub + hub, different types |
| `hub_same_intent` | Hub + hub, same intent |
| `spoke_vs_spoke` | Spoke + spoke |

Hub intents: `hub_routing`, `product`, `use_case_lp`.  
Spoke intents: `how_to`, `feature`, `integration`, `alternative_comparison`.

---

## Severity

| `severity` | Rule |
|------------|------|
| `active` | Both pages rank ≤ 20 |
| `emerging` | Both in top 50 |
| `pre_publish_risk` | New page vs existing top 10 |

---

## Playbook tension

| `playbook_tension` | Detection |
|--------------------|-----------|
| `accidental_vs_intended` | Intended hub competes with accidental/de facto pillar |
| `blog_vs_landing` | `how_to` vs commercial landing intent |
| `none` | Standalone or healthy overlap |

---

## Resolution enum

| `resolution` | Meaning |
|--------------|---------|
| `hub_spoke_ok` | Keep both |
| `differentiate` | Retitle, refocus, internal links |
| `redirect_301` | 301 after backlink check |
| `consolidate` | Merge spokes; name redirect target |
| `protected_review` | Protected URL — no retire recommendation |
| `needs_human_approval` | High-traffic overlap — sign-off before 301 |

**Script SSOT:** `scripts/resolve-conflict.mjs`.

### R-layer rules

| ID | Rule |
|----|------|
| R1 | Protected URL → `protected_review` |
| R2 | `hub_spoke_ok` relationship → `hub_spoke_ok` resolution, `recovery_phase: none` |
| R3 | Playbook tension → `recovery_phase: 5f` |
| R4 | `redirect_301` → non-null `redirect_target` |
| R5 | `needs_human_approval` ≠ `redirect_301` resolution label |
| R6 | Top-20 + volume > 10 on accidental → `needs_human_approval` |
| R7 | `consolidate` → non-null `redirect_target` |

---

## DataForSEO parameters

| Step | Tool | Notes |
|------|------|-------|
| Subject keywords | `dataforseo_labs_google_ranked_keywords` | limit 30, volume desc |
| Overlap | `dataforseo_labs_google_relevant_pages` | 2+ same-domain URLs in top 50 |
| Pre-redirect | `backlinks_summary` | Required before `redirect_301` |
| Optional | `serp_organic_live_advanced` | Intent ambiguity |

---

## Playbook consumer mapping

**Hub & Spoke Discovery & Recovery** Phase 4a: `conflicts[]`, `recovery_phase`, `redirect_target`, `architecture_conflicts[]`.

**Cornerstone Content Audit** Phase 4a: `mode: targeted` with cornerstone URLs as `subject_pages`.

---

## Step 0 — URL validation gate

Cannibalization compares **live pages that can both appear in search results**. Unpublished, draft, or missing URLs are out of scope.

| Check | Rule |
|-------|------|
| When | Before Step 1 — no exceptions |
| URLs | All `subject_pages[]`; all `intended_hubs[]` when provided |
| Pass | HTTP 200 |
| Fail | Any other status, timeout, or unfetchable |
| On fail | Stop — user clarification only; **no** handoff JSON, **no** DataForSEO |

Do not substitute repo drafts, sitemap entries, or cached copy for a failed URL.
