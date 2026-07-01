/**
 * Stable gap IDs for before/after re-audit tracking.
 */

/** @type {Record<string, { label: string, short: string, downside: string, category: "required" | "optional" }>} */
export const GAP_REGISTRY = {
  MD_SITEMAP_PRESENT: {
    label: "No sitemap URL in robots.txt (search engines use this to find your pages)",
    short: "Sitemap listed",
    downside:
      "Search engines may take longer to discover new or updated pages, so blog posts, product pages, or landing pages can show up late or get skipped.",
    category: "required"
  },
  MD_SITEMAP_VALID: {
    label: "Sitemap entry is missing or invalid",
    short: "Valid sitemap URL",
    downside:
      "Crawlers may ignore a broken sitemap line, so you lose the main shortcut for telling Google and Bing where your pages live.",
    category: "required"
  },
  MD_PATH__admin_: {
    label: "Admin area (/wp-admin/) not blocked from crawlers",
    short: "Admin area blocked",
    downside:
      "Login and dashboard URLs can appear in search results — not a full security fix, but it looks unprofessional and invites unnecessary probing.",
    category: "required"
  },
  MD_PATH__cart_: {
    label: "Cart pages not blocked from crawlers",
    short: "Cart pages blocked",
    downside:
      "Empty or session-specific cart URLs can get indexed and clutter search results with thin, low-value pages.",
    category: "required"
  },
  MD_PATH__checkout_: {
    label: "Checkout pages not blocked from crawlers",
    short: "Checkout pages blocked",
    downside:
      "Checkout URLs may surface in search with duplicate or transactional content that does not help visitors or conversions.",
    category: "required"
  },
  MD_GPTBot: {
    label: "OpenAI training bot (GPTBot) can still crawl the site",
    short: "GPTBot blocked",
    downside:
      "Your public content may be collected for model training unless you block training crawlers or use enforcement.",
    category: "required"
  },
  MD_Google_Extended: {
    label: "Google AI training bot not blocked",
    short: "Google-Extended blocked",
    downside:
      "Google may use crawled content for AI training products separate from normal search indexing.",
    category: "required"
  },
  MD_CCBot: {
    label: "Common Crawl training bot not blocked",
    short: "CCBot blocked",
    downside:
      "Your pages may enter open training datasets used by many AI tools downstream.",
    category: "required"
  },
  MD_OAI_SearchBot: {
    label: "ChatGPT search/citation bot is blocked (bad for AI visibility)",
    short: "ChatGPT search allowed",
    downside:
      "ChatGPT and similar answer tools may not cite or surface your pages when people ask questions in your niche.",
    category: "required"
  },
  MD_PerplexityBot: {
    label: "Perplexity discovery bot is blocked",
    short: "Perplexity allowed",
    downside:
      "Perplexity may not discover or reference your content in AI-generated answers.",
    category: "required"
  },
  MD_Googlebot: {
    label: "Google search bot is blocked (bad for SEO)",
    short: "Google search allowed",
    downside:
      "Google may not crawl or rank your pages normally — this hurts organic traffic directly.",
    category: "required"
  },
  MD_bingbot: {
    label: "Bing search bot is blocked",
    short: "Bing search allowed",
    downside:
      "Bing and partners (including some AI answers) may miss your content entirely.",
    category: "required"
  },
  MD_GOOGLE_PAIRING: {
    label: "Google search blocked but AI training allowed — settings are reversed",
    short: "Google rules aligned",
    downside:
      "You can end up invisible in search while still allowing training crawlers — the worst of both worlds for visibility.",
    category: "required"
  },
  MD_OPENAI_PAIRING: {
    label: "ChatGPT search blocked but training allowed — settings are reversed",
    short: "OpenAI rules aligned",
    downside:
      "ChatGPT may not cite you in answers while training bots can still ingest your content.",
    category: "required"
  },
  OPT_ANTHROPIC_AI: {
    label: "Legacy Anthropic training bot (anthropic-ai) not explicitly blocked",
    short: "Anthropic training blocked",
    downside:
      "Older Anthropic crawlers may still treat your site as open for training unless explicitly blocked.",
    category: "optional"
  },
  OPT_AI_INPUT_SIGNAL: {
    label: "AI “answer” permission (ai-input signal) not declared at origin — optional for GEO alignment",
    short: "AI answer signal declared",
    downside:
      "You miss a clear declaration that AI answer tools may use your content — mostly a GEO alignment gap, not a hard crawl block.",
    category: "optional"
  }
};

/**
 * @param {{ id: string, message?: string }} violation
 */
export function gapFromViolation(violation) {
  const entry = GAP_REGISTRY[violation.id];
  if (entry) {
    return { id: violation.id, ...entry };
  }
  return {
    id: violation.id,
    label: violation.message ?? violation.id,
    short: violation.id,
    downside: "This gap can leave crawl behavior misaligned with your stated policy.",
    category: "required"
  };
}

/**
 * @param {import("./assess-policy.mjs").assessRobotsTxtContent extends (...args: any) => infer R ? R["assessment"] : never} assessment
 */
export function collectGapsFromAssessment(assessment) {
  const required = [];
  const optional = [];
  const seen = new Set();
  const violations = assessment.policy_compliance?.violations ?? [];
  const hasSitemapPresent = violations.some((v) => v.id === "MD_SITEMAP_PRESENT");

  for (const v of violations) {
    if (v.id === "MD_SITEMAP_VALID" && hasSitemapPresent) {
      continue;
    }
    const gap = gapFromViolation(v);
    if (!seen.has(gap.id)) {
      seen.add(gap.id);
      if (gap.category === "optional") {
        optional.push(gap);
      } else {
        required.push(gap);
      }
    }
  }

  if (
    assessment.sitemap_validation?.status === "fail" &&
    !hasSitemapPresent &&
    violations.length === 0 &&
    !seen.has("MD_SITEMAP_PRESENT")
  ) {
    const gap = GAP_REGISTRY.MD_SITEMAP_PRESENT;
    required.push({ id: "MD_SITEMAP_PRESENT", ...gap });
    seen.add("MD_SITEMAP_PRESENT");
  }

  const matrix = assessment.crawler_matrix ?? [];
  const anthropic = matrix.find((r) => r.token === "anthropic-ai");
  if (anthropic?.training_crawl === "allowed" && !seen.has("OPT_ANTHROPIC_AI")) {
    optional.push({ id: "OPT_ANTHROPIC_AI", ...GAP_REGISTRY.OPT_ANTHROPIC_AI });
    seen.add("OPT_ANTHROPIC_AI");
  }

  if (
    assessment.deployment?.model === "cloudflare_managed" &&
    assessment.content_signals?.cf_managed_star?.ai_input == null &&
    assessment.crawl_policy === "max_discovery" &&
    !seen.has("OPT_AI_INPUT_SIGNAL")
  ) {
    optional.push({ id: "OPT_AI_INPUT_SIGNAL", ...GAP_REGISTRY.OPT_AI_INPUT_SIGNAL });
    seen.add("OPT_AI_INPUT_SIGNAL");
  }

  return { required, optional };
}

/**
 * @param {{ required: { id: string }[], optional: { id: string }[] }} gaps
 */
export function gapsToSnapshot(gaps) {
  return {
    required_ids: gaps.required.map((g) => g.id),
    optional_ids: gaps.optional.map((g) => g.id),
    required_labels: gaps.required.map((g) => g.label),
    optional_labels: gaps.optional.map((g) => g.label)
  };
}
