#!/usr/bin/env node
/**
 * Normalize relevance gate checks (NR1).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFanoutItems } from "./normalize-fanout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const checks = [];

checks.push({
  id: "NR1",
  pass: async () => {
    const fixture = loadJson("homograph-wise-reject.fixture.json");
    const normalized = await normalizeFanoutItems(
      fixture.items,
      fixture.seed,
      fixture.intent_lane
    );
    const map = new Map(normalized.map((row) => [row.keyword.toLowerCase(), row]));
    return (
      !map.has(fixture.expected.rejected_keywords[0].toLowerCase()) &&
      map.has(fixture.expected.accepted_keywords[0].toLowerCase())
    );
  },
  detail: "homograph brand leak (pricing page wise) rejected at normalize gate"
});

let failed = 0;
for (const check of checks) {
  const pass = await Promise.resolve(check.pass());
  console.log(`${pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} normalize-gate checks passed.`);
