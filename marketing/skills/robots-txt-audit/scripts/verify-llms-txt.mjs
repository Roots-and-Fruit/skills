#!/usr/bin/env node
/**
 * llms.txt companion checks (LL1–LL8).
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-llms-txt.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { collectGapsFromAssessment } from "./audit-gap-registry.mjs";
import { assessLlmsTxtCompanion, isLlmsTxtSitemapUrl } from "./assess-llms-txt.mjs";
import { parseRobotsTxt } from "./parse-robots-txt.mjs";

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

function load(name) {
  return readFileSync(path.join(examplesDir, name), "utf8");
}

console.log("verify-llms-txt.mjs\n");

ok("LL0", isLlmsTxtSitemapUrl("https://example.com/llms.txt"));
ok("LL0b", !isLlmsTxtSitemapUrl("https://example.com/sitemap.xml"));

const blocked = assessRobotsTxtContent(
  load("example-llms-blocked.robots.txt.fixture.txt"),
  "max_discovery",
  "example.com",
  { sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }] }
).assessment;

ok(
  "LL1",
  blocked.llms_txt_validation?.blocked_for?.some(
    (row) => row.path === "/llms.txt" && row.agent === "OAI-SearchBot"
  ),
  JSON.stringify(blocked.llms_txt_validation?.blocked_for ?? [])
);
ok(
  "LL2",
  blocked.audit_findings?.some((f) => f.id === "AF_LLMS_BLOCKED")
);
ok(
  "LL3",
  collectGapsFromAssessment(blocked).optional.some((g) => g.id === "MD_LLMS_BLOCKED")
);
ok(
  "LL4",
  blocked.policy_compliance?.compliant === true,
  "llms block must not fail max_discovery"
);

const asSitemap = assessRobotsTxtContent(
  load("example-llms-as-sitemap.robots.txt.fixture.txt"),
  "max_discovery",
  "example.com"
).assessment;

ok(
  "LL5",
  asSitemap.llms_txt_validation?.sitemap_misuse?.includes("https://example.com/llms.txt")
);
ok(
  "LL6",
  collectGapsFromAssessment(asSitemap).optional.some((g) => g.id === "MD_LLMS_AS_SITEMAP")
);

const good = assessRobotsTxtContent(
  load("example-good.robots.txt.fixture.txt"),
  "max_discovery",
  "example.com",
  {
    sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }],
    llms_txt_results: [{ url: "https://example.com/llms.txt", status: 404, ok: false }]
  }
).assessment;

ok("LL7", good.llms_txt_validation?.present === false);
ok(
  "LL7b",
  !collectGapsFromAssessment(good).optional.some((g) => g.id === "MD_LLMS_BLOCKED"),
  "missing llms.txt is not a gap"
);
ok(
  "LL7c",
  !good.audit_findings?.some((f) => f.id === "AF_LLMS_BLOCKED")
);

const restrictive = assessRobotsTxtContent(
  load("example-good-restrictive.robots.txt.fixture.txt"),
  "restrictive",
  "example.com"
).assessment;

ok("LL8", restrictive.llms_txt_validation?.applicable === false);
ok("LL8b", (restrictive.llms_txt_validation?.blocked_for ?? []).length === 0);

const parsedBlocked = parseRobotsTxt(load("example-llms-blocked.robots.txt.fixture.txt"));
const dedicated = assessLlmsTxtCompanion(
  parseRobotsTxt(`User-agent: OAI-SearchBot
Allow: /

User-agent: *
Disallow: /llms.txt
Allow: /
`).groups,
  "max_discovery",
  {}
);
ok(
  "LL9",
  !dedicated.blocked_for.some((row) => row.agent === "OAI-SearchBot"),
  "dedicated Allow: / group replaces * Disallow /llms.txt"
);

ok(
  "LL10",
  assessLlmsTxtCompanion(parsedBlocked.groups, "max_discovery", {}).blocked_for.length > 0
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
