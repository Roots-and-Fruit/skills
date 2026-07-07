/**
 * SSOT crawler registry: role, what robots.txt controls per bot, max_discovery expectation.
 * Verify tokens against provider docs before production deploy.
 */

/** @typedef {'indexing' | 'ai_answer' | 'ai_training' | 'user_triggered' | 'commercial_seo'} CrawlerRole */

/**
 * @typedef {Object} CrawlerDefinition
 * @property {CrawlerRole[]} roles
 * @property {'allow' | 'block'} max_discovery_site_access Expected crawl access at `/` for max_discovery
 * @property {string} controls What Disallow/Allow governs for this token
 * @property {string} [paired_token] Related token users often confuse
 * @property {string} [note]
 */

/** @type {Record<string, CrawlerDefinition>} */
export const CRAWLER_REGISTRY = {
  Googlebot: {
    roles: ["indexing"],
    max_discovery_site_access: "allow",
    controls: "Traditional Google Search crawling and indexing",
    paired_token: "Google-Extended",
    note: "Keep unblocked for SEO unless there is a precise non-search reason."
  },
  bingbot: {
    roles: ["indexing"],
    max_discovery_site_access: "allow",
    controls: "Bing search crawling and indexing"
  },
  Applebot: {
    roles: ["indexing", "ai_answer"],
    max_discovery_site_access: "allow",
    controls: "Apple Search, Siri, and Spotlight discovery",
    paired_token: "Applebot-Extended"
  },
  "OAI-SearchBot": {
    roles: ["ai_answer", "indexing"],
    max_discovery_site_access: "allow",
    controls: "ChatGPT search retrieval and citation discovery",
    paired_token: "GPTBot",
    note: "Allow for GEO; distinct from training crawler GPTBot."
  },
  "Claude-SearchBot": {
    roles: ["ai_answer", "indexing"],
    max_discovery_site_access: "allow",
    controls: "Claude web search retrieval and citation discovery",
    paired_token: "ClaudeBot",
    note: "Anthropic search crawler (2026+). Allow for GEO; distinct from training crawler ClaudeBot."
  },
  PerplexityBot: {
    roles: ["ai_answer", "indexing"],
    max_discovery_site_access: "allow",
    controls: "Perplexity search indexing and answer citations"
  },
  GPTBot: {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "OpenAI model training crawl",
    paired_token: "OAI-SearchBot",
    note: "Blocking limits training reuse; does not block ChatGPT search bot."
  },
  "Google-Extended": {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Google generative-AI product training token (robots.txt only)",
    paired_token: "Googlebot",
    note: "Does not affect Google Search when Googlebot remains allowed."
  },
  CCBot: {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Common Crawl corpus inclusion"
  },
  ClaudeBot: {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Anthropic model training crawl",
    paired_token: "Claude-SearchBot",
    note: "Block training; allow Claude-SearchBot separately for Claude answer citations."
  },
  "anthropic-ai": {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Anthropic legacy training crawl token"
  },
  "Applebot-Extended": {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Apple foundation-model training token",
    paired_token: "Applebot"
  },
  "Meta-ExternalAgent": {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Meta AI/product improvement crawl",
    note: "High crawl volume with no referral return — common training-block target."
  },
  Bytespider: {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "ByteDance AI training crawl",
    note:
      "Among the fastest-growing AI crawlers; may ignore robots.txt — pair blocks with CDN/WAF if needed."
  },
  Amazonbot: {
    roles: ["ai_training"],
    max_discovery_site_access: "block",
    controls: "Amazon Alexa and product/AI feature crawl"
  },
  "ChatGPT-User": {
    roles: ["user_triggered"],
    max_discovery_site_access: "allow",
    controls: "User-prompted URL fetch in ChatGPT",
    note: "May not obey robots.txt like automated crawlers; document only."
  },
  "Perplexity-User": {
    roles: ["user_triggered"],
    max_discovery_site_access: "allow",
    controls: "User-prompted fetch in Perplexity",
    note: "May not obey robots.txt like automated crawlers; document only."
  }
};

/** Discovery bots that must be allowed under max_discovery / block_training_allow_answers */
export const DISCOVERY_PRESET_ALLOW_TOKENS = [
  "Googlebot",
  "bingbot",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot"
];

/** Training bots that must be blocked only under block_training_allow_answers */
export const TRAINING_BLOCK_REQUIRED_TOKENS = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "ClaudeBot"
];

/** Search bots that must stay allowed under restrictive */
export const RESTRICTIVE_ALLOW_TOKENS = ["Googlebot", "bingbot"];

/** AI answer bots that must be blocked under restrictive (GEO/citation tradeoff) */
export const RESTRICTIVE_BLOCK_ANSWER_TOKENS = [
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot"
];

/**
 * Expected site access at `/` for a token under a crawl policy.
 * @param {string} token
 * @param {string} crawlPolicy
 * @returns {"allow" | "block" | "block_if_block_training_policy" | "na"}
 */
export function getPolicyExpectation(token, crawlPolicy) {
  const def = CRAWLER_REGISTRY[token];
  if (!def) {
    return "na";
  }
  if (crawlPolicy === "restrictive") {
    if (RESTRICTIVE_ALLOW_TOKENS.includes(token)) {
      return "allow";
    }
    if (
      RESTRICTIVE_BLOCK_ANSWER_TOKENS.includes(token) ||
      TRAINING_BLOCK_REQUIRED_TOKENS.includes(token)
    ) {
      return "block";
    }
    if (def.roles.includes("ai_training")) {
      return "block";
    }
    return def.max_discovery_site_access;
  }
  if (
    crawlPolicy === "block_training_allow_answers" &&
    TRAINING_BLOCK_REQUIRED_TOKENS.includes(token)
  ) {
    return "block";
  }
  if (DISCOVERY_PRESET_ALLOW_TOKENS.includes(token)) {
    return "allow";
  }
  if (TRAINING_BLOCK_REQUIRED_TOKENS.includes(token)) {
    return "block_if_block_training_policy";
  }
  return def.max_discovery_site_access;
}

/** Tokens the discovery preset explicitly configures (allow + optional training block set) */
export const MAX_DISCOVERY_REQUIRED_TOKENS = [
  ...TRAINING_BLOCK_REQUIRED_TOKENS,
  ...DISCOVERY_PRESET_ALLOW_TOKENS
];

/**
 * Training bots blocked at Cloudflare edge when managed robots.txt is ON.
 * Origin-only sites should still block these explicitly for max_discovery alignment.
 */
export const MAX_DISCOVERY_OPTIONAL_TRAINING_BLOCKS = [
  "Bytespider",
  "Meta-ExternalAgent",
  "Amazonbot",
  "Applebot-Extended"
];

/** Paths that should be Disallow'd in robots.txt under discovery presets (crawl hygiene) */
export const ROBOTS_DISALLOW_PATHS = ["/admin/"];

/**
 * Transactional paths where indexing control belongs on-page (noindex), not robots Disallow.
 * @see https://developers.google.com/search/docs/crawling-indexing/block-indexing
 */
export const INDEX_CONTROL_PATHS = ["/cart/", "/checkout/"];

/** @deprecated Use ROBOTS_DISALLOW_PATHS — kept for import compatibility */
export const MAX_DISCOVERY_RESTRICTED_PATHS = ROBOTS_DISALLOW_PATHS;

/**
 * Alternate paths that satisfy a robots Disallow check (e.g. WP uses /wp-admin/ not /admin/).
 */
export const MAX_DISCOVERY_PATH_ALTERNATIVES = {
  "/admin/": ["/admin/", "/wp-admin/"]
};

/** Discovery crawlers used for cornerstone path checks (R5) */
export const DISCOVERY_CRAWLERS = [
  "Googlebot",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot"
];

export function getCrawlerDefinition(token) {
  return CRAWLER_REGISTRY[token] ?? null;
}

export function roleLabel(roles) {
  if (roles.includes("ai_training") && roles.includes("ai_answer")) {
    return "training + answer (verify provider docs)";
  }
  if (roles.includes("ai_training")) {
    return "AI training crawl";
  }
  if (roles.includes("ai_answer")) {
    return "AI answer / retrieval crawl";
  }
  if (roles.includes("indexing")) {
    return "search indexing crawl";
  }
  if (roles.includes("user_triggered")) {
    return "user-triggered fetch";
  }
  return roles.join(", ");
}
