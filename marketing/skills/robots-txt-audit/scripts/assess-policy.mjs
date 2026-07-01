/**
 * Policy compliance and sitemap validation (SSOT for P-layer and agent handoff).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CRAWLER_REGISTRY,
  MAX_DISCOVERY_PATH_ALTERNATIVES,
  MAX_DISCOVERY_REQUIRED_TOKENS,
  MAX_DISCOVERY_RESTRICTED_PATHS
} from "./crawler-registry.mjs";
import {
  CLOUDFLARE_COMPANION_MODULE
} from "./crawler-registry-cloudflare.mjs";
import {
  buildCloudflareOriginAppend,
  contentSignalsPresetForCrawlPolicy,
  CONTENT_SIGNALS_LIMITATIONS,
  CONTENT_SIGNALS_PRESETS
} from "./content-signals-presets.mjs";
import {
  detectCloudflareManaged,
  findGroupForAgent,
  isPathAllowedForAgent,
  parseContentSignals,
  parseRobotsTxt,
  parseRobotsTxtLayers
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
        severity: "warn",
        message: `Sitemap host does not match ${domain} (Google allows off-host sitemaps): ${url}`
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

export function isRobotsTxtFetchSuspect(content) {
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

export function isRestrictedPathBlocked(groups, restrictedPath) {
  const candidates =
    MAX_DISCOVERY_PATH_ALTERNATIVES[restrictedPath] ?? [restrictedPath];
  return candidates.some((path) => !isPathAllowedForAgent(groups, "*", path));
}

export function getSiteAccess(groups, token, probePath = "/") {
  const allowed = isPathAllowedForAgent(groups, token, probePath);
  return allowed ? "allowed" : "blocked";
}

/**
 * Resolve deployment model from options and content.
 * @param {string} content
 * @param {{ robots_deployment?: string }} [options]
 */
export function resolveDeploymentModel(content, options = {}) {
  const override = options.robots_deployment;
  if (override === "origin_only") {
    return "origin_only";
  }
  if (override === "cloudflare_managed") {
    return "cloudflare_managed";
  }
  return detectCloudflareManaged(content) ? "cloudflare_managed" : "origin_only";
}

/**
 * Whether a training token is blocked in the Cloudflare managed layer.
 * @param {string} token
 * @param {{ groups: unknown[] }} cfParsed
 */
export function isTrainingBlockedInCloudflareLayer(token, cfParsed) {
  if (!cfParsed?.groups) {
    return false;
  }
  return getSiteAccess(cfParsed.groups, token, "/") === "blocked";
}

/**
 * Assess Cloudflare managed layer posture.
 * @param {ReturnType<typeof parseRobotsTxtLayers>} layers
 */
export function assessCloudflareLayer(layers) {
  if (!layers.detected || !layers.cloudflare) {
    return null;
  }

  const trainingTokens = ["GPTBot", "Google-Extended", "CCBot"];
  const trainingResults = Object.fromEntries(
    trainingTokens.map((token) => [
      token,
      isTrainingBlockedInCloudflareLayer(token, layers.cloudflare.parsed)
    ])
  );

  const training_bots_blocked = trainingTokens.every((token) => trainingResults[token]);
  const signals = layers.content_signals ?? parseContentSignals(layers.cloudflare.raw);
  const content_signals_ok =
    signals.search === "yes" && signals.ai_train === "no";

  return {
    training_bots_blocked,
    training_token_results: trainingResults,
    content_signals: signals,
    content_signals_ok,
    managed_group_count: layers.cloudflare.parsed.groupCount,
    managed_rule_count: layers.cloudflare.parsed.ruleCount
  };
}

/**
 * Assess origin layer responsibilities under Cloudflare managed deployment.
 * @param {ReturnType<typeof parseRobotsTxtLayers>} layers
 */
export function assessOriginLayer(layers) {
  const originGroups = layers.origin?.parsed?.groups ?? [];
  const sitemaps = layers.origin?.parsed?.sitemaps ?? [];

  const path_hygiene_ok = MAX_DISCOVERY_RESTRICTED_PATHS.every((restrictedPath) =>
    isRestrictedPathBlocked(originGroups, restrictedPath)
  );

  return {
    sitemap_present: sitemaps.length > 0,
    path_hygiene_ok,
    origin_group_count: layers.origin?.parsed?.groupCount ?? 0,
    origin_rule_count: layers.origin?.parsed?.ruleCount ?? 0
  };
}

/**
 * Build split recommendations for Cloudflare managed deployments.
 * @param {{ violations?: Array<{ id: string, path?: string, message: string, layer?: string }> } | null} policyCompliance
 * @param {ReturnType<typeof assessCloudflareLayer>} cloudflareLayer
 * @param {{ domain?: string, crawl_policy?: string, sitemap_url?: string }} [context]
 */
export function buildRecommendationsSplit(policyCompliance, cloudflareLayer, context = {}) {
  const originItems = [];
  const dashboardItems = [
    "Keep Cloudflare managed robots.txt enabled (Security → Bots → Instruct AI bot traffic with robots.txt)",
    "Verify live edge file matches dashboard after changes",
    "Review Signals / crawler logs for unexpected blocks on public content"
  ];
  const enforcementItems = [
    "Optional: enable AI Crawl Control if bots ignore robots.txt (preference vs enforcement)"
  ];

  for (const violation of policyCompliance?.violations ?? []) {
    if (
      violation.layer === "origin" ||
      violation.id.startsWith("MD_SITEMAP") ||
      violation.id.startsWith("MD_PATH_")
    ) {
      if (violation.id === "MD_SITEMAP_PRESENT") {
        originItems.push(
          "Add Sitemap: https://{domain}/sitemap.xml (or canonical sitemap URL) below the Cloudflare END marker in origin robots.txt"
        );
      } else if (violation.id.startsWith("MD_PATH_")) {
        const alt =
          violation.path === "/admin/"
            ? " (or /wp-admin/ equivalent)"
            : "";
        originItems.push(
          `Add Disallow for ${violation.path}${alt} on origin User-agent: * group`
        );
      } else if (violation.id !== "MD_SITEMAP_VALID") {
        originItems.push(violation.message);
      }
    }
  }

  if (cloudflareLayer && !cloudflareLayer.training_bots_blocked) {
    dashboardItems.push(
      "Confirm managed robots.txt toggle is ON — training bots should be blocked in CF layer"
    );
  }

  if (context.domain && context.crawl_policy === "max_discovery") {
    originItems.push(
      "Use origin_append_template in handoff (Search + AI input Content-Signal preset) — append below END marker; merge with any existing origin rules"
    );
  }

  return {
    cloudflare_dashboard: [...new Set(dashboardItems)],
    origin_file: [...new Set(originItems)],
    enforcement_optional: enforcementItems
  };
}

/**
 * max_discovery compliance with layer attribution (Cloudflare managed).
 * @param {ReturnType<typeof parseRobotsTxtLayers>} layers
 */
export function assessMaxDiscoveryLayered(layers) {
  const effectiveGroups = layers.effective.groups;
  const originGroups = layers.origin?.parsed?.groups ?? [];
  const cfGroups = layers.cloudflare?.parsed?.groups ?? [];
  const violations = [];

  for (const token of MAX_DISCOVERY_REQUIRED_TOKENS) {
    const expected = CRAWLER_REGISTRY[token].max_discovery_site_access;
    const actual = getSiteAccess(effectiveGroups, token, "/");
    const id = `MD_${token.replace(/[^a-zA-Z0-9]/g, "_")}`;

    if (expected === "allow" && actual !== "allowed") {
      violations.push({
        id,
        token,
        expected,
        actual,
        path: "/",
        layer: "effective",
        message: `${token} should be allowed for max_discovery (indexing/answer crawl)`
      });
    }

    if (expected === "block" && actual === "allowed") {
      const cfBlocked = isTrainingBlockedInCloudflareLayer(
        token,
        layers.cloudflare?.parsed
      );
      if (!cfBlocked) {
        violations.push({
          id,
          token,
          expected,
          actual,
          path: "/",
          layer: cfGroups.length > 0 ? "cloudflare" : "effective",
          message: `${token} should be blocked for max_discovery (training crawl)`
        });
      }
    }
  }

  if (
    getSiteAccess(effectiveGroups, "Googlebot", "/") === "blocked" &&
    getSiteAccess(effectiveGroups, "Google-Extended", "/") === "allowed"
  ) {
    violations.push({
      id: "MD_GOOGLE_PAIRING",
      token: "Googlebot",
      expected: "allow",
      actual: "blocked",
      path: "/",
      layer: "effective",
      message:
        "Googlebot blocked while Google-Extended allowed — likely reversed intent"
    });
  }

  if (
    getSiteAccess(effectiveGroups, "GPTBot", "/") === "allowed" &&
    getSiteAccess(effectiveGroups, "OAI-SearchBot", "/") === "blocked"
  ) {
    violations.push({
      id: "MD_OPENAI_PAIRING",
      token: "OAI-SearchBot",
      expected: "allow",
      actual: "blocked",
      path: "/",
      layer: "effective",
      message:
        "OAI-SearchBot blocked while GPTBot allowed — training/discovery reversed"
    });
  }

  for (const restrictedPath of MAX_DISCOVERY_RESTRICTED_PATHS) {
    if (!isRestrictedPathBlocked(originGroups, restrictedPath)) {
      const alts = MAX_DISCOVERY_PATH_ALTERNATIVES[restrictedPath];
      const pathNote = alts
        ? `${restrictedPath} (or ${alts.filter((p) => p !== restrictedPath).join(", ")})`
        : restrictedPath;
      violations.push({
        id: `MD_PATH_${restrictedPath.replace(/\//g, "_")}`,
        token: "*",
        expected: "block",
        actual: "allowed",
        path: restrictedPath,
        layer: "origin",
        message: `Origin User-agent: * should restrict low-value path ${pathNote}`
      });
    }
  }

  return {
    policy: "max_discovery",
    compliant: violations.length === 0,
    violations,
    layered: true
  };
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
 * @param {unknown[]} groups
 * @param {string} domain
 * @param {{ layers?: ReturnType<typeof parseRobotsTxtLayers>, deployment_model?: string }} [options]
 */
export function assessMaxDiscovery(groups, domain, options = {}) {
  if (options.layers?.detected && options.deployment_model === "cloudflare_managed") {
    return assessMaxDiscoveryLayered(options.layers);
  }

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
    if (!isRestrictedPathBlocked(groups, restrictedPath)) {
      const alts = MAX_DISCOVERY_PATH_ALTERNATIVES[restrictedPath];
      const pathNote = alts ? `${restrictedPath} (or ${alts.filter((p) => p !== restrictedPath).join(", ")})` : restrictedPath;
      violations.push({
        id: `MD_PATH_${restrictedPath.replace(/\//g, "_")}`,
        token: "*",
        expected: "block",
        actual: "allowed",
        path: restrictedPath,
        layer: "effective",
        message: `Wildcard should restrict low-value path ${pathNote}`
      });
    }
  }

  return {
    policy: "max_discovery",
    compliant: violations.length === 0,
    violations
  };
}

/**
 * Structured findings for audit_only handoffs (tiered severity).
 * @param {ReturnType<typeof assessPolicyCompliance>} assessment
 * @param {string} crawlPolicy
 * @param {{ fetch_suspect?: boolean, resolved_url?: string }} [discovery]
 */
export function buildAuditFindings(assessment, crawlPolicy, discovery = {}) {
  /** @type {Array<{ id: string, tier: "fail" | "warn" | "info", rubric: string, message: string }>} */
  const findings = [];

  if (discovery.fetch_suspect) {
    findings.push({
      id: "AF_R1_HTML",
      tier: "fail",
      rubric: "R1",
      message:
        "Response looks like HTML, not robots.txt — treat as unfetchable; Google treats 4xx/missing as no file (open crawl risk if misconfigured)."
    });
  }

  for (const issue of assessment.sitemap_validation?.issues ?? []) {
    findings.push({
      id: `AF_${issue.id}`,
      tier: issue.severity === "fail" ? "fail" : "warn",
      rubric: "R7",
      message: issue.message
    });
  }

  if (crawlPolicy === "audit_only") {
    const inheritedTraining = (assessment.crawler_matrix ?? []).filter(
      (row) =>
        row.roles?.includes("ai_training") &&
        row.training_crawl === "allowed" &&
        row.rule_source === "inherits_user_agent_star"
    );
    if (inheritedTraining.length > 0) {
      findings.push({
        id: "AF_R4_INHERITED_TRAINING",
        tier: "warn",
        rubric: "R4",
        message: `Training bots inherit allow from User-agent: * (${inheritedTraining.map((r) => r.token).join(", ")}) — informational unless client opts into training blocks.`
      });
    }
  }

  const groups = assessment.crawler_matrix;
  if (groups) {
    const googlebot = groups.find((r) => r.token === "Googlebot");
    const googleExt = groups.find((r) => r.token === "Google-Extended");
    if (
      googlebot?.indexing_crawl === "blocked" &&
      googleExt?.training_crawl === "allowed"
    ) {
      findings.push({
        id: "AF_R8_GOOGLE_PAIRING",
        tier: "fail",
        rubric: "R8",
        message:
          "Googlebot blocked while Google-Extended allowed — likely reversed intent (Search vs training token)."
      });
    }

    const gpt = groups.find((r) => r.token === "GPTBot");
    const oai = groups.find((r) => r.token === "OAI-SearchBot");
    if (gpt?.training_crawl === "allowed" && oai?.indexing_crawl === "blocked") {
      findings.push({
        id: "AF_R4_OPENAI_PAIRING",
        tier: "fail",
        rubric: "R4",
        message:
          "OAI-SearchBot blocked while GPTBot allowed — training/discovery pairing reversed."
      });
    }
  }

  if (crawlPolicy === "max_discovery" && assessment.policy_compliance?.violations?.length) {
    const originOnly = assessment.deployment?.model === "cloudflare_managed";
    findings.push({
      id: "AF_POLICY_GAP",
      tier: "warn",
      rubric: "policy",
      message: originOnly
        ? `${assessment.policy_compliance.violations.length} max_discovery violation(s) — see policy_compliance (check layer field: origin vs cloudflare).`
        : `${assessment.policy_compliance.violations.length} max_discovery violation(s) — see policy_compliance.`
    });
  }

  if (assessment.deployment?.model === "cloudflare_managed") {
    findings.push({
      id: "AF_CF_MANAGED",
      tier: "info",
      rubric: "R10",
      message:
        "Cloudflare managed robots.txt detected — training blocks may be CF-maintained; origin edits go below the END marker only."
    });
  }

  if (
    assessment.content_signals?.preset === "search_and_ai_input" &&
    assessment.content_signals?.cf_managed_star?.ai_input == null
  ) {
    findings.push({
      id: "AF_R11_AI_INPUT_GAP",
      tier: "info",
      rubric: "R11",
      message:
        "CF managed layer omits ai-input signal — use origin_append_template (Search + AI input preset) for ContentSignals.org-aligned declaration; Allow/Disallow remains primary crawl control."
    });
  }

  return findings;
}

export function assessPolicyCompliance(parsed, crawlPolicy, domain, options = {}) {
  const deploymentModel =
    options.deployment_model ?? resolveDeploymentModel(options.raw_content ?? "", options);
  const layers = options.layers ?? null;
  const isCfManaged =
    deploymentModel === "cloudflare_managed" && layers?.detected === true;

  const sitemapSource = isCfManaged
    ? (layers.origin?.parsed?.sitemaps ?? [])
    : parsed.sitemaps;

  const sitemap = validateSitemaps(sitemapSource, domain, options);
  const matrix = buildCrawlerMatrix(parsed.groups);

  let policyCompliance = null;
  let layerAssessment = null;
  let recommendationsSplit = null;
  let originAppendTemplate = null;
  let contentSignals = null;
  let deployment = {
    model: deploymentModel,
    companion_module: isCfManaged ? CLOUDFLARE_COMPANION_MODULE : null,
    detected_markers: isCfManaged ? [layers.markers?.begin, layers.markers?.end].filter(Boolean) : []
  };

  if (crawlPolicy === "max_discovery") {
    policyCompliance = assessMaxDiscovery(parsed.groups, domain, {
      layers,
      deployment_model: deploymentModel
    });

    if (!sitemap.present) {
      policyCompliance.violations.push({
        id: "MD_SITEMAP_PRESENT",
        token: "Sitemap",
        expected: "declared",
        actual: "missing",
        path: "n/a",
        layer: isCfManaged ? "origin" : "effective",
        message: isCfManaged
          ? "max_discovery requires Sitemap: in origin robots.txt (Cloudflare does not inject sitemaps)"
          : "max_discovery requires at least one Sitemap: directive"
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
        layer: isCfManaged ? "origin" : "effective",
        message: sitemap.issues.map((i) => i.message).join("; ")
      });
      policyCompliance.compliant = false;
    }
  }

  if (isCfManaged && layers) {
    const cloudflare = assessCloudflareLayer(layers);
    const origin = assessOriginLayer(layers);
    layerAssessment = {
      cloudflare,
      origin,
      effective: {
        policy_compliance: policyCompliance
      }
    };
    if (crawlPolicy === "max_discovery") {
      const presetId =
        options.content_signals_preset ??
        contentSignalsPresetForCrawlPolicy(crawlPolicy);
      contentSignals = {
        preset: presetId,
        preset_label: CONTENT_SIGNALS_PRESETS[presetId].label,
        cf_managed_star: layers.content_signals ?? null,
        origin_target: {
          search: CONTENT_SIGNALS_PRESETS[presetId].search,
          ai_input: CONTENT_SIGNALS_PRESETS[presetId].ai_input,
          ai_train: CONTENT_SIGNALS_PRESETS[presetId].ai_train
        },
        contentsignals_org_url: "https://contentsignals.org/",
        limitations: CONTENT_SIGNALS_LIMITATIONS
      };
      originAppendTemplate = buildCloudflareOriginAppend(domain, {
        content_signals_preset: presetId,
        crawl_policy: crawlPolicy,
        sitemap_url: options.expectedSitemapUrl
      });
      recommendationsSplit = buildRecommendationsSplit(policyCompliance, cloudflare, {
        domain,
        crawl_policy: crawlPolicy,
        sitemap_url: options.expectedSitemapUrl
      });
    }
  }

  return {
    crawl_policy: crawlPolicy,
    deployment,
    layer_assessment: layerAssessment,
    recommendations_split: recommendationsSplit,
    origin_append_template: originAppendTemplate,
    content_signals: contentSignals,
    sitemap_validation: sitemap,
    crawler_matrix: matrix,
    policy_compliance: policyCompliance,
    audit_findings: buildAuditFindings(
      {
        sitemap_validation: sitemap,
        crawler_matrix: matrix,
        policy_compliance: policyCompliance,
        deployment,
        layer_assessment: layerAssessment,
        content_signals: contentSignals
      },
      crawlPolicy,
      options.discovery ?? {}
    )
  };
}

export function assessRobotsTxtContent(content, crawlPolicy, domain, options = {}) {
  const layers = parseRobotsTxtLayers(content);
  const deploymentModel = resolveDeploymentModel(content, options);
  const parsed = layers.effective;
  const assessment = assessPolicyCompliance(parsed, crawlPolicy, domain, {
    ...options,
    raw_content: content,
    layers,
    deployment_model: deploymentModel
  });
  return { parsed, layers, deployment_model: deploymentModel, assessment };
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
