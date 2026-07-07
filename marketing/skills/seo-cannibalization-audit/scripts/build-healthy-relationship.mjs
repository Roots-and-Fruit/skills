#!/usr/bin/env node
/**
 * Build healthy_relationships[] row for a hub+spoke pair with no SERP conflict.
 *
 * Usage:
 *   node scripts/build-healthy-relationship.mjs --json path/to/pair.json --keyword "example term"
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  classifyRelationship,
  isHubIntent,
  isSpokeIntent
} from "./classify-relationship.mjs";

/**
 * @param {{ url: string, intent: string }} pageA
 * @param {{ url: string, intent: string }} pageB
 * @param {string} keyword
 * @returns {object|null}
 */
export function buildHealthyRelationship(pageA, pageB, keyword) {
  if (classifyRelationship(pageA.intent, pageB.intent) !== "hub_spoke_ok") {
    return null;
  }

  let hub_url;
  let spoke_url;

  if (isHubIntent(pageA.intent) && isSpokeIntent(pageB.intent)) {
    hub_url = pageA.url;
    spoke_url = pageB.url;
  } else if (isHubIntent(pageB.intent) && isSpokeIntent(pageA.intent)) {
    hub_url = pageB.url;
    spoke_url = pageA.url;
  } else {
    return null;
  }

  if (!keyword || typeof keyword !== "string" || keyword.trim().length === 0) {
    throw new Error("keyword is required for healthy_relationships row");
  }

  return {
    keyword: keyword.trim(),
    hub_url,
    spoke_url,
    relationship: "hub_spoke_ok"
  };
}

function main() {
  const jsonIdx = process.argv.indexOf("--json");
  const keywordIdx = process.argv.indexOf("--keyword");
  if (jsonIdx === -1 || keywordIdx === -1) {
    console.error(
      "Usage: node scripts/build-healthy-relationship.mjs --json pair.json --keyword \"term\""
    );
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(process.argv[jsonIdx + 1], "utf8"));
  const row = buildHealthyRelationship(
    payload.page_a,
    payload.page_b,
    process.argv[keywordIdx + 1]
  );

  if (!row) {
    console.error("Pair is not hub_spoke_ok — do not emit healthy_relationships row");
    process.exit(1);
  }

  console.log(JSON.stringify(row, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
