/**
 * Layperson user summary + technical detail report for robots-txt-audit.
 *
 * Usage:
 *   node scripts/build-layperson-summary.mjs <robots.txt> <crawl_policy> <domain> [detail_out_path]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent, normalizeDomain } from "./assess-policy.mjs";
import { collectGapsFromAssessment, gapFromViolation } from "./audit-gap-registry.mjs";
import { buildRecommendedRobotsTxt, recommendedRobotsPasteText } from "./build-recommended-robots.mjs";
import {
  buildLearnMoreFooter,
  formatGapBullet,
  learnMoreUrl
} from "./reference-links.mjs";
import {
  buildAuditSnapshot,
  buildReauditSummarySections,
  compareGapSnapshots,
  loadPriorSnapshot,
  saveAuditSnapshot
} from "./build-reaudit.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

/** @param {{ id: string, path?: string, layer?: string, message: string }} violation */
export function violationToLayperson(violation) {
  const gap = gapFromViolation(violation);
  return gap.label;
}

/**
 * @param {ReturnType<typeof assessRobotsTxtContent>["assessment"]} assessment
 * @param {string} domain
 */
export function buildWorkingList(assessment, domain) {
  const items = [];
  const pc = assessment.policy_compliance;
  const cf = assessment.layer_assessment?.cloudflare;
  const deployment = assessment.deployment?.model;

  items.push("robots.txt file is online and readable");

  if (deployment === "cloudflare_managed") {
    items.push("Cloudflare is managing AI training blocks for you (GPTBot, Google-Extended, etc.)");
    if (cf?.training_bots_blocked) {
      items.push("Major AI training crawlers are blocked");
    }
    if (cf?.content_signals_ok) {
      items.push("Your site signals “okay to index for search, not for AI training”");
    }
  }

  if (!pc || pc.compliant) {
    if (pc?.compliant) {
      items.push("Setup matches your max discovery goal");
    }
  } else {
    const effectiveOk = (pc.violations ?? []).filter(
      (v) => v.layer === "effective" || v.layer === "cloudflare"
    );
    if (effectiveOk.length === 0) {
      items.push("Google, Bing, and AI answer bots can reach your public pages");
      items.push("AI training bots are blocked");
    }
  }

  const matrix = assessment.crawler_matrix ?? [];
  const reversed = matrix.some(
    (r) =>
      (r.token === "Googlebot" && r.indexing_crawl === "blocked") ||
      (r.token === "OAI-SearchBot" && r.indexing_crawl === "blocked") ||
      (r.token === "Claude-SearchBot" && r.indexing_crawl === "blocked")
  );
  if (!reversed && (!pc || !pc.violations?.some((v) => v.id.includes("PAIRING")))) {
    if (!items.some((i) => i.includes("Google, Bing"))) {
      items.push("Search and AI answer crawlers are not accidentally blocked");
    }
  }

  const origin = assessment.layer_assessment?.origin;
  if (origin?.sitemap_present) {
    items.push("Sitemap is declared in robots.txt");
  }
  if (origin?.path_hygiene_ok) {
    items.push("Low-value paths (admin, cart, checkout) are restricted");
  }

  if (deployment !== "cloudflare_managed" && pc?.compliant) {
    items.push("Crawler rules match your requested policy");
  }

  return [...new Set(items)];
}

/**
 * @param {ReturnType<typeof assessRobotsTxtContent>["assessment"]} assessment
 * @param {{ includeOptional?: boolean }} [options]
 */
export function buildMissingGapItems(assessment, options = {}) {
  const includeOptional = options.includeOptional !== false;
  const { required, optional } = collectGapsFromAssessment(assessment);
  const gaps = includeOptional ? [...required, ...optional] : [...required];
  const seen = new Set();
  return gaps.filter((gap) => {
    if (seen.has(gap.id)) {
      return false;
    }
    seen.add(gap.id);
    return true;
  });
}

/**
 * @param {ReturnType<typeof assessRobotsTxtContent>["assessment"]} assessment
 * @param {{ includeOptional?: boolean }} [options]
 */
export function buildMissingList(assessment, options = {}) {
  return buildMissingGapItems(assessment, options).map((gap) => gap.label);
}

/** @param {ReturnType<typeof assessRobotsTxtContent>["assessment"]} assessment */
export function buildOptionalGaps(assessment) {
  const { optional } = collectGapsFromAssessment(assessment);
  return optional.map((gap) => gap.label);
}

/**
 * @param {{ id: string, label: string }[]} gaps
 * @param {{ includeLearnMore?: boolean }} [options]
 */
export function formatGapList(gaps, options = {}) {
  return gaps.map((gap) => {
    const line = formatGapBullet(gap, { includeLearnMore: options.includeLearnMore });
    return options.bulletPrefix ? `${options.bulletPrefix}${line}` : line;
  });
}

/**
 * @param {ReturnType<typeof assessRobotsTxtContent>["assessment"]} assessment
 * @param {string} domain
 */
export function buildActionPlan(assessment, domain) {
  const steps = [];
  const deployment = assessment.deployment?.model;
  const split = assessment.recommendations_split;

  if (deployment === "cloudflare_managed") {
    steps.push({
      step: 1,
      who: "Cloudflare + your host",
      action: `See **How to update (Cloudflare-managed)** below — dashboard toggle stays ON; edit the small origin file via SFTP/host (not the public merged file). [Cloudflare layer explained](${learnMoreUrl("cloudflare-detection")}).`
    });
  }

  let n = steps.length;
  const originSteps = [];

  if (assessment.origin_append_template) {
    originSteps.push("Paste the **origin-only** block below into your server file (SFTP/host).");
  } else if (split?.origin_file?.length) {
    for (const item of split.origin_file) {
      originSteps.push(item.replace(/\{domain\}/g, domain));
    }
  } else {
    const missing = buildMissingList(assessment, { includeOptional: false });
    if (missing.some((m) => m.includes("sitemap"))) {
      originSteps.push(`Add a line like: Sitemap: https://${normalizeDomain(domain)}/sitemap.xml (use your real sitemap URL).`);
    }
    if (missing.some((m) => m.includes("Admin"))) {
      originSteps.push("Add Disallow: /wp-admin/ under User-agent: * in your robots.txt.");
    }
  }

  if (originSteps.length > 0) {
    steps.push({
      step: ++n,
      who: deployment === "cloudflare_managed" ? "You (website host / origin robots.txt)" : "You (robots.txt file)",
      action: originSteps.join(" ")
    });
  }

  steps.push({
    step: ++n,
    who: "You (verification)",
    action:
      deployment === "cloudflare_managed"
        ? `Open https://${normalizeDomain(domain)}/robots.txt in a private window — you should see Cloudflare’s block, then your origin rules after END Cloudflare Managed Content.`
        : `Open https://${normalizeDomain(domain)}/robots.txt in a private browser window and confirm your changes appear.`
  });

  if (split?.enforcement_optional?.length) {
    steps.push({
      step: ++n,
      who: "Optional (Cloudflare)",
      action: "If bots ignore robots.txt, turn on AI Crawl Control for actual blocking — robots.txt is only a polite request."
    });
  }

  return steps;
}

/**
 * @param {object} params
 */
export function buildLaypersonReauditMarkdown({
  domain,
  crawlPolicy,
  assessment,
  detailRelativePath,
  recommended,
  priorSnapshot,
  reauditDelta,
  currentGaps
}) {
  const isCloudflare = assessment.deployment?.model === "cloudflare_managed";
  const missing = buildMissingList(assessment, { includeOptional: false });
  const plan = buildActionPlan(assessment, domain);
  const allRequiredDone = missing.length === 0;

  const lines = [
    `# robots.txt re-check — ${domain}`,
    "",
    buildReauditSummarySections({
      domain,
      priorSnapshot,
      currentGaps,
      delta: reauditDelta,
      isCloudflare
    }),
    "## What to do next",
    ""
  ];

  if (allRequiredDone) {
    lines.push(
      "1. **You (done)** — Required items are in place. Spot-check https://" +
        `${normalizeDomain(domain)}/robots.txt` +
        " occasionally after plugin or host changes.",
      ""
    );
    if (reauditDelta.stillOptional.length) {
      lines.push(
        "2. **Optional** — Address the optional items above if you want fuller GEO alignment.",
        ""
      );
    }
  } else {
    let stepNum = 1;
    for (const item of plan) {
      if (isCloudflare && item.who.includes("Cloudflare")) {
        continue;
      }
      lines.push(`${stepNum}. **${item.who}** — ${item.action}`);
      lines.push("");
      stepNum++;
    }
  }

  if (recommended?.changes?.length && !allRequiredDone) {
    lines.push("## Remaining changes", "", ...recommended.changes.map((c) => `- ${c}`), "");
  }

  if (recommended?.cfUpdateGuidance?.length && !allRequiredDone) {
    lines.push("## How to update (Cloudflare-managed)", "", ...recommended.cfUpdateGuidance.map((g) => `- ${g}`), "");
  }

  if (recommended?.text && !allRequiredDone) {
    lines.push(
      "## Copy-paste: origin robots.txt (your server file)",
      "",
      recommended.pasteNote,
      "",
      "```text",
      recommendedRobotsPasteText(recommended),
      "```",
      ""
    );
  }

  const priorDate = priorSnapshot.audited_at?.slice(0, 10) ?? "last check";
  lines.push(
    "---",
    "",
    `Compared to snapshot from **${priorDate}**. Technical detail: **${detailRelativePath}**`,
    "",
    "_Re-checks always use a fresh live fetch — not chat memory._",
    "",
    buildLearnMoreFooter()
  );

  return lines.join("\n");
}

/**
 * @param {object} params
 */
export function buildLaypersonSummaryMarkdown({
  domain,
  crawlPolicy,
  mode,
  assessment,
  detailRelativePath,
  recommended,
  recheck,
  priorSnapshot,
  reauditDelta,
  currentGaps
}) {
  if (recheck && priorSnapshot && reauditDelta && currentGaps) {
    return buildLaypersonReauditMarkdown({
      domain,
      crawlPolicy,
      assessment,
      detailRelativePath,
      recommended,
      priorSnapshot,
      reauditDelta,
      currentGaps
    });
  }

  const working = buildWorkingList(assessment, domain);
  const requiredGaps = buildMissingGapItems(assessment, { includeOptional: false });
  const optionalGaps = collectGapsFromAssessment(assessment).optional;
  const missing = requiredGaps.map((g) => g.label);
  const plan = buildActionPlan(assessment, domain);
  const compliant = assessment.policy_compliance?.compliant === true && optionalGaps.length === 0;
  const verdictBullets = formatGapList(requiredGaps, { includeLearnMore: true, bulletPrefix: "• " });
  const verdictLine =
    requiredGaps.length === 0
      ? optionalGaps.length
        ? "Required items are in place. Optional improvements remain (see below)."
        : "Nothing missing for your requested policy."
      : verdictBullets.join("\n");

  const lines = [
    `# robots.txt check — ${domain}`,
    "",
    "## Verdict",
    "",
    compliant && missing.length === 0 ? "**Good to go** for your requested policy." : "**Not quite there yet.** Missing:",
    "",
    verdictLine,
    "",
    "## What's working",
    "",
    ...working.map((w) => `- ${w}`),
    "",
    "## What still needs attention",
    "",
    ...(requiredGaps.length
      ? formatGapList(requiredGaps, { includeLearnMore: true }).map((line) => `- ${line}`)
      : ["- Nothing required"]),
    ...(optionalGaps.length
      ? [
          "",
          "_Optional:_",
          ...formatGapList(optionalGaps, { includeLearnMore: true }).map((line) => `- ${line}`)
        ]
      : []),
    "",
    "## What to do next",
    ""
  ];

  for (const item of plan) {
    lines.push(`${item.step}. **${item.who}** — ${item.action}`);
    lines.push("");
  }

  if (recommended?.changes?.length) {
    lines.push("## Changes", "", ...recommended.changes.map((c) => `- ${c}`), "");
  }

  if (recommended?.cfUpdateGuidance?.length) {
    lines.push("## How to update (Cloudflare-managed)", "", ...recommended.cfUpdateGuidance.map((g) => `- ${g}`), "");
  }

  if (recommended?.text) {
    lines.push(
      "## Copy-paste: origin robots.txt (your server file)",
      "",
      recommended.pasteNote,
      "",
      "```text",
      recommendedRobotsPasteText(recommended),
      "```",
      ""
    );
  }

  lines.push(
    "---",
    "",
    `Technical details (bot-by-bot tables, rubric scores, handoff JSON, robots.txt copy): **${detailRelativePath}**`,
    "",
    "_robots.txt tells well-behaved crawlers what they may fetch; it does not guarantee ranking, AI citations, or security._",
    "",
    buildLearnMoreFooter()
  );

  return lines.join("\n");
}

/**
 * @param {object} params
 */
export function buildDetailReportMarkdown({
  domain,
  crawlPolicy,
  mode,
  robotsContent,
  result,
  fetchedUrls,
  priorSnapshot,
  reauditDelta
}) {
  const { parsed, layers, deployment_model, assessment } = result;
  const now = new Date().toISOString().slice(0, 10);

  const sections = [
    `# robots.txt audit — technical detail`,
    "",
    `- **Domain:** ${domain}`,
    `- **Date:** ${now}`,
    `- **Crawl policy:** ${crawlPolicy}`,
    `- **Mode:** ${mode}`,
    `- **Deployment:** ${deployment_model}`,
    `- **URLs checked:** ${(fetchedUrls ?? []).join(", ")}`,
    "",
    "## Live robots.txt (fetched)",
    "",
    "```text",
    robotsContent.trim(),
    "```",
    "",
    "## Layer assessment",
    "",
    "```json",
    JSON.stringify(assessment.layer_assessment ?? null, null, 2),
    "```",
    "",
    "## Policy compliance",
    "",
    "```json",
    JSON.stringify(assessment.policy_compliance ?? null, null, 2),
    "```",
    "",
    "## Per-bot matrix",
    "",
    "```json",
    JSON.stringify(assessment.crawler_matrix ?? [], null, 2),
    "```",
    "",
    "## Sitemap validation",
    "",
    "```json",
    JSON.stringify(assessment.sitemap_validation ?? null, null, 2),
    "```",
    "",
    "## Audit findings",
    "",
    "```json",
    JSON.stringify(assessment.audit_findings ?? [], null, 2),
    "```",
    "",
    "## Recommendations split",
    "",
    "```json",
    JSON.stringify(assessment.recommendations_split ?? null, null, 2),
    "```",
    ""
  ];

  if (assessment.origin_append_template) {
    sections.push(
      "## Origin append template",
      "",
      "```text",
      assessment.origin_append_template,
      "```",
      ""
    );
  }

  if (deployment_model === "cloudflare_managed" && layers?.cloudflare?.raw) {
    const originBody = layers?.origin?.raw ?? "";
    const mergedPreview = originBody
      ? `${layers.cloudflare.raw.trimEnd()}\n\n${originBody.trim()}`
      : layers.cloudflare.raw.trim();
    sections.push(
      "## Merged edge preview (what the public URL should show)",
      "",
      "_Not for SFTP upload — origin edits only._",
      "",
      "```text",
      mergedPreview,
      "```",
      ""
    );
  }

  if (assessment.content_signals) {
    sections.push(
      "## Content signals",
      "",
      "```json",
      JSON.stringify(assessment.content_signals, null, 2),
      "```",
      ""
    );
  }

  if (reauditDelta && priorSnapshot) {
    sections.push(
      "## Re-audit delta",
      "",
      "```json",
      JSON.stringify(
        {
          prior_snapshot: priorSnapshot,
          delta: {
            fixed_required_ids: reauditDelta.fixedRequired.map((g) => g.id),
            still_required_ids: reauditDelta.stillRequired.map((g) => g.id),
            new_required_ids: reauditDelta.newRequired.map((g) => g.id),
            fixed_optional_ids: reauditDelta.fixedOptional.map((g) => g.id),
            still_optional_ids: reauditDelta.stillOptional.map((g) => g.id)
          }
        },
        null,
        2
      ),
      "```",
      ""
    );
  }

  const handoff = {
    handoff_version: "1.0",
    skill: "robots-txt-audit",
    skill_version: "1.5.0",
    mode,
    inputs: { domain, crawl_policy: crawlPolicy, robots_deployment: "auto" },
    discovery: {
      found: true,
      urls_checked: fetchedUrls ?? [],
      resolved_url: fetchedUrls?.[0] ?? `https://${normalizeDomain(domain)}/robots.txt`
    },
    deployment: assessment.deployment,
    layer_assessment: assessment.layer_assessment,
    recommendations_split: assessment.recommendations_split,
    origin_append_template: assessment.origin_append_template,
    content_signals: assessment.content_signals,
    parsed: {
      group_count: parsed.groupCount,
      rule_count: parsed.ruleCount,
      user_agent_tokens: parsed.userAgentTokens,
      sitemap_directives: parsed.sitemaps
    },
    crawler_matrix: assessment.crawler_matrix,
    sitemap_validation: assessment.sitemap_validation,
    policy_compliance: assessment.policy_compliance,
    audit_findings: assessment.audit_findings,
    deployment_note: "See layperson summary for action steps. Do not deploy from this file without review."
  };

  sections.push(
    "## Handoff JSON (v1.0)",
    "",
    "```json",
    JSON.stringify(handoff, null, 2),
    "```",
    ""
  );

  return sections.join("\n");
}

/**
 * @param {string} domain
 * @param {string} robotsContent
 * @param {string} crawlPolicy
 * @param {{ outputDir?: string, mode?: string, fetchedUrls?: string[], recheck?: boolean, priorSnapshot?: object | null }} [options]
 */
export function writeAuditReports(domain, robotsContent, crawlPolicy, options = {}) {
  const bare = normalizeDomain(domain);
  const date = new Date().toISOString().slice(0, 10);
  const outputDir = options.outputDir ?? path.join(skillRoot, "reports");
  mkdirSync(outputDir, { recursive: true });

  const priorSnapshot =
    options.priorSnapshot ?? (options.recheck ? loadPriorSnapshot(bare, outputDir) : null);

  const baseName = `${bare}-${date}`;
  const detailFileName = `${baseName}-detail.md`;
  const detailPath = path.join(outputDir, detailFileName);

  const result = assessRobotsTxtContent(robotsContent, crawlPolicy, domain);
  const mode =
    options.mode ??
    (result.assessment.policy_compliance?.compliant === false ? "recommend" : "audit");

  const currentGaps = collectGapsFromAssessment(result.assessment);
  const reauditDelta =
    options.recheck && priorSnapshot
      ? compareGapSnapshots(priorSnapshot, currentGaps)
      : null;

  const detailMarkdown = buildDetailReportMarkdown({
    domain: bare,
    crawlPolicy,
    mode: options.recheck ? "recheck" : mode,
    robotsContent,
    result,
    fetchedUrls: options.fetchedUrls,
    priorSnapshot,
    reauditDelta
  });

  writeFileSync(detailPath, detailMarkdown, "utf8");

  const snapshot = buildAuditSnapshot(bare, result.assessment, {
    crawl_policy: crawlPolicy,
    deployment: result.deployment_model,
    detail_path: detailPath
  });

  saveAuditSnapshot(bare, snapshot, outputDir);

  const recommended = buildRecommendedRobotsTxt(robotsContent, result, bare);

  const detailRelativePath = path.relative(process.cwd(), detailPath).replace(/\\/g, "/");
  const summaryMarkdown = buildLaypersonSummaryMarkdown({
    domain: bare,
    crawlPolicy,
    mode,
    assessment: result.assessment,
    detailRelativePath: detailRelativePath.startsWith("..")
      ? detailPath
      : detailRelativePath,
    recommended,
    recheck: Boolean(options.recheck && priorSnapshot),
    priorSnapshot,
    reauditDelta,
    currentGaps
  });

  return {
    summaryMarkdown,
    detailPath,
    detailRelativePath,
    recommended,
    result,
    priorSnapshot,
    reauditDelta,
    snapshot
  };
}

function main() {
  const args = process.argv.slice(2);
  const recheck = args.includes("--recheck");
  const filtered = args.filter((a) => a !== "--recheck");
  const file = filtered[0];
  const policy = filtered[1] ?? "max_discovery";
  const domain = filtered[2] ?? "example.com";
  const outArg = filtered[3];

  if (!file) {
    console.error(
      "Usage: node scripts/build-layperson-summary.mjs <robots.txt> <crawl_policy> <domain> [output_dir] [--recheck]"
    );
    process.exit(2);
  }

  const content = readFileSync(file, "utf8");
  const { summaryMarkdown, detailPath } = writeAuditReports(domain, content, policy, {
    outputDir: outArg,
    recheck,
    fetchedUrls: [
      `https://${normalizeDomain(domain)}/robots.txt`,
      `https://www.${normalizeDomain(domain)}/robots.txt`
    ]
  });

  console.log(summaryMarkdown);
  console.error(`\nDetail report written: ${detailPath}`);
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
