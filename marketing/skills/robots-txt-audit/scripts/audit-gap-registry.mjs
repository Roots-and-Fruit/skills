/**
 * Stable gap IDs for before/after re-audit tracking.
 */
import { MAX_DISCOVERY_OPTIONAL_TRAINING_BLOCKS } from "./crawler-registry.mjs";

/** @type {Record<string, { label: string, short: string, downside: string, category: "required" | "optional", learn_more_anchor: string }>} */
export const GAP_REGISTRY = {
  MD_SITEMAP_PRESENT: {
    label: "No sitemap URL in robots.txt (search engines use this to find your pages)",
    short: "Sitemap listed",
    downside:
      "Search engines may take longer to discover new or updated pages, so blog posts, product pages, or landing pages can show up late or get skipped.",
    category: "required",
    learn_more_anchor: "sitemap-declaration"
  },
  MD_SITEMAP_VALID: {
    label: "Sitemap entry is missing or invalid",
    short: "Valid sitemap URL",
    downside:
      "Crawlers may ignore a broken sitemap line, so you lose the main shortcut for telling Google and Bing where your pages live.",
    category: "required",
    learn_more_anchor: "sitemap-declaration"
  },
  MD_SITEMAP_TYPO: {
    label: "Invalid sitemap directive spelling (e.g. Schemamap: instead of Sitemap:)",
    short: "Sitemap directive spelling",
    downside:
      "Crawlers ignore unknown directives — Google Search Console reports syntax not understood. Your sitemap URL is never registered.",
    category: "optional",
    learn_more_anchor: "sitemap-declaration"
  },
  MD_SITEMAP_ENDPOINT: {
    label: "Declared sitemap URL returns an error (HTTP 4xx/5xx) — robots.txt is fine, but the sitemap file itself is broken",
    short: "Sitemap endpoint reachable",
    downside:
      "Search engines may struggle to discover new or updated pages even when robots.txt declares a valid sitemap URL.",
    category: "optional",
    learn_more_anchor: "sitemap-declaration"
  },
  SY_SYNTAX_UNKNOWN: {
    label: "Unrecognized robots.txt directive (GSC: syntax not understood)",
    short: "Valid directive spelling",
    downside:
      "Google Search Console may flag the line; crawlers ignore unknown directives, so intent may not apply.",
    category: "optional",
    learn_more_anchor: "syntax-validation"
  },
  SY_MALFORMED_LINE: {
    label: "Malformed robots.txt line (missing ':' separator)",
    short: "Valid line syntax",
    downside:
      "Search engines may skip the line or report a syntax warning in Google Search Console.",
    category: "optional",
    learn_more_anchor: "syntax-validation"
  },
  SY_EMPTY_DIRECTIVE: {
    label: "Empty directive name in robots.txt",
    short: "Valid directive names",
    downside:
      "Lines without a directive name are ignored and may trigger GSC syntax warnings.",
    category: "optional",
    learn_more_anchor: "syntax-validation"
  },
  MD_PATH__admin_: {
    label: "Admin area (/wp-admin/) not blocked from crawlers",
    short: "Admin area blocked",
    downside:
      "Login and dashboard URLs can appear in search results — not a full security fix, but it looks unprofessional and invites unnecessary probing.",
    category: "required",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX__cart_: {
    label: "Cart pages lack noindex (index control)",
    short: "Cart noindex set",
    downside:
      "Empty or session-specific cart URLs can get indexed and clutter search results — use noindex on-page, not robots.txt Disallow.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX__checkout_: {
    label: "Checkout pages lack noindex (index control)",
    short: "Checkout noindex set",
    downside:
      "Checkout URLs may surface in search with thin transactional content — use noindex meta or X-Robots-Tag instead of robots.txt Disallow.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX_ROBOTS_CONFLICT__cart_: {
    label: "Cart has noindex but is blocked in robots.txt",
    short: "Cart crawl/noindex aligned",
    downside:
      "Google cannot read noindex when the URL is blocked in robots.txt — the page may stay in search results via inbound links.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX_ROBOTS_CONFLICT__checkout_: {
    label: "Checkout has noindex but is blocked in robots.txt",
    short: "Checkout crawl/noindex aligned",
    downside:
      "Google cannot read noindex when the URL is blocked in robots.txt — the page may stay in search results via inbound links.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX_ROBOTS_ONLY__cart_: {
    label: "Cart blocked in robots.txt without confirmed noindex",
    short: "Cart index control verified",
    downside:
      "robots.txt Disallow alone does not remove URLs from search — crawlers never see a noindex signal when blocked.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_INDEX_ROBOTS_ONLY__checkout_: {
    label: "Checkout blocked in robots.txt without confirmed noindex",
    short: "Checkout index control verified",
    downside:
      "robots.txt Disallow alone does not remove URLs from search — crawlers never see a noindex signal when blocked.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_PATH__cart_: {
    label: "Cart pages not blocked from crawlers",
    short: "Cart pages blocked",
    downside:
      "Deprecated check — prefer noindex for cart URLs. robots.txt Disallow is not required when noindex is set.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_PATH__checkout_: {
    label: "Checkout pages not blocked from crawlers",
    short: "Checkout pages blocked",
    downside:
      "Deprecated check — prefer noindex for checkout URLs. robots.txt Disallow is not required when noindex is set.",
    category: "optional",
    learn_more_anchor: "path-hygiene"
  },
  MD_GPTBot: {
    label: "OpenAI training bot (GPTBot) can still crawl the site",
    short: "GPTBot blocked",
    downside:
      "Your public content may be collected for model training unless you block training crawlers or use enforcement.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_Google_Extended: {
    label: "Google AI training bot not blocked",
    short: "Google-Extended blocked",
    downside:
      "Google may use crawled content for AI training products separate from normal search indexing.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_CCBot: {
    label: "Common Crawl training bot not blocked",
    short: "CCBot blocked",
    downside:
      "Your pages may enter open training datasets used by many AI tools downstream.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_RESTRICT_OAI_SearchBot: {
    label: "ChatGPT search/citation bot is still allowed (should be blocked under restrictive)",
    short: "ChatGPT search blocked",
    downside:
      "Under restrictive policy, AI answer bots should be blocked — you trade GEO citations for tighter crawl control.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_RESTRICT_Claude_SearchBot: {
    label: "Claude search/citation bot is still allowed (should be blocked under restrictive)",
    short: "Claude search blocked",
    downside:
      "Restrictive policy blocks AI answer crawlers — Claude may still cite your pages if left allowed.",
    category: "required",
    learn_more_anchor: "anthropic-search-pairing"
  },
  MD_RESTRICT_PerplexityBot: {
    label: "Perplexity discovery bot is still allowed (should be blocked under restrictive)",
    short: "Perplexity blocked",
    downside:
      "Restrictive policy expects answer bots blocked — Perplexity may still reference your content.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_OAI_SearchBot: {
    label: "ChatGPT search/citation bot is blocked (bad for AI visibility)",
    short: "ChatGPT search allowed",
    downside:
      "ChatGPT and similar answer tools may not cite or surface your pages when people ask questions in your niche.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_PerplexityBot: {
    label: "Perplexity discovery bot is blocked",
    short: "Perplexity allowed",
    downside:
      "Perplexity may not discover or reference your content in AI-generated answers.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_Googlebot: {
    label: "Google search bot is blocked (bad for SEO)",
    short: "Google search allowed",
    downside:
      "Google may not crawl or rank your pages normally — this hurts organic traffic directly.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_bingbot: {
    label: "Bing search bot is blocked",
    short: "Bing search allowed",
    downside:
      "Bing and partners (including some AI answers) may miss your content entirely.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_GOOGLE_PAIRING: {
    label: "Google search blocked but AI training allowed — settings are reversed",
    short: "Google rules aligned",
    downside:
      "You can end up invisible in search while still allowing training crawlers — the worst of both worlds for visibility.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_OPENAI_PAIRING: {
    label: "ChatGPT search blocked but training allowed — settings are reversed",
    short: "OpenAI rules aligned",
    downside:
      "ChatGPT may not cite you in answers while training bots can still ingest your content.",
    category: "required",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  MD_ClaudeBot: {
    label: "Anthropic training bot (ClaudeBot) can still crawl the site",
    short: "ClaudeBot blocked",
    downside:
      "Your public content may be collected for Anthropic model training unless you block training crawlers.",
    category: "optional",
    learn_more_anchor: "anthropic-search-pairing"
  },
  MD_Claude_SearchBot: {
    label: "Claude search/citation bot is blocked (bad for AI visibility)",
    short: "Claude search allowed",
    downside:
      "Claude answer tools may not cite or surface your pages when people ask questions in your niche.",
    category: "required",
    learn_more_anchor: "anthropic-search-pairing"
  },
  MD_ANTHROPIC_PAIRING: {
    label: "Claude search blocked but training allowed — settings are reversed",
    short: "Anthropic rules aligned",
    downside:
      "Claude may not cite you in answers while training bots can still ingest your content.",
    category: "required",
    learn_more_anchor: "anthropic-search-pairing"
  },
  OPT_ANTHROPIC_AI: {
    label: "Legacy Anthropic training bot (anthropic-ai) not explicitly blocked",
    short: "Anthropic training blocked",
    downside:
      "Older Anthropic crawlers may still treat your site as open for training unless explicitly blocked.",
    category: "optional",
    learn_more_anchor: "anthropic-search-pairing"
  },
  OPT_Bytespider: {
    label: "ByteDance training bot (Bytespider) not explicitly blocked",
    short: "Bytespider blocked",
    downside:
      "A fast-growing training crawler may keep fetching despite industry-wide blocks — consider explicit Disallow plus CDN enforcement if load spikes.",
    category: "optional",
    learn_more_anchor: "enforcement-beyond-robots-txt"
  },
  OPT_Meta_ExternalAgent: {
    label: "Meta AI training bot (Meta-ExternalAgent) not explicitly blocked",
    short: "Meta training blocked",
    downside:
      "Meta’s training crawler returns no referral traffic — blocking reduces one-way extraction when bots comply.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  OPT_Amazonbot: {
    label: "Amazon training bot (Amazonbot) not explicitly blocked",
    short: "Amazonbot blocked",
    downside:
      "Amazon may use crawled product and content data for Alexa and AI features — retailers often block explicitly.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  OPT_Applebot_Extended: {
    label: "Apple AI training bot (Applebot-Extended) not explicitly blocked",
    short: "Apple training blocked",
    downside:
      "Apple may use crawled content for Apple Intelligence training separate from Apple Search indexing.",
    category: "optional",
    learn_more_anchor: "training-vs-search-and-answer-bots"
  },
  OPT_AI_INPUT_SIGNAL: {
    label: "AI “answer” permission (ai-input signal) not declared at origin — optional for GEO alignment",
    short: "AI answer signal declared",
    downside:
      "You miss a clear declaration that AI answer tools may use your content — mostly a GEO alignment gap, not a hard crawl block.",
    category: "optional",
    learn_more_anchor: "content-signal-alignment"
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
    category: "required",
    learn_more_anchor: ""
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
  const crawlPolicy = assessment.crawl_policy ?? "audit_only";
  const trainingRequired =
    crawlPolicy === "block_training_allow_answers" || crawlPolicy === "restrictive";
  const hasSitemapPresent = violations.some((v) => v.id === "MD_SITEMAP_PRESENT");

  const trainingGapIds = new Set([
    "MD_GPTBot",
    "MD_Google_Extended",
    "MD_CCBot",
    "MD_ClaudeBot"
  ]);

  for (const v of violations) {
    if (v.id === "MD_SITEMAP_VALID" && hasSitemapPresent) {
      continue;
    }
    const gap = gapFromViolation(v);
    if (!seen.has(gap.id)) {
      seen.add(gap.id);
      const category = trainingGapIds.has(gap.id)
        ? trainingRequired
          ? "required"
          : "optional"
        : gap.category;
      if (category === "optional") {
        optional.push({ ...gap, category });
      } else {
        required.push({ ...gap, category });
      }
    }
  }

  for (const warning of assessment.index_control_validation?.warnings ?? []) {
    if (seen.has(warning.id)) {
      continue;
    }
    const gap = gapFromViolation(warning);
    seen.add(gap.id);
    optional.push({ ...gap, category: "optional" });
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

  const hasSitemapTypo = (assessment.sitemap_validation?.issues ?? []).some(
    (i) => i.id === "SM8"
  );
  if (hasSitemapTypo && !seen.has("MD_SITEMAP_TYPO")) {
    const gap = GAP_REGISTRY.MD_SITEMAP_TYPO;
    optional.push({ id: "MD_SITEMAP_TYPO", ...gap });
    seen.add("MD_SITEMAP_TYPO");
  }

  const syntaxGapById = {
    SY1: "SY_SYNTAX_UNKNOWN",
    SY2: "SY_MALFORMED_LINE",
    SY3: "SY_EMPTY_DIRECTIVE"
  };
  for (const issue of assessment.syntax_validation?.issues ?? []) {
    const gapId = syntaxGapById[issue.id];
    if (!gapId || seen.has(gapId)) {
      continue;
    }
    const gap = GAP_REGISTRY[gapId];
    if (gap) {
      optional.push({ id: gapId, ...gap });
      seen.add(gapId);
    }
  }

  const matrix = assessment.crawler_matrix ?? [];
  const anthropic = matrix.find((r) => r.token === "anthropic-ai");
  if (anthropic?.training_crawl === "allowed" && !seen.has("OPT_ANTHROPIC_AI")) {
    optional.push({ id: "OPT_ANTHROPIC_AI", ...GAP_REGISTRY.OPT_ANTHROPIC_AI });
    seen.add("OPT_ANTHROPIC_AI");
  }

  const policy = assessment.crawl_policy ?? "audit_only";
  if (policy === "block_training_allow_answers") {
    for (const token of MAX_DISCOVERY_OPTIONAL_TRAINING_BLOCKS) {
      const gapId = `OPT_${token.replace(/[^a-zA-Z0-9]/g, "_")}`;
      const entry = GAP_REGISTRY[gapId];
      if (!entry || seen.has(gapId)) {
        continue;
      }
      const row = matrix.find((r) => r.token === token);
      if (row?.training_crawl === "allowed") {
        optional.push({ id: gapId, ...entry });
        seen.add(gapId);
      }
    }
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

  const site_health = [];
  const sm7Issues = (assessment.sitemap_validation?.issues ?? []).filter((i) => i.id === "SM7");
  if (sm7Issues.length > 0 && !seen.has("MD_SITEMAP_ENDPOINT")) {
    const gap = GAP_REGISTRY.MD_SITEMAP_ENDPOINT;
    const statusMatch = sm7Issues[0].message.match(/HTTP (\d+)/);
    const urlMatch = sm7Issues[0].message.match(/https?:\/\/\S+/);
    const label =
      statusMatch && urlMatch
        ? `Declared sitemap at ${urlMatch[0]} returns HTTP ${statusMatch[1]} — robots.txt is fine, but the sitemap file itself is broken`
        : gap.label;
    site_health.push({ id: "MD_SITEMAP_ENDPOINT", ...gap, label });
    seen.add("MD_SITEMAP_ENDPOINT");
  }

  return { required, optional, site_health };
}

/**
 * @param {{ required: { id: string }[], optional: { id: string }[], site_health?: { id: string }[] }} gaps
 */
export function gapsToSnapshot(gaps) {
  const siteHealth = gaps.site_health ?? [];
  return {
    required_ids: gaps.required.map((g) => g.id),
    optional_ids: gaps.optional.map((g) => g.id),
    site_health_ids: siteHealth.map((g) => g.id),
    required_labels: gaps.required.map((g) => g.label),
    optional_labels: gaps.optional.map((g) => g.label),
    site_health_labels: siteHealth.map((g) => g.label)
  };
}
