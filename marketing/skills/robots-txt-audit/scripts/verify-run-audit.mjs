#!/usr/bin/env node
/**
 * RA-CLI gates for run-audit.mjs primary agent path.
 */
import { readFileSync, rmSync, existsSync, writeFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { runChecks } from "./verify-handoff.mjs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");
const reportsDir = path.join(root, "reports", ".verify-run-audit-cli");
const sitemapFetchFile = path.join(examplesDir, ".verify-sitemap-fetch.json");

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

function runAudit(extraArgs = "") {
  const robots = path.join(examplesDir, "example-good.robots.txt.fixture.txt");
  const cmd = `node scripts/run-audit.mjs --robots "${robots}" --domain example.com --policy max_discovery --output-dir "${reportsDir}" ${extraArgs}`;
  return execSync(cmd, { cwd: root, encoding: "utf8" });
}

console.log("verify-run-audit.mjs\n");

writeFileSync(
  sitemapFetchFile,
  JSON.stringify([{ url: "https://example.com/sitemap.xml", status: 200 }])
);

if (existsSync(reportsDir)) {
  rmSync(reportsDir, { recursive: true, force: true });
}

const stdout = runAudit(`--sitemap-fetch "${sitemapFetchFile}"`);

ok("RA-CLI1", stdout.includes("# robots.txt check"));
ok("RA-CLI6", !stdout.includes('"handoff_version"'));

const detailFiles = readdirSync(reportsDir).filter((n) => n.endsWith("-detail.md"));
ok("RA-CLI2", detailFiles.length === 1);
const detailPath = path.join(reportsDir, detailFiles[0]);
const detail = readFileSync(detailPath, "utf8");
ok("RA-CLI2b", detail.includes("## Handoff JSON") && detail.includes('"audit_checks"'));

const handoffMatch = detail.match(/## Handoff JSON \(v1\.0\)\s+```json\s+([\s\S]*?)```/);
let handoff = null;
if (handoffMatch) {
  handoff = JSON.parse(handoffMatch[1]);
  const checks = runChecks(handoff);
  ok("RA-CLI3", checks.every((c) => c.pass()));
}

const live = assessRobotsTxtContent(
  readFileSync(path.join(examplesDir, "example-good.robots.txt.fixture.txt"), "utf8"),
  "max_discovery",
  "example.com",
  { sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }] }
);
ok(
  "RA-CLI4",
  JSON.stringify(handoff?.sitemap_validation) ===
    JSON.stringify(live.assessment.sitemap_validation)
);

const skillMd = readFileSync(path.join(root, "SKILL.md"), "utf8");
const lineCount = skillMd.split("\n").length;
ok("RA-CLI7", lineCount <= 200);
ok("RA-CLI8", skillMd.includes("run-audit.mjs"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
