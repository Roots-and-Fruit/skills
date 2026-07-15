/**
 * Shared modifier tokens for cluster collapse and priority demotion (SSOT).
 */

export const CLUSTER_MODIFIER_TOKENS = new Set(["reddit"]);

export const YEAR_TOKEN_PATTERN = /^20\d{2}$/;

/**
 * Normalize seed-adjacent extra tokens before cluster slugging.
 * Strips reddit, 4-digit years, and redundant download when free is present.
 * @param {string[]} extras — sorted tokens not in seed
 */
export function normalizeSeedExtras(extras) {
  let tokens = extras.filter((token) => !CLUSTER_MODIFIER_TOKENS.has(token));
  tokens = tokens.filter((token) => !YEAR_TOKEN_PATTERN.test(token));

  if (tokens.includes("free") && tokens.includes("download")) {
    tokens = tokens.filter((token) => token !== "download");
  }

  return [...new Set(tokens)].sort();
}

/**
 * Priority demotion when tool_discovery lane and extras are modifier noise.
 * @param {string[]} extras
 * @param {string | null} intentLane
 */
export function isModifierNoiseExtras(extras, intentLane = null) {
  if (extras.length === 0) {
    return false;
  }

  const hasModifier =
    extras.some((token) => CLUSTER_MODIFIER_TOKENS.has(token)) ||
    extras.some((token) => YEAR_TOKEN_PATTERN.test(token)) ||
    (extras.includes("theme") && intentLane === "tool_discovery") ||
    (extras.includes("download") && extras.includes("free"));

  return hasModifier;
}

/**
 * Competitor-shaped extras for no-PAA priority boost (generic token only).
 */
export function isCompetitorShapedExtras(extras) {
  return extras.includes("competitor");
}

/** Career / methodology PAAs on commercial tool SERPs — demote in priority + write-next. */
export function isCareerMethodologyPaa(keyword) {
  const kw = String(keyword ?? "").toLowerCase();
  return (
    /\bsalary\b/.test(kw) ||
    /\bpmp\b/.test(kw) ||
    /\bpmi recommend/.test(kw) ||
    /\bbig 3 in project management\b/.test(kw) ||
    /\bcertification\b/.test(kw)
  );
}

const HEALTH_PAA_PATTERN =
  /\b(blood pressure|blood sugar|diabetes|cholesterol|spike my blood|lower blood pressure)\b/i;

const HEALTH_SEED_TOKENS = new Set([
  "diabetes",
  "pressure",
  "blood",
  "cholesterol",
  "symptom",
  "health"
]);

/** Health/YMYL PAAs on non-health seeds (recipe, tool, etc.). */
export function isHealthAdjacentPaa(keyword, seedTokens = []) {
  const kw = String(keyword ?? "").toLowerCase();
  if (!HEALTH_PAA_PATTERN.test(kw)) {
    return false;
  }
  const seedSet = new Set(seedTokens);
  for (const token of HEALTH_SEED_TOKENS) {
    if (seedSet.has(token)) {
      return false;
    }
  }
  return true;
}

/** Startup budget / failure PAAs on tool-discovery SERPs. */
export function isHustleCostPaa(keyword) {
  const kw = String(keyword ?? "").toLowerCase();
  return (
    /\$[\d,]+/.test(kw) ||
    /\b(enough to start|how many .+ fail|dropshippers fail|per month dropshipping)\b/.test(kw) ||
    /\bmake \$[\d,]+/.test(kw)
  );
}

/** Pricing-adjacent methodology PAAs (not product pricing pages). */
export function isPricingAdjacentPaa(keyword) {
  const kw = String(keyword ?? "").toLowerCase();
  return (
    /\bhow much is\b/.test(kw) ||
    /\bhow much does it cost\b/.test(kw) ||
    /\b\d+ email list worth\b/.test(kw) ||
    /\bworth\?\s*$/.test(kw)
  );
}

/**
 * PAAs to demote or reject off-lane — SSOT for priority + write-next.
 * @param {string} keyword
 * @param {{ seed?: string, seedTokens?: string[], chosenLane?: string | null }} [context]
 */
export function isOffTopicDemotablePaa(keyword, context = {}) {
  if (isCareerMethodologyPaa(keyword)) {
    return true;
  }
  const seedTokens = context.seedTokens ?? [];
  if (context.chosenLane === "primary_topic" && isHealthAdjacentPaa(keyword, seedTokens)) {
    return true;
  }
  if (isHustleCostPaa(keyword)) {
    return true;
  }
  if (isPricingAdjacentPaa(keyword)) {
    return true;
  }
  return false;
}

/** Homograph brand tokens — sole extra token can be unrelated fintech brand. */
export const HOMOGRAPH_BRAND_TOKENS = new Set(["wise"]);

const FINTECH_CO_OCCURRENCE = new Set([
  "transfer",
  "fees",
  "fintech",
  "currency",
  "exchange",
  "remittance"
]);

/**
 * Reject serp_related when distinguishing token is a homograph brand unrelated to seed.
 * @param {string} keyword
 * @param {string[]} seedTokens
 */
export function isHomographBrandLeak(keyword, seedTokens) {
  const kwTokens = salientTokensImport(keyword);
  const seedSet = new Set(seedTokens);
  const extras = kwTokens.filter((token) => !seedSet.has(token));
  if (extras.length !== 1) {
    return false;
  }
  const [extra] = extras;
  if (!HOMOGRAPH_BRAND_TOKENS.has(extra)) {
    return false;
  }
  if (seedSet.has(extra)) {
    return false;
  }
  const hasFintech = kwTokens.some((token) => FINTECH_CO_OCCURRENCE.has(token));
  return !hasFintech;
}

/** Commercial modifier tokens that drift on mixed SERPs. */
export const COMMERCIAL_MODIFIER_TOKENS = new Set([
  "free",
  "jobs",
  "course",
  "pdf",
  "download"
]);

/** Lazy import to avoid circular dependency at module load. */
function salientTokensImport(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function hasCommercialModifierDrift(keyword, seedTokens) {
  const kwTokens = salientTokensImport(keyword);
  const seedSet = new Set(seedTokens);
  return kwTokens.some(
    (token) => COMMERCIAL_MODIFIER_TOKENS.has(token) && !seedSet.has(token)
  );
}

/** Marketplace / listicle row shape for tool_discovery on directory SERPs. */
export function isMarketplaceListicleKeyword(keyword) {
  const kw = String(keyword ?? "").toLowerCase();
  return (
    /\b(templates|marketplace|alternatives|best .+ for)\b/.test(kw) ||
    /\b(etsy|gumroad|canva)\b/.test(kw)
  );
}
