#!/usr/bin/env node
/**
 * Regenerate example-saas.handoff.fixture.json from sample CSVs.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPerformanceMatrix,
  loadCsvFile,
  parseGscQueriesCsv,
  parseGscQueryRows,
  parseGa4LandingCsv
} from "./build-matrix-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examples = path.join(root, "examples");

const domain = "example.com";
const conversionEvents = ["demo_request", "newsletter_signup"];
const intendedHubs = [
  "https://example.com/",
  "https://example.com/features/analytics",
  "https://example.com/pricing"
];
const protectedPages = ["https://example.com/about/security"];

const gscCsv = loadCsvFile(path.join(examples, "sample-gsc-queries.csv"));
const gscPages = parseGscQueriesCsv(gscCsv, domain);
const gscRows = parseGscQueryRows(gscCsv, domain);
const ga4Pages = parseGa4LandingCsv(
  loadCsvFile(path.join(examples, "sample-ga4-landing-pages.csv")),
  domain,
  conversionEvents
);

const handoff = buildPerformanceMatrix({
  domain,
  gscPages,
  gscRows,
  ga4Pages,
  conversionEvents,
  intendedHubs,
  protectedPages,
  dateRange: "2025-12-01/2026-05-31",
  analysisMode: "discovery_plus_conversions"
});

handoff.generated_at = "2026-06-26T12:00:00.000Z";

const outPath = path.join(examples, "example-saas.handoff.fixture.json");
writeFileSync(outPath, JSON.stringify(handoff, null, 2) + "\n", "utf8");
console.log(`Wrote ${outPath}`);
