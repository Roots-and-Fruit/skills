#!/usr/bin/env node
/**
 * Fold SERP seed + Labs exports into normalize input shape.
 *
 * Usage:
 *   node scripts/merge-expansion-input.mjs --serp serp.json --labs related.json --labs suggestions.json -o merged.json
 *
 * serp.json:
 *   { "people_also_ask": ["..."], "related_searches": ["..."] }
 *
 * labs.json:
 *   { "items": [ { "keyword": "...", "search_volume": 0, "source": "related" } ] }
 *   or a bare array of items (source defaults to file stem or --labs-source)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const opts = {
    serp: null,
    labs: [],
    labsSource: null,
    output: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--serp") {
      opts.serp = argv[++i] ?? null;
    } else if (arg === "--labs") {
      opts.labs.push(argv[++i] ?? "");
    } else if (arg === "--labs-source") {
      opts.labsSource = argv[++i] ?? null;
    } else if (arg === "-o" || arg === "--output") {
      opts.output = argv[++i] ?? null;
    }
  }

  return opts;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function defaultSourceFromPath(filePath, fallback) {
  if (fallback) {
    return fallback;
  }
  const base = path.basename(filePath, path.extname(filePath)).toLowerCase();
  if (base.includes("suggest")) {
    return "suggestions";
  }
  if (base.includes("idea")) {
    return "ideas";
  }
  if (base.includes("related")) {
    return "related";
  }
  return "related";
}

/**
 * @param {object} serpData
 * @returns {Array<{ keyword: string, search_volume: number, source: string }>}
 */
export function itemsFromSerp(serpData) {
  const items = [];
  for (const question of serpData.people_also_ask ?? []) {
    if (question) {
      items.push({ keyword: String(question), search_volume: 0, source: "serp_paa" });
    }
  }
  for (const related of serpData.related_searches ?? []) {
    if (related) {
      items.push({ keyword: String(related), search_volume: 0, source: "serp_related" });
    }
  }
  return items;
}

/**
 * @param {unknown} data
 * @param {string} defaultSource
 */
export function itemsFromLabs(data, defaultSource) {
  const rows = Array.isArray(data) ? data : data.items ?? [];
  return rows
    .map((row) => ({
      keyword: String(row.keyword ?? "").trim(),
      search_volume: Number(row.search_volume ?? row.volume ?? 0),
      source: row.source ?? defaultSource
    }))
    .filter((row) => row.keyword.length > 0);
}

/**
 * @param {{ serp?: object, labsFiles?: Array<{ path: string, source?: string }> }} input
 */
export function mergeExpansionItems(input) {
  const items = [];

  if (input.serp) {
    items.push(...itemsFromSerp(input.serp));
  }

  for (const file of input.labsFiles ?? []) {
    const data = typeof file.data === "object" ? file.data : loadJson(file.path);
    const source = file.source ?? defaultSourceFromPath(file.path ?? "", null);
    items.push(...itemsFromLabs(data, source));
  }

  return { items };
}

function main() {
  const opts = parseArgs(process.argv);
  const labsFiles = opts.labs.map((filePath) => ({
    path: filePath,
    source: opts.labsSource ?? defaultSourceFromPath(filePath, null)
  }));

  const serp = opts.serp ? loadJson(opts.serp) : null;
  const merged = mergeExpansionItems({ serp, labsFiles });
  const text = `${JSON.stringify(merged, null, 2)}\n`;

  if (opts.output) {
    writeFileSync(path.resolve(opts.output), text, "utf8");
    console.error(`Wrote ${merged.items.length} items to ${opts.output}`);
  } else {
    process.stdout.write(text);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
