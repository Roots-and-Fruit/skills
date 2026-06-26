/**
 * SSOT expected outcomes for max_discovery regression (P-layer).
 * Update when assessMaxDiscovery() rules change.
 */
import { MAX_DISCOVERY_REQUIRED_TOKENS } from "./crawler-registry.mjs";

export const FIXTURE_EXPECTATIONS = {
  "example-good.robots.txt.fixture.txt": {
    compliant: true,
    requiredViolationIds: [],
    forbiddenViolationIds: [
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_GOOGLE_PAIRING",
      "MD_OPENAI_PAIRING",
      "MD_SITEMAP_PRESENT"
    ],
    sitemapStatusWith200: "pass",
    trainingTokensBlocked: ["GPTBot", "Google-Extended", "CCBot"],
    discoveryTokensAllowed: [
      "Googlebot",
      "bingbot",
      "OAI-SearchBot",
      "PerplexityBot"
    ]
  },
  "example-bad-max-discovery.robots.txt.fixture.txt": {
    compliant: false,
    requiredViolationIds: [
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_Googlebot",
      "MD_OAI_SearchBot",
      "MD_OPENAI_PAIRING",
      "MD_SITEMAP_PRESENT"
    ],
    forbiddenViolationIds: [],
    sitemapPresent: false
  },
  "example-wp-open.robots.txt.fixture.txt": {
    compliant: false,
    requiredViolationIds: [
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_PATH__admin_",
      "MD_PATH__cart_",
      "MD_PATH__checkout_"
    ],
    forbiddenViolationIds: ["MD_GOOGLE_PAIRING", "MD_OPENAI_PAIRING"],
    sitemapFetch200: [
      { url: "https://www.example.com/sitemap_index.xml", status: 200 }
    ],
    sitemapStatusWith200: "pass",
    sitemapStatusWith500: "warn",
    policyCompliantDespiteSitemap500: false,
    trainingTokensAllowed: ["GPTBot", "Google-Extended", "CCBot"],
    ruleSource: { GPTBot: "inherits_user_agent_star" }
  }
};

export const VIOLATION_SHAPE_KEYS = [
  "id",
  "token",
  "expected",
  "actual",
  "path",
  "message"
];

export function violationIds(violations = []) {
  return violations.map((v) => v.id).sort();
}

export function includesAll(haystack, needles) {
  return needles.every((id) => haystack.includes(id));
}

export function includesNone(haystack, needles) {
  return needles.every((id) => !haystack.includes(id));
}

export function allRequiredTokensCovered(violations, expectedAccess) {
  const blocked = violations
    .filter((v) => v.expected === "block" && v.actual === "allowed")
    .map((v) => v.token);
  return MAX_DISCOVERY_REQUIRED_TOKENS.filter(
    (token) => expectedAccess[token] === "block"
  ).every((token) => blocked.includes(token));
}

export const REQUIRED_TRAINING_BLOCKS = ["GPTBot", "Google-Extended", "CCBot"];
