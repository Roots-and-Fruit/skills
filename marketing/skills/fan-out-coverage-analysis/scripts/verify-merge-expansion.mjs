#!/usr/bin/env node
/**
 * Regression checks for merge-expansion-input.mjs (M1–M5).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { itemsFromSerp, itemsFromLabs, mergeExpansionItems } from "./merge-expansion-input.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const checks = [];

checks.push({
  id: "M1",
  pass: () => {
    const serp = loadJson("serp-seed.fixture.json");
    const items = itemsFromSerp(serp);
    return items.length === 4 && items.every((row) => row.source.startsWith("serp_"));
  },
  detail: "SERP seed expands PAA + related with serp_* sources"
});

checks.push({
  id: "M2",
  pass: () => {
    const labs = loadJson("merged-keywords.fixture.json");
    const items = itemsFromLabs(labs, "related");
    return items.length >= 10;
  },
  detail: "Labs items array parsed"
});

checks.push({
  id: "M3",
  pass: () => {
    const merged = mergeExpansionItems({
      serp: loadJson("serp-seed.fixture.json"),
      labsFiles: [{ data: loadJson("merged-keywords.fixture.json"), source: "related" }]
    });
    return merged.items.length >= 14;
  },
  detail: "SERP + Labs merge produces combined items"
});

checks.push({
  id: "M4",
  pass: () => {
    const merged = mergeExpansionItems({
      serp: loadJson("serp-seed.fixture.json"),
      labsFiles: [{ data: loadJson("merged-keywords.fixture.json"), source: "related" }]
    });
    const sources = new Set(merged.items.map((row) => row.source));
    return sources.has("serp_paa") && sources.has("serp_related") && sources.has("related");
  },
  detail: "Merged output preserves source tags"
});

checks.push({
  id: "M5",
  pass: () => {
    const merged = mergeExpansionItems({
      serp: loadJson("serp-seed.fixture.json"),
      labsFiles: [{ data: loadJson("merged-keywords.fixture.json"), source: "related" }]
    });
    return merged.items.every((row) => typeof row.keyword === "string" && row.keyword.length > 0);
  },
  detail: "Every merged row has non-empty keyword"
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

console.log(`\nAll ${checks.length} merge-expansion checks passed.`);
