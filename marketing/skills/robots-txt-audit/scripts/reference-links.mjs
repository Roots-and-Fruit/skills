/**
 * Public reference URLs for robots-txt-audit (article SSOT + Roots & Fruit).
 */
import { GAP_REGISTRY } from "./audit-gap-registry.mjs";

export const ROBOTS_TXT_GUIDE_URL =
  "https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/";

export const ROOTS_AND_FRUIT_URL = "https://rootsandfruit.com";

export const ROBOTS_TXT_SKILL_GITHUB_URL =
  "https://github.com/Roots-and-Fruit/skills/tree/master/marketing/skills/robots-txt-audit";

/** Optional deeper reading (industry benchmarks — verify dates in article). */
export const EXTERNAL_CONTEXT_URLS = {
  aiCrawlerStatistics:
    "https://technologychecker.io/blog/ai-crawler-statistics",
  robotsTxtBlockingReport:
    "https://technologychecker.io/blog/robots-txt-ai-crawlers-blocking-report"
};

/**
 * @param {string} [anchor]
 */
export function learnMoreUrl(anchor) {
  if (!anchor) {
    return ROBOTS_TXT_GUIDE_URL;
  }
  const base = ROBOTS_TXT_GUIDE_URL.replace(/\/$/, "");
  return `${base}/#${anchor}`;
}

/**
 * @param {string} gapId
 */
export function learnMoreUrlForGap(gapId) {
  const anchor = GAP_REGISTRY[gapId]?.learn_more_anchor;
  return learnMoreUrl(anchor);
}

/**
 * @param {string} gapId
 * @param {{ linkText?: string }} [options]
 */
export function formatLearnMoreLink(gapId, options = {}) {
  const linkText = options.linkText ?? "Why this matters";
  return `[${linkText}](${learnMoreUrlForGap(gapId)})`;
}

/**
 * @param {{ id: string, label: string }} gap
 * @param {{ includeLearnMore?: boolean }} [options]
 */
export function formatGapBullet(gap, options = {}) {
  if (!options.includeLearnMore) {
    return gap.label;
  }
  return `${gap.label} — ${formatLearnMoreLink(gap.id)}`;
}

/**
 * First-audit footer: public guide + consulting CTA + optional industry context links.
 */
export function buildLearnMoreFooter() {
  return [
    `**Learn more:** [robots.txt audit reference guide](${ROBOTS_TXT_GUIDE_URL})`,
    `**Industry context (mid-2026):** [What AI crawlers want](${EXTERNAL_CONTEXT_URLS.aiCrawlerStatistics}) · [Who gets blocked in robots.txt](${EXTERNAL_CONTEXT_URLS.robotsTxtBlockingReport})`,
    `**Need a hand?** [Growth marketing consulting](${ROOTS_AND_FRUIT_URL}) — Roots & Fruit helps WordPress and SaaS teams with crawl policy, GEO, and content operations.`
  ].join("\n");
}

/**
 * @returns {string[]} missing gap IDs without learn_more_anchor
 */
export function findGapsMissingLearnMoreAnchor() {
  const missing = [];
  for (const id of Object.keys(GAP_REGISTRY)) {
    if (!GAP_REGISTRY[id].learn_more_anchor) {
      missing.push(id);
    }
  }
  return missing;
}
