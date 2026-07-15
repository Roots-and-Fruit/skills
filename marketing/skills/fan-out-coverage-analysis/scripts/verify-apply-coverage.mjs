#!/usr/bin/env node
/**
 * Regression checks for apply-coverage.mjs (C1–C8).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyCoverageToHandoff, parseRankedRows, buildGapsFromSubQueries } from "./apply-coverage.mjs";
import { computeClusterCoverage } from "./intent-clusters.mjs";

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
const clusterFixture = loadJson("cluster-coverage.handoff.fixture.json");
const seedSynonymFixture = loadJson("seed-synonym-canonical.fixture.json");
const seedSynonymApplied = applyCoverageToHandoff(
  seedSynonymFixture.handoff,
  seedSynonymFixture.ranked
);

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
  pass: () =>
    Boolean(
      applied.coverage_summary?.coverage_story?.includes("intent clusters") ||
        applied.coverage_summary?.coverage_story?.includes("Labs")
    ),
  detail: "coverage_story summarizes cluster/Labs index without repeating anchor rank"
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

checks.push({
  id: "C12",
  pass: () => clusterFixture.coverage_summary?.cluster_count === 4,
  detail: "cluster_count matches hand-computed value on cluster-coverage fixture"
});

checks.push({
  id: "C13",
  pass: () => clusterFixture.coverage_summary?.cluster_coverage_rate_pct === 50,
  detail: "cluster_coverage_rate_pct matches hand-computed value (50)"
});

checks.push({
  id: "C14",
  pass: () =>
    clusterFixture.coverage_summary?.cluster_coverage_rate_pct !==
    clusterFixture.coverage_summary?.labs_coverage_rate_pct,
  detail: "cluster rate differs from row-level Labs rate on cluster-coverage fixture"
});

checks.push({
  id: "C15",
  pass: () => {
    const gaps = clusterFixture.gaps ?? [];
    const gapCount = clusterFixture.coverage_summary?.cluster_gap_count ?? 0;
    const hasAnagramAlias = gaps.some((gap) =>
      ["software team chat", "chat software team", "team software chat"].includes(
        gap.keyword.toLowerCase()
      )
    );
    return gaps.length <= gapCount && !hasAnagramAlias;
  },
  detail: "gaps[] has no seed anagram aliases and length <= cluster_gap_count"
});

checks.push({
  id: "C16",
  pass: () => {
    const gapKeys = new Set((clusterFixture.gaps ?? []).map((row) => row.keyword.toLowerCase()));
    return (
      gapKeys.has("what is the best team chat software?") &&
      gapKeys.has("how to choose team chat software?")
    );
  },
  detail: "gaps[] includes both PAA canonical gaps"
});

checks.push({
  id: "C17",
  pass: () => {
    const gapKeys = new Set((clusterFixture.gaps ?? []).map((row) => row.keyword.toLowerCase()));
    return !gapKeys.has("team chat software") && !gapKeys.has("software team chat");
  },
  detail: "seed synonym cluster not in gaps[] when anchor rank present"
});

checks.push({
  id: "C18",
  pass: () => {
    const independent = computeClusterCoverage(clusterFixture.sub_queries, {
      anchorSerpRank: clusterFixture.serp_context?.anchor_serp_rank
    });
    return independent.cluster_coverage_rate_pct === 50 && independent.cluster_count === 4;
  },
  detail: "independent cluster math from fixture sub_queries matches 50%"
});

checks.push({
  id: "C19",
  pass: () => {
    const canonical = seedSynonymApplied.sub_queries.find((row) => row.is_canonical);
    const gapKeys = new Set((seedSynonymApplied.gaps ?? []).map((g) => g.keyword.toLowerCase()));
    return (
      canonical?.keyword?.toLowerCase() ===
        seedSynonymFixture.expected.canonical_keyword.toLowerCase() &&
      canonical?.status === "hub_serp_only" &&
      !gapKeys.has(seedSynonymFixture.expected.anagram_keyword.toLowerCase())
    );
  },
  detail: "seed_synonym canonical is covered row; anagram not in gaps[]"
});

checks.push({
  id: "C20",
  pass: () => {
    const independent = computeClusterCoverage(seedSynonymApplied.sub_queries, {
      anchorSerpRank: seedSynonymFixture.handoff.serp_context?.anchor_serp_rank
    });
    const seedRows = seedSynonymApplied.sub_queries.filter(
      (row) => row.intent_cluster_id === "seed_synonym"
    );
    const anyCovered = seedRows.some((row) =>
      ["hub", "spoke", "broken_spoke", "hub_serp_only"].includes(row.status)
    );
    return anyCovered && independent.cluster_covered_count >= 1;
  },
  detail: "seed_synonym cluster counted covered when any row covered (independent recompute)"
});

checks.push({
  id: "C21",
  pass: () => {
    const permutationHandoff = loadJson("seed-permutation-covered.handoff.fixture.json");
    const gapKeys = new Set((permutationHandoff.gaps ?? []).map((g) => g.keyword.toLowerCase()));
    return (
      !gapKeys.has("backup software example") && gapKeys.has("competitor backup plugin")
    );
  },
  detail: "gaps[] excludes covered-cluster anagram; keeps true gap"
});

checks.push({
  id: "C22",
  pass: () => {
    const summary = seedSynonymApplied.coverage_summary ?? {};
    return (
      summary.gaps_shortlist_count === (seedSynonymApplied.gaps ?? []).length &&
      summary.gaps_row_total >= summary.gaps_shortlist_count
    );
  },
  detail: "apply-coverage sets gaps_shortlist_count and gaps_row_total on handoff"
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
