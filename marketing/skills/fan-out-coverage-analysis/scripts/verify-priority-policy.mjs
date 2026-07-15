#!/usr/bin/env node
/**
 * No-PAA priority policy checks (PR1–PR3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignClusters } from "./intent-clusters.mjs";
import { assignPriority, buildPrioritySubQueries } from "./apply-priority.mjs";
import { normalizeFanoutItems } from "./normalize-fanout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

(async () => {
const fixture = loadJson("no-paa-priority.fixture.json");
const careerFixture = loadJson("career-paa-priority.fixture.json");
const clustered = assignClusters(fixture.rows, fixture.seed);
const enriched = clustered.map((row) => ({
  ...row,
  priority: assignPriority(row, fixture.intent_split, fixture.intent_lane, fixture.seed)
}));
const priority = buildPrioritySubQueries(enriched, {
  seed: fixture.seed,
  intentLane: fixture.intent_lane
});

const expectedOrder = fixture.expected.priority_order ?? [];
const priorityKeywords = priority.map((row) => row.keyword.toLowerCase());

const careerClustered = assignClusters(careerFixture.rows, careerFixture.seed);
const careerEnriched = careerClustered.map((row) => ({
  ...row,
  priority: assignPriority(
    row,
    careerFixture.intent_split,
    careerFixture.intent_lane,
    careerFixture.seed
  )
}));
const careerPriority = buildPrioritySubQueries(careerEnriched, {
  seed: careerFixture.seed,
  intentLane: careerFixture.intent_lane
});
const careerKeywords = careerPriority.map((row) => row.keyword.toLowerCase());
const careerExpected = careerFixture.expected.priority_order ?? [];

const competitorIdx = priorityKeywords.indexOf("competitor cms plugin");
const themeIdx = priorityKeywords.indexOf("example cms theme free");

const checks = [
  {
    id: "PR1",
    pass: () => priority[0]?.relevance_tier === "serp_native",
    detail: "no PAA — first priority row is serp_native"
  },
  {
    id: "PR2",
    pass: () => competitorIdx >= 0 && themeIdx >= 0 && competitorIdx < themeIdx,
    detail: "competitor gap ranks before theme noise"
  },
  {
    id: "PR3",
    pass: () =>
      expectedOrder.every(
        (keyword, index) => priorityKeywords[index] === keyword.toLowerCase()
      ),
    detail: "priority order matches hand-computed expected.priority_order"
  },
  {
    id: "PR4",
    pass: () => {
      const salaryIdx = careerKeywords.indexOf("what is a pmp salary?");
      const constructionIdx = careerKeywords.indexOf(
        "best project management software for construction"
      );
      return (
        salaryIdx >= 0 &&
        constructionIdx >= 0 &&
        constructionIdx < salaryIdx &&
        careerExpected.every(
          (keyword, index) => careerKeywords[index] === keyword.toLowerCase()
        )
      );
    },
    detail: "career methodology PAA ranks after commercial related searches"
  }
];

const healthFixture = loadJson("health-paa-demote.fixture.json");
const hustleFixture = loadJson("hustle-paa-demote.fixture.json");
const marketplaceFixture = loadJson("marketplace-competitor-priority.fixture.json");

const hustleClustered = assignClusters(hustleFixture.rows, hustleFixture.seed);
const hustleEnriched = hustleClustered.map((row) => ({
  ...row,
  priority: assignPriority(
    row,
    hustleFixture.intent_split,
    hustleFixture.intent_lane,
    hustleFixture.seed
  )
}));
const hustlePriority = buildPrioritySubQueries(hustleEnriched, {
  seed: hustleFixture.seed,
  intentLane: hustleFixture.intent_lane
});
const hustleKeywords = hustlePriority.map((row) => row.keyword.toLowerCase());
const hustleExpected = hustleFixture.expected.priority_order ?? [];

const marketplaceClustered = assignClusters(marketplaceFixture.rows, marketplaceFixture.seed);
const marketplaceEnriched = marketplaceClustered.map((row) => ({
  ...row,
  priority: assignPriority(
    row,
    marketplaceFixture.intent_split,
    marketplaceFixture.intent_lane,
    marketplaceFixture.seed
  )
}));
const marketplacePriority = buildPrioritySubQueries(marketplaceEnriched, {
  seed: marketplaceFixture.seed,
  intentLane: marketplaceFixture.intent_lane,
  serpContext: marketplaceFixture.serp_context ?? {}
});
const marketplaceKeywords = marketplacePriority.map((row) => row.keyword.toLowerCase());

checks.push(
  {
    id: "PR5",
    pass: async () => {
      const normalized = await normalizeFanoutItems(
        healthFixture.items,
        healthFixture.seed,
        healthFixture.intent_lane,
        healthFixture.intent_split
      );
      const map = new Map(normalized.map((row) => [row.keyword.toLowerCase(), row]));
      return (
        !map.has(healthFixture.expected.rejected_keywords[0].toLowerCase()) &&
        map.has(healthFixture.expected.accepted_paa[0].toLowerCase())
      );
    },
    detail: "health-adjacent PAA rejected for primary_topic recipe seed"
  },
  {
    id: "PR6",
    pass: () => {
      const commercialIdx = hustleKeywords.indexOf("best example dropshipping suppliers");
      const hustleIdx = hustleKeywords.indexOf(
        "is $1000 enough to start example dropshipping?"
      );
      return (
        commercialIdx >= 0 &&
        hustleIdx >= 0 &&
        commercialIdx < hustleIdx
      );
    },
    detail: "hustle PAAs rank after commercial related on tool_discovery"
  },
  {
    id: "PR7",
    pass: () => {
      const marketIdx = marketplaceKeywords.indexOf("best example templates marketplace");
      const paaIdx = marketplaceKeywords.indexOf("what is an example template used for?");
      return marketIdx >= 0 && paaIdx >= 0 && marketIdx < paaIdx;
    },
    detail: "marketplace listicle ranks before PAA when competitor domains on SERP"
  }
);

let failed = 0;
for (const check of checks) {
  const pass = await Promise.resolve(check.pass());
  console.log(`${pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll PR1–PR7 priority policy checks passed.");
})();

