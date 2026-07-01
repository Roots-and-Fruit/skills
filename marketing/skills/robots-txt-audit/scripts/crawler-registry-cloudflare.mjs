/**
 * Cloudflare managed robots.txt overlay (SSOT).
 * Verify against https://developers.cloudflare.com/bots/additional-configurations/managed-robots-txt/
 * before production deploy — CF may update this list over time.
 */

/** Markers that delimit CF prepended content in edge-served robots.txt */
export const CLOUDFLARE_MANAGED_MARKERS = {
  begin: /#\s*BEGIN\s+Cloudflare\s+Managed\s+content/i,
  end: /#\s*END\s+Cloudflare\s+Managed\s+Content/i
};

/**
 * User-agent tokens CF typically blocks site-wide in the managed block.
 * Case variants may appear in live files (e.g. meta-externalagent).
 */
export const CLOUDFLARE_MANAGED_TRAINING_BLOCKS = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "ClaudeBot",
  "Applebot-Extended",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "Meta-ExternalAgent",
  "CloudflareBrowserRenderingCrawler"
];

/** What CF managed robots.txt does not inject — origin responsibility */
export const CLOUDFLARE_ORIGIN_RESPONSIBILITIES = [
  "Sitemap: directive",
  "Low-value path Disallow rules (/wp-admin/, /cart/, /checkout/)",
  "Site-specific path rules",
  "Explicit Allow groups for answer bots when wildcard rules are complex"
];

export const CLOUDFLARE_COMPANION_MODULE = "CLOUDFLARE-MANAGED.md";

/**
 * Normalize token for case-insensitive comparison against CF block list.
 * @param {string} token
 */
export function normalizeCrawlerToken(token) {
  return token.trim().toLowerCase();
}

/**
 * @param {string} token
 * @returns {boolean}
 */
export function isCloudflareManagedTrainingToken(token) {
  return CLOUDFLARE_MANAGED_TRAINING_BLOCKS.some(
    (t) => normalizeCrawlerToken(t) === normalizeCrawlerToken(token)
  );
}
