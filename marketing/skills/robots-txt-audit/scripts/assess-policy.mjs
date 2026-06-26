/**
 * Policy compliance and sitemap validation (SSOT for P-layer and agent handoff).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRAWLER_REGISTRY,
  MAX_DISCOVERY_REQUIRED_TOKENS,
  MAX_DISCOVERY_RESTRICTED_PATHS
} from "./crawler-registry.mjs";
import {
  findGroupForAgent,
  isPathAllowedForAgent,
  parseRobotsTxt
} from "./parse-robots-txt.mjs";

export function normalizeDomain(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

export function hostMatchesDomain(urlString, domain) {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    const base = normalizeDomain(domain);
    return host === base || host === `www.${base}`;
  } catch {
    return false;
  }
}

/**
 * Validate Sitemap: directives for a site audit.
 * @param {string[]} sitemaps
 * @param {string} domain
 * @param {{ expectedSitemapUrl?: string, sitemap_fetch_results?: Array<{ url: string, status: number, ok?: boolean }> }} [options]
 */
export function validateSitemaps(sitemaps, domain, options = {}) {
  const issues = [];
  const urls = [...sitemaps];
  const validUrls = [];
  const endpoint_fetch = [];

  if (urls.length === 0) {
    issues.push({
      id: "SM1",
      severity: "fail",
      message: "No Sitemap: directive found"
    });
  }

  for (const url of urls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      issues.push({
        id: "SM2",
        severity: "fail",
        message: `Sitemap URL is not absolute: ${url}`
      });
      continue;
    }

    if (!/^https?:$/i.test(parsed.protocol)) {
      issues.push({
        id: "SM2",
        severity: "fail",
        message: `Sitemap URL must use http(s): ${url}`
      });
      continue;
    }

    if (parsed.protocol === "http:") {
      issues.push({
        id: "SM3",
        severity: "warn",
        message: `Prefer https Sitemap URL: ${url}`
      });
    }

    if (!hostMatchesDomain(url, domain)) {
      issues.push({
        id: "SM4",
        severity: "fail",
        message: `Sitemap host does not match domain ${domain}: ${url}`
      });
      continue;
    }

    const path = parsed.pathname.toLowerCase();
    if (!/sitemap|\.xml$/.test(path)) {
      issues.push({
        id: "SM5",
        severity: "warn",
        message: `Sitemap path should typically contain sitemap or end in .xml: ${url}`
      });
    }

    validUrls.push(url);
  }

  if (options.sitemap_fetch_results?.length) {
    for (const result of options.sitemap_fetch_results) {
      const status = result.status;
      const url = result.url;
      const ok = result.ok ?? (status >= 200 && status < 300);
      endpoint_fetch.push({ url, status, ok });

      if (!ok) {
        issues.push({
          id: "SM7",
          severity: "warn",
          message: `Sitemap URL returned HTTP ${status}: ${url}`
        });
      }
    }
  } else if (validUrls.length > 0) {
    for (const url of validUrls) {
      endpoint_fetch.push({ url, status: null, ok: null });
    }
  }

  if (options.expectedSitemapUrl) {
    const expected = options.expectedSitemapUrl;
    if (!urls.includes(expected)) {
      issues.push({
        id: "SM6",
        severity: "warn",
        message: `Expected sitemap not declared: ${expected}`
      });
    }
  }

  const hasFail = issues.some((i) => i.severity === "fail");

  return {
    present: urls.length > 0,
    urls,
    valid_urls: validUrls,
    host_match: validUrls.length > 0 && !issues.some((i) => i.id === "SM4"),
    absolute_urls: urls.length > 0 && !issues.some((i) => i.id === "SM2"),
    endpoint_fetch,
    issues,
    status: hasFail ? "fail" : issues.length > 0 ? "warn" : "pass"
  };
}

export function hasExplicitUserAgentGroup(groups, userAgent) {
  const ua = userAgent.toLowerCase();
  return groups.some((group) =>
    group.userAgents.some((agent) => agent.toLowerCase() === ua)
  );
}

export function getSiteAccess(groups, token, probePath = "/") {
  const allowed = isPathAllowedForAgent(groups, token, probePath);
  return allowed ? "allowed" : "blocked";
}

/**
 * Per-bot matrix for human output and handoff.
 */
export function buildCrawlerMatrix(groups) {
  return Object.entries(CRAWLER_REGISTRY).map(([token, def]) => {
    const indexingProbe =
      def.roles.includes("indexing") || def.roles.includes("ai_answer");
    const trainingProbe = def.roles.includes("ai_training");

    const explicit = hasExplicitUserAgentGroup(groups, token);

    return {
      token,
      roles: def.roles,
      role_label: def.roles.join(", "),
      controls: def.controls,
      paired_token: def.paired_token ?? null,
      rule_source: explicit ? "explicit" : "inherits_user_agent_star",
      indexing_crawl: indexingProbe ? getSiteAccess(groups, token, "/") : "na",
      training_crawl: trainingProbe ? getSiteAccess(groups, token, "/") : "na",
      max_discovery_expectation: def.max_discovery_site_access,
      note: def.note ?? null
    };
  });
}

/**
 * max_discovery compliance checks (P-layer).
 */
export function assessMaxDiscovery(groups, domain) {
  const violations = [];

  for (const token of MAX_DISCOVERY_REQUIRED_TOKENS) {
    const expected = CRAWLER_REGISTRY[token].max_discovery_site_access;
    const actual = getSiteAccess(groups, token, "/");
    const id = `MD_${token.replace(/[^a-zA-Z0-9]/g, "_")}`;

    if (expected === "allow" && actual !== "allowed") {
      violations.push({
        id,
        token,
        expected,
        actual,
        path: "/",
        message: `${token} should be allowed for max_discovery (indexing/answer crawl)`
      });
    }

    if (expected === "block" && actual === "allowed") {
      violations.push({
        id,
        token,
        expected,
        actual,
        path: "/",
        message: `${token} should be blocked for max_discovery (training crawl)`
      });
    }
  }

  if (getSiteAccess(groups, "Googlebot", "/") === "blocked" &&
      getSiteAccess(groups, "Google-Extended", "/") === "allowed") {
    violations.push({
      id: "MD_GOOGLE_PAIRING",
      token: "Googlebot",
      expected: "allow",
      actual: "blocked",
      path: "/",
      message: "Googlebot blocked while Google-Extended allowed — likely reversed intent"
    });
  }

  if (getSiteAccess(groups, "GPTBot", "/") === "allowed" &&
      getSiteAccess(groups, "OAI-SearchBot", "/") === "blocked") {
    violations.push({
      id: "MD_OPENAI_PAIRING",
      token: "OAI-SearchBot",
      expected: "allow",
      actual: "blocked",
      path: "/",
      message: "OAI-SearchBot blocked while GPTBot allowed — training/discovery reversed"
    });
  }

  for (const restrictedPath of MAX_DISCOVERY_RESTRICTED_PATHS) {
    if (isPathAllowedForAgent(groups, "*", restrictedPath)) {
      violations.push({
        id: `MD_PATH_${restrictedPath.replace(/\//g, "_")}`,
        token: "*",
        expected: "block",
        actual: "allowed",
        path: restrictedPath,
        message: `Wildcard should restrict low-value path ${restrictedPath}`
      });
    }
  }

  return {
    policy: "max_discovery",
    compliant: violations.length === 0,
    violations
  };
}

export function assessPolicyCompliance(parsed, crawlPolicy, domain, options = {}) {
  const sitemap = validateSitemaps(parsed.sitemaps, domain, options);
  const matrix = buildCrawlerMatrix(parsed.groups);

  let policyCompliance = null;
  if (crawlPolicy === "max_discovery") {
    policyCompliance = assessMaxDiscovery(parsed.groups, domain);
    if (!sitemap.present) {
      policyCompliance.violations.push({
        id: "MD_SITEMAP_PRESENT",
        token: "Sitemap",
        expected: "declared",
        actual: "missing",
        path: "n/a",
        message: "max_discovery requires at least one Sitemap: directive"
      });
      policyCompliance.compliant = false;
    }
    if (sitemap.status === "fail") {
      policyCompliance.violations.push({
        id: "MD_SITEMAP_VALID",
        token: "Sitemap",
        expected: "valid absolute URL on site host",
        actual: "invalid",
        path: "n/a",
        message: sitemap.issues.map((i) => i.message).join("; ")
      });
      policyCompliance.compliant = false;
    }
  }

  return {
    crawl_policy: crawlPolicy,
    sitemap_validation: sitemap,
    crawler_matrix: matrix,
    policy_compliance: policyCompliance
  };
}

export function assessRobotsTxtContent(content, crawlPolicy, domain, options = {}) {
  const parsed = parseRobotsTxt(content);
  const assessment = assessPolicyCompliance(parsed, crawlPolicy, domain, options);
  return { parsed, assessment };
}

function main() {
  const file = process.argv[2];
  const policy = process.argv[3] ?? "max_discovery";
  const domain = process.argv[4] ?? "example.com";

  if (!file) {
    console.error(
      "Usage: node scripts/assess-policy.mjs <robots.txt> [crawl_policy] [domain]"
    );
    process.exit(2);
  }

  const content = readFileSync(file, "utf8");
  const result = assessRobotsTxtContent(content, policy, domain);
  console.log(JSON.stringify(result, null, 2));
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
