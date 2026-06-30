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
    controls: "Apple Search, Siri, and Spotlight discovery"
  },
  "OAI-SearchBot": {
    roles: ["ai_answer", "indexing"],
    max_discovery_site_access: "allow",
    controls: "ChatGPT search retrieval and citation discovery",
    paired_token: "GPTBot",
    note: "Allow for GEO; distinct from training crawler GPTBot."
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
    roles: ["ai_training", "ai_answer"],
    max_discovery_site_access: "block",
    controls: "Anthropic crawl — verify current docs for training vs fetch behavior",
    note: "Registry default blocks training posture; confirm against live Anthropic policy."
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
    controls: "Meta AI/product improvement crawl"
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

/** Tokens the max_discovery policy template explicitly configures */
export const MAX_DISCOVERY_REQUIRED_TOKENS = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "OAI-SearchBot",
  "PerplexityBot",
  "Googlebot",
  "bingbot"
];

/** Paths that should be blocked for User-agent: * under max_discovery */
export const MAX_DISCOVERY_RESTRICTED_PATHS = ["/admin/", "/cart/", "/checkout/"];

/**
 * Alternate paths that satisfy a restricted-path check (e.g. WP uses /wp-admin/ not /admin/).
 * Key is the canonical template path from MAX_DISCOVERY_RESTRICTED_PATHS.
 */
export const MAX_DISCOVERY_PATH_ALTERNATIVES = {
  "/admin/": ["/admin/", "/wp-admin/"]
};

/** Discovery crawlers used for cornerstone path checks (R5) */
export const DISCOVERY_CRAWLERS = ["Googlebot", "OAI-SearchBot", "PerplexityBot"];

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
