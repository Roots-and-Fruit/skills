#!/usr/bin/env node
/**
 * Apply REFERENCE priority rules to normalized fan-out rows.
 *
 * Usage:
 *   node apply-priority.mjs --intent-split mixed --lane primary_topic < normalized.json
 *   node apply-priority.mjs --file normalized.json --intent-file intents.json --intent-split mixed --lane primary_topic
 *
 * Input: JSON array of normalize-fanout rows (with search_intent added per row, or via --intent-file)
 * Intent file shape: { "intents": { "keyword lower": "informational" } }
 *
 * Output: { "sub_queries": [...], "priority_sub_queries": [...] }
 */
import fs from "node:fs";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { salientTokens } from "./normalize-fanout.mjs";
import {
  isCompetitorShapedExtras,
  isOffTopicDemotablePaa,
  isMarketplaceListicleKeyword,
  isModifierNoiseExtras
} from "./fanout-modifiers.mjs";
import { TIER_RANK, isSuggestionOnlyPermutation, rowSources } from "./fanout-shared.mjs";

function parseArgs(argv) {
  let file = null;
  let intentFile = null;
  let intentSplit = "single";
  let lane = null;
  let seed = "";

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--intent-file") {
      intentFile = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--intent-split") {
      intentSplit = argv[i + 1] ?? "single";
      i += 1;
      continue;
    }
    if (arg === "--lane") {
      lane = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--seed") {
      seed = argv[i + 1] ?? "";
      i += 1;
    }
  }

  return { file, intentFile, intentSplit, lane, seed };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function readInput(file) {
  const raw = file ? fs.readFileSync(file, "utf8") : await readStdin();
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.sub_queries)) {
    return parsed.sub_queries;
  }
  throw new Error("Expected JSON array or { sub_queries: [] }");
}

function loadIntents(intentFile) {
  if (!intentFile) {
    return {};
  }
  const data = JSON.parse(fs.readFileSync(intentFile, "utf8"));
  if (data.intents && typeof data.intents === "object") {
    return data.intents;
  }
  if (Array.isArray(data.items)) {
    return Object.fromEntries(
      data.items.map((row) => [String(row.keyword).toLowerCase(), row.search_intent ?? row.main_intent])
    );
  }
  return {};
}

function laneMatches(row, chosenLane) {
  return Boolean(chosenLane && row.intent_lane === chosenLane);
}

/** Labs suggestion reorderings of the seed — not fan-out; cap priority in single-intent mode. */
function rowExtras(row, seed) {
  const seedTokenSet = new Set(salientTokens(seed));
  return salientTokens(row.keyword).filter((token) => !seedTokenSet.has(token));
}

function assignPriorityMixed(row, chosenLane, seed = "") {
  const volume = Number(row.search_volume ?? 0);
  const tier = row.relevance_tier;
  const onSerp = Boolean(row.on_seed_serp);
  const isQuestion = row.dimension === "question" || rowSources(row).includes("serp_paa");

  if (isQuestion && isOffTopicDemotablePaa(row.keyword, { chosenLane, seedTokens: salientTokens(seed) })) {
    return "medium";
  }

  if (tier === "adjacent") {
    return "low";
  }

  if (tier === "facet_drift") {
    return volume >= 50 ? "medium" : "low";
  }

  if (tier === "serp_native") {
    if (laneMatches(row, chosenLane) || isQuestion) {
      return "high";
    }
    return onSerp ? "medium" : "low";
  }

  if (tier === "core") {
    const extras = rowExtras(row, seed);
    if (
      chosenLane === "tool_discovery" &&
      extras.includes("theme") &&
      !extras.includes("plugin")
    ) {
      return "medium";
    }
    if (laneMatches(row, chosenLane)) {
      return "high";
    }
    return "medium";
  }

  return "low";
}

function assignPrioritySingle(row) {
  const volume = Number(row.search_volume ?? 0);
  const tier = row.relevance_tier;

  if (isSuggestionOnlyPermutation(row)) {
    return "medium";
  }

  if (tier === "serp_native" || volume >= 50) {
    return "high";
  }
  if (tier === "core" || volume >= 10 || row.dimension === "question") {
    return "medium";
  }
  return "low";
}

function assignPriority(row, intentSplit, chosenLane, seed = "") {
  if (intentSplit === "mixed") {
    return assignPriorityMixed(row, chosenLane, seed);
  }
  return assignPrioritySingle(row);
}

function noPaaPriorityRank(row, seed, lane) {
  if (row.relevance_tier === "serp_native") {
    return 4;
  }
  const extras = rowExtras(row, seed);
  if (isCompetitorShapedExtras(extras)) {
    return 3;
  }
  if (isModifierNoiseExtras(extras, lane)) {
    return 0;
  }
  return 2;
}

function isCanonicalRow(row) {
  return row.is_canonical !== false && row.cluster_role !== "alias";
}

function demotablePaaSort(a, b, chosenLane, seed) {
  const ctx = { chosenLane, seedTokens: salientTokens(seed) };
  const demoteDiff =
    Number(!isOffTopicDemotablePaa(a.keyword, ctx)) -
    Number(!isOffTopicDemotablePaa(b.keyword, ctx));
  if (demoteDiff !== 0) {
    return demoteDiff;
  }
  return 0;
}

function isUserOwnedDomain(domain, userDomain = "example.com") {
  const d = String(domain).toLowerCase().replace(/^www\./, "");
  const user = String(userDomain).toLowerCase().replace(/^www\./, "");
  return d === user || d.endsWith(`.${user}`);
}

function marketplaceBoostRank(row, serpContext, intentLane) {
  if (intentLane !== "tool_discovery") {
    return 0;
  }
  const domains = serpContext?.top_organic_domains ?? [];
  const userDomain = serpContext?.user_domain ?? "example.com";
  const hasCompetitorDomains =
    domains.length > 0 && domains.some((d) => !isUserOwnedDomain(d, userDomain));
  if (!hasCompetitorDomains) {
    return 0;
  }
  if (isMarketplaceListicleKeyword(row.keyword)) {
    return 2;
  }
  return 0;
}

export function buildPrioritySubQueries(rows, options = {}) {
  const maxTotal = options.maxTotal ?? 12;
  const seed = options.seed ?? "";
  const intentLane = options.intentLane ?? null;
  const serpContext = options.serpContext ?? {};

  const tierOrder = (a, b) => {
    const tierDiff = (TIER_RANK[b.relevance_tier] ?? 0) - (TIER_RANK[a.relevance_tier] ?? 0);
    if (tierDiff !== 0) {
      return tierDiff;
    }
    const priorityRank = { high: 3, medium: 2, low: 1 };
    const pr = (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
    if (pr !== 0) {
      return pr;
    }
    return Number(b.search_volume ?? 0) - Number(a.search_volume ?? 0);
  };

  const canonicalRows = rows.filter(isCanonicalRow);

  const paaReserved = canonicalRows
    .filter(
      (row) =>
        rowSources(row).includes("serp_paa") &&
        row.relevance_tier !== "adjacent" &&
        row.priority !== "low"
    )
    .sort((a, b) => {
      const demote = demotablePaaSort(a, b, intentLane, seed);
      if (demote !== 0) {
        return demote;
      }
      return tierOrder(a, b);
    });

  const paaCtx = { chosenLane: intentLane, seedTokens: salientTokens(seed) };
  const paaCommercial = paaReserved.filter((row) => !isOffTopicDemotablePaa(row.keyword, paaCtx));
  const paaDemoted = paaReserved.filter((row) => isOffTopicDemotablePaa(row.keyword, paaCtx));
  const paaKeys = new Set(paaReserved.map((row) => row.keyword.toLowerCase()));

  const eligible = canonicalRows.filter(
    (row) =>
      row.relevance_tier !== "adjacent" &&
      row.priority !== "low" &&
      !paaKeys.has(row.keyword.toLowerCase())
  );

  const noPaaSort = (a, b) => {
    const marketDiff =
      marketplaceBoostRank(b, serpContext, intentLane) -
      marketplaceBoostRank(a, serpContext, intentLane);
    if (marketDiff !== 0) {
      return marketDiff;
    }
    const rankDiff = noPaaPriorityRank(b, seed, intentLane) - noPaaPriorityRank(a, seed, intentLane);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return tierOrder(a, b);
  };

  const toolDiscoveryWithPaa =
    paaReserved.length > 0 && (intentLane === "tool_discovery" || paaCommercial.length > 0);
  const highSort = paaReserved.length === 0 && seed ? noPaaSort : tierOrder;
  const highs = eligible.filter((row) => row.priority === "high").sort(highSort);

  let paaCommercialCapped = paaCommercial;
  if (toolDiscoveryWithPaa && intentLane === "tool_discovery" && highs.length > 0) {
    paaCommercialCapped = paaCommercial.slice(0, 2);
  }

  const mediums = eligible.filter((row) => row.priority === "medium").sort(tierOrder);
  const boostedMarketplace = eligible
    .filter((row) => marketplaceBoostRank(row, serpContext, intentLane) > 0)
    .sort(noPaaSort);
  const boostedKeys = new Set(boostedMarketplace.map((row) => row.keyword.toLowerCase()));
  const highsFiltered = highs.filter((row) => !boostedKeys.has(row.keyword.toLowerCase()));
  const mediumsFiltered = mediums.filter((row) => !boostedKeys.has(row.keyword.toLowerCase()));
  const marketplaceFirst =
    intentLane === "tool_discovery" && boostedMarketplace.length > 0;
  const combined = (
    marketplaceFirst
      ? [
          ...boostedMarketplace,
          ...paaCommercialCapped,
          ...highsFiltered,
          ...mediumsFiltered,
          ...paaDemoted
        ]
      : [...paaCommercialCapped, ...highs, ...mediums, ...paaDemoted]
  ).slice(0, maxTotal);

  return combined.map((row) => ({
    keyword: row.keyword,
    search_volume: row.search_volume ?? null,
    relevance_tier: row.relevance_tier,
    priority: row.priority,
    rationale: row.priority_rationale ?? defaultRationale(row)
  }));
}

function defaultRationale(row) {
  if (row.sources?.includes("serp_paa")) {
    return "PAA on seed SERP";
  }
  if (row.on_seed_serp) {
    return "Related search on seed SERP";
  }
  if (row.relevance_tier === "core") {
    return "Labs expansion aligned with seed";
  }
  return `${row.relevance_tier} tier`;
}

function toHandoffRow(row, intents) {
  const key = row.keyword.toLowerCase();
  const searchIntent = row.search_intent ?? intents[key] ?? null;
  const handoffRow = {
    keyword: row.keyword,
    search_volume: row.search_volume ?? null,
    dimension: row.dimension,
    search_intent: searchIntent,
    relevance_tier: row.relevance_tier,
    intent_lane: row.intent_lane ?? null,
    on_seed_serp: row.on_seed_serp,
    priority: row.priority,
    source: row.sources ?? row.source ?? ["unknown"]
  };

  if (row.intent_cluster_id) {
    handoffRow.intent_cluster_id = row.intent_cluster_id;
    handoffRow.is_canonical = row.is_canonical;
    handoffRow.cluster_role = row.cluster_role;
  }

  return handoffRow;
}

export { assignPriority };

export function applyPriorityPipeline(rows, options = {}) {
  const {
    intentSplit = "single",
    lane = null,
    seed = "",
    intents = {},
    serpContext = {}
  } = options;

  const enriched = rows.map((row) => ({
    ...row,
    priority: assignPriority(row, intentSplit, lane, seed)
  }));

  const sub_queries = enriched.map((row) => toHandoffRow(row, intents));
  const priority_sub_queries = buildPrioritySubQueries(enriched, {
    seed,
    intentLane: lane,
    serpContext
  });

  return { sub_queries, priority_sub_queries };
}

async function main() {
  const { file, intentFile, intentSplit, lane, seed: seedArg } = parseArgs(process.argv);
  const intents = loadIntents(intentFile);
  const rows = await readInput(file);
  const seed =
    seedArg ||
    rows.find((row) => row.core_keyword)?.core_keyword ||
    rows[0]?.seed ||
    "";

  const result = applyPriorityPipeline(rows, {
    intentSplit,
    lane,
    seed,
    intents
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
