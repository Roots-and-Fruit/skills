#!/usr/bin/env node
/**
 * Detail report contract checks (DR1–DR6).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDetailReportMarkdown,
  deriveSerpFanoutFromSubQueries,
  syncSerpContextFanout
} from "./detail-report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const clusterFixture = loadJson("cluster-coverage.handoff.fixture.json");
const permutationFixture = loadJson("seed-permutation-covered.handoff.fixture.json");
const hubPathFixture = loadJson("hub-path-layperson.handoff.fixture.json");
const staleHandoff = {
  ...clusterFixture,
  serp_context: {
    ...clusterFixture.serp_context,
    people_also_ask: clusterFixture.serp_context.people_also_ask.slice(0, 1)
  }
};
const synced = syncSerpContextFanout(staleHandoff);
const ingested = deriveSerpFanoutFromSubQueries(clusterFixture.sub_queries);
const detail = buildDetailReportMarkdown(clusterFixture);
const permutationDetail = buildDetailReportMarkdown(permutationFixture);
const hubPathDetail = buildDetailReportMarkdown(hubPathFixture);

const paaInSubQueries = clusterFixture.sub_queries.filter((row) =>
  (row.source ?? []).includes("serp_paa")
).length;

const checks = [
  {
    id: "DR1",
    pass: () => synced.serp_context.people_also_ask.length === paaInSubQueries,
    detail: "syncSerpContextFanout aligns PAA list with ingested sub_queries"
  },
  {
    id: "DR2",
    pass: () => detail.includes("## SERP fan-out ingested (SSOT)"),
    detail: "detail report leads with ingested fan-out section"
  },
  {
    id: "DR3",
    pass: () =>
      detail.includes(`### People Also Ask (${ingested.people_also_ask.length})`) &&
      ingested.people_also_ask.length === paaInSubQueries,
    detail: "PAA subsection count matches sub_queries"
  },
  {
    id: "DR4",
    pass: () => detail.includes("| Cluster |") && detail.includes("| Intent |"),
    detail: "sub-query table includes Cluster and Intent columns"
  },
  {
    id: "DR5",
    pass: () => detail.includes("## Intent clusters") && detail.includes("## Weak coverage"),
    detail: "cluster rollup and weak coverage sections present for domain mode"
  },
  {
    id: "DR6",
    pass: () => detail.includes("## Hub / spoke map") && detail.includes("## Live SERP metadata"),
    detail: "hub/spoke map and live metadata sections present"
  },
  {
    id: "DR7",
    pass: () => {
      const clusterSection = permutationDetail.split("## Sub-queries")[0] ?? "";
      return (
        clusterSection.includes("seed_synonym") &&
        /\|\s*seed_synonym\s*\|[^|]+\|\s*weak\s*\|/i.test(clusterSection) &&
        !/\|\s*seed_synonym\s*\|[^|]+\|\s*gap\s*\|/i.test(clusterSection)
      );
    },
    detail: "seed_synonym cluster rollup shows weak/covered, not canonical gap status"
  },
  {
    id: "DR8",
    pass: () => {
      const weakSection = hubPathDetail.split("## Weak coverage")[1]?.split("##")[0] ?? "";
      return weakSection.includes("Hub URL ranks") && !/Homepage ranks/i.test(weakSection);
    },
    detail: "hub-path anchor uses Hub URL phrasing in weak coverage intro"
  },
  {
    id: "DR9",
    pass: () => detail.includes("## Gaps (shortlist") && detail.includes("cluster gaps)"),
    detail: "detail gaps section labels shortlist vs row and cluster totals"
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

console.log("\nAll DR1–DR9 detail report checks passed.");
