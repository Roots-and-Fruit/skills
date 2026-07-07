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

function normalizeKeyword(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

const PRIORITY_RANK = { high: 2, medium: 1, low: 0 };

export function buildGapsFromSubQueries(subQueries) {
  return subQueries
    .filter((row) => row.status === "gap")
    .filter((row) => row.priority === "high" || row.priority === "medium")
    .filter((row) => row.relevance_tier !== "facet_drift" || row.priority === "high")
    .sort(
      (a, b) =>
        (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0) ||
        (b.search_volume ?? 0) - (a.search_volume ?? 0)
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
  const anchorRank = serpContext?.anchor_serp_rank ?? summary?.anchor_serp_rank;
  const labsPct = summary?.labs_coverage_rate_pct ?? summary?.coverage_rate_pct ?? 0;

  if (anchorRank != null && labsPct < 70) {
    return `Anchor ranks #${anchorRank} live for "${seed}"; Labs index not yet updated for fan-out terms.`;
  }
  if (labsPct >= 70) {
    return "Strong breadth — most fan-out terms have indexed rankings.";
  }
  if (labsPct > 0) {
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
      next.status = "hub_serp_only";
      next.covering_url = anchorUrl;
      next.rank_group = anchorRank;
      return next;
    }

    if (anchorRank != null && anchorUrl && isBrandedSeedRelated(row, seed)) {
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

  const subQueryCount = subQueries.length;
  const labsCovered = subQueries.filter((row) =>
    ["hub", "spoke", "broken_spoke"].includes(row.status)
  ).length;
  const gapCountFinal = subQueries.filter((row) => row.status === "gap").length;
  const labsCoverageRatePct =
    subQueryCount > 0 ? Math.round((labsCovered / subQueryCount) * 100) : 0;

  const coverageSummary = {
    sub_query_count: subQueryCount,
    covered_count: coveredCount,
    hub_count: hubCount,
    spoke_count: spokeCount,
    broken_spoke_count: brokenSpokeCount,
    gap_count: gapCountFinal,
    labs_coverage_rate_pct: labsCoverageRatePct,
    coverage_rate_pct: labsCoverageRatePct,
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

  return {
    ...handoff,
    sub_queries: subQueries,
    coverage_summary: coverageSummary,
    gaps: buildGapsFromSubQueries(subQueries),
    hub_spoke_map: buildHubSpokeMap(subQueries, anchorUrl)
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
