# Requirements

This skill is a **workflow for an AI agent**. It does not fetch data on its own.

You need a **target** (URL or draft), a **primary keyword**, and a way to read page content plus (usually) one SERP pull for competitor discovery.

---

## The short version

| You have… | Skill usefulness |
|-----------|------------------|
| **DataForSEO MCP + WebFetch** | Full workflow — best documented path |
| **Ahrefs MCP + WebFetch** | Full workflow — you supply SERP URLs; agent maps tools |
| **Pinned competitor URLs + WebFetch** | Strong path — no SERP required for competitor pick |
| **Draft content only** | Partial — comparative scoring if competitors are pinned or from SERP |
| **None of the above** | Skill will not produce meaningful results |

Pick **one** path. You do not need every integration.

---

## Always required

- **Cursor** (or similar agent with skills + optional MCP)
- **Primary keyword** and **target URL or draft** from the user — never from skill examples or workspace context
- **WebFetch** or equivalent page-reading capability

**Optional:**

- **Node.js 18+** — for `node scripts/verify-handoff.mjs`
- **Pinned competitor URLs** — stabilizes regression testing

### Mixed-intent SERPs

Some keywords mix how-to guides and tool roundups. The skill classifies lanes in Step 0.5 and may ask which lane defines the competitor set. Plan for a one-line answer, or pass `intent_lane` from an upstream fan-out handoff.

---

## Option A — DataForSEO MCP + WebFetch (recommended)

### What you need

- Active [DataForSEO](https://dataforseo.com) account with API credits
- DataForSEO MCP connected in Cursor
- WebFetch (or browser fetch) for target and competitor pages

### What it covers

| Workflow step | Tool |
|---------------|------|
| SERP + competitor discovery | `serp_organic_live_advanced` |
| Page content | WebFetch |

### Setup pointer

See [`marketing/README.md`](../README.md) → **DataForSEO MCP**.

---

## Option B — Ahrefs MCP + WebFetch

Use when you already have Ahrefs MCP instead of DataForSEO.

| Workflow step | Ahrefs equivalent (conceptual) |
|---------------|--------------------------------|
| SERP / top URLs | SERP overview or organic results export for the keyword |
| Page content | WebFetch on target + competitor URLs |

**Caveat:** Ahrefs MCP tool names vary — read your MCP tool list and map to the same handoff schema. Note gaps in `limitations[]`.

---

## Option C — Pinned competitors (no SERP)

Best for **stable regression tests** and when you already know the competitive set.

Provide in your prompt:

- Target URL (or draft)
- Primary keyword
- 3–5 competitor URLs

Example:

> *Evaluate information gain for https://example.com/guides/enterprise-sso on keyword "enterprise SSO". Pinned competitors: https://vendor-a.com/sso-guide, https://vendor-b.com/blog/sso …*

Agent skips auto competitor selection; SERP call optional for context only.

---

## Option D — Draft content

Provide pasted markdown or HTML as the target plus keyword and either pinned competitors or live SERP.

Example:

> *Draft mode — evaluate this draft for keyword "enterprise SSO" against SERP competitors. [paste content]*

---

## What does *not* count as a data source

- Skill files and examples alone
- Guessing competitor claims without fetching
- General web search substituted for reading actual competitor pages

---

## Quick decision guide

```
Have target URL or draft + keyword?
  no → gather inputs first
  yes ↓

Have pinned competitor URLs?
  yes → Option C (most stable for testing)
  no ↓

Have DataForSEO MCP?
  yes → Option A
  no ↓

Have Ahrefs MCP?
  yes → Option B
  no → Option C with manual URL list
```

---

## Related docs

| File | Contents |
|------|----------|
| `SKILL.md` | Agent workflow |
| `REFERENCE.md` | SERP params, dimensions, handoff schema |
| `EXAMPLES.md` | Sample report and handoff |
| `examples/SCORECARD-enterprise-sso.md` | Regression + live MCP test protocol |
