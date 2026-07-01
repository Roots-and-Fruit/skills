/**
 * Public reference URLs for robots-txt-audit (article SSOT + Roots & Fruit).
 */
import { GAP_REGISTRY } from "./audit-gap-registry.mjs";

export const ROBOTS_TXT_GUIDE_URL =
  "https://rootsandfruit.com/docs/marketing-skills/reference/robots-txt-audit-skill-reference-guide/";

export const ROOTS_AND_FRUIT_URL = "https://rootsandfruit.com";

export const ROBOTS_TXT_SKILL_GITHUB_URL =
  "https://github.com/Roots-and-Fruit/skills/tree/master/marketing/skills/robots-txt-audit";

/** @type {Record<string, string>} */
export const GAP_LEARN_MORE_ANCHORS = {
  MD_SITEMAP_PRESENT: "sitemap-declaration",
  MD_SITEMAP_VALID: "sitemap-declaration",
  MD_PATH__admin_: "path-hygiene",
  MD_PATH__cart_: "path-hygiene",
  MD_PATH__checkout_: "path-hygiene",
  MD_GPTBot: "training-vs-search-and-answer-bots",
  MD_Google_Extended: "training-vs-search-and-answer-bots",
  MD_CCBot: "training-vs-search-and-answer-bots",
  MD_OAI_SearchBot: "training-vs-search-and-answer-bots",
  MD_PerplexityBot: "training-vs-search-and-answer-bots",
  MD_Googlebot: "training-vs-search-and-answer-bots",
  MD_bingbot: "training-vs-search-and-answer-bots",
  MD_GOOGLE_PAIRING: "training-vs-search-and-answer-bots",
  MD_OPENAI_PAIRING: "training-vs-search-and-answer-bots",
  OPT_ANTHROPIC_AI: "training-vs-search-and-answer-bots",
  OPT_AI_INPUT_SIGNAL: "content-signal-alignment"
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
  const anchor = GAP_REGISTRY[gapId]?.learn_more_anchor ?? GAP_LEARN_MORE_ANCHORS[gapId];
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
 * First-audit footer: article + consulting CTA.
 */
export function buildLearnMoreFooter() {
  return [
    `**Learn more:** [robots.txt audit reference guide](${ROBOTS_TXT_GUIDE_URL})`,
    `**Need a hand?** [Growth marketing consulting](${ROOTS_AND_FRUIT_URL}) — Roots & Fruit helps WordPress and SaaS teams with crawl policy, GEO, and content operations.`
  ].join("\n");
}

/**
 * @returns {string[]} missing gap IDs without learn_more_anchor
 */
export function findGapsMissingLearnMoreAnchor() {
  const missing = [];
  for (const id of Object.keys(GAP_REGISTRY)) {
    if (!GAP_REGISTRY[id].learn_more_anchor && !GAP_LEARN_MORE_ANCHORS[id]) {
      missing.push(id);
    }
  }
  return missing;
}
