#!/usr/bin/env node
/**
 * Verify re-audit snapshot + delta (RA1–RA12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectGapsFromAssessment } from "./audit-gap-registry.mjs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import {
  buildAuditSnapshot,
  buildEncouragement,
  buildPartialFixDownsides,
  compareGapSnapshots
} from "./build-reaudit.mjs";
import { writeAuditReports } from "./build-layperson-summary.mjs";

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

const cfFixture = readFileSync(
  path.join(root, "examples/example-cloudflare-managed-origin-append.robots.txt.fixture.txt"),
  "utf8"
);

const partialFixed = `${cfFixture.trim()}\n\nUser-agent: *\nDisallow: /wp-admin/\nDisallow: /cart/\nDisallow: /checkout/\nSitemap: https://example.com/sitemap.xml\n`;

console.log("verify-reaudit.mjs\n");

const baseline = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");
const baselineGaps = collectGapsFromAssessment(baseline.assessment);
ok("RA1", baselineGaps.required.length >= 3);

const snap = buildAuditSnapshot("example.com", baseline.assessment, {
  crawl_policy: "max_discovery"
});
ok("RA2", snap.required_ids.includes("MD_SITEMAP_PRESENT"));

const improved = assessRobotsTxtContent(partialFixed, "max_discovery", "example.com");
const improvedGaps = collectGapsFromAssessment(improved.assessment);
const delta = compareGapSnapshots(snap, improvedGaps);
ok("RA3", delta.fixedRequired.length >= 1);
ok("RA4", delta.stillRequired.length < baselineGaps.required.length);
ok("RA5", buildEncouragement(delta).toLowerCase().includes("progress") || buildEncouragement(delta).toLowerCase().includes("almost"));

const downsides = buildPartialFixDownsides(delta.stillRequired);
ok("RA6", downsides === null || downsides.includes("If you stop"));

const { summaryMarkdown: firstRun } = writeAuditReports(
  "example.com",
  cfFixture,
  "max_discovery",
  { outputDir: path.join(root, "reports", ".verify-reaudit-tmp") }
);
ok("RA7", firstRun.includes("robots.txt check"));

const { summaryMarkdown: recheckRun, reauditDelta } = writeAuditReports(
  "example.com",
  partialFixed,
  "max_discovery",
  {
    outputDir: path.join(root, "reports", ".verify-reaudit-tmp"),
    recheck: true
  }
);
ok("RA8", recheckRun.includes("re-check"));
ok("RA9", recheckRun.includes("Progress since last check"));
ok("RA10", recheckRun.includes("Fixed — nice work") || recheckRun.includes("Still to do"));
ok("RA11", reauditDelta && reauditDelta.fixedRequiredCount >= 1);
ok("RA12", recheckRun.includes("|") && recheckRun.includes("Last check"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
