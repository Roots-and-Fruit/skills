#!/usr/bin/env node
/**
 * Regression scorecard for web-scrape-to-md — efficiency (E), quality (Q), fallback (S).
 *
 * Usage (from web-scrape-to-md/):
 *   node scripts/verify-scorecard.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessPageMd } from "./assess-page-md.mjs";
import {
  blogArchiveCandidates,
  childSitemapCandidates,
  goalNeedsFreshness,
  isArchiveIndexUrl,
  parseSitemapLocs
} from "./wp-sitemap-fallback.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

function loadText(name) {
  return readFileSync(path.join(examplesDir, name), "utf8");
}

function check(id, pass) {
  console.log(`${id} ${pass ? "PASS" : "FAIL"}`);
  return pass ? 0 : 1;
}

function okUrlResults(data) {
  return data.url_results.filter((row) => row.status === "ok");
}

function runEfficiencyChecks(data, label) {
  let failed = 0;
  const d = data.discovery_summary;

  console.log(`\nEfficiency (E-layer) — ${label}`);

  failed += check("E1", d.llms_endpoints_checked === true);

  const okRows = okUrlResults(data);
  const md = okRows.filter((row) => row.fetch_format === "markdown").length;
  const html = okRows.filter((row) => row.fetch_format === "html").length;
  failed += check(
    "E2",
    d.markdown_direct_count === md && d.html_fallback_count === html
  );

  failed += check(
    "E3",
    !d.sitemap_checked ||
      d.search_rounds <= 2 ||
      data.url_results.length < 3
  );

  failed += check(
    "E4",
    d.markdown_direct_count === md && d.html_fallback_count === html
  );

  failed += check(
    "E5",
    d.completed_ok <= data.inputs.coverage_target ||
      data.limitations.some((line) => /exhaustive|full/i.test(String(line)))
  );

  if (d.sitemap_root_status === "http_error") {
    failed += check(
      "E6",
      d.sitemap_child_urls_tried.length >= 1 ||
        d.blog_archive_fetched ||
        data.limitations.some((line) => /sitemap|child|archive/i.test(String(line)))
    );
  }

  if (d.freshness_goal) {
    failed += check(
      "E7",
      d.recent_posts_discovered.length >= 1 ||
        data.limitations.some((line) => /blog|post|no public/i.test(String(line)))
    );
  }

  return failed;
}

function runQualityChecks() {
  let failed = 0;
  console.log("\nPage markdown (Q-layer)");

  const good = assessPageMd(loadText("good-page.md.fixture.md"));
  for (const row of good) {
    failed += check(row.id, row.pass);
  }

  const bad = assessPageMd(loadText("bad-page-html-dump.md.fixture.md"));
  const badMustFail = new Set(["Q2", "Q3", "Q4", "Q5", "Q6", "Q7"]);
  for (const row of bad) {
    if (badMustFail.has(row.id)) {
      failed += check(`${row.id}-bad`, row.pass === false);
    }
  }

  return failed;
}

function runFallbackScriptChecks() {
  let failed = 0;
  console.log("\nSitemap fallback (S-layer)");

  const children = childSitemapCandidates("example.com");
  failed += check(
    "S1",
    children.includes("https://example.com/sitemap-post-type-post.xml")
  );
  failed += check(
    "S2",
    children.includes("https://example.com/sitemap-post-type-page.xml")
  );

  const archives = blogArchiveCandidates("example.com");
  failed += check("S3", archives[0] === "https://example.com/articles/");

  const xml =
    '<?xml version="1.0"?><urlset><url><loc>https://example.com/articles/a/</loc></url></urlset>';
  const locs = parseSitemapLocs(xml);
  failed += check("S4", locs.length === 1 && locs[0].endsWith("/articles/a/"));

  failed += check(
    "S5",
    isArchiveIndexUrl("https://example.com/articles/") &&
      !isArchiveIndexUrl("https://example.com/articles/launch/")
  );

  failed += check(
    "S6",
    goalNeedsFreshness("research corpus with latest blog posts") &&
      !goalNeedsFreshness("pricing page audit only")
  );

  return failed;
}

function main() {
  let failed = 0;

  const saas = loadJson("example-saas.handoff.fixture.json");
  failed += runEfficiencyChecks(saas, "example-saas");
  failed += check(
    "Q8",
    saas.corpus_files.every((row) => row.quality_pass === true)
  );

  const sitemapFail = loadJson("example-sitemap-fail.handoff.fixture.json");
  failed += runEfficiencyChecks(sitemapFail, "example-sitemap-fail");

  failed += runQualityChecks();
  failed += runFallbackScriptChecks();

  process.exit(failed > 0 ? 1 : 0);
}

main();
