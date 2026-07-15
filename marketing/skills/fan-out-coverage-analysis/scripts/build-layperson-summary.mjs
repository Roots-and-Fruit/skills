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
import {
  buildActionableGaps,
  brokenSpokeRows,
  buildWriteNextGaps,
  coreVariantPermutationRows,
  isQuestionRow,
  rowSources
} from "./actionable-gaps.mjs";
import { buildDetailReportMarkdown, syncSerpContextFanout } from "./detail-report.mjs";
import { isRootAnchorUrl } from "./fanout-shared.mjs";
import { detectLaneMismatch } from "./serp-context.mjs";
import { isEncyclopediaProfile } from "./apply-coverage.mjs";
import { isOffTopicDemotablePaa } from "./fanout-modifiers.mjs";
import { salientTokens } from "./normalize-fanout.mjs";

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

function detectDualLaneReport(handoff) {
  return (handoff.limitations ?? []).some((line) =>
    /report both|dual.lane|tool_discovery and primary_topic/i.test(line)
  );
}

function facetDriftRows(handoff) {
  return (handoff.sub_queries ?? []).filter((row) => row.relevance_tier === "facet_drift");
}

function shouldAppendCoverageStory(anchorRank, clusterPct, labsPct, story) {
  if (!story) {
    return false;
  }
  if (anchorRank != null && clusterPct != null) {
    return false;
  }
  if (anchorRank != null && /anchor ranks #\d+/i.test(story)) {
    return false;
  }
  if (clusterPct != null && labsPct != null && /labs row index/i.test(story)) {
    return false;
  }
  return true;
}

function coverageStory(handoff) {
  const summary = handoff.coverage_summary ?? {};
  const serp = handoff.serp_context ?? {};
  const labsPct = summary.labs_coverage_rate_pct ?? summary.coverage_rate_pct ?? 0;
  const clusterPct = summary.cluster_coverage_rate_pct ?? null;
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

  if (labsPct === 0 && anchorRank != null && clusterPct == null) {
    lines.push(
      `Our ranking database has not linked your site to these follow-up questions yet — that is common right after publishing. Focus on the content gaps below, not the "0%" headline alone.`
    );
  } else if (clusterPct != null && clusterPct > 0) {
    lines.push(
      `Intent cluster coverage: **${clusterPct}%** (${summary.cluster_covered_count ?? 0}/${summary.cluster_count ?? 0} fan-out intents).`
    );
    if (labsPct > 0 && labsPct !== clusterPct) {
      lines.push(`Labs row index (lagging): **${labsPct}%** (${summary.covered_count ?? 0}/${summary.sub_query_count ?? 0}).`);
    } else if (labsPct === 0 && anchorRank != null) {
      lines.push(
        `Labs row index has not caught up yet — focus on the content gaps below, not the low Labs % alone.`
      );
    }
  } else if (labsPct > 0) {
    lines.push(`Indexed coverage on fan-out questions: **${labsPct}%** (${summary.covered_count ?? 0}/${summary.sub_query_count ?? 0}).`);
  } else {
    lines.push(`Indexed coverage on fan-out questions: **${labsPct}%**.`);
  }

  if (shouldAppendCoverageStory(anchorRank, clusterPct, labsPct, summary.coverage_story)) {
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

  if (handoff.inputs?.intent_lane) {
    items.push(`Analysis focused on your chosen angle (${handoff.inputs.intent_lane.replace(/_/g, " ")})`);
  }

  const actionable = buildActionableGaps(handoff);
  if (actionable.length > 0) {
    items.push(`We mapped ${handoff.sub_queries?.length ?? 0} related questions searchers ask`);
  }

  if (items.length === 0) {
    items.push("SERP seed and fan-out map completed successfully");
  }

  return items;
}

export function resolveHubRankLabel(handoff) {
  const anchor = handoff?.inputs?.anchor_url;
  if (anchor && !isRootAnchorUrl(anchor)) {
    return "your hub page";
  }
  return "homepage";
}

export function gapToPlainLanguage(row, handoff = null) {
  const kw = row.keyword;
  if (isQuestionRow(row) || rowSources(row).includes("serp_paa")) {
    return `Answer "${kw}" — people ask this directly on Google`;
  }
  if (row.coverage_weak || row.status === "hub_serp_only") {
    const rank = row.rank_group;
    const hubLabel = handoff ? resolveHubRankLabel(handoff) : "homepage";
    const rankNote = rank != null ? ` (${hubLabel} ranks ~#${rank} today)` : "";
    return `Strengthen dedicated content for "${kw}"${rankNote}`;
  }
  if (row.status === "broken_spoke") {
    const rank = row.rank_group;
    const rankNote = rank != null ? ` (ranks ~#${rank} — page 2+)` : " (page 2+)";
    return `Strengthen "${kw}"${rankNote} — you have coverage but need a stronger page`;
  }
  if (row.on_seed_serp || row.relevance_tier === "serp_native") {
    return `Cover "${kw}" — searchers use this related query on Google`;
  }
  if (row.relevance_tier === "core" && /how to/i.test(kw)) {
    return `Add a how-to piece or section for "${kw}"`;
  }
  return `Cover "${kw}" in your content plan`;
}

function buildActionPlan(handoff) {
  const chosenLane = handoff.inputs?.intent_lane ?? null;
  const paaCtx = {
    chosenLane,
    seedTokens: salientTokens(handoff.inputs?.primary_keyword ?? "")
  };
  return buildWriteNextGaps(handoff, 6)
    .filter((row) => {
      if (chosenLane === "tool_discovery" && isOffTopicDemotablePaa(row.keyword, paaCtx)) {
        return false;
      }
      return true;
    })
    .map((row, index) => ({
      step: index + 1,
      action: gapToPlainLanguage(row, handoff)
    }));
}

function hubSpokeDigestLine(handoff) {
  const map = handoff.hub_spoke_map ?? [];
  const anchor = handoff.inputs?.anchor_url ?? null;
  if (map.length <= 1) {
    return null;
  }

  const anchorNorm = anchor ? anchor.replace(/\/+$/, "").toLowerCase() : null;
  const spokes = map.filter((entry) => {
    const urlNorm = String(entry.url ?? "").replace(/\/+$/, "").toLowerCase();
    return anchorNorm && urlNorm !== anchorNorm;
  });

  if (spokes.length === 0) {
    return null;
  }

  return `**${spokes.length}** fan-out intents rank on dedicated spoke pages — not on your overview anchor. See the detail report hub/spoke map.`;
}

function formatVerdictGapHeadline(handoff, actionableCount) {
  const keyword = handoff.inputs?.primary_keyword ?? "your keyword";
  const clusterGapCount = handoff.coverage_summary?.cluster_gap_count;
  const shortlistCount =
    handoff.coverage_summary?.gaps_shortlist_count ?? handoff.gaps?.length ?? null;

  if (clusterGapCount == null) {
    return `**${actionableCount} high-priority content gap${actionableCount === 1 ? "" : "s"}** around "${keyword}".`;
  }

  if (shortlistCount != null && shortlistCount !== clusterGapCount) {
    return `**${clusterGapCount} intent cluster gap${clusterGapCount === 1 ? "" : "s"}** (${shortlistCount} in shortlist) around "${keyword}".`;
  }

  return `**${clusterGapCount} intent cluster gap${clusterGapCount === 1 ? "" : "s"}** around "${keyword}".`;
}

function formatPermutationNote(rows) {
  if (rows.length === 0) {
    return [];
  }
  const labels = rows.map((row) => row.keyword);
  if (labels.length <= 3) {
    return labels.map((label) => `- ${label}`);
  }
  const preview = labels.slice(0, 2).join(", ");
  return [`- ${preview}, and ${labels.length - 2} similar word-order variants`];
}

/**
 * @param {object} handoff
 * @param {{ detailRelativePath: string }} options
 */
export function buildLaypersonSummaryMarkdown(handoff, options) {
  const keyword = handoff.inputs?.primary_keyword ?? "your keyword";
  const domain = handoff.inputs?.domain;
  const titleDomain = domain ?? "keyword-only";
  const actionable = buildActionableGaps(handoff);
  const brokenSpokes = brokenSpokeRows(handoff);
  const clusterGapCount = handoff.coverage_summary?.cluster_gap_count;
  const gapCountForVerdict = clusterGapCount ?? actionable.length;
  const drift = facetDriftRows(handoff);
  const permutations = coreVariantPermutationRows(handoff);
  const working = buildWorkingList(handoff);
  const coverageLines = coverageStory(handoff);
  const plan = buildActionPlan(handoff);
  const laneMismatch = detectLaneMismatch(handoff.serp_context ?? {}, handoff.inputs?.intent_lane);
  const dualLane = detectDualLaneReport(handoff);
  const encyclopedia = isEncyclopediaProfile(handoff);
  const hubDigest = hubSpokeDigestLine(handoff);

  let verdictHeadline;
  if (handoff.mode === "keyword_only") {
    verdictHeadline = `**Fan-out map ready** for "${keyword}" — no site coverage checked.`;
  } else if (encyclopedia && (handoff.coverage_summary?.cluster_coverage_rate_pct ?? 0) >= 50) {
    verdictHeadline =
      "**Strong internal coverage** on related topics — strengthen or link existing articles, not net-new pages.";
  } else if (actionable.length === 0) {
    verdictHeadline = "**Strong coverage** on high-priority follow-up questions for your chosen lane.";
  } else if (coverageLines.some((l) => l.includes("#"))) {
    verdictHeadline = `**Visible on the main topic, gaps on follow-up questions** — ${gapCountForVerdict} intent cluster${gapCountForVerdict === 1 ? "" : "s"} need content.`;
  } else {
    verdictHeadline = formatVerdictGapHeadline(handoff, actionable.length);
  }

  const lines = [
    `# Fan-out coverage — ${titleDomain}`,
    "",
    "## Verdict",
    "",
    verdictHeadline,
    "",
    ...coverageLines.map((l) => `- ${l}`),
    ...(laneMismatch
      ? [
          `- **Lane note:** This SERP is mostly **${laneMismatch.dominant.replace(/_/g, " ")}** (${laneMismatch.pct}%) but analysis used **${laneMismatch.chosenLane.replace(/_/g, " ")}** — write-next may not match listicle/commercial intent.`
        ]
      : dualLane
        ? [
            "- **Lane note:** Mixed SERP — user requested both **tool discovery** and **primary topic** lanes; see detail report for lane attribution on gaps."
          ]
        : []),
    ...(hubDigest ? [`- ${hubDigest}`] : []),
    "",
    "## What's working",
    "",
    ...working.map((w) => `- ${w}`),
    "",
    "## What still needs attention",
    ""
  ];

  if (actionable.length === 0) {
    lines.push("- Nothing urgent in your chosen lane");
  } else {
    for (const row of actionable.slice(0, 8)) {
      if (row.status === "broken_spoke") {
        continue;
      }
      lines.push(`- ${gapToPlainLanguage(row, handoff)}`);
    }
  }

  if (brokenSpokes.length > 0) {
    lines.push(
      "",
      "_Ranks page 2+ — strengthen existing pages, not new URLs:_",
      ""
    );
    for (const row of brokenSpokes.slice(0, 6)) {
      lines.push(`- ${gapToPlainLanguage(row, handoff)}`);
    }
  }

  if (permutations.length > 0) {
    lines.push(
      "",
      "_Not priority (same search intent as the main topic — word-order variants, not separate content jobs):_",
      ""
    );
    lines.push(...formatPermutationNote(permutations));
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
  const synced = normalizeHandoffSerpContext(syncSerpContextFanout(handoff));
  const { summaryMarkdown, detailPath } = writeFanoutReports(synced, {
    outputDir: outputDir ? path.resolve(outputDir) : undefined
  });

  console.error(`Detail report: ${detailPath}`);
  console.log(summaryMarkdown);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
