#!/usr/bin/env node
/**
 * Regression checks for apply-coverage.mjs (C1–C8).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCoverageToHandoff, parseRankedRows, buildGapsFromSubQueries } from "./apply-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const partial = loadJson("enterprise-sso-partial.handoff.sample.json");
const ranked = loadJson("ranked-example-com.fixture.json");
const golden = loadJson("enterprise-sso-domain.handoff.fixture.json");
const applied = applyCoverageToHandoff(partial, ranked);
const brandedPartial = loadJson("branded-hub-serp-partial.handoff.sample.json");
const brandedApplied = applyCoverageToHandoff(brandedPartial, { items: [] });

function row(keyword) {
  return applied.sub_queries.find((item) => item.keyword.toLowerCase() === keyword.toLowerCase());
}

const checks = [];

checks.push({
  id: "C1",
  pass: () => parseRankedRows(ranked).length === 1,
  detail: "ranked fixture parses flat items shape"
});

checks.push({
  id: "C2",
  pass: () => row("sso providers")?.status === "hub",
  detail: "ranked keyword on anchor URL becomes hub"
});

checks.push({
  id: "C3",
  pass: () => row("sso vs oauth")?.status === "gap",
  detail: "missing ranked row becomes gap"
});

checks.push({
  id: "C4",
  pass: () => applied.coverage_summary?.labs_coverage_rate_pct === 50,
  detail: "labs_coverage_rate_pct computed from sub_queries"
});

checks.push({
  id: "C5",
  pass: () => applied.gaps?.length === 1 && applied.gaps[0].keyword === "sso vs oauth",
  detail: "gaps[] rebuilt from gap status rows"
});

checks.push({
  id: "C6",
  pass: () =>
    applied.hub_spoke_map?.length === 1 &&
    applied.hub_spoke_map[0].keywords_served.includes("sso providers"),
  detail: "hub_spoke_map populated for covered URLs"
});

checks.push({
  id: "C7",
  pass: () => Boolean(applied.coverage_summary?.coverage_story?.includes("Anchor ranks #4")),
  detail: "coverage_story mentions live anchor rank when Labs % is low"
});

checks.push({
  id: "C8",
  pass: () => {
    const providers = row("sso providers");
    const goldenProviders = golden.sub_queries.find(
      (item) => item.keyword.toLowerCase() === "sso providers"
    );
    return (
      providers?.status === goldenProviders?.status &&
      providers?.covering_url === goldenProviders?.covering_url &&
      providers?.rank_group === goldenProviders?.rank_group
    );
  },
  detail: "apply-coverage output matches enterprise-sso golden hub row"
});

checks.push({
  id: "C9",
  pass: () => {
    const rows = [
      { status: "gap", priority: "medium", relevance_tier: "serp_native", keyword: "a" },
      { status: "gap", priority: "high", relevance_tier: "core", keyword: "b" }
    ];
    const gaps = buildGapsFromSubQueries(rows);
    return gaps[0]?.priority === "high";
  },
  detail: "buildGapsFromSubQueries sorts high before medium"
});

checks.push({
  id: "C10",
  pass: () => {
    const branded = brandedApplied.sub_queries.find(
      (row) => row.keyword.toLowerCase() === "wordpress product go to market strategy"
    );
    const generic = brandedApplied.sub_queries.find(
      (row) => row.keyword.toLowerCase() === "go-to-market strategy example"
    );
    return branded?.status === "hub_serp_only" && generic?.status === "gap";
  },
  detail: "branded on_seed_serp related → hub_serp_only; generic related stays gap"
});

checks.push({
  id: "C11",
  pass: () =>
    brandedApplied.gaps[0]?.keyword?.toLowerCase() === "how to market a wordpress plugin",
  detail: "gaps[] shortlist leads with high-priority row"
});

let failed = 0;
for (const check of checks) {
  const pass = check.pass();
  console.log(`${pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} apply-coverage checks passed.`);
