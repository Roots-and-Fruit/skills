#!/usr/bin/env node
/**
 * Regression checks for ingest-mcp-export.mjs (I1–I6).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractSerpSeed,
  extractLabsItems,
  extractSearchIntents,
  ingestMcpExports
} from "./ingest-mcp-export.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const checks = [];

checks.push({
  id: "I1",
  pass: () => {
    const serp = extractSerpSeed(loadJson("mcp-serp-raw.fixture.json"));
    return serp.people_also_ask.length === 2 && serp.related_searches.length === 2;
  },
  detail: "raw MCP SERP flattens PAA + related"
});

checks.push({
  id: "I2",
  pass: () => {
    const items = extractLabsItems(loadJson("mcp-labs-related-raw.fixture.json"), "related");
    return items.length === 2 && items[0].keyword === "what is a go to market strategy";
  },
  detail: "raw MCP Labs flattens keyword_data.keyword + volume"
});

checks.push({
  id: "I3",
  pass: () => {
    const intents = extractSearchIntents(loadJson("mcp-intent-raw.fixture.json"));
    return intents["how to market a wordpress plugin"] === "informational";
  },
  detail: "raw MCP search_intent maps keyword → intent"
});

checks.push({
  id: "I4",
  pass: () => {
    const { merged } = ingestMcpExports({
      serpData: loadJson("mcp-serp-raw.fixture.json"),
      labsFiles: [{ data: loadJson("mcp-labs-related-raw.fixture.json"), source: "related" }]
    });
    return merged.items.length === 6;
  },
  detail: "ingest merges SERP + Labs into items[]"
});

checks.push({
  id: "I5",
  pass: () => {
    const { merged } = ingestMcpExports({
      serpData: loadJson("mcp-serp-raw.fixture.json"),
      labsFiles: [{ data: loadJson("mcp-labs-related-raw.fixture.json"), source: "related" }]
    });
    const sources = new Set(merged.items.map((row) => row.source));
    return sources.has("serp_paa") && sources.has("serp_related") && sources.has("related");
  },
  detail: "ingest preserves source tags"
});

checks.push({
  id: "I6",
  pass: () => {
    const { intents } = ingestMcpExports({
      intentData: loadJson("mcp-intent-raw.fixture.json")
    });
    return Object.keys(intents ?? {}).length === 2;
  },
  detail: "ingest returns intents map when intent export provided"
});

checks.push({
  id: "I7",
  pass: () => {
    const items = extractLabsItems(loadJson("mcp-labs-related-core-keyword.fixture.json"), "related");
    return items.every((row) => row.core_keyword === "team chat software");
  },
  detail: "ingest preserves core_keyword on Labs items"
});

checks.push({
  id: "I8",
  pass: () => {
    const items = extractLabsItems(loadJson("mcp-labs-related-core-keyword.fixture.json"), "related");
    const cores = new Set(items.map((row) => row.core_keyword));
    return items.length === 2 && cores.size === 1 && cores.has("team chat software");
  },
  detail: "related keywords share core_keyword from Labs properties"
});

checks.push({
  id: "I9",
  pass: () => {
    const items = extractLabsItems(loadJson("nested-related-labs-raw.json"), "related");
    return items.some((row) => row.keyword === "example nested child keyword");
  },
  detail: "nested Labs related_keywords flattened one level into items"
});

let failed = 0;
for (const check of checks) {
  const pass = check.pass();
  console.log(`${pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} ingest-mcp checks passed.`);
