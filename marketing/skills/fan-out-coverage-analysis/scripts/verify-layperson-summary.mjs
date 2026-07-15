#!/usr/bin/env node
/**
 * Verify layperson summary builder (LP1–LP13).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLaypersonSummaryMarkdown,
  buildWorkingList,
  writeFanoutReports
} from "./build-layperson-summary.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const fixture = path.join(root, "examples", "wordpress-plugin-marketing-v2.3.handoff.fixture.json");
const actionableFixture = path.join(
  root,
  "examples",
  "layperson-actionable-gaps.handoff.fixture.json"
);

let passed = 0;
let failed = 0;

function ok(id, cond, detail = "") {
  if (cond) {
    passed += 1;
    console.log(`PASS ${id}`);
  } else {
    failed += 1;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ""}`);
  }
}

const handoff = JSON.parse(readFileSync(fixture, "utf8"));
const summary = buildLaypersonSummaryMarkdown(handoff, {
  detailRelativePath: "reports/example.com-2026-07-07-detail.md"
});

ok("LP1", summary.includes("## Verdict"));
ok("LP2", summary.includes("## What's working"));
ok("LP3", summary.includes("## What to write next"));
ok("LP4", !summary.includes('"handoff_version"'));
ok("LP5", !summary.includes("| Tier |"));
ok("LP6", summary.includes("## What still needs attention"));

const working = buildWorkingList(handoff);
ok("LP7", working.length >= 1);

const { summaryMarkdown, detailPath } = writeFanoutReports(handoff, {
  outputDir: path.join(root, "reports", ".verify-layperson-tmp")
});
const detail = readFileSync(detailPath, "utf8");
ok("LP8", detail.includes("## Handoff JSON"));
ok("LP9", detail.includes("## Sub-queries (coverage map)"));
ok("LP10", summaryMarkdown.includes("Technical details"));

const actionableHandoff = JSON.parse(readFileSync(actionableFixture, "utf8"));
const actionableSummary = buildLaypersonSummaryMarkdown(actionableHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-detail.md"
});

ok(
  "LP11",
  actionableSummary.includes("people ask this directly on Google"),
  "PAA-shaped actions when PAA fan-out gaps exist"
);
const attentionBlock =
  actionableSummary.split("## What still needs attention")[1]?.split("_Not priority")[0] ?? "";
ok(
  "LP12",
  !attentionBlock.includes("chat software for team"),
  "seed token permutations excluded from attention section"
);
ok(
  "LP13",
  actionableSummary.includes("word-order variants"),
  "permutation cluster surfaced under Not priority"
);
ok(
  "LP14",
  actionableSummary.includes("example.com") && !actionableSummary.includes("example-saas.internal"),
  "fictional public fixture domain only"
);

const clusterCoverage = JSON.parse(
  readFileSync(path.join(root, "examples", "cluster-coverage.handoff.fixture.json"), "utf8")
);
const clusterSummary = buildLaypersonSummaryMarkdown(clusterCoverage, {
  detailRelativePath: "reports/example.com-2026-07-14-cluster-detail.md"
});

ok(
  "LP15",
  clusterSummary.includes("2 intent cluster") || clusterSummary.includes("2 intent clusters"),
  "verdict uses cluster gap count not raw row gap count"
);
const clusterAttention =
  clusterSummary.split("## What still needs attention")[1]?.split("_Not priority")[0] ?? "";
ok(
  "LP16",
  clusterAttention.includes("people ask this directly on Google") &&
    !clusterAttention.includes("software team chat"),
  "layperson mentions PAA; no anagram alias in attention section"
);

const verdictBlock = clusterSummary.split("## What's working")[0] ?? "";
ok(
  "LP17",
  (verdictBlock.includes("**#8**") || verdictBlock.includes("around **#8**")) &&
    !/Anchor ranks #\d+/i.test(verdictBlock),
  "verdict states anchor rank once — no duplicate coverage_story line"
);
ok(
  "LP18",
  !clusterSummary.includes("You already rank on page one"),
  "anchor rank not repeated in What's working when already in Verdict"
);

const permutationCovered = JSON.parse(
  readFileSync(path.join(root, "examples", "seed-permutation-covered.handoff.fixture.json"), "utf8")
);
const permutationSummary = buildLaypersonSummaryMarkdown(permutationCovered, {
  detailRelativePath: "reports/example.com-2026-07-14-permutation-detail.md"
});
const permutationAttention =
  permutationSummary.split("## What still needs attention")[1]?.split("_Not priority")[0] ?? "";
const writeNextBlock = permutationSummary.split("## What to write next")[1]?.split("---")[0] ?? "";
ok(
  "LP19",
  !permutationAttention.includes("backup software example") &&
    !writeNextBlock.includes("backup software example"),
  "covered-cluster anagram absent from attention and write-next"
);
ok(
  "LP20",
  permutationSummary.includes("word-order variants"),
  "covered-cluster permutation surfaced under Not priority"
);

const hubPathHandoff = JSON.parse(
  readFileSync(path.join(root, "examples", "hub-path-layperson.handoff.fixture.json"), "utf8")
);
const hubPathSummary = buildLaypersonSummaryMarkdown(hubPathHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-hub-detail.md"
});
ok(
  "LP21",
  hubPathSummary.includes("your hub page ranks") && !hubPathSummary.includes("homepage ranks"),
  "hub-path anchor uses hub page phrasing in weak-coverage line"
);
ok(
  "LP22",
  clusterSummary.includes("homepage ranks") || clusterSummary.includes("around **#8**"),
  "root-anchor cluster-coverage fixture still shows anchor rank in verdict"
);

const brokenSpokeHandoff = JSON.parse(
  readFileSync(path.join(root, "examples", "broken-spoke-layperson.handoff.fixture.json"), "utf8")
);
const brokenSpokeSummary = buildLaypersonSummaryMarkdown(brokenSpokeHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-broken-spoke-detail.md"
});
const brokenSpokePermLines =
  brokenSpokeSummary.split("word-order variants")[1]?.split("##")[0] ?? "";
ok(
  "LP23",
  !brokenSpokePermLines.includes("type 1 diabetes"),
  "type 1 diabetes not demoted as seed word-order variant"
);
ok(
  "LP24",
  brokenSpokeSummary.includes("Ranks page 2+") &&
    brokenSpokeSummary.includes("type 2 diabetes symptoms"),
  "broken_spoke rows surfaced in dedicated layperson section"
);
ok(
  "LP25",
  brokenSpokeSummary.includes("dedicated spoke pages"),
  "hub/spoke digest when multiple ranking URLs exist"
);

const zeroCoverageHandoff = JSON.parse(
  readFileSync(path.join(root, "examples", "zero-coverage-write-next.handoff.fixture.json"), "utf8")
);
const zeroCoverageSummary = buildLaypersonSummaryMarkdown(zeroCoverageHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-zero-coverage-detail.md"
});
const zeroWriteNext = zeroCoverageSummary.split("## What to write next")[1]?.split("---")[0] ?? "";
ok(
  "LP26",
  zeroCoverageSummary.includes("Lane note") && zeroCoverageSummary.includes("tool discovery"),
  "lane mismatch warning in verdict when SERP lane conflicts"
);
ok(
  "LP27",
  zeroWriteNext.includes("construction") && !zeroWriteNext.match(/PMP salary/i),
  "zero-coverage write-next blends commercial related ahead of career PAA"
);

const healthLaypersonHandoff = JSON.parse(
  readFileSync(path.join(root, "examples", "health-paa-layperson.fixture.json"), "utf8")
);
const healthSummary = buildLaypersonSummaryMarkdown(healthLaypersonHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-health-detail.md"
});
const healthWriteNext = healthSummary.split("## What to write next")[1]?.split("---")[0] ?? "";
ok(
  "LP28",
  !healthWriteNext.match(/blood pressure/i),
  "health-adjacent PAA absent from write-next on recipe lane"
);

const partialToolHandoff = JSON.parse(
  readFileSync(
    path.join(root, "examples", "partial-coverage-tool-write-next.fixture.json"),
    "utf8"
  )
);
const partialSummary = buildLaypersonSummaryMarkdown(partialToolHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-partial-tool-detail.md"
});
const partialWriteNext = partialSummary.split("## What to write next")[1]?.split("---")[0] ?? "";
ok(
  "LP29",
  partialWriteNext.includes("free") &&
    !partialWriteNext.match(/\$1000 enough to start/i),
  "partial tool_discovery write-next prefers commercial related over hustle PAA"
);

const dualLaneHandoff = JSON.parse(
  readFileSync(path.join(root, "examples", "dual-lane-layperson.fixture.json"), "utf8")
);
const dualLaneSummary = buildLaypersonSummaryMarkdown(dualLaneHandoff, {
  detailRelativePath: "reports/example.com-2026-07-14-dual-lane-detail.md"
});
ok(
  "LP30",
  dualLaneSummary.includes("Lane note") && dualLaneSummary.includes("tool discovery"),
  "dual-lane limitation surfaces lane note in layperson verdict"
);

if (failed > 0) {
  console.error(`\n${failed} layperson check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll LP1–LP30 layperson checks passed.`);
