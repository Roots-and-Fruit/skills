#!/usr/bin/env node
/**
 * PAA unconditional ingest checks (PA1–PA3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFanoutItems } from "./normalize-fanout.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

  const paaFixture = loadJson("paa-low-overlap.fixture.json");
  const mergedFixture = loadJson("merged-keywords.fixture.json");
  const healthFixture = loadJson("health-paa-demote.fixture.json");
  const mixedFreeItems = loadJson("mixed-serp-free-modifier.items.json");
  const seed = paaFixture.seed ?? "team chat software";

  async function runChecks() {
  const paaNormalized = await normalizeFanoutItems(paaFixture.items, seed);
  const mergedNormalized = await normalizeFanoutItems(mergedFixture.items, "wordpress plugin marketing");
  const healthNormalized = await normalizeFanoutItems(
    healthFixture.items,
    healthFixture.seed,
    healthFixture.intent_lane,
    healthFixture.intent_split
  );
  const mixedFreeNormalized = await normalizeFanoutItems(
    mixedFreeItems.items,
    mixedFreeItems.seed,
    mixedFreeItems.intent_lane,
    mixedFreeItems.intent_split
  );

  const byKw = (rows) => new Map(rows.map((row) => [row.keyword.toLowerCase(), row]));

  const paaMap = byKw(paaNormalized);

  const checks = [
    {
      id: "PA1",
      pass: () => {
        const a = paaMap.get("what is the difference between producta and productb?");
        const b = paaMap.get("how much does the starter plan cost?");
        return (
          a?.dimension === "question" &&
          a.sources?.includes("serp_paa") &&
          b?.dimension === "question" &&
          b.sources?.includes("serp_paa")
        );
      },
      detail: "low-overlap PAAs survive normalize"
    },
    {
      id: "PA2",
      pass: () => !paaMap.has("is team chat software outdated in 2026"),
      detail: "platform-meta PAA still rejected"
    },
    {
      id: "PA3",
      pass: () => !byKw(mergedNormalized).has("mailpoet"),
      detail: "zero-overlap brand still excluded on merged-keywords fixture"
    },
    {
      id: "PA7",
      pass: () => {
        const healthMap = new Map(healthNormalized.map((row) => [row.keyword.toLowerCase(), row]));
        return (
          !healthMap.has(healthFixture.expected.rejected_keywords[0].toLowerCase()) &&
          healthMap.has(healthFixture.expected.accepted_paa[0].toLowerCase())
        );
      },
      detail: "health-adjacent PAA rejected at normalize gate for recipe lane"
    },
    {
      id: "PA8",
      pass: () => {
        const freeRow = mixedFreeNormalized.find((row) =>
          row.keyword.toLowerCase().includes("free")
        );
        return freeRow?.relevance_tier === mixedFreeItems.expected.free_row_tier;
      },
      detail: "commercial free modifier is facet_drift on mixed SERP"
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

  console.log("\nAll PA1–PA8 PAA gate checks passed.");
}

runChecks().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
