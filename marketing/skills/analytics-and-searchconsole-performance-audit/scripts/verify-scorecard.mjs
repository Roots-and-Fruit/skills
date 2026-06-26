#!/usr/bin/env node
/**
 * Regression scorecard S1–S9 + R1–R6 on golden sample CSVs.
 *
 * Usage (from analytics-and-searchconsole-performance-audit/):
 *   node scripts/verify-scorecard.mjs
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const buildScript = path.join(__dirname, "build-matrix.mjs");
const gsc = path.join(root, "examples", "sample-gsc-queries.csv");
const ga4 = path.join(root, "examples", "sample-ga4-landing-pages.csv");

const intended = [
  "https://example.com/",
  "https://example.com/features/analytics",
  "https://example.com/pricing"
].join(",");
const protectedPages = "https://example.com/about/security";

function runMatrix() {
  const raw = execFileSync(
    process.execPath,
    [
      buildScript,
      "--domain",
      "example.com",
      "--gsc",
      gsc,
      "--ga4",
      ga4,
      "--analysis-mode",
      "discovery_plus_conversions",
      "--conversions",
      "demo_request,newsletter_signup",
      "--intended",
      intended,
      "--protected",
      protectedPages,
      "--date-range",
      "2025-12-01/2026-05-31"
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(raw);
}

function runDiscoveryOnlyMatrix() {
  const raw = execFileSync(
    process.execPath,
    [
      buildScript,
      "--domain",
      "example.com",
      "--gsc",
      gsc,
      "--ga4",
      ga4,
      "--analysis-mode",
      "discovery_only",
      "--intended",
      intended,
      "--date-range",
      "2025-12-01/2026-05-31"
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(raw);
}

function pageByPath(handoff, pathname) {
  return handoff.pages.find((p) => new URL(p.url).pathname === pathname);
}

function runGa4OnlyMatrix() {
  const raw = execFileSync(
    process.execPath,
    [
      buildScript,
      "--domain",
      "example.com",
      "--ga4",
      ga4,
      "--conversions",
      "demo_request,newsletter_signup",
      "--intended",
      intended,
      "--date-range",
      "2025-12-01/2026-05-31"
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(raw);
}

function main() {
  const handoff = runMatrix();
  const ga4Only = runGa4OnlyMatrix();
  const discoveryOnly = runDiscoveryOnlyMatrix();
  const checks = [];

  const sso = pageByPath(handoff, "/blog/how-to-configure-sso");
  const analytics = pageByPath(handoff, "/features/analytics");
  const pricing = pageByPath(handoff, "/pricing");
  const security = pageByPath(handoff, "/about/security");
  const legacy = pageByPath(handoff, "/blog/legacy-feature-announcement");
  const home = pageByPath(handoff, "/");

  checks.push({
    id: "S1",
    pass: () => sso?.quadrant === "accidental_hub"
  });
  checks.push({
    id: "S2",
    pass: () => analytics?.quadrant === "unicorn"
  });
  checks.push({
    id: "S3",
    pass: () => home?.quadrant === "unicorn"
  });
  checks.push({
    id: "S4",
    pass: () =>
      pricing?.quadrant === "hidden_gem" &&
      pricing?.flags.includes("intended_hub") &&
      pricing?.flags.includes("building_toward_intent")
  });
  checks.push({
    id: "S5",
    pass: () =>
      security?.quadrant === "protected_review" &&
      security?.flags.includes("protected")
  });
  checks.push({
    id: "S6",
    pass: () => legacy?.quadrant === "prune_candidate"
  });
  checks.push({
    id: "S7",
    pass: () => handoff.mode === "full"
  });
  checks.push({
    id: "S8",
    pass: () =>
      handoff.summary.quadrant_counts.accidental_hub === 1 &&
      handoff.summary.quadrant_counts.unicorn === 2 &&
      handoff.summary.quadrant_counts.hidden_gem === 2 &&
      handoff.summary.quadrant_counts.protected_review === 1 &&
      handoff.summary.quadrant_counts.prune_candidate === 2
  });
  checks.push({
    id: "S9",
    pass: () =>
      ga4Only.mode === "ga4_only" &&
      !ga4Only.pages.some((p) =>
        p.flags.includes("converts_without_search_clicks")
      ) &&
      ga4Only.limitations.some((l) => /GSC/i.test(l))
  });
  checks.push({
    id: "D1",
    pass: () =>
      handoff.discovery &&
      handoff.discovery.intent_split &&
      typeof handoff.discovery.intent_split.commercial === "object"
  });
  checks.push({
    id: "D2",
    pass: () => {
      const pricing = handoff.discovery?.intended_hubs?.find((h) =>
        h.url.endsWith("/pricing")
      );
      return pricing && ["discovering", "brand_only", "misaligned"].includes(pricing.verdict);
    }
  });
  checks.push({
    id: "D3",
    pass: () => handoff.inputs.analysis_mode === "discovery_plus_conversions"
  });
  checks.push({
    id: "D4",
    pass: () =>
      discoveryOnly.inputs.analysis_mode === "discovery_only" &&
      !discoveryOnly.pages.some((p) =>
        ["unicorn", "hidden_gem", "prune_candidate"].includes(p.quadrant)
      )
  });
  checks.push({
    id: "D5",
    pass: () => {
      const intendedUrls = discoveryOnly.inputs.intended_hubs || [];
      const discoveryUrls = new Set(
        (discoveryOnly.discovery?.intended_hubs || []).map((h) => h.url)
      );
      return intendedUrls.every((url) => discoveryUrls.has(url));
    }
  });

  checks.push({
    id: "R1",
    pass: () =>
      handoff.pages
        .filter((p) => p.quadrant === "accidental_hub")
        .every(
          (p) =>
            p.visibility_score !== null &&
            p.value_score !== null &&
            p.visibility_score > p.value_score
        )
  });
  checks.push({
    id: "R2",
    pass: () =>
      handoff.pages
        .filter((p) => p.quadrant === "hidden_gem" && p.gsc !== null)
        .every((p) => p.value_score > p.visibility_score)
  });
  checks.push({
    id: "R3",
    pass: () =>
      handoff.pages
        .filter((p) => p.quadrant === "unicorn")
        .every(
          (p) =>
            (p.visibility_score ?? 0) >= 0.5 && (p.value_score ?? 0) >= 0.5
        )
  });
  checks.push({
    id: "R4",
    pass: () =>
      handoff.pages
        .filter((p) => p.quadrant === "protected_review")
        .every((p) => p.flags.includes("protected"))
  });
  checks.push({
    id: "R5",
    pass: () =>
      !handoff.pages.some(
        (p) => p.quadrant === "prune_candidate" && p.flags.includes("protected")
      )
  });
  checks.push({
    id: "R6",
    pass: () =>
      sso?.flags.includes("low_ctr_high_impressions") &&
      (sso?.gsc?.impressions ?? 0) > 50000
  });

  let failed = 0;
  for (const check of checks) {
    if (check.pass()) {
      console.log(`PASS ${check.id}`);
    } else {
      failed++;
      console.error(`FAIL ${check.id}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
