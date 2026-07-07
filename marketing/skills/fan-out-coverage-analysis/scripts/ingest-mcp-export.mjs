#!/usr/bin/env node
/**
 * Flatten raw DataForSEO MCP JSON exports into merge / intent shapes.
 *
 * Usage:
 *   node scripts/ingest-mcp-export.mjs \
 *     --serp raw-serp.json \
 *     --labs related-raw.json:related \
 *     --labs suggestions-raw.json:suggestions \
 *     -o merged.json \
 *     --intent-out intents.json
 *
 * Labs --labs arg format: path or path:source (source = related | suggestions | ideas)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { mergeExpansionItems } from "./merge-expansion-input.mjs";

function parseArgs(argv) {
  const opts = {
    serp: null,
    labs: [],
    output: null,
    intentOut: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--serp") {
      opts.serp = argv[++i] ?? null;
    } else if (arg === "--labs") {
      opts.labs.push(argv[++i] ?? "");
    } else if (arg === "-o" || arg === "--output") {
      opts.output = argv[++i] ?? null;
    } else if (arg === "--intent-out") {
      opts.intentOut = argv[++i] ?? null;
    }
  }

  return opts;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function extractTaskItems(data) {
  if (Array.isArray(data?.tasks?.[0]?.result?.[0]?.items)) {
    return data.tasks[0].result[0].items;
  }
  if (Array.isArray(data?.result?.[0]?.items)) {
    return data.result[0].items;
  }
  if (Array.isArray(data?.items)) {
    return data.items;
  }
  return [];
}

function readQuestion(value) {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  return String(
    value.title ??
      value.question ??
      value.people_also_ask_element?.title ??
      value.text ??
      ""
  ).trim();
}

/**
 * @param {unknown} data — raw MCP SERP export or flat { people_also_ask, related_searches }
 */
export function extractSerpSeed(data) {
  if (data.people_also_ask || data.related_searches) {
    return {
      people_also_ask: (data.people_also_ask ?? []).map(readQuestion).filter(Boolean),
      related_searches: (data.related_searches ?? []).map(readQuestion).filter(Boolean)
    };
  }

  const peopleAlsoAsk = [];
  const relatedSearches = [];

  for (const block of extractTaskItems(data)) {
    if (block.type === "people_also_ask") {
      for (const item of block.items ?? []) {
        const question = readQuestion(item);
        if (question) {
          peopleAlsoAsk.push(question);
        }
      }
    }
    if (block.type === "related_searches") {
      for (const item of block.items ?? block.related_searches_items ?? []) {
        const related = readQuestion(item);
        if (related) {
          relatedSearches.push(related);
        }
      }
    }
  }

  return {
    people_also_ask: peopleAlsoAsk,
    related_searches: relatedSearches
  };
}

function keywordFromLabsRow(row) {
  return String(
    row.keyword ??
      row.keyword_data?.keyword ??
      row.keyword_data?.keyword_info?.keyword ??
      ""
  ).trim();
}

function volumeFromLabsRow(row) {
  const info = row.keyword_data?.keyword_info ?? row.keyword_info ?? row;
  return Number(
    row.search_volume ??
      info.search_volume ??
      info.monthly_searches ??
      0
  );
}

/**
 * @param {unknown} data — raw MCP Labs export or flat { items: [...] }
 * @param {string} source
 */
export function extractLabsItems(data, source) {
  const rows = extractTaskItems(data);
  const list = rows.length > 0 ? rows : Array.isArray(data) ? data : data.items ?? [];

  return list
    .map((row) => ({
      keyword: keywordFromLabsRow(row),
      search_volume: volumeFromLabsRow(row),
      source
    }))
    .filter((row) => row.keyword.length > 0);
}

/**
 * @param {unknown} data — raw MCP search_intent export
 * @returns {Record<string, string>}
 */
export function extractSearchIntents(data) {
  const intents = {};
  const rows = extractTaskItems(data);
  const list = rows.length > 0 ? rows : Array.isArray(data) ? data : data.items ?? [];

  for (const row of list) {
    const keyword = keywordFromLabsRow(row);
    const intent =
      row.keyword_intent?.label ??
      row.search_intent ??
      row.keyword_data?.keyword_info?.search_intent_info?.main_intent ??
      row.keyword_data?.search_intent_info?.main_intent ??
      null;
    if (keyword && intent) {
      intents[keyword.toLowerCase()] = String(intent).toLowerCase();
    }
  }

  return intents;
}

function parseLabsArg(arg) {
  const [filePath, source] = arg.split(":");
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
  const inferred = base.includes("suggest")
    ? "suggestions"
    : base.includes("idea")
      ? "ideas"
      : "related";
  return { filePath, source: source ?? inferred };
}

/**
 * @param {{ serpData?: unknown, labsFiles?: Array<{ data: unknown, source: string }>, intentData?: unknown }} input
 */
export function ingestMcpExports(input) {
  const serp = input.serpData ? extractSerpSeed(input.serpData) : null;
  const labsFiles = (input.labsFiles ?? []).map((file) => ({
    data: { items: extractLabsItems(file.data, file.source) },
    source: file.source
  }));
  const merged = mergeExpansionItems({ serp, labsFiles });
  const intents = input.intentData ? extractSearchIntents(input.intentData) : null;

  return { merged, intents, serp };
}

function main() {
  const opts = parseArgs(process.argv);

  if (!opts.serp && opts.labs.length === 0) {
    console.error(
      "Usage: node scripts/ingest-mcp-export.mjs --serp raw.json [--labs file.json:related] -o merged.json [--intent-out intents.json]"
    );
    process.exit(2);
  }

  const serpData = opts.serp ? loadJson(opts.serp) : null;
  const labsFiles = opts.labs.map((arg) => {
    const { filePath, source } = parseLabsArg(arg);
    return { data: loadJson(filePath), source };
  });

  const { merged, intents } = ingestMcpExports({ serpData, labsFiles });
  const mergedText = `${JSON.stringify(merged, null, 2)}\n`;

  if (opts.output) {
    writeFileSync(path.resolve(opts.output), mergedText, "utf8");
    console.error(`Wrote ${merged.items.length} merged items to ${opts.output}`);
  } else {
    process.stdout.write(mergedText);
  }

  if (opts.intentOut && intents) {
    writeFileSync(path.resolve(opts.intentOut), `${JSON.stringify(intents, null, 2)}\n`, "utf8");
    console.error(`Wrote ${Object.keys(intents).length} intents to ${opts.intentOut}`);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
