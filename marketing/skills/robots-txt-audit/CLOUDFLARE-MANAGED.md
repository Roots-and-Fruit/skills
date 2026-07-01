# Cloudflare managed robots.txt — companion module

**Invoked by:** parent [`SKILL.md`](SKILL.md) when edge-served `robots.txt` contains Cloudflare managed markers.  
**Not standalone:** do not run this module without completing parent Step 1 discovery first.

**Layperson context:** [Cloudflare detection](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#cloudflare-detection) · [File accessibility and CDN reality](https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/#file-accessibility-and-cdn-reality)

**SSOT scripts:** `parseRobotsTxtLayers()` in `parse-robots-txt.mjs` · `assessCloudflareLayer()` / `assessOriginLayer()` in `assess-policy.mjs` · `crawler-registry-cloudflare.mjs` · `buildCloudflareOriginAppend()` in `content-signals-presets.mjs`

**External references:**

- [Cloudflare managed robots.txt](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/)
- [What is robots.txt?](https://www.cloudflare.com/learning/bots/what-is-robots-txt/)
- [Control content use for AI training](https://blog.cloudflare.com/control-content-use-for-ai-training/)

---

## How Cloudflare composes robots.txt

When **Instruct AI bot traffic with robots.txt** is enabled, Cloudflare intercepts `/robots.txt` at the edge:

1. **Prepends** managed content (training-bot blocks, Content-Signal on `User-agent: *`)
2. **Appends** the origin `robots.txt` if one exists (HTTP 200 at origin)

Markers in the edge response:

```text
# BEGIN Cloudflare Managed content
…
# END Cloudflare Managed Content
```

Everything **after** the END marker is **origin-owned**. That is where the site operator adds `Sitemap:`, path-specific `Disallow` rules, and other site policy.

---

## Detection gate (parent skill)

Auto-detect when **both** markers appear in the fetched edge file:

- `# BEGIN Cloudflare Managed content`
- `# END Cloudflare Managed Content`

Optional input override: `robots_deployment: auto | origin_only | cloudflare_managed` (default `auto`).

Set `deployment.model: "cloudflare_managed"` in handoff when detected.

---

## Three assessment layers

| Layer | Source | Assess for |
|-------|--------|------------|
| **cloudflare** | BEGIN…END block | Training-bot blocks, Content-Signal (`search`, `ai-train`) |
| **origin** | After END marker | Sitemap, path hygiene, site-specific disallows |
| **effective** | Full merged file | What crawlers actually see; per-bot matrix; pairing checks |

Run `assessRobotsTxtContent()` — it splits layers automatically when markers are present.

---

## What Cloudflare maintains vs what origin must add

### Cloudflare layer (dashboard — keep enabled)

- Blocks common **training** crawlers (`GPTBot`, `Google-Extended`, `CCBot`, and others per CF docs)
- Sets `Content-Signal: search=yes,ai-train=no` on `User-agent: *`
- Updates managed list over time — **do not duplicate** training blocks at origin

### Origin layer (your edits below END marker)

- `Sitemap: https://{domain}/sitemap.xml` (absolute URL — CF does not inject sitemaps)
- Low-value path hygiene on `User-agent: *`: `/wp-admin/` or `/admin/`, `/cart/`, `/checkout/` when applicable
- Site-specific rules (e.g. `Disallow: /wp-content/uploads/*.html`)

### Do not recommend for CF-managed sites

- Adding `User-agent: GPTBot` / `Disallow: /` at origin when CF already blocks in the managed layer
- Merging or removing the second `User-agent: *` origin group when it carries intentional site rules
- Treating the merged file as a single file the operator fully controls

---

## max_discovery compliance under CF

`assessMaxDiscoveryLayered()` credits the **cloudflare** layer for training-bot blocks. Violations include a `layer` field:

| `layer` | Meaning |
|---------|---------|
| `cloudflare` | CF managed block gap (rare if toggle is ON) |
| `origin` | Sitemap or path hygiene missing in origin file |
| `effective` | Merged crawl posture (search/answer bots, pairing reversals) |

`policy_compliance.compliant` reflects **effective** readiness. Use `recommendations_split` for human output.

---

## Split recommendations (human output)

When `deployment.model` is `cloudflare_managed` and `crawl_policy` is `max_discovery`, emit three sections:

### A. Cloudflare dashboard

- Keep managed robots.txt enabled
- Verify live edge file after changes
- Review **Signals** / crawler logs for which directive fired (`Cloudflare Managed` vs origin rule)

### B. Origin file (append below END marker)

- `Sitemap:` line
- Path `Disallow` rules on origin `User-agent: *`
- Preserve intentional site-specific disallows

### C. Enforcement (optional)

- [AI Crawl Control](https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/) when robots.txt preference is not enough — robots.txt is voluntary ([RFC 9309](https://datatracker.ietf.org/doc/html/rfc9309))

Copy `recommendations_split` from `assessRobotsTxtContent()` into handoff.

---

## ContentSignals.org preset mapping

[ContentSignals.org](https://contentsignals.org/) generates **Content-Signal** declarations (preferences, not technical blocks). Cloudflare managed robots.txt approximates the **Search only** preset on `User-agent: *` (`search=yes`, `ai-train=no`, **no `ai-input`**).

| ContentSignals.org preset | Signals | CF managed (prepend) | Our `crawl_policy` | Origin append template |
|---------------------------|---------|----------------------|--------------------|-------------------------|
| Most restrictive | all `no` | — | `restrictive` | Not generated by default |
| **Search only** | `search=yes`, `ai-input=no`, `ai-train=no` | **≈ Yes** (`ai-input omitted`) | — | — |
| **Search + AI input** | `search=yes`, `ai-input=yes`, `ai-train=no` | Partial (no `ai-input`) | **`max_discovery`** | **`origin_append_template`** |
| All permitted | all `yes` | — | — | — |

**Operational crawl control** (what most bots honor today) stays **`Allow`/`Disallow` per bot** in `origin_append_template`. Content-Signals are **declarative** alignment with ContentSignals.org — not a substitute for bot rules or AI Crawl Control.

SSOT: `scripts/content-signals-presets.mjs` · `buildCloudflareOriginAppend()`

### When to use origin_append_template vs ContentSignals.org

| Approach | Use when |
|----------|----------|
| **Keep CF managed ON** + `origin_append_template` | Want training blocks maintained by CF + max_discovery declaration (`ai-input=yes`) and sitemap/paths at origin |
| **ContentSignals.org** + paste / Deploy to Cloudflare | Want their UI for custom per-path signals or a different preset before auditing |
| **Turn off CF managed** + full `generate` mode | Need full control of every line in one file |

---

## Origin append template (`max_discovery` + CF managed)

When `crawl_policy` is `max_discovery` and `deployment.model` is `cloudflare_managed`, `assessRobotsTxtContent()` returns **`origin_append_template`** — copy into **origin** `robots.txt` below the END marker (merge with existing origin rules).

The template:

1. Sets **Search + AI input** Content-Signal on `Googlebot`, `bingbot`, `OAI-SearchBot`, `PerplexityBot`
2. Adds `User-agent: *` path hygiene (`/wp-admin/`, `/cart/`, `/checkout/`) + `Allow: /`
3. Declares `Sitemap: https://{domain}/sitemap.xml` (override with catalog URL when known)

Handoff also includes **`content_signals`** (`preset`, `cf_managed_star`, `origin_target`, `limitations[]`).

### Limitations (state in every recommend output)

- Content-Signal support is **evolving** — not all crawlers read signals
- **`Allow`/`Disallow` per bot** remains the primary crawl lever; CF managed layer already blocks training bots
- Signals are **preferences**, not enforcement — use **AI Crawl Control** when needed
- GSC may warn on Content-Signal syntax — typically benign per Cloudflare docs
- Do **not** duplicate CF training `Disallow` lines at origin

---

## What CF UI can and cannot customize

| Dashboard | Managed block content |
|-----------|------------------------|
| Toggle managed robots.txt ON/OFF | Per-bot pick list |
| Hide Content Signals preamble | Custom `ai-input` on `*` |
| Signals / crawler logs (verify) | `Sitemap:` injection |
| AI Crawl Control (enforcement) | Path rules inside prepend |

Customization of **policy** beyond CF’s package → **origin append** or turn managed OFF.

---

## Content-Signal (R11)

Parse from the CF managed block:

```text
Content-Signal: search=yes,ai-train=no
```

| Signal | max_discovery alignment |
|--------|-------------------------|
| `search=yes` | Consistent with open search indexing |
| `ai-train=no` | Consistent with training-block intent |

`ai-input` may be unset — note in limitations. GSC may report syntax warnings on Content-Signal; Cloudflare documents this as typically benign.

---

## Handoff fields (v1.0 + optional v1.1 block)

Populate when `deployment.model === "cloudflare_managed"`:

```json
{
  "deployment": {
    "model": "cloudflare_managed",
    "companion_module": "CLOUDFLARE-MANAGED.md",
    "detected_markers": ["# BEGIN Cloudflare Managed content", "# END Cloudflare Managed Content"]
  },
  "layer_assessment": {
    "cloudflare": { "training_bots_blocked": true, "content_signals_ok": true },
    "origin": { "sitemap_present": false, "path_hygiene_ok": false },
    "effective": { "policy_compliance": { } }
  },
  "recommendations_split": {
    "cloudflare_dashboard": [],
    "origin_file": [],
    "enforcement_optional": []
  },
  "origin_append_template": "# Origin robots.txt — append below …",
  "content_signals": {
    "preset": "search_and_ai_input",
    "preset_label": "Search + AI input (ContentSignals.org)",
    "cf_managed_star": { "search": "yes", "ai_input": null, "ai_train": "no" },
    "origin_target": { "search": "yes", "ai_input": "yes", "ai_train": "no" },
    "contentsignals_org_url": "https://contentsignals.org/",
    "limitations": []
  }
}
```

`skill` remains `robots-txt-audit`. `crawler_matrix` still reflects **effective** merged rules.

---

## Fixture

Regression: `examples/example-cloudflare-managed-origin-append.robots.txt.fixture.txt` (fictional `example.com`).

```bash
node scripts/verify-cloudflare-layers.mjs
node scripts/verify-handoff.mjs examples/example-cloudflare-managed-origin-append.handoff.fixture.json
```

---

## Limitations

- CF managed bot list changes over time — audit is point-in-time
- Copy-pasted CF markers at origin without the dashboard toggle enabled → edge behavior may differ; always audit the **public edge URL**
- Other CDNs are out of scope until a second detection signature exists
