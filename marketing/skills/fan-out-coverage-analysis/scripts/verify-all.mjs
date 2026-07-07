#!/usr/bin/env node
/**
 * Run all fan-out regression verifiers.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scripts = [
  "verify-scorecard.mjs",
  "verify-handoff.mjs",
  "verify-layperson-summary.mjs",
  "verify-merge-expansion.mjs",
  "verify-apply-coverage.mjs",
  "verify-ingest-mcp.mjs"
];

for (const name of scripts) {
  console.log(`\n=== ${name} ===`);
  execFileSync(process.execPath, [path.join(__dirname, name)], { stdio: "inherit" });
}

console.log("\nAll fan-out verifiers passed.");
