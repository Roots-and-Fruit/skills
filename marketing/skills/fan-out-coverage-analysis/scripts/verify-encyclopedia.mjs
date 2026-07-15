#!/usr/bin/env node
/**
 * Encyclopedia site_profile checks (EP1–EP5).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyCoverageToHandoff,
  isEncyclopediaProfile
} from "./apply-coverage.mjs";
import { buildLaypersonSummaryMarkdown } from "./build-layperson-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = path.join(__dirname, "..", "examples");

function loadJson(name) {
  return JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
}

const encyclopediaHandoff = loadJson("encyclopedia-sibling-spoke.fixture.json");

const encyclopediaPartial = {
  ...encyclopediaHandoff,
  sub_queries: encyclopediaHandoff.sub_queries.map((row) => ({
    ...row,
    status: "gap",
    covering_url: null,
    rank_group: null
  }))
};

const encyclopediaRanked = {
  items: [
    {
      keyword: "Why did they execute Example Figure?",
      url: "https://example.com/wiki/Example_Figure",
      rank_group: 1
    },
    {
      keyword: "example revolution timeline",
      url: "https://example.com/wiki/Example_Revolution_timeline",
      rank_group: 2
    },
    {
      keyword: "example revolution",
      url: "https://example.com/wiki/Example_Revolution",
      rank_group: 1
    }
  ]
};

const applied = applyCoverageToHandoff(encyclopediaPartial, encyclopediaRanked);
const paaRow = applied.sub_queries.find((row) =>
  /execute example figure/i.test(row.keyword ?? "")
);
const timelineRow = applied.sub_queries.find((row) =>
  /timeline/i.test(row.keyword ?? "")
);

const layperson = buildLaypersonSummaryMarkdown(encyclopediaHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-encyclopedia-detail.md"
});

const checks = [
  {
    id: "EP1",
    pass: () => isEncyclopediaProfile(encyclopediaHandoff),
    detail: "site_profile encyclopedia detected on fixture handoff"
  },
  {
    id: "EP2",
    pass: () => paaRow?.status === "spoke" && Boolean(paaRow?.covering_url),
    detail: "PAA gap reconciled to spoke when sibling article ranks"
  },
  {
    id: "EP3",
    pass: () => timelineRow?.status !== "hub_serp_only",
    detail: "year/timeline sibling not hub_serp_only on encyclopedia profile"
  },
  {
    id: "EP4",
    pass: () =>
      /strengthen|link existing|sibling/i.test(layperson) &&
      !layperson.match(/intent clusters need content/i),
    detail: "layperson verdict uses encyclopedia strengthen/link framing"
  },
  {
    id: "EP5",
    pass: () =>
      (applied.limitations ?? []).some((line) => /encyclopedia/i.test(line)) ||
      (encyclopediaHandoff.limitations ?? []).some((line) => /encyclopedia/i.test(line)),
    detail: "encyclopedia limitation note present on handoff"
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

console.log("\nAll EP1–EP5 encyclopedia checks passed.");
