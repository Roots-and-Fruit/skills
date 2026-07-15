#!/usr/bin/env node
/**
 * Dedupe, relevance-filter, and classify fan-out sub-queries from merged API results.
 *
 * Usage:
 *   node normalize-fanout.mjs --seed "enterprise SSO" < raw.json
 *   node normalize-fanout.mjs --seed "wordpress plugin marketing" --lane primary_topic --file merged.json
 *
 * Input JSON shape:
 *   { "items": [ { "keyword": "...", "search_volume": 390, "source": "related" }, ... ] }
 *
 * Output: JSON array of normalized sub-queries (top 30 by priority score).
 */
import fs from "node:fs";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { assignClusters } from "./intent-clusters.mjs";
import {
  hasCommercialModifierDrift,
  isHealthAdjacentPaa,
  isHomographBrandLeak
} from "./fanout-modifiers.mjs";

const STOPWORDS = new Set([
  "a", "an", "the", "for", "to", "on", "in", "with", "and", "or", "of", "is", "at", "by"
]);

const FACET_TOKENS = new Set([
  "email", "newsletter", "affiliate", "crm", "seo", "analytics", "sms", "referral",
  "mailchimp", "hubspot", "woocommerce", "checkout", "popup", "chatbot", "automation"
]);

const PLATFORM_META_PAA =
  /\b(outdated|replacing|moving away|leaving|what is replacing|still relevant|is .+ dead)\b/i;

const SERP_SOURCES = new Set(["serp_paa", "serp_related", "related_searches"]);

/** Expand acronyms before token overlap (GTM ↔ go-to-market). */
const ACRONYM_EXPANSIONS = [
  [/\bgtms\b/gi, "go to market"],
  [/\bgtm\b/gi, "go to market"]
];

function expandAcronyms(text) {
  let out = text;
  for (const [pattern, replacement] of ACRONYM_EXPANSIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function salientTokens(text) {
  return expandAcronyms(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function parseArgs(argv) {
  let seed = "";
  let file = null;
  let lane = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--seed") {
      seed = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (argv[i] === "--file") {
      file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (argv[i] === "--lane") {
      lane = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return { seed, file, lane };
}

function normalizeKeyword(keyword) {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlatformMetaPaa(keyword) {
  return PLATFORM_META_PAA.test(keyword);
}

function isFacetDrift(keyword, seedTokens, options = {}) {
  const kwTokens = salientTokens(keyword);
  const seedSet = new Set(seedTokens);
  const extraFacets = kwTokens.filter((t) => FACET_TOKENS.has(t) && !seedSet.has(t));
  if (extraFacets.length > 0) {
    return true;
  }
  if (options.intentSplit === "mixed" && hasCommercialModifierDrift(keyword, seedTokens)) {
    const rowLane = options.rowIntentLane ?? null;
    if (rowLane === "tool_discovery" || !options.chosenLane) {
      return true;
    }
    if (options.chosenLane === "primary_topic" && rowLane === "tool_discovery") {
      return true;
    }
  }
  return false;
}

function tokenOverlapCount(keyword, seedTokens) {
  const kwSet = new Set(salientTokens(keyword));
  return seedTokens.filter((t) => kwSet.has(t)).length;
}

/** REFERENCE unified gate — zero overlap always rejects (incl. serp_related brands). */
export function passesRelevanceGate(keyword, seedTokens, source, options = {}) {
  const chosenLane = options.chosenLane ?? null;

  if (source === "serp_paa") {
    if (isPlatformMetaPaa(keyword)) {
      return false;
    }
    if (chosenLane === "primary_topic" && isHealthAdjacentPaa(keyword, seedTokens)) {
      return false;
    }
    return true;
  }

  const overlap = tokenOverlapCount(keyword, seedTokens);
  if (overlap === 0) {
    return false;
  }

  if (SERP_SOURCES.has(source) && isHomographBrandLeak(keyword, seedTokens)) {
    return false;
  }

  if (SERP_SOURCES.has(source)) {
    if (seedTokens.length <= 2) {
      return overlap >= 1;
    }
    return overlap >= 2;
  }

  if (seedTokens.length >= 3 && overlap < 2) {
    return false;
  }
  return true;
}

function buildSerpSeeds(items, seedTokens, chosenLane = null) {
  const seeds = new Set();
  for (const item of items) {
    const source = item.source ?? "unknown";
    if (!SERP_SOURCES.has(source)) {
      continue;
    }
    if (passesRelevanceGate(item.keyword, seedTokens, source, { chosenLane })) {
      seeds.add(normalizeKeyword(item.keyword));
    }
  }
  return seeds;
}

function classifyDimension(keyword, seedTokens, facetOptions = {}) {
  const lower = keyword.toLowerCase();
  const overlap = tokenOverlapCount(keyword, seedTokens);

  if (isFacetDrift(keyword, seedTokens, facetOptions)) {
    return "facet_drift";
  }
  if (/^(how|what|why|can|does|do|is|are)\b/.test(lower)) {
    return "question";
  }
  if (lower.split(/\s+/).length >= 5) {
    return "long_tail";
  }
  if (overlap >= Math.max(1, seedTokens.length - 1)) {
    return "core_variant";
  }
  if (overlap === 0) {
    return "adjacent_topic";
  }
  return "detail_drill";
}

function relevanceTier(
  keyword,
  seedTokens,
  serpSeeds,
  source,
  dimension,
  intentLane,
  chosenLane,
  facetOptions = {}
) {
  if (source === "serp_paa" && isPlatformMetaPaa(keyword)) {
    return "adjacent";
  }

  const onSerp =
    serpSeeds.has(normalizeKeyword(keyword)) ||
    source === "serp_paa" ||
    source === "serp_related" ||
    source === "related_searches";
  const drift = dimension === "facet_drift" || isFacetDrift(keyword, seedTokens, facetOptions);

  if (onSerp) {
    if (drift) {
      if (chosenLane && intentLane === chosenLane) {
        return "serp_native";
      }
      return "facet_drift";
    }
    return "serp_native";
  }

  if (drift) {
    return "facet_drift";
  }
  if (dimension === "adjacent_topic") {
    return "adjacent";
  }
  if (tokenOverlapCount(keyword, seedTokens) === 0) {
    return "adjacent";
  }
  return "core";
}

function priorityScore(entry, seedTokens, chosenLane) {
  const tierWeight = {
    serp_native: 1000,
    core: 500,
    facet_drift: 200,
    adjacent: 50
  };
  let score = tierWeight[entry.relevance_tier] ?? 0;
  score += Math.min(entry.search_volume ?? 0, 500);
  if (chosenLane && entry.intent_lane === chosenLane) {
    score += 300;
  }
  if (entry.dimension === "question") {
    score += 80;
  }
  return score;
}

export function isSeedTokenPermutation(keyword, seedOrTokens) {
  const seedTokens = Array.isArray(seedOrTokens)
    ? seedOrTokens
    : permutationTokens(seedOrTokens);
  const kwTokens = permutationTokens(keyword);
  if (seedTokens.length === 0 || kwTokens.length !== seedTokens.length) {
    return false;
  }
  return kwTokens.slice().sort().join(" ") === seedTokens.slice().sort().join(" ");
}

/** Token bag for permutation checks — keeps numeric tokens (e.g. type 1 vs type 2). */
export function permutationTokens(text) {
  return expandAcronyms(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => {
      if (!t || STOPWORDS.has(t)) {
        return false;
      }
      if (/^\d+$/.test(t)) {
        return true;
      }
      return t.length > 1;
    });
}

/** Keep one Labs suggestion reordering of the seed token set (not fan-out). */
function collapseSuggestionPermutations(rows, seedTokens) {
  let bestPermutation = null;
  const rest = [];

  for (const row of rows) {
    const sources = row.sources ?? [];
    const suggestionOnly =
      sources.length > 0 && sources.every((s) => s === "suggestions");
    if (
      suggestionOnly &&
      !row.on_seed_serp &&
      row.dimension === "core_variant" &&
      isSeedTokenPermutation(row.keyword, seedTokens)
    ) {
      if (!bestPermutation || row.priority_score > bestPermutation.priority_score) {
        bestPermutation = row;
      }
      continue;
    }
    rest.push(row);
  }

  if (bestPermutation) {
    rest.push(bestPermutation);
  }
  return rest;
}

function inferIntentLane(keyword, dimension) {
  if (dimension === "facet_drift") {
    return "tool_discovery";
  }
  if (/\b(best|top|free|plugin|tool|software)\b/i.test(keyword) && dimension !== "question") {
    return "tool_discovery";
  }
  if (/^(how|what|why|can)\b/i.test(keyword)) {
    return "primary_topic";
  }
  return null;
}

async function readInput(file) {
  const raw = file ? fs.readFileSync(file, "utf8") : await readStdin();
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (Array.isArray(parsed.items)) {
    return parsed.items;
  }
  throw new Error("Expected JSON array or { items: [] }");
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

export async function normalizeFanoutItems(items, seed, lane = null, intentSplit = "single") {
  const seedTokens = salientTokens(seed);
  const facetOptions = { chosenLane: lane, intentSplit };
  const serpSeeds = buildSerpSeeds(items, seedTokens, lane);
  const gateOptions = { chosenLane: lane };
  const byKeyword = new Map();

  for (const item of items) {
    const keyword = String(item.keyword ?? "").trim();
    if (!keyword) {
      continue;
    }
    const source = item.source ?? "unknown";
    if (!passesRelevanceGate(keyword, seedTokens, source, gateOptions)) {
      continue;
    }

    const normalized = normalizeKeyword(keyword);
    const existing = byKeyword.get(normalized);
    const volume = Number(item.search_volume ?? 0);
    const sources = new Set(existing?.sources ?? []);
    sources.add(source);

    const coreKeyword = item.core_keyword ?? existing?.core_keyword ?? null;

    if (!existing || volume > existing.search_volume) {
      byKeyword.set(normalized, {
        keyword,
        search_volume: volume,
        sources: [...sources],
        core_keyword: coreKeyword
      });
    } else if (coreKeyword && !existing.core_keyword) {
      existing.core_keyword = coreKeyword;
    }
  }

  const mapped = [...byKeyword.values()]
    .map((entry) => {
      const primarySource = entry.sources.find((s) => SERP_SOURCES.has(s)) ?? entry.sources[0];
      const intent_lane = inferIntentLane(entry.keyword, "detail_drill");
      const dimensionOpts = { ...facetOptions, rowIntentLane: intent_lane };
      const dimension = classifyDimension(entry.keyword, seedTokens, dimensionOpts);
      const tier = relevanceTier(
        entry.keyword,
        seedTokens,
        serpSeeds,
        primarySource,
        dimension,
        intent_lane,
        lane,
        dimensionOpts
      );
      const row = {
        keyword: entry.keyword,
        search_volume: entry.search_volume,
        dimension,
        relevance_tier: tier,
        intent_lane,
        on_seed_serp: serpSeeds.has(normalizeKeyword(entry.keyword)),
        sources: entry.sources,
        core_keyword: entry.core_keyword ?? null
      };
      row.priority_score = priorityScore(row, seedTokens, lane);
      return row;
    });

  const collapsed = collapseSuggestionPermutations(mapped, seedTokens)
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 30);

  return assignClusters(collapsed, seed);
}

async function main() {
  const { seed, file, lane } = parseArgs(process.argv);
  if (!seed) {
    console.error(
      "Usage: node normalize-fanout.mjs --seed \"primary keyword\" [--lane primary_topic] [--file input.json]"
    );
    process.exit(1);
  }

  const items = await readInput(file);
  const normalized = await normalizeFanoutItems(items, seed, lane);
  process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
