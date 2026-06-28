#!/usr/bin/env node
/**
 * Validate web-scrape-to-md handoff JSON (schema v1.1).
 *
 * Usage (from web-scrape-to-md/):
 *   node scripts/verify-handoff.mjs
 *   node scripts/verify-handoff.mjs examples/example-saas.handoff.fixture.json
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const HANDOFF_VERSIONS = new Set(["1.0", "1.1"]);
const MODES = new Set(["corpus_run", "summary_only"]);
const LLMS_STATUS = new Set(["found", "missing", "not_checked"]);
const SITEMAP_ROOT_STATUS = new Set(["ok", "http_error", "missing", "not_fetched"]);
const URL_STATUS = new Set(["ok", "http_error", "blocked_or_empty", "unresolved"]);
const INTENTS = new Set(["identity", "value", "evidence", "reference", "general"]);
const SOURCE_TAGS = new Set([
  "llms_seed",
  "sitemap_discovered",
  "sitemap_child_discovered",
  "archive_discovered",
  "search_discovered",
  "nav_discovered"
]);
const FETCH_FORMATS = new Set(["markdown", "html"]);

function defaultHandoffFixtures() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith(".handoff.fixture.json"))
    .map((name) => path.join(examplesDir, name))
    .sort();
}

function loadHandoff(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return { filePath, data: JSON.parse(raw) };
}

function okUrlResults(data) {
  return data.url_results.filter((row) => row.status === "ok");
}

function runChecks(data) {
  const checks = [];
  const isV11 = data.handoff_version === "1.1";

  checks.push({
    id: "G1",
    pass: () => HANDOFF_VERSIONS.has(data.handoff_version)
  });
  checks.push({ id: "G2", pass: () => data.skill === "web-scrape-to-md" });
  checks.push({ id: "G3", pass: () => MODES.has(data.mode) });
  checks.push({
    id: "G4",
    pass: () =>
      (typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0) ||
      (Array.isArray(data.inputs?.urls) && data.inputs.urls.length > 0)
  });
  checks.push({
    id: "G5",
    pass: () =>
      typeof data.inputs?.goal === "string" &&
      data.inputs.goal.length > 0 &&
      typeof data.inputs?.coverage_target === "number"
  });

  checks.push({
    id: "G6",
    pass: () => {
      const d = data.discovery_summary;
      const base =
        d &&
        typeof d.llms_endpoints_checked === "boolean" &&
        LLMS_STATUS.has(d.llms_txt_status) &&
        typeof d.sitemap_checked === "boolean" &&
        typeof d.search_rounds === "number" &&
        typeof d.markdown_direct_count === "number" &&
        typeof d.html_fallback_count === "number" &&
        Array.isArray(d.discovery_sources) &&
        typeof d.completed_ok === "number" &&
        typeof d.completed_total === "number";
      if (!base) {
        return false;
      }
      if (!isV11) {
        return true;
      }
      return (
        SITEMAP_ROOT_STATUS.has(d.sitemap_root_status) &&
        Array.isArray(d.sitemap_child_urls_tried) &&
        typeof d.blog_archive_fetched === "boolean" &&
        typeof d.freshness_goal === "boolean" &&
        Array.isArray(d.recent_posts_discovered) &&
        (!d.blog_archive_fetched || typeof d.blog_archive_url === "string")
      );
    }
  });

  checks.push({
    id: "G7",
    pass: () => Array.isArray(data.url_results) && data.url_results.length >= 1
  });

  checks.push({
    id: "G8",
    pass: () =>
      data.url_results.every(
        (row) =>
          typeof row.url === "string" &&
          URL_STATUS.has(row.status) &&
          INTENTS.has(row.intent) &&
          SOURCE_TAGS.has(row.source_tag)
      )
  });

  checks.push({
    id: "G9",
    pass: () =>
      okUrlResults(data).every(
        (row) =>
          typeof row.final_url === "string" && FETCH_FORMATS.has(row.fetch_format)
      )
  });

  checks.push({ id: "G10", pass: () => Array.isArray(data.corpus_files) });

  checks.push({
    id: "G11",
    pass: () =>
      data.mode !== "corpus_run" ||
      (data.corpus_files.length >= 1 &&
        data.corpus_files.every(
          (row) =>
            typeof row.path === "string" &&
            typeof row.url === "string" &&
            typeof row.line_count === "number" &&
            FETCH_FORMATS.has(row.fetch_format) &&
            typeof row.quality_pass === "boolean"
        ))
  });

  checks.push({
    id: "G12",
    pass: () =>
      data.mode !== "corpus_run" ||
      data.corpus_files.filter((row) => row.quality_pass).length >= 1
  });

  checks.push({
    id: "G13",
    pass: () =>
      Array.isArray(data.recommended_keep) && Array.isArray(data.recommended_drop)
  });

  checks.push({ id: "G14", pass: () => Array.isArray(data.limitations) });

  checks.push({
    id: "G15",
    pass: () => data.discovery_summary.llms_endpoints_checked === true
  });

  checks.push({
    id: "G16",
    pass: () => {
      const okRows = okUrlResults(data);
      const md = okRows.filter((row) => row.fetch_format === "markdown").length;
      const html = okRows.filter((row) => row.fetch_format === "html").length;
      return (
        data.discovery_summary.markdown_direct_count === md &&
        data.discovery_summary.html_fallback_count === html
      );
    }
  });

  checks.push({
    id: "G17",
    pass: () => data.discovery_summary.completed_ok === okUrlResults(data).length
  });

  checks.push({
    id: "G18",
    pass: () => data.discovery_summary.completed_total === data.url_results.length
  });

  checks.push({
    id: "G19",
    pass: () =>
      data.mode !== "corpus_run" ||
      data.corpus_files.length === okUrlResults(data).length
  });

  return checks;
}

function verifyFile(filePath) {
  const { data } = loadHandoff(filePath);
  const checks = runChecks(data);
  let failed = 0;

  console.log(`\n${path.basename(filePath)}`);
  for (const check of checks) {
    const pass = check.pass();
    console.log(`${check.id} ${pass ? "PASS" : "FAIL"}`);
    if (!pass) {
      failed += 1;
    }
  }

  return failed;
}

function main() {
  const files =
    process.argv.length > 2
      ? process.argv.slice(2).map((f) => path.resolve(f))
      : defaultHandoffFixtures();

  let totalFailed = 0;
  for (const file of files) {
    totalFailed += verifyFile(file);
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
