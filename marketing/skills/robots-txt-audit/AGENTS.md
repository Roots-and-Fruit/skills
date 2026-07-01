# robots.txt Audit — maintainer notes

Follow repo-root [`AGENTS.md`](../../../../AGENTS.md) for all public-skill rules.

## Skill-specific

- This skill audits **any domain** the user provides. Never hardcode client domains in fixtures or docs.
- **Default path** is CDN-agnostic (`origin_only` deployment).
- When Cloudflare managed markers are detected, read **`CLOUDFLARE-MANAGED.md`** and use layer-split scripts — do not treat the merged file as a single editable origin file.
- **Public reference:** [robots.txt audit reference guide](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/) — user-facing learn-more links and practitioner context; update that article when modes, policies, or provider contracts change.
- Examples use **`example.com`** only.
