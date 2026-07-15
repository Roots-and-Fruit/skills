#!/usr/bin/env node
/**
 * Intent cluster assignment checks (CL1–CL7).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignClusters, summarizeClusters, refreshClusterCanonicals } from "./intent-clusters.mjs";
import { isSeedTokenPermutation } from "./normalize-fanout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const fixture = loadJson("cluster-assign.fixture.json");
const mergeFixture = loadJson("cluster-merge.fixture.json");
const modifierFixture = loadJson("cluster-modifier-collapse.fixture.json");
const seedSynonymFixture = loadJson("seed-synonym-canonical.fixture.json");

const seed = fixture.seed;
const clustered = assignClusters(fixture.rows, seed);
const expected = fixture.expected ?? {};

const mergeClustered = assignClusters(mergeFixture.rows, mergeFixture.seed);
const mergeExpected = mergeFixture.expected ?? {};

const modifierClustered = assignClusters(modifierFixture.rows, modifierFixture.seed);
const modifierExpected = modifierFixture.expected ?? {};

const seedSynonymRows = clustered.filter((row) => row.intent_cluster_id === "seed_synonym");
const paaClusters = new Set(
  clustered.filter((row) => row.intent_cluster_id.startsWith("serp_paa:")).map((row) => row.intent_cluster_id)
);

function rowByKeyword(rows, keyword) {
  return rows.find((row) => row.keyword.toLowerCase() === keyword.toLowerCase());
}

const checks = [
  {
    id: "CL1",
    pass: () => {
      const canonical = seedSynonymRows.filter((row) => row.is_canonical);
      return seedSynonymRows.length >= 6 && canonical.length === 1;
    },
    detail: "seed permutations share one cluster with one canonical"
  },
  {
    id: "CL2",
    pass: () => paaClusters.size === (expected.paa_cluster_count ?? 2),
    detail: "each PAA is its own cluster"
  },
  {
    id: "CL3",
    pass: () => {
      const canonical = seedSynonymRows.find((row) => row.is_canonical);
      return canonical?.keyword?.toLowerCase() === expected.seed_synonym_canonical_keyword?.toLowerCase();
    },
    detail: "seed_synonym canonical prefers seed surface form when present"
  },
  {
    id: "CL4",
    pass: () => {
      const summary = summarizeClusters(clustered);
      return summary.cluster_count === (expected.cluster_count ?? 4);
    },
    detail: "summarizeClusters cluster_count matches hand-computed value"
  },
  {
    id: "CL5",
    pass: () =>
      (mergeExpected.merge_pairs ?? []).every((pair) => {
        const left = rowByKeyword(mergeClustered, pair[0]);
        const right = rowByKeyword(mergeClustered, pair[1]);
        return (
          left &&
          right &&
          left.intent_cluster_id === right.intent_cluster_id &&
          left.intent_cluster_id.startsWith("seed_adjacent:")
        );
      }),
    detail: "SERP + Labs reorderings share seed_adjacent cluster IDs"
  },
  {
    id: "CL6",
    pass: () => summarizeClusters(mergeClustered).cluster_count === (mergeExpected.cluster_count ?? 4),
    detail: "merge fixture cluster_count matches hand-computed value"
  },
  {
    id: "CL7",
    pass: () => {
      const canonical = rowByKeyword(mergeClustered, mergeExpected.serp_canonical_keyword);
      const pair = mergeExpected.merge_pairs?.[0] ?? [];
      const alias = rowByKeyword(mergeClustered, pair[1]);
      return (
        canonical?.is_canonical === true &&
        alias?.cluster_role === "alias" &&
        canonical?.intent_cluster_id === alias?.intent_cluster_id
      );
    },
    detail: "merged cluster canonical prefers serp_related row over Labs alias"
  },
  {
    id: "CL8",
    pass: () => {
      const pre = seedSynonymFixture.handoff.sub_queries.map((row) => ({
        ...row,
        status: row.keyword.toLowerCase() === seedSynonymFixture.expected.canonical_keyword
          ? "hub_serp_only"
          : "gap",
        covering_url:
          row.keyword.toLowerCase() === seedSynonymFixture.expected.canonical_keyword
            ? "https://example.com/"
            : null
      }));
      const refreshed = refreshClusterCanonicals(pre, seedSynonymFixture.seed);
      const canonical = refreshed.find((row) => row.is_canonical);
      return (
        canonical?.keyword?.toLowerCase() ===
          seedSynonymFixture.expected.canonical_keyword.toLowerCase() &&
        canonical?.status === "hub_serp_only"
      );
    },
    detail: "refreshClusterCanonicals picks covered row as seed_synonym canonical"
  },
  {
    id: "CL9",
    pass: () =>
      (modifierExpected.merge_groups ?? []).every((group) => {
        const ids = new Set(
          group.map((keyword) => rowByKeyword(modifierClustered, keyword)?.intent_cluster_id)
        );
        return ids.size === 1 && [...ids][0]?.startsWith("seed_adjacent:");
      }),
    detail: "modifier variants share parent seed_adjacent cluster IDs"
  },
  {
    id: "CL10",
    pass: () =>
      summarizeClusters(modifierClustered).cluster_count === (modifierExpected.cluster_count ?? 4),
    detail: "modifier fixture cluster_count matches hand-computed value (4)"
  },
  {
    id: "CL11",
    pass: () =>
      (mergeExpected.merge_pairs ?? []).every((pair) => {
        const left = rowByKeyword(mergeClustered, pair[0]);
        const right = rowByKeyword(mergeClustered, pair[1]);
        return left && right && left.intent_cluster_id === right.intent_cluster_id;
      }),
    detail: "cluster-merge regression unchanged after modifier collapse"
  },
  {
    id: "CL12",
    pass: () => {
      const numericRows = assignClusters(
        [
          {
            keyword: "type 1 diabetes",
            sources: ["related"],
            search_volume: 165000,
            on_seed_serp: true
          },
          {
            keyword: "type 2 diabetes",
            sources: ["related"],
            search_volume: 201000
          }
        ],
        "type 2 diabetes"
      );
      const typeOne = rowByKeyword(numericRows, "type 1 diabetes");
      return (
        !isSeedTokenPermutation("type 1 diabetes", "type 2 diabetes") &&
        typeOne?.intent_cluster_id !== "seed_synonym"
      );
    },
    detail: "numeric token delta (type 1 vs type 2) is not a seed_synonym permutation"
  },
  {
    id: "CL13",
    pass: () => {
      const rows = assignClusters(
        [
          {
            keyword: "example widgets reddit",
            sources: ["serp_related"],
            search_volume: 100,
            on_seed_serp: true
          }
        ],
        "example widgets"
      );
      const id = rows[0]?.intent_cluster_id ?? "";
      return id === "seed_adjacent:modifier_only" && !id.endsWith(":");
    },
    detail: "reddit-only modifier maps to seed_adjacent:modifier_only not empty slug"
  }
];

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

console.log("\nAll CL1–CL13 intent-cluster checks passed.");
