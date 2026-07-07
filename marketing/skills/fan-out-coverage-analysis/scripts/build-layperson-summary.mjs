#!/usr/bin/env node
/**
 * Layperson chat summary + technical detail report for fan-out-coverage-analysis.
 *
 * Usage:
 *   node scripts/build-layperson-summary.mjs path/to/handoff.json [output_dir]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

function loadHandoff(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function slugFromHandoff(handoff) {
  const domain = handoff.inputs?.domain;
  if (domain) {
    return String(domain).replace(/^www\./, "");
  }
  const kw = handoff.inputs?.primary_keyword ?? "keyword-only";
  return kw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function highGaps(handoff) {
  const gapHighs = (handoff.sub_queries ?? []).filter(
    (row) => row.priority === "high" && row.status === "gap"
  );
  if (gapHighs.length > 0) {
    return gapHighs;
  }

  const fromGaps = (handoff.gaps ?? []).filter((row) => row.priority === "high");
  if (fromGaps.length > 0) {
    return fromGaps;
  }

  return (handoff.priority_sub_queries ?? []).filter((row) => row.priority === "high");
}

function facetDriftRows(handoff) {
  return (handoff.sub_queries ?? []).filter((row) => row.relevance_tier === "facet_drift");
}

function coverageStory(handoff) {
  const summary = handoff.coverage_summary ?? {};
  const serp = handoff.serp_context ?? {};
  const labsPct = summary.labs_coverage_rate_pct ?? summary.coverage_rate_pct ?? 0;
  const anchorRank = serp.anchor_serp_rank ?? summary.anchor_serp_rank ?? null;
  const lines = [];

  if (handoff.mode === "keyword_only") {
    lines.push("Keyword-only run — no site coverage measured.");
    return lines;
  }

  if (anchorRank != null && anchorRank > 0) {
    lines.push(
      `Your main article shows up around **#${anchorRank}** on Google for the primary search term (live SERP).`
    );
  }

  if (labsPct === 0 && anchorRank != null) {
    lines.push(
      `Our ranking database has not linked your site to these follow-up questions yet — that is common right after publishing. Focus on the content gaps below, not the "0%" headline alone.`
    );
  } else if (labsPct > 0) {
    lines.push(`Indexed coverage on fan-out questions: **${labsPct}%** (${summary.covered_count ?? 0}/${summary.sub_query_count ?? 0}).`);
  } else {
    lines.push(`Indexed coverage on fan-out questions: **${labsPct}%**.`);
  }

  if (summary.coverage_story) {
    lines.push(summary.coverage_story);
  }

  return lines;
}

export function buildWorkingList(handoff) {
  const items = [];
  const serp = handoff.serp_context ?? {};
  const summary = handoff.coverage_summary ?? {};

  if (serp.ai_overview_present) {
    items.push("Google shows an AI Overview for this search — fan-out questions matter for visibility");
  }

  if (summary.anchor_serp_rank != null || serp.anchor_serp_rank != null) {
    const rank = summary.anchor_serp_rank ?? serp.anchor_serp_rank;
    items.push(`You already rank on page one (~#${rank}) for the main topic`);
  }

  if (handoff.inputs?.intent_lane) {
    items.push(`Analysis focused on your chosen angle (${handoff.inputs.intent_lane.replace(/_/g, " ")})`);
  }

  const highs = highGaps(handoff);
  if (highs.length > 0 && handoff.mode === "domain_coverage") {
    items.push(`We mapped ${handoff.sub_queries?.length ?? 0} related questions searchers ask`);
  }

  if (items.length === 0) {
    items.push("SERP seed and fan-out map completed successfully");
  }

  return items;
}

function gapToPlainLanguage(row) {
  const kw = row.keyword;
  if (row.source?.includes?.("serp_paa") || /^(what|how|why|can|does)\b/i.test(kw)) {
    return `Answer "${kw}" — people ask this directly on Google`;
  }
  if (row.relevance_tier === "core" && /how to/i.test(kw)) {
    return `Add a how-to piece or section for "${kw}"`;
  }
  return `Cover "${kw}" in your content plan`;
}

function buildActionPlan(handoff) {
  const highs = highGaps(handoff);
  const fromPriority = handoff.priority_sub_queries ?? [];
  const seen = new Set();
  const ordered = [];

  for (const row of [...highs, ...fromPriority]) {
    const key = row.keyword?.toLowerCase();
    if (!key || seen.has(key) || row.priority === "low") {
      continue;
    }
    seen.add(key);
    ordered.push(row);
  }

  return ordered.slice(0, 6).map((row, index) => ({
    step: index + 1,
    action: gapToPlainLanguage(row)
  }));
}

/**
 * @param {object} handoff
 * @param {{ detailRelativePath: string }} options
 */
export function buildLaypersonSummaryMarkdown(handoff, options) {
  const keyword = handoff.inputs?.primary_keyword ?? "your keyword";
  const domain = handoff.inputs?.domain;
  const titleDomain = domain ?? "keyword-only";
  const highs = highGaps(handoff);
  const drift = facetDriftRows(handoff);
  const working = buildWorkingList(handoff);
  const coverageLines = coverageStory(handoff);
  const plan = buildActionPlan(handoff);

  let verdictHeadline;
  if (handoff.mode === "keyword_only") {
    verdictHeadline = `**Fan-out map ready** for "${keyword}" — no site coverage checked.`;
  } else if (highs.length === 0) {
    verdictHeadline = "**Strong coverage** on high-priority follow-up questions for your chosen lane.";
  } else if (coverageLines.some((l) => l.includes("#"))) {
    verdictHeadline = `**Visible on the main topic, gaps on follow-up questions** — ${highs.length} high-priority content opportunities.`;
  } else {
    verdictHeadline = `**${highs.length} high-priority content gaps** around "${keyword}".`;
  }

  const lines = [
    `# Fan-out coverage — ${titleDomain}`,
    "",
    "## Verdict",
    "",
    verdictHeadline,
    "",
    ...coverageLines.map((l) => `- ${l}`),
    "",
    "## What's working",
    "",
    ...working.map((w) => `- ${w}`),
    "",
    "## What still needs attention",
    ""
  ];

  if (highs.length === 0) {
    lines.push("- Nothing urgent in your chosen lane");
  } else {
    for (const row of highs.slice(0, 8)) {
      lines.push(`- ${gapToPlainLanguage(row)}`);
    }
  }

  if (drift.length > 0) {
    lines.push("", "_Not priority (different search intent — safe to ignore unless you pivot):_", "");
    for (const row of drift.slice(0, 5)) {
      lines.push(`- ${row.keyword}`);
    }
  }

  lines.push("", "## What to write next", "");
  if (plan.length === 0) {
    lines.push("1. Review the detail report and confirm priorities with your editor.");
    lines.push("");
  } else {
    for (const item of plan) {
      lines.push(`${item.step}. ${item.action}`);
      lines.push("");
    }
  }

  lines.push(
    "---",
    "",
    `Technical details (full coverage map, tiers, handoff JSON): **${options.detailRelativePath}**`,
    "",
    "_Fan-out maps related questions searchers ask; it is not a guarantee of rankings or AI citations._",
    ""
  );

  return lines.join("\n");
}

export function buildDetailReportMarkdown(handoff) {
  const sections = [
    `# Fan-out detail report — ${handoff.inputs?.primary_keyword ?? "keyword"}`,
    "",
    `**Mode:** ${handoff.mode}`,
    `**Generated:** ${handoff.generated_at ?? ""}`,
    "",
    "## Layperson summary inputs",
    "",
    `- Domain: ${handoff.inputs?.domain ?? "—"}`,
    `- Intent lane: ${handoff.inputs?.intent_lane ?? "—"}`,
    `- Sub-queries: ${handoff.sub_queries?.length ?? 0}`,
    "",
    "## SERP context",
    "",
    "```json",
    JSON.stringify(handoff.serp_context ?? {}, null, 2),
    "```",
    "",
    "## Coverage summary",
    "",
    "```json",
    JSON.stringify(handoff.coverage_summary ?? {}, null, 2),
    "```",
    "",
    "## Sub-queries",
    "",
    "| Keyword | Tier | Priority | Status |",
    "|---------|------|----------|--------|"
  ];

  for (const row of handoff.sub_queries ?? []) {
    sections.push(
      `| ${row.keyword} | ${row.relevance_tier} | ${row.priority} | ${row.status ?? "—"} |`
    );
  }

  sections.push(
    "",
    "## Priority sub-queries",
    "",
    "```json",
    JSON.stringify(handoff.priority_sub_queries ?? [], null, 2),
    "```",
    "",
    "## Gaps",
    "",
    "```json",
    JSON.stringify(handoff.gaps ?? [], null, 2),
    "```",
    "",
    "## Limitations",
    "",
    ...(handoff.limitations ?? []).map((l) => `- ${l}`),
    "",
    "## Handoff JSON",
    "",
    "```json",
    JSON.stringify(handoff, null, 2),
    "```",
    ""
  );

  return sections.join("\n");
}

/**
 * @param {object} handoff
 * @param {{ outputDir?: string }} [options]
 */
export function writeFanoutReports(handoff, options = {}) {
  const slug = slugFromHandoff(handoff);
  const date = new Date().toISOString().slice(0, 10);
  const outputDir = options.outputDir ?? path.join(skillRoot, "reports");
  mkdirSync(outputDir, { recursive: true });

  const detailFileName = `${slug}-${date}-detail.md`;
  const detailPath = path.join(outputDir, detailFileName);
  const detailMarkdown = buildDetailReportMarkdown(handoff);
  writeFileSync(detailPath, detailMarkdown, "utf8");

  let detailRelativePath = path.relative(process.cwd(), detailPath).replace(/\\/g, "/");
  if (detailRelativePath.startsWith("..")) {
    detailRelativePath = detailPath;
  }

  const summaryMarkdown = buildLaypersonSummaryMarkdown(handoff, { detailRelativePath });

  return { summaryMarkdown, detailPath, detailRelativePath };
}

function main() {
  const handoffPath = process.argv[2];
  const outputDir = process.argv[3] ?? null;

  if (!handoffPath) {
    console.error("Usage: node scripts/build-layperson-summary.mjs <handoff.json> [output_dir]");
    process.exit(2);
  }

  const handoff = loadHandoff(path.resolve(handoffPath));
  const { summaryMarkdown, detailPath } = writeFanoutReports(handoff, {
    outputDir: outputDir ? path.resolve(outputDir) : undefined
  });

  console.error(`Detail report: ${detailPath}`);
  console.log(summaryMarkdown);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
