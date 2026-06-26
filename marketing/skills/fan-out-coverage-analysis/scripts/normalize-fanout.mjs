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

function salientTokens(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function normalizeKeyword(keyword) {
  return keyword.trim().toLowerCase().replace(/\s+/g, " ");
}

function isPlatformMetaPaa(keyword) {
  return PLATFORM_META_PAA.test(keyword);
}

function isFacetDrift(keyword, seedTokens) {
  const kwTokens = salientTokens(keyword);
  const seedSet = new Set(seedTokens);
  const extraFacets = kwTokens.filter((t) => FACET_TOKENS.has(t) && !seedSet.has(t));
  return extraFacets.length > 0;
}

function tokenOverlapCount(keyword, seedTokens) {
  const kwSet = new Set(salientTokens(keyword));
  return seedTokens.filter((t) => kwSet.has(t)).length;
}

function passesRelevanceGate(keyword, seedTokens, serpSeeds, source) {
  if (source === "serp_paa" && isPlatformMetaPaa(keyword)) {
    return false;
  }
  const normalized = normalizeKeyword(keyword);
  if (serpSeeds.has(normalized)) {
    return true;
  }
  if (SERP_SOURCES.has(source)) {
    return true;
  }
  const overlap = tokenOverlapCount(keyword, seedTokens);
  if (overlap === 0) {
    return false;
  }
  if (seedTokens.length >= 3 && overlap < 2) {
    return false;
  }
  return true;
}

function classifyDimension(keyword, seedTokens) {
  const lower = keyword.toLowerCase();
  const overlap = tokenOverlapCount(keyword, seedTokens);

  if (isFacetDrift(keyword, seedTokens)) {
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

function relevanceTier(keyword, seedTokens, serpSeeds, source, dimension, intentLane, chosenLane) {
  if (source === "serp_paa" && isPlatformMetaPaa(keyword)) {
    return "adjacent";
  }

  const onSerp =
    serpSeeds.has(normalizeKeyword(keyword)) ||
    source === "serp_paa" ||
    source === "serp_related" ||
    source === "related_searches";
  const drift = dimension === "facet_drift" || isFacetDrift(keyword, seedTokens);

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

async function main() {
  const { seed, file, lane } = parseArgs(process.argv);
  if (!seed) {
    console.error(
      "Usage: node normalize-fanout.mjs --seed \"primary keyword\" [--lane primary_topic] [--file input.json]"
    );
    process.exit(1);
  }

  const items = await readInput(file);
  const seedTokens = salientTokens(seed);
  const serpSeeds = new Set(
    items
      .filter(
        (item) =>
          SERP_SOURCES.has(item.source) && !(item.source === "serp_paa" && isPlatformMetaPaa(item.keyword))
      )
      .map((item) => normalizeKeyword(item.keyword))
  );

  const byKeyword = new Map();

  for (const item of items) {
    const keyword = String(item.keyword ?? "").trim();
    if (!keyword) {
      continue;
    }
    const source = item.source ?? "unknown";
    if (!passesRelevanceGate(keyword, seedTokens, serpSeeds, source)) {
      continue;
    }

    const normalized = normalizeKeyword(keyword);
    const existing = byKeyword.get(normalized);
    const volume = Number(item.search_volume ?? 0);
    const sources = new Set(existing?.sources ?? []);
    sources.add(source);

    if (!existing || volume > existing.search_volume) {
      byKeyword.set(normalized, {
        keyword,
        search_volume: volume,
        sources: [...sources]
      });
    }
  }

  const normalized = [...byKeyword.values()]
    .map((entry) => {
      const primarySource = entry.sources.find((s) => SERP_SOURCES.has(s)) ?? entry.sources[0];
      const dimension = classifyDimension(entry.keyword, seedTokens);
      const intent_lane = inferIntentLane(entry.keyword, dimension);
      const tier = relevanceTier(
        entry.keyword,
        seedTokens,
        serpSeeds,
        primarySource,
        dimension,
        intent_lane,
        lane
      );
      const row = {
        keyword: entry.keyword,
        search_volume: entry.search_volume,
        dimension,
        relevance_tier: tier,
        intent_lane,
        on_seed_serp: serpSeeds.has(normalizeKeyword(entry.keyword)),
        sources: entry.sources
      };
      row.priority_score = priorityScore(row, seedTokens, lane);
      return row;
    })
    .sort((a, b) => b.priority_score - a.priority_score)
    .slice(0, 30);

  process.stdout.write(`${JSON.stringify(normalized, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
