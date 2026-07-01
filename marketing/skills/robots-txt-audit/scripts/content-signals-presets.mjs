/**
 * Content-Signal presets (aligned with https://contentsignals.org/ four default policies).
 * Signals express preferences; Allow/Disallow per bot remains the operational crawl layer.
 */

function normalizeDomain(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

/** @typedef {'search_only' | 'search_and_ai_input' | 'most_restrictive' | 'all_permitted'} ContentSignalsPresetId */

/** @type {Record<ContentSignalsPresetId, { label: string, search: string, ai_input: string, ai_train: string, maps_to_crawl_policy: string | null }>} */
export const CONTENT_SIGNALS_PRESETS = {
  most_restrictive: {
    label: "Most restrictive (ContentSignals.org)",
    search: "no",
    ai_input: "no",
    ai_train: "no",
    maps_to_crawl_policy: "restrictive"
  },
  search_only: {
    label: "Search only (ContentSignals.org)",
    search: "yes",
    ai_input: "no",
    ai_train: "no",
    maps_to_crawl_policy: null
  },
  search_and_ai_input: {
    label: "Search + AI input (ContentSignals.org)",
    search: "yes",
    ai_input: "yes",
    ai_train: "no",
    maps_to_crawl_policy: "max_discovery"
  },
  all_permitted: {
    label: "All permitted (ContentSignals.org)",
    search: "yes",
    ai_input: "yes",
    ai_train: "yes",
    maps_to_crawl_policy: null
  }
};

/** Bots that receive explicit Content-Signal + Allow in the CF origin append template */
export const ORIGIN_APPEND_SIGNAL_AGENTS = [
  "Googlebot",
  "bingbot",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot"
];

/**
 * @param {{ search: string, ai_input: string, ai_train: string }} signals
 */
export function formatContentSignalLine(signals) {
  return `Content-Signal: search=${signals.search}, ai-input=${signals.ai_input}, ai-train=${signals.ai_train}`;
}

/**
 * Map crawl_policy to default ContentSignals.org preset id.
 * @param {string} crawlPolicy
 * @returns {ContentSignalsPresetId}
 */
export function contentSignalsPresetForCrawlPolicy(crawlPolicy) {
  if (crawlPolicy === "max_discovery" || crawlPolicy === "block_training_allow_answers") {
    return "search_and_ai_input";
  }
  if (crawlPolicy === "restrictive") {
    return "most_restrictive";
  }
  return "search_only";
}

/**
 * Origin robots.txt block to append below Cloudflare's END marker.
 * Declares ai-input=yes for max_discovery (CF managed sets search=yes, ai-train=no on * only).
 *
 * @param {string} domain
 * @param {{ content_signals_preset?: ContentSignalsPresetId, sitemap_url?: string, crawl_policy?: string, preserve_comment?: string }} [options]
 */
export function buildCloudflareOriginAppend(domain, options = {}) {
  const bare = normalizeDomain(domain);
  const presetId =
    options.content_signals_preset ??
    contentSignalsPresetForCrawlPolicy(options.crawl_policy ?? "max_discovery");
  const preset = CONTENT_SIGNALS_PRESETS[presetId];
  const signalLine = formatContentSignalLine({
    search: preset.search,
    ai_input: preset.ai_input,
    ai_train: preset.ai_train
  });
  const sitemapUrl = options.sitemap_url ?? `https://${bare}/sitemap.xml`;

  const lines = [
    "# Origin robots.txt — append below \"# END Cloudflare Managed Content\"",
    `# Content-Signal preset: ${presetId} (${preset.label})`,
    "# Allow/Disallow below are the operational crawl layer; signals are declarative preferences.",
    "# Verify merged edge file after publish. For enforcement use AI Crawl Control.",
    ""
  ];

  if (presetId === "search_and_ai_input") {
    for (const agent of ORIGIN_APPEND_SIGNAL_AGENTS) {
      lines.push(`User-agent: ${agent}`);
      lines.push(signalLine);
      lines.push("Allow: /");
      lines.push("");
    }
  }

  lines.push("User-agent: *");
  if (presetId !== "most_restrictive") {
    lines.push("Disallow: /wp-admin/");
    lines.push("Disallow: /cart/");
    lines.push("Disallow: /checkout/");
    lines.push("Allow: /");
    lines.push("");
  }
  lines.push(`Sitemap: ${sitemapUrl}`);

  if (options.preserve_comment) {
    lines.push("");
    lines.push(`# Preserve existing origin rules if present: ${options.preserve_comment}`);
  }

  return lines.join("\n");
}

/**
 * Short limitations block for human output and handoff.
 */
export const CONTENT_SIGNALS_LIMITATIONS = [
  "Content-Signal support is evolving — not all crawlers read signals; Allow/Disallow per bot remains the primary crawl lever.",
  "Cloudflare managed prepend sets search=yes, ai-train=no on User-agent: * and does not set ai-input — origin append supplies ai-input=yes for max_discovery alignment with ContentSignals.org \"Search + AI input\".",
  "Signals express preferences, not technical blocks — pair with AI Crawl Control if enforcement is required.",
  "Google Search Console may warn on Content-Signal syntax; Cloudflare documents this as typically benign for SEO crawl rates."
];
