# robots.txt Audit — maintainer notes

Follow repo-root [`AGENTS.md`](../../../../AGENTS.md) for all public-skill rules.

## Skill-specific

- This skill audits **any domain** the user provides. Never hardcode client domains in fixtures or docs.
- **Default path** is CDN-agnostic (`origin_only` deployment).
- When Cloudflare managed markers are detected, read **`CLOUDFLARE-MANAGED.md`** and use layer-split scripts — do not treat the merged file as a single editable origin file.
- Examples use **`example.com`** only.
