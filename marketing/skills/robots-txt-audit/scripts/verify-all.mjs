#!/usr/bin/env node
/**
 * Full ship bar — runs all verifier suites in fixed order.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const SUITES = [
  "verify-robots-structure.mjs",
  "verify-max-discovery.mjs",
  "verify-max-discovery-contract.mjs",
  "verify-syntax.mjs",
  "verify-restrictive.mjs",
  "verify-build-handoff.mjs",
  "verify-handoff.mjs",
  "verify-v1_3-changes.mjs",
  "verify-cloudflare-layers.mjs",
  "verify-layperson-summary.mjs",
  "verify-reaudit.mjs",
  "verify-reference-links.mjs",
  "verify-run-audit.mjs"
];

let failed = false;

console.log("verify-all.mjs — robots-txt-audit ship bar\n");

for (const script of SUITES) {
  const scriptPath = path.join(__dirname, script);
  console.log(`--- ${script} ---`);
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    stdio: "inherit"
  });
  if (result.status !== 0) {
    failed = true;
    console.error(`\nFAILED: ${script} (exit ${result.status ?? "signal"})\n`);
    break;
  }
  console.log("");
}

if (failed) {
  process.exit(1);
}

console.log(`All ${SUITES.length} verifier suites passed.`);
process.exit(0);
