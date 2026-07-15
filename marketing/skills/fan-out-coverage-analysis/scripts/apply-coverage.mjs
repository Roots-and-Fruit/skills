#!/usr/bin/env node
/**
 * Apply Labs ranked_keywords export to handoff sub_queries (Mode A).
 *
 * Usage:
 *   node scripts/apply-coverage.mjs handoff.json ranked.json
 *   node scripts/apply-coverage.mjs handoff.json ranked.json -o out.json
 *
 * ranked.json shapes supported:
 *   { "items": [{ "keyword": "...", "rank_group": 4, "url": "https://..." }] }
 *   DataForSEO tasks export with keyword_data.keyword + ranked_serp_element
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sortGapsForHandoff, buildActionableGaps } from "./actionable-gaps.mjs";
import { computeClusterCoverage, refreshClusterCanonicals } from "./intent-clusters.mjs";
import { normalizeKeyword } from "./fanout-shared.mjs";
import { salientTokens } from "./normalize-fanout.mjs";
import { YEAR_TOKEN_PATTERN } from "./fanout-modifiers.mjs";

function parseArgs(argv) {
  const opts = { handoff: null, ranked: null, output: null };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-o" || arg === "--output") {
      opts.output = argv[++i] ?? null;
    } else if (!opts.handoff) {
      opts.handoff = arg;
    } else if (!opts.ranked) {
      opts.ranked = arg;
    }
  }
  return opts;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function normalizeUrl(value) {
  if (!value) {
    return "";
  }
  return String(value).replace(/\/+$/, "").toLowerCase();
}

function extractRankedItems(data) {
  if (Array.isArray(data?.tasks?.[0]?.result?.[0]?.items)) {
    return data.tasks[0].result[0].items;
  }
  if (Array.isArray(data?.result?.[0]?.items)) {
    return data.result[0].items;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }
  if (Array.isArray(data)) {
    return data;
  }
  return [];
}

/**
 * @param {unknown} data
 * @returns {Array<{ keyword: string, rank_group: number | null, url: string | null }>}
 */
export function parseRankedRows(data) {
  return extractRankedItems(data)
    .map((row) => {
      const keyword =
        row.keyword ??
        row.keyword_data?.keyword ??
        row.keyword_data?.keyword_info?.keyword ??
        "";
      const serpItem =
        row.ranked_serp_element?.serp_item ??
        row.serp_item ??
        row;
      const rankGroup =
        serpItem?.rank_group ??
        row.rank_group ??
        row.rank_absolute ??
        null;
      const url =
        serpItem?.url ??
        serpItem?.relative_url ??
        row.url ??
        row.covering_url ??
        null;

      return {
        keyword: normalizeKeyword(keyword),
        rank_group: rankGroup == null ? null : Number(rankGroup),
        url: url ? String(url) : null
      };
    })
    .filter((row) => row.keyword.length > 0);
}

/**
 * @param {Array<{ keyword: string, rank_group: number | null, url: string | null }>} rows
 */
export function buildRankIndex(rows) {
  const index = new Map();
  for (const row of rows) {
    const existing = index.get(row.keyword);
    if (!existing) {
      index.set(row.keyword, row);
      continue;
    }
    const existingRank = existing.rank_group ?? Number.POSITIVE_INFINITY;
    const nextRank = row.rank_group ?? Number.POSITIVE_INFINITY;
    if (nextRank < existingRank) {
      index.set(row.keyword, row);
    }
  }
  return index;
}

function keywordsMatch(a, b) {
  const left = normalizeKeyword(a);
  const right = normalizeKeyword(b);
  return left.length > 0 && left === right;
}

function isSeedMatch(keyword, seed) {
  const kw = normalizeKeyword(keyword);
  const seedNorm = normalizeKeyword(seed);
  if (!kw || !seedNorm) {
    return false;
  }
  if (kw === seedNorm) {
    return true;
  }
  return kw.includes(seedNorm) || seedNorm.includes(kw);
}

const SEED_STOP_TOKENS = new Set([
  "go",
  "to",
  "market",
  "gtm",
  "strategy",
  "the",
  "a",
  "an",
  "for",
  "of",
  "and",
  "your"
]);

export function seedDistinctTokens(seed) {
  return normalizeKeyword(seed)
    .split(" ")
    .filter((token) => token.length > 2 && !SEED_STOP_TOKENS.has(token));
}

/**
 * Branded seed-adjacent related search on live SERP (not generic GTM-only queries).
 */
export function isBrandedSeedRelated(row, seed) {
  if (!row.on_seed_serp) {
    return false;
  }
  const sources = Array.isArray(row.source) ? row.source : [row.source];
  if (!sources.includes("serp_related")) {
    return false;
  }
  if (isSeedMatch(row.keyword, seed)) {
    return true;
  }
  const kw = normalizeKeyword(row.keyword);
  const tokens = seedDistinctTokens(seed);
  if (tokens.length === 0) {
    return false;
  }
  return tokens.some((token) => kw.includes(token));
}

export function isEncyclopediaProfile(handoff) {
  if (handoff.inputs?.site_profile === "encyclopedia") {
    return true;
  }
  const domain = String(handoff.inputs?.domain ?? "").toLowerCase();
  return domain.includes("wikipedia") || domain.includes("example-wiki");
}

function isYearSiblingVariant(keyword, seed) {
  const kwTokens = salientTokens(keyword);
  const seedSet = new Set(salientTokens(seed));
  const extras = kwTokens.filter((token) => !seedSet.has(token));
  return extras.some((token) => YEAR_TOKEN_PATTERN.test(token));
}

function findSiblingRankMatch(keyword, rankIndex) {
  const kwTokens = new Set(salientTokens(keyword));
  if (kwTokens.size < 2) {
    return null;
  }
  let best = null;
  let bestOverlap = 0;
  for (const match of rankIndex.values()) {
    const rankedTokens = salientTokens(match.keyword);
    const overlap = rankedTokens.filter((token) => kwTokens.has(token)).length;
    if (overlap >= 2 && overlap > bestOverlap && match.url) {
      best = match;
      bestOverlap = overlap;
    }
  }
  return best;
}

function reconcileEncyclopediaRows(subQueries, rankIndex, anchorUrl, anchorNorm, encyclopedia, seed) {
  if (!encyclopedia) {
    return subQueries;
  }

  return subQueries.map((row) => {
    const next = { ...row };
    if (next.status === "gap") {
      const sibling = findSiblingRankMatch(row.keyword, rankIndex);
      if (sibling?.url) {
        const urlNorm = normalizeUrl(sibling.url);
        next.status = urlNorm === anchorNorm ? "hub" : "spoke";
        next.covering_url = sibling.url;
        next.rank_group = sibling.rank_group;
        return next;
      }
    }

    if (next.status === "hub_serp_only" && isYearSiblingVariant(row.keyword, seed)) {
      next.status = "gap";
      next.covering_url = null;
      next.rank_group = null;
    }

    return next;
  });
}

export function buildGapsFromSubQueries(subQueriesOrHandoff) {
  if (subQueriesOrHandoff && !Array.isArray(subQueriesOrHandoff) && subQueriesOrHandoff.sub_queries) {
    const handoff = subQueriesOrHandoff;
    const actionable = buildActionableGaps(handoff).filter(
      (row) =>
        row.is_canonical !== false &&
        row.cluster_role !== "alias" &&
        (row.status === "gap" || row.status === "broken_spoke")
    );
    return sortGapsForHandoff(actionable)
      .slice(0, 12)
      .map((row) => ({
        keyword: row.keyword,
        search_volume: row.search_volume ?? null,
        dimension: row.dimension,
        search_intent: row.search_intent,
        relevance_tier: row.relevance_tier,
        priority: row.priority,
        notes: row.on_seed_serp ? "On seed SERP" : "Labs expansion"
      }));
  }

  const subQueries = subQueriesOrHandoff;
  return sortGapsForHandoff(
    subQueries.filter(
      (row) =>
        row.status === "gap" &&
        (row.priority === "high" || row.priority === "medium") &&
        (row.relevance_tier !== "facet_drift" || row.priority === "high")
    )
  )
    .slice(0, 12)
    .map((row) => ({
      keyword: row.keyword,
      search_volume: row.search_volume ?? null,
      dimension: row.dimension,
      search_intent: row.search_intent,
      relevance_tier: row.relevance_tier,
      priority: row.priority,
      notes: row.on_seed_serp ? "On seed SERP" : "Labs expansion"
    }));
}

export function buildHubSpokeMap(subQueries, anchorUrl) {
  const anchorNorm = normalizeUrl(anchorUrl);
  const byUrl = new Map();

  for (const row of subQueries) {
    if (row.status === "gap" || !row.covering_url) {
      continue;
    }
    const url = row.covering_url;
    const urlNorm = normalizeUrl(url);
    const role =
      row.status === "hub_serp_only"
        ? "hub"
        : urlNorm && anchorNorm && urlNorm === anchorNorm
          ? "hub"
          : "spoke";

    if (!byUrl.has(url)) {
      byUrl.set(url, {
        url,
        role,
        keywords_served: [],
        links_to_anchor: role === "spoke" ? anchorUrl ?? null : null
      });
    }
    byUrl.get(url).keywords_served.push(row.keyword);
  }

  return [...byUrl.values()];
}

function buildCoverageStory(summary, serpContext, seed) {
  const clusterPct = summary?.cluster_coverage_rate_pct;
  const labsPct = summary?.labs_coverage_rate_pct ?? summary?.coverage_rate_pct ?? 0;
  const clusterCount = summary?.cluster_count;
  const clusterCovered = summary?.cluster_covered_count;

  if (clusterPct != null && labsPct !== clusterPct) {
    return `${clusterPct}% of intent clusters covered (${clusterCovered ?? 0}/${clusterCount ?? 0}); Labs row index ${labsPct}% on fan-out terms.`;
  }
  if (clusterPct != null && clusterPct < 70) {
    return `${clusterPct}% of intent clusters covered — prioritize PAA and SERP-native gaps for "${seed}".`;
  }
  if (labsPct < 70 && labsPct > 0) {
    return "Partial Labs index on fan-out terms — use live SERP context when cluster coverage is higher.";
  }
  if ((clusterPct ?? labsPct) >= 70) {
    return "Strong breadth — most fan-out intent clusters have coverage.";
  }
  if ((clusterPct ?? labsPct) > 0) {
    return "Partial coverage — prioritize high-priority gaps in the chosen lane.";
  }
  return "No Labs rankings for fan-out terms yet — use live SERP context when available.";
}

/**
 * @param {object} handoff
 * @param {unknown} rankedData
 * @returns {object}
 */
export function applyCoverageToHandoff(handoff, rankedData) {
  if (handoff.mode !== "domain_coverage") {
    return handoff;
  }

  const seed = handoff.inputs?.primary_keyword ?? "";
  const anchorUrl = handoff.inputs?.anchor_url ?? null;
  const anchorNorm = normalizeUrl(anchorUrl);
  const anchorRank = handoff.serp_context?.anchor_serp_rank ?? null;
  const rankIndex = buildRankIndex(parseRankedRows(rankedData));
  const encyclopedia = isEncyclopediaProfile(handoff);

  let hubCount = 0;
  let spokeCount = 0;
  let brokenSpokeCount = 0;
  let gapCount = 0;
  let coveredCount = 0;

  const subQueries = (handoff.sub_queries ?? []).map((row) => {
    const next = { ...row };
    const match = rankIndex.get(normalizeKeyword(row.keyword));

    if (match?.url) {
      const urlNorm = normalizeUrl(match.url);
      const rankGroup = match.rank_group;
      next.covering_url = match.url;
      next.rank_group = rankGroup;

      if (rankGroup != null && rankGroup > 20) {
        next.status = "broken_spoke";
        brokenSpokeCount += 1;
        coveredCount += 1;
      } else if (anchorNorm && urlNorm === anchorNorm) {
        next.status = "hub";
        hubCount += 1;
        coveredCount += 1;
      } else {
        next.status = "spoke";
        spokeCount += 1;
        coveredCount += 1;
      }
      return next;
    }

    if (anchorRank != null && anchorUrl && isSeedMatch(row.keyword, seed)) {
      if (encyclopedia && isYearSiblingVariant(row.keyword, seed)) {
        next.status = "gap";
        next.covering_url = null;
        next.rank_group = null;
        gapCount += 1;
        return next;
      }
      next.status = "hub_serp_only";
      next.covering_url = anchorUrl;
      next.rank_group = anchorRank;
      return next;
    }

    if (anchorRank != null && anchorUrl && isBrandedSeedRelated(row, seed)) {
      if (encyclopedia && isYearSiblingVariant(row.keyword, seed)) {
        next.status = "gap";
        next.covering_url = null;
        next.rank_group = null;
        gapCount += 1;
        return next;
      }
      next.status = "hub_serp_only";
      next.covering_url = anchorUrl;
      next.rank_group = anchorRank;
      return next;
    }

    next.status = "gap";
    next.covering_url = null;
    next.rank_group = null;
    gapCount += 1;
    return next;
  });

  const reconciled = reconcileEncyclopediaRows(
    subQueries,
    rankIndex,
    anchorUrl,
    anchorNorm,
    encyclopedia,
    seed
  );

  const canonicalized = refreshClusterCanonicals(reconciled, seed);

  const subQueryCount = canonicalized.length;
  const labsCovered = canonicalized.filter((row) =>
    ["hub", "spoke", "broken_spoke"].includes(row.status)
  ).length;
  const gapCountFinal = canonicalized.filter((row) => row.status === "gap").length;
  const labsCoverageRatePct =
    subQueryCount > 0 ? Math.round((labsCovered / subQueryCount) * 100) : 0;

  const clusterStats = computeClusterCoverage(canonicalized, { anchorSerpRank: anchorRank });

  const gapsList = buildGapsFromSubQueries({ ...handoff, sub_queries: canonicalized });
  const gapsRowTotal = canonicalized.filter((row) => row.status === "gap").length;

  const coverageSummary = {
    sub_query_count: subQueryCount,
    covered_count: coveredCount,
    hub_count: hubCount,
    spoke_count: spokeCount,
    broken_spoke_count: brokenSpokeCount,
    gap_count: gapCountFinal,
    labs_coverage_rate_pct: labsCoverageRatePct,
    coverage_rate_pct: clusterStats.cluster_coverage_rate_pct,
    cluster_count: clusterStats.cluster_count,
    cluster_covered_count: clusterStats.cluster_covered_count,
    cluster_gap_count: clusterStats.cluster_gap_count,
    cluster_coverage_rate_pct: clusterStats.cluster_coverage_rate_pct,
    benchmark_note: ">70% suggested for strong AI visibility breadth"
  };

  if (anchorRank != null) {
    coverageSummary.anchor_serp_rank = anchorRank;
  }

  coverageSummary.coverage_story = buildCoverageStory(
    coverageSummary,
    handoff.serp_context,
    seed
  );

  coverageSummary.gaps_shortlist_count = gapsList.length;
  coverageSummary.gaps_row_total = gapsRowTotal;

  return {
    ...handoff,
    sub_queries: canonicalized,
    coverage_summary: coverageSummary,
    gaps: gapsList,
    hub_spoke_map: buildHubSpokeMap(canonicalized, anchorUrl),
    limitations: encyclopedia
      ? [
          ...(handoff.limitations ?? []),
          "Encyclopedia profile: strengthen/link existing articles — not a net-new content plan."
        ].filter((value, index, arr) => arr.indexOf(value) === index)
      : handoff.limitations
  };
}

function main() {
  const opts = parseArgs(process.argv);
  if (!opts.handoff || !opts.ranked) {
    console.error(
      "Usage: node scripts/apply-coverage.mjs handoff.json ranked.json [-o out.json]"
    );
    process.exit(2);
  }

  const handoff = loadJson(opts.handoff);
  const ranked = loadJson(opts.ranked);
  const updated = applyCoverageToHandoff(handoff, ranked);
  const text = `${JSON.stringify(updated, null, 2)}\n`;

  if (opts.output) {
    writeFileSync(path.resolve(opts.output), text, "utf8");
    console.error(`Coverage applied: ${opts.output}`);
  } else {
    process.stdout.write(text);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
