#!/usr/bin/env node
/**
 * Verify SM8 sitemap directive typo detection (Step 1).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { detectSitemapDirectiveTypos } from "./syntax-validation.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

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

console.log("verify-schemamap.mjs\n");

const typoFixture = readFileSync(
  path.join(examplesDir, "example-schemamap-typo.robots.txt.fixture.txt"),
  "utf8"
);

const typos = detectSitemapDirectiveTypos(typoFixture);
ok("SY1", typos.length === 1 && typos[0].directive === "Schemamap");
ok("SY2", typos[0]?.id === "SM8");

const { assessment } = assessRobotsTxtContent(typoFixture, "audit_only", "example.com");
ok("SY3", assessment.sitemap_validation?.status === "fail");
ok(
  "SY4",
  assessment.sitemap_validation?.issues?.some((i) => i.id === "SM8")
);
ok(
  "SY5",
  assessment.sitemap_validation?.issues?.some((i) => i.id === "SM1")
);
ok(
  "SY6",
  assessment.sitemap_validation?.issues
    ?.find((i) => i.id === "SM1")
    ?.message?.includes("Schemamap")
);
ok(
  "SY7",
  assessment.audit_findings?.some((f) => f.id === "AF_SM8" && f.tier === "warn")
);

const goodFixture = readFileSync(
  path.join(examplesDir, "example-good.robots.txt.fixture.txt"),
  "utf8"
);
const good = assessRobotsTxtContent(goodFixture, "max_discovery", "example.com", {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
});
ok(
  "SY8",
  !good.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM8")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
