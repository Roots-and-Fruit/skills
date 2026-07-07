#!/usr/bin/env node
/**
 * Verify layperson summary builder (LP1–LP10).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLaypersonSummaryMarkdown,
  buildWorkingList,
  writeFanoutReports
} from "./build-layperson-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixture = path.join(root, "examples", "wordpress-plugin-marketing-v2.3.handoff.fixture.json");

let passed = 0;
let failed = 0;

function ok(id, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`PASS ${id}`);
  } else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ""}`);
  }
}

const handoff = JSON.parse(readFileSync(fixture, "utf8"));
const summary = buildLaypersonSummaryMarkdown(handoff, {
  detailRelativePath: "reports/example.com-2026-07-07-detail.md"
});

ok("LP1", summary.includes("## Verdict"));
ok("LP2", summary.includes("## What's working"));
ok("LP3", summary.includes("## What to write next"));
ok("LP4", !summary.includes('"handoff_version"'));
ok("LP5", !summary.includes("| Tier |"));
ok("LP6", summary.includes("## What still needs attention"));

const working = buildWorkingList(handoff);
ok("LP7", working.length >= 1);

const { summaryMarkdown, detailPath } = writeFanoutReports(handoff, {
  outputDir: path.join(root, "reports", ".verify-layperson-tmp")
});
const detail = readFileSync(detailPath, "utf8");
ok("LP8", detail.includes("## Handoff JSON"));
ok("LP9", detail.includes("## Sub-queries"));
ok("LP10", summaryMarkdown.includes("Technical details"));

if (failed > 0) {
  console.error(`\n${failed} layperson check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll LP1–LP10 layperson checks passed.`);
