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
  "verify-client-agnostic.mjs",
  "verify-paa-gate.mjs",
  "verify-normalize-gate.mjs",
  "verify-intent-clusters.mjs",
  "verify-detail-report.mjs",
  "verify-handoff.mjs",
  "verify-layperson-summary.mjs",
  "verify-actionable-gaps.mjs",
  "verify-priority-policy.mjs",
  "verify-serp-context.mjs",
  "verify-merge-expansion.mjs",
  "verify-apply-coverage.mjs",
  "verify-encyclopedia.mjs",
  "verify-ingest-mcp.mjs"
];

for (const name of scripts) {
  console.log(`\n=== ${name} ===`);
  execFileSync(process.execPath, [path.join(__dirname, name)], { stdio: "inherit" });
}

console.log("\nAll fan-out verifiers passed.");
