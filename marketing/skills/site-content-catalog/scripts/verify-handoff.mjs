#!/usr/bin/env node
/**
 * Validate site-content-catalog handoff JSON (schema v1.0).
 *
 * Usage (from site-content-catalog/):
 *   node scripts/verify-handoff.mjs
 *   node scripts/verify-handoff.mjs examples/example-saas.handoff.fixture.json
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPageType, PAGE_TYPES } from "./classify-page-type.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const MODES = new Set(["sitemap_only", "sitemap_enriched", "labs_fallback"]);
const DISCOVERY_SOURCES = new Set(["sitemap", "sitemap_index", "labs_fallback"]);
const ENRICHMENT_STATUS = new Set(["discovered_only", "enriched", "unfetchable"]);

const PAGE_TYPE_SET = new Set(PAGE_TYPES);

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

function sumTypeSummary(typeSummary) {
  if (!typeSummary || typeof typeSummary !== "object") {
    return 0;
  }
  return Object.values(typeSummary).reduce((a, b) => a + (Number(b) || 0), 0);
}

function runChecks(data) {
  const checks = [];

  checks.push({
    id: "G1",
    pass: () => data.handoff_version === "1.0"
  });

  checks.push({
    id: "G2",
    pass: () => data.skill === "site-content-catalog"
  });

  checks.push({
    id: "G3",
    pass: () => MODES.has(data.mode)
  });

  checks.push({
    id: "G4",
    pass: () =>
      typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0
  });

  checks.push({
    id: "G5",
    pass: () => {
      const d = data.discovery_summary;
      return (
        d &&
        typeof d.total_discovered === "number" &&
        typeof d.enriched_count === "number" &&
        DISCOVERY_SOURCES.has(d.discovery_source)
      );
    }
  });

  checks.push({
    id: "G6",
    pass: () => Array.isArray(data.pages) && data.pages.length >= 1
  });

  checks.push({
    id: "G7",
    pass: () =>
      data.pages.every(
        (p) =>
          typeof p.url === "string" &&
          p.url.length > 0 &&
          PAGE_TYPE_SET.has(p.page_type)
      )
  });

  checks.push({
    id: "G8",
    pass: () => data.pages.every((p) => ENRICHMENT_STATUS.has(p.enrichment_status))
  });

  checks.push({
    id: "G9",
    pass: () => sumTypeSummary(data.type_summary) === data.pages.length
  });

  checks.push({
    id: "G10",
    pass: () =>
      data.discovery_summary.total_discovered === data.pages.length ||
      (Array.isArray(data.limitations) &&
        data.limitations.some((l) => /truncat|sample|subset/i.test(String(l))))
  });

  checks.push({
    id: "G11",
    pass: () => Array.isArray(data.limitations)
  });

  checks.push({
    id: "G12",
    pass: () => {
      if (data.mode !== "sitemap_only") {
        return true;
      }
      return data.pages.every((p) => p.enrichment_status === "discovered_only");
    }
  });

  checks.push({
    id: "G13",
    pass: () => {
      if (data.mode !== "sitemap_enriched") {
        return true;
      }
      return (
        data.discovery_summary.enriched_count >= 1 &&
        data.pages.some((p) => p.enrichment_status === "enriched")
      );
    }
  });

  checks.push({
    id: "G14",
    pass: () => {
      if (data.mode !== "labs_fallback") {
        return true;
      }
      return (
        data.discovery_summary.discovery_source === "labs_fallback" &&
        data.limitations.length >= 1
      );
    }
  });

  checks.push({
    id: "G15",
    pass: () => {
      if (data.discovery_summary.discovery_source !== "sitemap_index") {
        return true;
      }
      const rows = data.discovery_summary.content_sitemaps;
      return Array.isArray(rows) && rows.length >= 1;
    }
  });

  checks.push({
    id: "G16",
    pass: () => {
      const rows = data.discovery_summary.content_sitemaps;
      if (!rows) {
        return true;
      }
      if (!Array.isArray(rows)) {
        return false;
      }
      return rows.every(
        (row) =>
          typeof row.sitemap_url === "string" &&
          row.sitemap_url.length > 0 &&
          typeof row.post_type === "string" &&
          row.post_type.length > 0 &&
          typeof row.url_count === "number"
      );
    }
  });

  checks.push({
    id: "G17",
    pass: () => {
      const rows = data.discovery_summary.content_sitemaps;
      if (data.discovery_summary.discovery_source !== "sitemap_index" || !rows) {
        return true;
      }
      return rows.some((row) => row.post_type === "post");
    }
  });

  checks.push({
    id: "G18",
    pass: () =>
      data.pages.every((p) => {
        if (!p.sitemap_post_type) {
          return true;
        }
        const expected = classifyPageType(p.url, p.title ?? "", {
          sitemap_post_type: p.sitemap_post_type
        });
        return p.page_type === expected;
      })
  });

  checks.push({
    id: "G19",
    pass: () => {
      if (data.discovery_summary.discovery_source !== "sitemap_index") {
        return true;
      }
      const rows = data.discovery_summary.content_sitemaps;
      if (!Array.isArray(rows) || rows.length === 0) {
        return true;
      }
      const sum = rows.reduce((total, row) => total + (Number(row.url_count) || 0), 0);
      return sum === data.pages.length;
    }
  });

  return checks;
}

function verifyFile(filePath) {
  const { data } = loadHandoff(filePath);
  const checks = runChecks(data);

  let failed = 0;
  console.log(`\n${filePath}`);
  for (const check of checks) {
    const ok = check.pass();
    console.log(`${ok ? "PASS" : "FAIL"} ${check.id}`);
    if (!ok) {
      failed += 1;
    }
  }

  return failed;
}

function main() {
  const argPath = process.argv[2];
  const targets = argPath ? [path.resolve(argPath)] : defaultHandoffFixtures();

  let totalFailed = 0;
  for (const filePath of targets) {
    totalFailed += verifyFile(filePath);
  }

  if (totalFailed > 0) {
    console.error(`\n${totalFailed} check(s) failed.`);
    process.exit(1);
  }

  console.log(`\nAll G1–G19 passed for ${targets.length} handoff fixture(s).`);
}

main();
