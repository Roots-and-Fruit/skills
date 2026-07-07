/** Crawl policy preset helpers — shared by assess, handoff, and verify gates. */

export const POLICY_COMPLIANCE_PRESETS = new Set([
  "max_discovery",
  "block_training_allow_answers",
  "restrictive"
]);

/** @param {string | undefined} crawlPolicy */
export function requiresDiscoveryCompliance(crawlPolicy) {
  return (
    crawlPolicy === "max_discovery" || crawlPolicy === "block_training_allow_answers"
  );
}

/** @param {string | undefined} crawlPolicy */
export function requiresPolicyCompliance(crawlPolicy) {
  return requiresDiscoveryCompliance(crawlPolicy) || crawlPolicy === "restrictive";
}

/** @param {string | undefined} crawlPolicy */
export function requiresTrainingBlockCompliance(crawlPolicy) {
  return crawlPolicy === "block_training_allow_answers";
}

/** Apex + www robots.txt URLs per SKILL Step 1 */
export function canonicalDiscoveryUrls(domain) {
  const bare = String(domain)
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .replace(/^www\./i, "");
  return [`https://${bare}/robots.txt`, `https://www.${bare}/robots.txt`];
}
