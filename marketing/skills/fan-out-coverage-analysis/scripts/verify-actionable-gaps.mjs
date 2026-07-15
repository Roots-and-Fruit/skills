#!/usr/bin/env node
/**
 * Actionable gap selection checks (AG1–AG3).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildActionableGaps,
  buildWriteNextGaps,
  coreVariantPermutationRows,
  isActionableFanoutRow
} from "./actionable-gaps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const coveredFixture = loadJson("seed-permutation-covered.handoff.fixture.json");
const actionableFixture = loadJson("layperson-actionable-gaps.handoff.fixture.json");
const partialToolFixture = loadJson("partial-coverage-tool-write-next.fixture.json");
const seed = coveredFixture.inputs.primary_keyword;

const actionable = buildActionableGaps(coveredFixture);
const permutations = coreVariantPermutationRows(coveredFixture);

const anagram = "backup software example";
const competitor = "competitor backup plugin";

const checks = [
  {
    id: "AG1",
    pass: () =>
      !actionable.some((row) => row.keyword.toLowerCase() === anagram) &&
      !isActionableFanoutRow(
        coveredFixture.sub_queries.find((r) => r.keyword.toLowerCase() === anagram),
        seed,
        coveredFixture
      ),
    detail: "covered-cluster seed permutation not actionable"
  },
  {
    id: "AG2",
    pass: () => {
      const uncovered = actionableFixture.sub_queries.find(
        (r) => r.keyword.toLowerCase() === "chat software for team"
      );
      return !isActionableFanoutRow(uncovered, actionableFixture.inputs.primary_keyword, actionableFixture);
    },
    detail: "uncovered suggestion permutation still not actionable"
  },
  {
    id: "AG3",
    pass: () => {
      const gapActionable = actionable.filter(
        (row) => row.status === "gap" || row.status === "broken_spoke"
      );
      const handComputed = 1;
      return (
        gapActionable.length === handComputed &&
        gapActionable[0]?.keyword?.toLowerCase() === competitor &&
        permutations.some((row) => row.keyword.toLowerCase() === anagram)
      );
    },
    detail: "independent actionable gap count matches hand-computed value (1)"
  },
  {
    id: "AG4",
    pass: () => {
      const writeNext = buildWriteNextGaps(partialToolFixture, 6).map((row) =>
        row.keyword.toLowerCase()
      );
      const commercialIdx = writeNext.indexOf("example dropshipping suppliers free");
      const hustleIdx = writeNext.indexOf(
        "is $1000 enough to start example dropshipping?"
      );
      return commercialIdx >= 0 && hustleIdx >= 0 && commercialIdx < hustleIdx;
    },
    detail: "partial tool_discovery write-next ranks commercial related before hustle PAA"
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

console.log("\nAll AG1–AG4 actionable-gap checks passed.");
