#!/usr/bin/env node
/**
 * Run regression scorecard S1–S8 against merged-keywords.fixture.json
 *
 * Usage (from fan-out-coverage-analysis/):
 *   node scripts/verify-scorecard.mjs
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const normalizeScript = path.join(__dirname, "normalize-fanout.mjs");
const fixture = path.join(root, "examples", "merged-keywords.fixture.json");
const seed = "wordpress plugin marketing";
const lane = "primary_topic";

const raw = execFileSync(
  process.execPath,
  [normalizeScript, "--seed", seed, "--lane", lane, "--file", fixture],
  { encoding: "utf8" }
);
const rows = JSON.parse(raw);
const byKeyword = new Map(rows.map((row) => [row.keyword.toLowerCase(), row]));

function get(keyword) {
  return byKeyword.get(keyword.toLowerCase());
}

const checks = [
  {
    id: "S1",
    pass: () => get("how to promote a wordpress plugin")?.relevance_tier === "serp_native"
  },
  {
    id: "S2",
    pass: () => get("wordpress plugin marketing strategy")?.relevance_tier === "serp_native"
  },
  {
    id: "S3",
    pass: () => get("wordpress email marketing plugin free")?.relevance_tier === "facet_drift"
  },
  {
    id: "S4",
    pass: () => get("best newsletter plugin for wordpress free")?.relevance_tier === "facet_drift"
  },
  {
    id: "S5",
    pass: () => !get("mailpoet")
  },
  {
    id: "S6",
    pass: () => !get("is wordpress outdated in 2026")
  },
  {
    id: "S7",
    pass: () => rows[0]?.keyword.toLowerCase() === "how to promote a wordpress plugin"
  },
  {
    id: "S8",
    pass: () => get("wordpress email marketing plugin")?.relevance_tier === "facet_drift"
  }
];

let failed = 0;
for (const check of checks) {
  const ok = check.pass();
  console.log(`${ok ? "PASS" : "FAIL"} ${check.id}`);
  if (!ok) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} scorecard check(s) failed.`);
  process.exit(1);
}

console.log("\nAll S1–S8 scorecard checks passed.");
