#!/usr/bin/env node
/**
 * GSC-like robots.txt syntax validation (SX1–SX12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import {
  ALLOWED_ROBOTS_DIRECTIVES,
  detectSitemapDirectiveTypos,
  validateRobotsTxtSyntax
} from "./syntax-validation.mjs";

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

console.log("verify-syntax.mjs\n");

ok("SX1", ALLOWED_ROBOTS_DIRECTIVES.has("content-signal"));

const good = readFileSync(
  path.join(examplesDir, "example-good.robots.txt.fixture.txt"),
  "utf8"
);
const goodSyntax = validateRobotsTxtSyntax(good);
ok("SX2", goodSyntax.status === "pass");
ok("SX3", goodSyntax.issue_count === 0);

const schemamap = readFileSync(
  path.join(examplesDir, "example-schemamap-typo.robots.txt.fixture.txt"),
  "utf8"
);
const schemamapSyntax = validateRobotsTxtSyntax(schemamap);
ok("SX4", schemamapSyntax.issues.some((i) => i.id === "SM8"));
ok(
  "SX5",
  schemamapSyntax.issues.some((i) => i.id === "SY1") === false,
  "SM8 typo should not double as SY1"
);

const host = readFileSync(
  path.join(examplesDir, "example-syntax-unknown-host.robots.txt.fixture.txt"),
  "utf8"
);
const hostSyntax = validateRobotsTxtSyntax(host);
ok("SX6", hostSyntax.status === "warn");
ok("SX7", hostSyntax.issues.some((i) => i.id === "SY1" && i.directive === "Host"));

const malformed = readFileSync(
  path.join(examplesDir, "example-syntax-malformed-line.robots.txt.fixture.txt"),
  "utf8"
);
const malformedSyntax = validateRobotsTxtSyntax(malformed);
ok("SX8", malformedSyntax.issues.some((i) => i.id === "SY2"));

const cf = readFileSync(
  path.join(
    examplesDir,
    "example-cloudflare-managed-origin-append.robots.txt.fixture.txt"
  ),
  "utf8"
);
const cfSyntax = validateRobotsTxtSyntax(cf);
ok("SX9", cfSyntax.status === "pass");
ok("SX10", cfSyntax.issues.some((i) => i.directive === "Content-Signal") === false);

const hostAssess = assessRobotsTxtContent(host, "audit_only", "example.com", {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
});
ok("SX11", hostAssess.assessment.syntax_validation?.status === "warn");
ok(
  "SX12",
  hostAssess.assessment.audit_findings?.some(
    (f) => f.id === "AF_SY1" && f.rubric === "R2b"
  )
);

console.log("\nSchemamap / SM8 (SY1–SY8):\n");

const typos = detectSitemapDirectiveTypos(schemamap);
ok("SY1", typos.length === 1 && typos[0].directive === "Schemamap");
ok("SY2", typos[0]?.id === "SM8");

const schemamapAssess = assessRobotsTxtContent(schemamap, "audit_only", "example.com");
ok("SY3", schemamapAssess.assessment.sitemap_validation?.status === "fail");
ok(
  "SY4",
  schemamapAssess.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM8")
);
ok(
  "SY5",
  schemamapAssess.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM1")
);
ok(
  "SY6",
  schemamapAssess.assessment.sitemap_validation?.issues
    ?.find((i) => i.id === "SM1")
    ?.message?.includes("Schemamap")
);
ok(
  "SY7",
  schemamapAssess.assessment.audit_findings?.some(
    (f) => f.id === "AF_SM8" && f.tier === "warn"
  )
);

const goodAssess = assessRobotsTxtContent(good, "max_discovery", "example.com", {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
});
ok(
  "SY8",
  !goodAssess.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM8")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
