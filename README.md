# Roots & Fruit — Agent Skills

Cursor agent skills for professional marketing and product development work at **[Roots & Fruit](https://rootsandfruit.com)**.

These are not one-line prompt snippets. Each skill is a **workflow package** — instructions for an AI agent, plus reference docs, examples, and optional scripts. Most marketing skills expect live data via MCP (DataForSEO, Ahrefs) or structured CSV exports you provide.

---

## What this repo is

| Area | Path | Focus |
|------|------|--------|
| **Marketing** | [`marketing/`](marketing/) | SEO, content strategy, AI-search (GEO), campaign and research workflows |
| **Product development** | [`product-dev/`](product-dev/) | Product discovery, specs, launch — *skills coming soon* |

Skills are built for **Cursor** (or any agent runtime that supports the [Agent Skills](https://cursor.com/docs/skills) standard + optional MCP). Install once globally, per project, or reference from this repo.

---

## Marketing skills

| Skill | Description |
|-------|-------------|
| [Fan-Out Coverage Analysis](marketing/fan-out-coverage-analysis/) | Map how a search query fans out into sub-questions (PAA, related, Labs expansion); optional domain coverage check |

See [`marketing/README.md`](marketing/README.md) for skill-specific setup and data requirements.

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
    └── fan-out-coverage-analysis/   # copy or symlink from marketing/fan-out-coverage-analysis/
        └── SKILL.md
```

Cursor also discovers `.agents/skills/` and nested `.cursor/skills/` folders in monorepos.

### Option D — Manual copy (fallback)

1. Clone this repo
2. Copy the skill folder into your user skills directory:

```bash
cp -r marketing/fan-out-coverage-analysis ~/.cursor/skills/fan-out-coverage-analysis
```

**Windows (PowerShell):**

```powershell
Copy-Item -Recurse marketing\fan-out-coverage-analysis "$env:USERPROFILE\.cursor\skills\fan-out-coverage-analysis"
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
├── README.md                 # This file — Roots & Fruit skills index
├── marketing/
│   ├── README.md
│   └── fan-out-coverage-analysis/
│       ├── SKILL.md
│       ├── REQUIREMENTS.md
│       ├── REFERENCE.md
│       ├── EXAMPLES.md
│       ├── examples/
│       └── scripts/
└── product-dev/              # Reserved — empty for now
```

---

## Principles

- **Domain-agnostic by default** — skills ask for the site/domain; they do not guess from context.
- **Structured handoffs** — reports plus JSON payloads for downstream briefs, audits, or writing.
- **Data-source flexible** — MCP or CSV where documented; no skill runs on vibes alone.

---

## About Roots & Fruit

[rootsandfruit.com](https://rootsandfruit.com) — marketing and product development for software businesses, especially WordPress and SaaS.

---

## License

[MIT](LICENSE)
