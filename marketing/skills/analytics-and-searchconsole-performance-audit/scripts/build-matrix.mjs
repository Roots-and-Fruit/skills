#!/usr/bin/env node
/**
 * Build analytics-and-searchconsole performance audit handoff from GSC + GA4 CSV exports.
 *
 * Usage (from analytics-and-searchconsole-performance-audit/):
 *   node scripts/build-matrix.mjs \
 *     --domain example.com \
 *     --gsc examples/sample-gsc-queries.csv \
 *     --ga4 examples/sample-ga4-landing-pages.csv \
 *     --conversions demo_request,newsletter_signup
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

function parseArgs(argv) {
  const opts = {
    domain: null,
    gsc: null,
    ga4: null,
    conversions: [],
    intended: [],
    protected: [],
    dateRange: null,
    out: null,
    analysisMode: "discovery_plus_conversions"
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case "--domain":
        opts.domain = next;
        i++;
        break;
      case "--gsc":
        opts.gsc = next;
        i++;
        break;
      case "--ga4":
        opts.ga4 = next;
        i++;
        break;
      case "--conversions":
        opts.conversions = next.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "--intended":
        opts.intended = next.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "--protected":
        opts.protected = next.split(",").map((s) => s.trim()).filter(Boolean);
        i++;
        break;
      case "--date-range":
        opts.dateRange = next;
        i++;
        break;
      case "--out":
        opts.out = next;
        i++;
        break;
      case "--analysis-mode":
        opts.analysisMode = next;
        i++;
        break;
      default:
        break;
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv);

  if (!opts.domain) {
    console.error("Missing required --domain");
    process.exit(1);
  }

  const gscText = opts.gsc ? loadCsvFile(path.resolve(opts.gsc)) : null;
  const gscPages = gscText ? parseGscQueriesCsv(gscText, opts.domain) : [];
  const gscRows = gscText ? parseGscQueryRows(gscText, opts.domain) : [];
  const ga4Pages = opts.ga4
    ? parseGa4LandingCsv(
        loadCsvFile(path.resolve(opts.ga4)),
        opts.domain,
        opts.conversions
      )
    : [];

  const handoff = buildPerformanceMatrix({
    domain: opts.domain,
    gscPages,
    gscRows,
    ga4Pages,
    conversionEvents: opts.conversions,
    intendedHubs: opts.intended,
    protectedPages: opts.protected,
    dateRange: opts.dateRange,
    analysisMode: opts.analysisMode
  });

  const json = JSON.stringify(handoff, null, 2);
  if (opts.out) {
    writeFileSync(path.resolve(opts.out), json, "utf8");
    console.error(`Wrote ${opts.out}`);
  } else {
    console.log(json);
  }
}

main();
