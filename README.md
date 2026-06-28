# Roots & Fruit — Agent Skills

Cursor agent skills for professional marketing and product development work at **[Roots & Fruit](https://rootsandfruit.com)**.

These are not one-line prompt snippets. Each skill is a **workflow package** — instructions for an AI agent, plus reference docs, examples, and optional scripts. Most marketing skills expect live data via MCP (DataForSEO, Ahrefs) or structured CSV exports you provide.

---

## What this repo is

| Area | Path | Focus |
|------|------|--------|
| **Marketing** | [`marketing/`](marketing/) | SEO, content strategy, AI-search (GEO), campaign and research workflows |
| **Product development** | [`product-dev/`](product-dev/) | Product discovery, specs, launch — *skills coming soon* |
| **Utilities** | [`utilities/`](utilities/) | Meta-skills for authoring and packaging skills in this repo |

Skills are built for **Cursor** (or any agent runtime that supports the [Agent Skills](https://cursor.com/docs/skills) standard + optional MCP). Install once globally, per project, or reference from this repo.

---

## Marketing skills

| Skill | Description |
|-------|-------------|
| [Fan-Out Coverage Analysis](marketing/skills/fan-out-coverage-analysis/) | Map how a search query fans out into sub-questions (PAA, related, Labs expansion); optional domain coverage check |
| [Information Gain Evaluator](marketing/skills/information-gain-evaluator/) | Rigorous SERP-comparative citation gain scoring (handoff v1.1, citation fit + page–keyword fit) |
| [Site Content Catalog](marketing/skills/site-content-catalog/) | Sitemap or domain page inventory with `page_type` labels and optional SEO signals (handoff v1.0, WordPress child sitemaps) |
| [Analytics and Search Console Performance Audit](marketing/skills/analytics-and-searchconsole-performance-audit/) | GSC query-intent discovery + optional GA4 conversion quadrants (`discovery_only` / `discovery_plus_conversions`); handoff v1.0; Phase 1a for hub-and-spoke playbook |
| [robots.txt Audit](marketing/skills/robots-txt-audit/) | AI crawler permissions, cornerstone crawlability, and policy-aligned robots.txt (handoff v1.0) |
| [SEO Cannibalization Audit](marketing/skills/seo-cannibalization-audit/) | Same-domain keyword overlap, intent comparison, resolution recommendations (playbook Phase 4a) |

### Playbooks (in progress)

| Playbook | Description |
|----------|-------------|
| [Hub & Spoke Discovery & Recovery](marketing/playbooks/hub-spoke-discovery-recovery/) | Bottom-up discovery — GSC/GA4 performance matrix + DataForSEO triangulation + recovery plan (v0.3.0) |
| [Cornerstone Content Audit](marketing/playbooks/cornerstone-content-audit/) | Top-down cornerstone health audit when pillars are already known |

See [`marketing/README.md`](marketing/README.md) for skill-specific setup and data requirements.

---

## Utilities

| Utility | Description |
|---------|-------------|
| [write-a-skill](utilities/write-a-skill/) | Author skills — predictability + right-sized tiers; regression when earned |
| [web-scrape-to-md](utilities/web-scrape-to-md/) | Scrape sites to markdown — llms-first, sitemap/blog fallbacks, freshness pass, handoff v1.1 |

See [`utilities/README.md`](utilities/README.md).

---

## Product development skills

Nothing published here yet. The `product-dev/` directory is reserved for discovery, positioning, spec, and launch workflows.

---

## Install

Pick one path. You do **not** need a separate public registry — this GitHub repo is enough.

### Option A — Skills CLI (recommended)

Uses the open [skills.sh](https://skills.sh/) ecosystem. Installs into Cursor automatically.

**Global** (all projects):

```bash
npx skills add Roots-and-Fruit/skills -g -y
```

**This project only** (omit `-g`):

```bash
npx skills add Roots-and-Fruit/skills -y
```

List skills in the repo without installing:

```bash
npx skills add Roots-and-Fruit/skills --list
```

Search the broader catalog:

```bash
npx skills find fan-out
```

### Option B — Cursor Remote Rule (UI)

1. Open **Customize** in the Cursor sidebar
2. Go to **Rules** → **Add Rule**
3. Choose **Remote Rule (Github)**
4. Enter: `https://github.com/Roots-and-Fruit/skills`

See [Cursor docs — Installing skills from GitHub](https://cursor.com/docs/skills#installing-skills-from-github).

### Option C — Project skill (team / git)

Commit skills into your repo so everyone gets them on clone:

```text
your-repo/
└── .cursor/skills/
    └── fan-out-coverage-analysis/   # copy or symlink from marketing/skills/fan-out-coverage-analysis/
        └── SKILL.md
```

Cursor also discovers `.agents/skills/` and nested `.cursor/skills/` folders in monorepos.

### Option D — Manual copy (fallback)

1. Clone this repo
2. Copy the skill folder into your user skills directory:

```bash
cp -r marketing/skills/fan-out-coverage-analysis ~/.cursor/skills/fan-out-coverage-analysis
```

**Windows (PowerShell):**

```powershell
Copy-Item -Recurse marketing\skills\fan-out-coverage-analysis "$env:USERPROFILE\.cursor\skills\fan-out-coverage-analysis"
```

---

## After install

1. Configure MCP or data exports per the skill's `REQUIREMENTS.md` (e.g. DataForSEO for fan-out).
2. Restart Cursor if skills do not appear immediately.
3. **Invoke** in Agent chat:
   - Type `/` and pick the skill, or
   - Attach `@SKILL.md`, or
   - Describe the task — the agent matches on the skill `description`.

View installed skills: **Customize → Skills** (Agent Decides section).

---

## Repo layout

```text
skills/
├── README.md
├── marketing/
│   ├── README.md
│   ├── playbooks/
│   │   ├── cornerstone-content-audit/
│   │   ├── cornerstone-discovery-audit/   # redirect stub → hub-spoke-discovery-recovery
│   │   └── hub-spoke-discovery-recovery/
│   └── skills/
│       ├── analytics-and-searchconsole-performance-audit/
│       ├── fan-out-coverage-analysis/
│       ├── information-gain-evaluator/
│       ├── site-content-catalog/
│       ├── seo-cannibalization-audit/
│       └── robots-txt-audit/
├── utilities/
│   ├── write-a-skill/
│   └── web-scrape-to-md/
└── product-dev/
```

---

## Principles

- **Domain-agnostic by default** — skills ask for the site/domain; they do not guess from context.
- **Structured handoffs** — reports plus JSON payloads for downstream briefs, audits, or writing.
- **Data-source flexible** — MCP or CSV where documented; no skill runs on vibes alone.

---

## Influences

Authoring conventions in this repo (especially [`utilities/write-a-skill/`](utilities/write-a-skill/)) combine:

- **[Matt Pocock — writing-great-skills](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-great-skills)** — predictable process, completion criteria, progressive disclosure inside the skill body, pruning passes.
- **[Chris Lema — skills that don't fire](https://chrislema.com/youve-installed-a-claude-skill-and-its-not-working-how-to-fix-it)** — frontmatter `description` as the routing trigger; widen user vocabulary on the opening line (`Use when …`).

Roots & Fruit adds **right-sized package tiers** (A/B/C), **handoff JSON**, **SCORECARD** regression IDs, and **verify scripts** where drift would break downstream playbooks. Skill files stay operational; credits live here.

---

## About Roots & Fruit

[rootsandfruit.com](https://rootsandfruit.com) — marketing and product development for software businesses, especially WordPress and SaaS.

---

## License

[MIT](LICENSE)
