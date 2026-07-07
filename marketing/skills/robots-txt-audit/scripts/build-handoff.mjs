/**
 * SSOT handoff JSON builder (schema v1.0).
 */
import { buildAuditChecks } from "./build-audit-checks.mjs";
import { canonicalDiscoveryUrls, requiresPolicyCompliance } from "./policy-presets.mjs";
import { SKILL_VERSION } from "./skill-version.mjs";
import {
  assessCrawlability,
  findGroupForAgent,
  isPathAllowedForAgent,
  parseRobotsTxt
} from "./parse-robots-txt.mjs";

const SEARCH_TOKENS = ["Googlebot", "bingbot"];
const ANSWER_TOKENS = ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"];
const TRAINING_TOKENS = ["GPTBot", "Google-Extended", "CCBot", "ClaudeBot"];
const CRAWLER_RULE_TOKENS = [
  "GPTBot",
  "Google-Extended",
  "OAI-SearchBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Googlebot",
  "bingbot",
  "*"
];

/**
 * @param {Array<{ token: string, indexing_crawl?: string, training_crawl?: string }>} matrix
 * @param {string[]} tokens
 * @param {"indexing"|"training"} kind
 */
function summarizeBotGroup(matrix, tokens, kind) {
  const rows = matrix.filter((r) => tokens.includes(r.token));
  if (rows.length === 0) {
    return "ambiguous";
  }
  const statuses = rows.map((r) =>
    kind === "training" ? r.training_crawl : r.indexing_crawl
  );
  const meaningful = statuses.filter((s) => s && s !== "na");
  if (meaningful.length === 0) {
    return "ambiguous";
  }
  if (meaningful.every((s) => s === "allowed")) {
    return "allowed";
  }
  if (meaningful.every((s) => s === "blocked")) {
    return "blocked";
  }
  if (meaningful.some((s) => s === "ambiguous")) {
    return "ambiguous";
  }
  return "mixed";
}

/**
 * @param {Array<{ token: string, indexing_crawl?: string, training_crawl?: string }>} matrix
 */
export function buildPolicySummary(matrix) {
  return {
    search_bots: summarizeBotGroup(matrix, SEARCH_TOKENS, "indexing"),
    ai_answer_bots: summarizeBotGroup(matrix, ANSWER_TOKENS, "indexing"),
    ai_training_bots: summarizeBotGroup(matrix, TRAINING_TOKENS, "training")
  };
}

/**
 * @param {ReturnType<typeof parseRobotsTxt>} parsed
 */
export function buildCrawlerRules(parsed) {
  const groups = parsed.groups ?? [];
  const rules = [];

  for (const token of CRAWLER_RULE_TOKENS) {
    const group = findGroupForAgent(groups, token);
    if (token !== "*" && !group) {
      if (token === "OAI-SearchBot" || token === "Claude-SearchBot") {
        if (findGroupForAgent(groups, "*")) {
          rules.push({
            user_agent: token,
            effective_access: isPathAllowedForAgent(groups, token, "/")
              ? "allowed"
              : "blocked",
            rules: ["No explicit group — falls through to User-agent: *"]
          });
        }
      }
      continue;
    }
    if (!group) {
      continue;
    }
    const access = isPathAllowedForAgent(groups, token, "/") ? "allowed" : "blocked";
    const ruleLines = group.rules.map((r) =>
      r.type === "allow" ? `Allow: ${r.path}` : `Disallow: ${r.path}`
    );
    rules.push({
      user_agent: token,
      effective_access: access,
      rules: ruleLines.length ? ruleLines : ["(no rules)"]
    });
  }

  return rules;
}

/**
 * @param {object} params
 */
export function deriveHandoffMode({ modeOverride, assessment, discovery, draft_robots_txt, crawlPolicy }) {
  if (modeOverride) {
    return modeOverride;
  }
  if (draft_robots_txt && !discovery.found) {
    return "generate";
  }
  if (
    requiresPolicyCompliance(crawlPolicy) &&
    assessment.policy_compliance?.compliant === false
  ) {
    return "recommend";
  }
  return "audit";
}

/**
 * @param {object} params
 */
export function buildDiscovery({
  domain,
  found,
  resolved_url = null,
  fetch_suspect = false
}) {
  return {
    found,
    urls_checked: canonicalDiscoveryUrls(domain),
    resolved_url: found ? resolved_url : null,
    ...(fetch_suspect ? { fetch_suspect: true } : {})
  };
}

/**
 * @param {object} params
 */
export function buildHandoff({
  assessment,
  parsed,
  inputs,
  discovery,
  modeOverride,
  deployment_note,
  limitations = [],
  draft_robots_txt = null
}) {
  const domain = inputs.domain;
  const crawlPolicy = inputs.crawl_policy ?? "audit_only";
  const keyPages = inputs.key_pages ?? [];
  const discoveryAgents = ["Googlebot", "OAI-SearchBot", "Claude-SearchBot"];

  let crawlability;
  if (!discovery.found && keyPages.length > 0) {
    crawlability = {
      key_pages_provided: keyPages.length,
      fully_crawlable: 0,
      blocked_key_pages: keyPages.map((url) => ({
        url,
        pathname: url.replace(/^https?:\/\/[^/]+/i, "") || "/",
        blocked_by: ["all crawlers — no robots.txt"]
      }))
    };
  } else if (discovery.found) {
    crawlability = assessCrawlability(parsed.groups, keyPages, discoveryAgents);
  } else {
    crawlability = {
      key_pages_provided: 0,
      fully_crawlable: null,
      blocked_key_pages: []
    };
  }

  const mode = deriveHandoffMode({
    modeOverride,
    assessment,
    discovery,
    draft_robots_txt,
    crawlPolicy
  });

  const audit_checks = buildAuditChecks(assessment, inputs, discovery, crawlability);

  const handoff = {
    handoff_version: "1.0",
    skill: "robots-txt-audit",
    skill_version: SKILL_VERSION,
    mode,
    inputs: {
      domain,
      key_pages: keyPages,
      crawl_policy: crawlPolicy,
      ...(inputs.robots_deployment ? { robots_deployment: inputs.robots_deployment } : {})
    },
    discovery,
    parsed: {
      group_count: parsed.groupCount ?? 0,
      rule_count: parsed.ruleCount ?? 0,
      user_agent_tokens: parsed.userAgentTokens ?? [],
      sitemap_directives: parsed.sitemaps ?? []
    },
    policy_summary: buildPolicySummary(assessment.crawler_matrix ?? []),
    crawlability,
    crawler_rules: discovery.found ? buildCrawlerRules(parsed) : [],
    audit_checks,
    crawler_matrix:
      discovery.found || draft_robots_txt ? (assessment.crawler_matrix ?? []) : [],
    sitemap_validation: assessment.sitemap_validation ?? null,
    syntax_validation: assessment.syntax_validation ?? null,
    index_control_validation: assessment.index_control_validation ?? null,
    policy_compliance: assessment.policy_compliance ?? null,
    audit_findings: assessment.audit_findings ?? [],
    draft_robots_txt,
    deployment_note:
      deployment_note ??
      `No deployment performed. Live file at https://${domain}/robots.txt`,
    limitations
  };

  if (assessment.deployment) {
    handoff.deployment = assessment.deployment;
  }
  if (assessment.layer_assessment) {
    handoff.layer_assessment = assessment.layer_assessment;
  }
  if (assessment.recommendations_split) {
    handoff.recommendations_split = assessment.recommendations_split;
  }
  if (assessment.origin_append_template) {
    handoff.origin_append_template = assessment.origin_append_template;
  }
  if (assessment.content_signals) {
    handoff.content_signals = assessment.content_signals;
  }

  return handoff;
}
