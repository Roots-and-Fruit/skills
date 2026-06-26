#!/usr/bin/env node
/**
 * Validate analytics-and-searchconsole-performance-audit handoff JSON (schema v1.0).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HUB_TYPES } from "./classify-hub-type.mjs";
import { ANALYSIS_MODES } from "./build-matrix-core.mjs";
import { QUERY_INTENTS } from "./classify-query-intent.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const MODES = new Set(["full", "gsc_only", "ga4_only", "empty"]);
const QUADRANTS = new Set([
  "unicorn",
  "accidental_hub",
  "hidden_gem",
  "prune_candidate",
  "protected_review",
  "high_visibility_unvalued",
  "low_visibility_unvalued",
  "high_value_untracked",
  "low_value_untracked",
  "unclassified"
]);
const CONFIDENCE = new Set(["high", "medium", "low"]);
const HUB_TYPE_SET = new Set(HUB_TYPES);

function defaultFixtures() {
  return readdirSync(examplesDir)
    .filter((n) => n.endsWith(".handoff.fixture.json"))
    .map((n) => path.join(examplesDir, n))
    .sort();
}

function load(filePath) {
  return { filePath, data: JSON.parse(readFileSync(filePath, "utf8")) };
}

function runChecks(data) {
  const checks = [];

  checks.push({ id: "M1", pass: () => data.handoff_version === "1.0" });
  checks.push({ id: "M2", pass: () => data.skill === "analytics-and-searchconsole-performance-audit" });
  checks.push({ id: "M3", pass: () => MODES.has(data.mode) });
  checks.push({
    id: "M4",
    pass: () => typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0
  });
  checks.push({
    id: "M5",
    pass: () => Array.isArray(data.inputs?.conversion_events)
  });
  checks.push({
    id: "M6",
    pass: () =>
      data.summary &&
      typeof data.summary.total_pages === "number" &&
      typeof data.summary.quadrant_counts === "object"
  });
  checks.push({ id: "M7", pass: () => Array.isArray(data.pages) && data.pages.length >= 1 });
  checks.push({
    id: "M8",
    pass: () =>
      data.pages.every(
        (p) =>
          typeof p.url === "string" &&
          QUADRANTS.has(p.quadrant) &&
          CONFIDENCE.has(p.confidence) &&
          HUB_TYPE_SET.has(p.hub_type_hint) &&
          Array.isArray(p.flags) &&
          typeof p.recommended_review === "string"
      )
  });
  checks.push({ id: "M9", pass: () => Array.isArray(data.limitations) });
  checks.push({
    id: "M10",
    pass: () =>
      data.summary.total_pages === data.pages.length &&
      Object.values(data.summary.quadrant_counts).reduce((a, b) => a + b, 0) ===
        data.pages.length
  });
  checks.push({
    id: "M11",
    pass: () => {
      if (data.mode === "full") {
        return data.pages.every((p) => p.gsc !== null || p.ga4 !== null);
      }
      return true;
    }
  });
  checks.push({
    id: "M12",
    pass: () =>
      !data.pages.some(
        (p) => p.quadrant === "prune_candidate" && p.flags.includes("protected")
      )
  });
  checks.push({
    id: "M13",
    pass: () => ANALYSIS_MODES.has(data.inputs?.analysis_mode)
  });
  checks.push({
    id: "M14",
    pass: () => {
      if (!data.discovery) {
        return true;
      }
      const d = data.discovery;
      return (
        d.intent_split &&
        QUERY_INTENTS.every((k) => typeof d.intent_split[k]?.clicks === "number") &&
        Array.isArray(d.intended_hubs) &&
        Array.isArray(d.misalignments) &&
        Array.isArray(d.indexing_noise_urls)
      );
    }
  });
  checks.push({
    id: "M15",
    pass: () => {
      if (data.inputs?.analysis_mode !== "discovery_only") {
        return true;
      }
      return !data.pages.some((p) =>
        ["unicorn", "hidden_gem", "prune_candidate"].includes(p.quadrant)
      );
    }
  });
  checks.push({
    id: "M16",
    pass: () => {
      const intended = data.inputs?.intended_hubs || [];
      if (!data.discovery || intended.length === 0) {
        return true;
      }
      const discoveryUrls = new Set(
        (data.discovery.intended_hubs || []).map((h) => h.url)
      );
      return intended.every((url) => discoveryUrls.has(url));
    }
  });
  checks.push({
    id: "M17",
    pass: () => {
      if (!data.discovery) {
        return data.mode === "ga4_only" || data.mode === "empty";
      }
      return data.discovery.intended_hubs.every(
        (h) =>
          typeof h.url === "string" &&
          typeof h.verdict === "string" &&
          Array.isArray(h.top_queries) &&
          typeof h.gsc_clicks === "number" &&
          typeof h.gsc_impressions === "number"
      );
    }
  });

  return checks;
}

function main() {
  const files = process.argv.slice(2).length
    ? process.argv.slice(2).map((f) => path.resolve(f))
    : defaultFixtures();

  let failed = 0;

  for (const filePath of files) {
    const { data } = load(filePath);
    const checks = runChecks(data);
    const results = checks.map((c) => ({ id: c.id, ok: c.pass() }));
    const bad = results.filter((r) => !r.ok);

    if (bad.length) {
      failed++;
      console.error(`FAIL ${filePath}`);
      for (const b of bad) {
        console.error(`  ${b.id}`);
      }
    } else {
      console.log(`OK ${filePath} (${results.length} checks)`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
