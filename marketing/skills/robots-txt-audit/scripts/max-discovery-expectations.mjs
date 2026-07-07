/**
 * SSOT expected outcomes for discovery preset regression (P-layer).
 * Update when assessMaxDiscovery() rules change.
 */
import {
  DISCOVERY_PRESET_ALLOW_TOKENS,
  TRAINING_BLOCK_REQUIRED_TOKENS
} from "./crawler-registry.mjs";

export const FIXTURE_EXPECTATIONS = {
  "example-good.robots.txt.fixture.txt": {
    compliant: true,
    requiredViolationIds: [],
    forbiddenViolationIds: [
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_ClaudeBot",
      "MD_Claude_SearchBot",
      "MD_GOOGLE_PAIRING",
      "MD_OPENAI_PAIRING",
      "MD_ANTHROPIC_PAIRING",
      "MD_SITEMAP_PRESENT",
      "MD_PATH__cart_",
      "MD_PATH__checkout_"
    ],
    sitemapStatusWith200: "pass",
    discoveryTokensAllowed: [
      "Googlebot",
      "bingbot",
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot"
    ]
  },
  "example-good-block-training.robots.txt.fixture.txt": {
    policy: "block_training_allow_answers",
    compliant: true,
    requiredViolationIds: [],
    forbiddenViolationIds: [
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_ClaudeBot",
      "MD_SITEMAP_PRESENT"
    ],
    sitemapStatusWith200: "pass",
    trainingTokensBlocked: ["GPTBot", "Google-Extended", "CCBot", "ClaudeBot"],
    discoveryTokensAllowed: [
      "Googlebot",
      "bingbot",
      "OAI-SearchBot",
      "Claude-SearchBot",
      "PerplexityBot"
    ]
  },
  "example-bad-max-discovery.robots.txt.fixture.txt": {
    compliant: false,
    requiredViolationIds: [
      "MD_Googlebot",
      "MD_OAI_SearchBot",
      "MD_OPENAI_PAIRING",
      "MD_SITEMAP_PRESENT"
    ],
    forbiddenViolationIds: ["MD_GPTBot"],
    sitemapPresent: false
  },
  "example-wp-open.robots.txt.fixture.txt": {
    compliant: true,
    requiredViolationIds: [],
    forbiddenViolationIds: [
      "MD_PATH__admin_",
      "MD_PATH__cart_",
      "MD_PATH__checkout_",
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_ClaudeBot",
      "MD_GOOGLE_PAIRING",
      "MD_OPENAI_PAIRING",
      "MD_ANTHROPIC_PAIRING"
    ],
    sitemapFetch200: [
      { url: "https://www.example.com/sitemap_index.xml", status: 200 }
    ],
    sitemapStatusWith200: "pass",
    sitemapStatusWith500: "warn",
    policyCompliantDespiteSitemap500: true,
    trainingTokensAllowed: ["GPTBot", "Google-Extended", "CCBot"],
    ruleSource: { GPTBot: "inherits_user_agent_star" }
  },
  "example-good-restrictive.robots.txt.fixture.txt": {
    policy: "restrictive",
    compliant: true,
    requiredViolationIds: [],
    forbiddenViolationIds: [
      "MD_RESTRICT_OAI_SearchBot",
      "MD_RESTRICT_Claude_SearchBot",
      "MD_RESTRICT_PerplexityBot",
      "MD_GPTBot",
      "MD_Google_Extended",
      "MD_CCBot",
      "MD_ClaudeBot",
      "MD_GOOGLE_PAIRING",
      "MD_SITEMAP_PRESENT"
    ],
    sitemapStatusWith200: "pass",
    searchTokensAllowed: ["Googlebot", "bingbot"],
    answerTokensBlocked: ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"],
    trainingTokensBlocked: ["GPTBot", "Google-Extended", "CCBot", "ClaudeBot"]
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
  return TRAINING_BLOCK_REQUIRED_TOKENS.filter(
    (token) => expectedAccess[token] === "block"
  ).every((token) => blocked.includes(token));
}

export const REQUIRED_TRAINING_BLOCKS = TRAINING_BLOCK_REQUIRED_TOKENS;
