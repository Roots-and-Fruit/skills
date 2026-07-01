#!/usr/bin/env node
/**
 * Verify reference link coverage (RL1–RL6).
 */
import { GAP_REGISTRY } from "./audit-gap-registry.mjs";
import {
  buildLearnMoreFooter,
  findGapsMissingLearnMoreAnchor,
  formatLearnMoreLink,
  learnMoreUrl,
  learnMoreUrlForGap,
  ROBOTS_TXT_GUIDE_URL,
  ROOTS_AND_FRUIT_URL
} from "./reference-links.mjs";
import { buildLaypersonSummaryMarkdown } from "./build-layperson-summary.mjs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

let passed = 0;
let failed = 0;

function ok(id, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${id}`);
  } else {
    failed++;
    console.error(`  ✗ ${id}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("verify-reference-links.mjs\n");

ok("RL1", ROBOTS_TXT_GUIDE_URL.includes("robots-txt-audit-skill-reference-guide"));
ok("RL2", learnMoreUrl("sitemap-declaration").endsWith("#sitemap-declaration"));
ok("RL3", findGapsMissingLearnMoreAnchor().length === 0, findGapsMissingLearnMoreAnchor().join(", "));
ok(
  "RL4",
  Object.keys(GAP_REGISTRY).every((id) => learnMoreUrlForGap(id).includes("#"))
);

const cfFixture = readFileSync(
  path.join(root, "examples/example-cloudflare-managed-origin-append.robots.txt.fixture.txt"),
  "utf8"
);
const { assessment } = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");
const summary = buildLaypersonSummaryMarkdown({
  domain: "example.com",
  crawlPolicy: "max_discovery",
  mode: "recommend",
  assessment,
  detailRelativePath: "reports/example.com-2026-07-01-detail.md"
});

ok("RL5", summary.includes("Why this matters"));
ok("RL5b", summary.includes("#sitemap-declaration"));
ok("RL6", buildLearnMoreFooter().includes(ROOTS_AND_FRUIT_URL));
ok("RL6b", summary.includes("Growth marketing consulting"));

for (const id of Object.keys(GAP_REGISTRY)) {
  const link = formatLearnMoreLink(id);
  ok(`RL-gap-${id}`, link.startsWith("[Why this matters](") && link.includes("#"));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
