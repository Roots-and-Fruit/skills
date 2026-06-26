/**
 * Domain-agnostic GSC query intent buckets for discovery analysis.
 */

export const QUERY_INTENTS = [
  "brand",
  "commercial",
  "job",
  "product",
  "diy",
  "other"
];

const JOB_RE =
  /\b(jobs?|hiring|careers?|vacanc(?:y|ies)|recruit|apply now|engineer jobs?|technician jobs?)\b/i;
const COMMERCIAL_RE =
  /\b(pricing|price|plans?|support plan|managed|maintenance|subscription|service|services|agency|hire us|get (?:a )?quote|demo|consulting|enterprise support)\b/i;
const PRODUCT_RE =
  /\b(plugin|plugins|app|download|shop|buy|sku|extension|tool)\b/i;
const DIY_RE =
  /\b(how to|tutorial|guide|fix|error|snippet|code|example|setup|configure|troubleshoot|vs |versus)\b/i;

export function brandTermsFromDomain(domain) {
  const host = String(domain || "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  const stem = host.split(".")[0] || host;
  const terms = new Set([stem]);
  if (stem.includes("-")) {
    for (const part of stem.split("-")) {
      if (part.length >= 3) {
        terms.add(part);
      }
    }
  }
  if (stem.length >= 5) {
    terms.add(stem.replace(/-/g, " "));
  }
  return [...terms];
}

export function classifyQueryIntent(query, brandTerms = []) {
  const q = String(query || "").toLowerCase().trim();
  if (!q) {
    return "other";
  }

  for (const term of brandTerms) {
    const t = term.toLowerCase();
    if (t.length >= 3 && q.includes(t)) {
      return "brand";
    }
  }
  if (/\bsite:/.test(q)) {
    return "brand";
  }
  if (JOB_RE.test(q)) {
    return "job";
  }
  if (COMMERCIAL_RE.test(q)) {
    return "commercial";
  }
  if (PRODUCT_RE.test(q)) {
    return "product";
  }
  if (DIY_RE.test(q)) {
    return "diy";
  }
  return "other";
}
