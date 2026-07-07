#!/usr/bin/env node
/**
 * Verify layperson summary builder (LP1–LP23).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLaypersonSummaryMarkdown,
  buildMissingGapItems,
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

const goodFixture = readFileSync(
  path.join(root, "examples/example-good.robots.txt.fixture.txt"),
  "utf8"
);
const goodAssess = assessRobotsTxtContent(goodFixture, "max_discovery", "example.com", {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
}).assessment;
const goodRequired = buildMissingGapItems(goodAssess, { includeOptional: false });
ok(
  "LP18",
  !goodRequired.some((g) => /training/i.test(g.label)),
  goodRequired.map((g) => g.id).join(", ")
);
ok(
  "LP19",
  !summary.includes("Major AI training crawlers are blocked"),
  "CF max_discovery summary must not claim training blocks as required wins"
);
ok(
  "LP19b",
  summary.includes("optional") && summary.includes("max discovery"),
  "CF max_discovery should label edge training blocks as optional"
);

const blockTrainingFixture = readFileSync(
  path.join(root, "examples/example-good-block-training.robots.txt.fixture.txt"),
  "utf8"
);
const blockTrainingAssess = assessRobotsTxtContent(
  blockTrainingFixture,
  "block_training_allow_answers",
  "example.com",
  {
    sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
  }
).assessment;
const blockTrainingWorking = buildWorkingList(blockTrainingAssess, "example.com");
ok(
  "LP20",
  blockTrainingWorking.some((line) => line.includes("AI training bots are blocked")),
  blockTrainingWorking.join(" | ")
);
ok(
  "LP20b",
  blockTrainingWorking.some((line) => line.includes("block training while allowing answers")),
  blockTrainingWorking.join(" | ")
);

const wpOpenFixture = readFileSync(
  path.join(root, "examples/example-wp-open.robots.txt.fixture.txt"),
  "utf8"
);
const auditOnlyAssess = assessRobotsTxtContent(wpOpenFixture, "audit_only", "example.com", {
  sitemap_fetch_results: [{ url: "https://www.example.com/sitemap_index.xml", status: 200 }]
}).assessment;
const auditOnlySummary = buildLaypersonSummaryMarkdown({
  domain: "example.com",
  crawlPolicy: "audit_only",
  mode: "audit",
  assessment: auditOnlyAssess,
  detailRelativePath: "reports/example.com-2026-07-07-detail.md"
});
ok(
  "LP21",
  !auditOnlySummary.includes("Not quite there yet") &&
    auditOnlySummary.includes("Looks good — optional improvements below"),
  "audit_only with only optional gaps should not use negative verdict headline"
);

const sitemap500Assess = assessRobotsTxtContent(wpOpenFixture, "audit_only", "example.com", {
  sitemap_fetch_results: [{ url: "https://www.example.com/sitemap_index.xml", status: 500 }]
}).assessment;
const sitemap500Summary = buildLaypersonSummaryMarkdown({
  domain: "example.com",
  crawlPolicy: "audit_only",
  mode: "audit",
  assessment: sitemap500Assess,
  detailRelativePath: "reports/example.com-2026-07-07-detail.md"
});
ok(
  "LP22",
  sitemap500Summary.includes("Worth fixing (not a robots.txt rule issue)") &&
    sitemap500Summary.includes("HTTP 500") &&
    sitemap500Summary.includes("sitemap_index.xml"),
  "SM7 sitemap endpoint failure should surface in layperson attention"
);

const wpOpenWorking = buildWorkingList(auditOnlyAssess, "example.com");
ok(
  "LP23",
  auditOnlyAssess.layer_assessment?.origin?.sitemap_present === true &&
    wpOpenWorking.some((line) => line.includes("Sitemap is declared")) &&
    wpOpenWorking.some((line) => line.includes("Admin paths are restricted")),
  wpOpenWorking.join(" | ")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
