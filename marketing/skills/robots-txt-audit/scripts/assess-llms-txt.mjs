/**
 * Companion check: robots.txt vs llms.txt (llmstxt.org v2).
 *
 * llms.txt is an inference-time navigation file, not crawl control.
 * This module only checks whether robots.txt accidentally blocks
 * /llms.txt or /llms-full.txt for discovery crawlers that are allowed
 * at `/`, and whether Sitemap: wrongly points at those files.
 */
import { DISCOVERY_CRAWLERS } from "./crawler-registry.mjs";
import { isPathAllowedForAgent } from "./parse-robots-txt.mjs";

export const LLMS_TXT_PATHS = ["/llms.txt", "/llms-full.txt"];

/**
 * @param {string} url
 */
export function isLlmsTxtSitemapUrl(url) {
  const raw = String(url ?? "").trim();
  if (!raw) {
    return false;
  }
  try {
    const pathname = new URL(raw).pathname.replace(/\/+$/, "") || "/";
    return LLMS_TXT_PATHS.includes(pathname);
  } catch {
    return /\/llms(-full)?\.txt$/i.test(raw);
  }
}

/**
 * @param {Array<{ url?: string, status?: number, ok?: boolean, fetch_suspect?: boolean }>} fetchResults
 * @returns {boolean | null}
 */
export function inferLlmsTxtPresent(fetchResults) {
  if (!Array.isArray(fetchResults) || fetchResults.length === 0) {
    return null;
  }
  const root = fetchResults.find((row) =>
    /\/llms\.txt(?:$|\?)/i.test(String(row?.url ?? ""))
  );
  if (!root) {
    return null;
  }
  if (root.fetch_suspect) {
    return false;
  }
  if (typeof root.ok === "boolean") {
    return root.ok;
  }
  const status = Number(root.status);
  return status >= 200 && status < 300;
}

/**
 * @param {unknown[]} groups
 * @param {string} crawlPolicy
 * @param {{ sitemap_urls?: string[], llms_txt_results?: object[] }} [options]
 */
export function assessLlmsTxtCompanion(groups, crawlPolicy, options = {}) {
  const sitemapUrls = options.sitemap_urls ?? [];
  const fetchResults = options.llms_txt_results ?? [];
  const sitemap_misuse = sitemapUrls.filter(isLlmsTxtSitemapUrl);
  const fetch_ran = fetchResults.length > 0;
  const present = inferLlmsTxtPresent(fetchResults);

  if (crawlPolicy === "restrictive") {
    return {
      applicable: false,
      present,
      blocked_for: [],
      sitemap_misuse,
      fetch_ran
    };
  }

  const blocked_for = [];
  for (const pathname of LLMS_TXT_PATHS) {
    for (const agent of DISCOVERY_CRAWLERS) {
      const rootAllowed = isPathAllowedForAgent(groups, agent, "/");
      const pathAllowed = isPathAllowedForAgent(groups, agent, pathname);
      if (rootAllowed && !pathAllowed) {
        blocked_for.push({ path: pathname, agent });
      }
    }
  }

  return {
    applicable: true,
    present,
    blocked_for,
    sitemap_misuse,
    fetch_ran
  };
}
