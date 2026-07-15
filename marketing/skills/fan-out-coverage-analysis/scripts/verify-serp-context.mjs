#!/usr/bin/env node
/**
 * SERP context normalization checks (SC1–SC3).
 */
import {
  dominantSerpLane,
  detectLaneMismatch,
  normalizeIntentSplit,
  normalizeHandoffSerpContext
} from "./serp-context.mjs";

const checks = [
  {
    id: "SC1",
    pass: () =>
      normalizeIntentSplit({
        intent_split: "single",
        intent_lanes_detected: ["tool_discovery", "community"],
        lane_counts: { tool_discovery: 6, community: 1 }
      }) === "mixed",
    detail: "two meaningful lanes force intent_split mixed"
  },
  {
    id: "SC2",
    pass: () => {
      const mismatch = detectLaneMismatch(
        {
          lane_counts: { tool_discovery: 6, community: 1 }
        },
        "primary_topic"
      );
      return mismatch?.dominant === "tool_discovery" && mismatch.pct >= 60;
    },
    detail: "lane mismatch detects tool_discovery-dominant SERP vs primary_topic choice"
  },
  {
    id: "SC3",
    pass: () =>
      dominantSerpLane({
        lane_counts: { primary_topic: 8 }
      }) === "primary_topic",
    detail: "single-lane SERP returns dominant lane"
  },
  {
    id: "SC4",
    pass: () => {
      const normalized = normalizeHandoffSerpContext({
        inputs: { intent_lane: "primary_topic" },
        serp_context: {
          intent_split: "single",
          intent_lanes_detected: ["tool_discovery", "community"],
          lane_counts: { tool_discovery: 6, community: 1 }
        },
        limitations: []
      });
      return (
        normalized.serp_context.intent_split === "mixed" &&
        normalized.lane_mismatch?.dominant === "tool_discovery" &&
        (normalized.limitations ?? []).some((line) => line.includes("dominant"))
      );
    },
    detail: "normalizeHandoffSerpContext forces mixed split and lane mismatch note"
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

console.log("\nAll SC1–SC4 serp-context checks passed.");
