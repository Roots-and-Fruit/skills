#!/usr/bin/env node
/**
 * Verify layperson summary builder (LP1–LP8).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLaypersonSummaryMarkdown,
  buildMissingList,
  buildWorkingList,
  violationToLayperson,
  writeAuditReports
} from "./build-layperson-summary.mjs";
import { buildRecommendedRobotsTxt, collectPreservedDisallows, injectPreservedDisallows } from "./build-recommended-robots.mjs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";

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

const { assessment } = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");

console.log("verify-layperson-summary.mjs\n");

// LP1: violation mapping
ok(
  "LP1",
  violationToLayperson({ id: "MD_SITEMAP_PRESENT", message: "x" }).includes("sitemap")
);

// LP2: missing list from CF fixture (origin gaps)
const missing = buildMissingList(assessment);
ok("LP2", missing.length >= 3, `got ${missing.length} items`);

// LP3: working list non-empty
const working = buildWorkingList(assessment, "example.com");
ok("LP3", working.length >= 2);

// LP4: summary has required sections, no handoff JSON
const summary = buildLaypersonSummaryMarkdown({
  domain: "example.com",
  crawlPolicy: "max_discovery",
  mode: "recommend",
  assessment,
  detailRelativePath: "reports/example.com-2026-07-01-detail.md"
});
ok("LP4", summary.includes("## Verdict"));
ok("LP5", summary.includes("## What's working"));
ok("LP6", summary.includes("## What to do next"));
ok("LP7", !summary.includes('"handoff_version"'));
ok("LP8", !summary.includes("crawler_matrix"));

// LP9: writeAuditReports produces detail file content
const { summaryMarkdown, detailPath, result } = writeAuditReports(
  "example.com",
  cfFixture,
  "max_discovery",
  { fetchedUrls: ["https://example.com/robots.txt", "https://www.example.com/robots.txt"] }
);
const detail = readFileSync(detailPath, "utf8");
ok("LP9", detail.includes("## Handoff JSON"));
ok("LP10", detail.includes("## Per-bot matrix"));
ok("LP11", summaryMarkdown.includes("Technical details"));

const cfResult = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");
const rec = buildRecommendedRobotsTxt(cfFixture, cfResult, "example.com");
ok("LP12", rec?.originOnly?.includes("Sitemap:"));
ok("LP17", summaryMarkdown.includes("How to update (Cloudflare-managed)") || summaryMarkdown.includes("SFTP"));
ok("LP13", rec?.text?.includes("Sitemap:"));
ok("LP14", summaryMarkdown.includes("Copy-paste: origin robots.txt"));
ok("LP15", collectPreservedDisallows("User-agent: *\nDisallow: /wp-content/uploads/*.html").includes("/wp-content/uploads/*.html"));
const merged = injectPreservedDisallows(
  "User-agent: Googlebot\nAllow: /\n\nUser-agent: *\nDisallow: /wp-admin/\nAllow: /",
  ["/wp-content/uploads/*.html"]
);
ok("LP16", merged.includes("User-agent: *\nDisallow: /wp-admin/\nDisallow: /wp-content/uploads/*.html"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
