# Roots & Fruit — Agent Skills

Cursor agent skills for professional marketing and product development work at **[Roots & Fruit](https://rootsandfruit.com)**.

These are not one-line prompt snippets. Each skill is a **workflow package** — instructions for an AI agent, plus reference docs, examples, and optional scripts. Most marketing skills expect live data via MCP (DataForSEO, Ahrefs) or structured CSV exports you provide.

---

## What this repo is

| Area | Path | Focus |
|------|------|--------|
| **Marketing** | [`marketing/`](marketing/) | SEO, content strategy, AI-search (GEO), campaign and research workflows |
| **Product development** | [`product-dev/`](product-dev/) | Product discovery, specs, launch — *skills coming soon* |

Skills are built for **Cursor** (or any agent runtime that supports skill folders + MCP). Copy a skill into `~/.cursor/skills/` or reference it as a project skill.

---

## Marketing skills

| Skill | Description |
|-------|-------------|
| [Fan-Out Coverage Analysis](marketing/fan-out-coverage-analysis/) | Map how a search query fans out into sub-questions (PAA, related, Labs expansion); optional domain coverage check |

See [`marketing/README.md`](marketing/README.md) for install notes and data-source requirements.

---

## Product development skills

Nothing published here yet. The `product-dev/` directory is reserved for discovery, positioning, spec, and launch workflows.

---

## Install (general)

1. Clone this repo.
2. Copy the skill folder you need into your Cursor skills directory:

```bash
# Example: fan-out coverage
cp -r marketing/fan-out-coverage-analysis ~/.cursor/skills/fan-out-coverage-analysis
```

**Windows (PowerShell):**

```powershell
Copy-Item -Recurse marketing\fan-out-coverage-analysis "$env:USERPROFILE\.cursor\skills\fan-out-coverage-analysis"
```

3. Configure any required MCP servers or data exports per that skill's `REQUIREMENTS.md`.
4. Restart Cursor and invoke the skill by describing the task in chat.

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
