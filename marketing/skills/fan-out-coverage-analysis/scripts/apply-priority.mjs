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

const TIER_RANK = { serp_native: 4, core: 3, facet_drift: 2, adjacent: 1 };

function parseArgs(argv) {
  let file = null;
  let intentFile = null;
  let intentSplit = "single";
  let lane = null;

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
    }
  }

  return { file, intentFile, intentSplit, lane };
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

function assignPriorityMixed(row, chosenLane) {
  const volume = Number(row.search_volume ?? 0);
  const tier = row.relevance_tier;
  const onSerp = Boolean(row.on_seed_serp);
  const isQuestion = row.dimension === "question" || row.sources?.includes("serp_paa");

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

  if (tier === "serp_native" || volume >= 50) {
    return "high";
  }
  if (tier === "core" || volume >= 10 || row.dimension === "question") {
    return "medium";
  }
  return "low";
}

function assignPriority(row, intentSplit, chosenLane) {
  if (intentSplit === "mixed") {
    return assignPriorityMixed(row, chosenLane);
  }
  return assignPrioritySingle(row);
}

function buildPrioritySubQueries(rows, maxTotal = 12) {
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

  const eligible = rows.filter(
    (row) => row.relevance_tier !== "adjacent" && row.priority !== "low"
  );
  const highs = eligible.filter((row) => row.priority === "high").sort(tierOrder);
  const mediums = eligible.filter((row) => row.priority === "medium").sort(tierOrder);
  const combined = [...highs, ...mediums].slice(0, maxTotal);

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
  return {
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
}

async function main() {
  const { file, intentFile, intentSplit, lane } = parseArgs(process.argv);
  const intents = loadIntents(intentFile);
  const rows = await readInput(file);

  const enriched = rows.map((row) => {
    const priority = assignPriority(row, intentSplit, lane);
    return { ...row, priority };
  });

  const sub_queries = enriched.map((row) => toHandoffRow(row, intents));
  const priority_sub_queries = buildPrioritySubQueries(enriched);

  process.stdout.write(`${JSON.stringify({ sub_queries, priority_sub_queries }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
