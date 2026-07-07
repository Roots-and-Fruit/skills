#!/usr/bin/env node
/**
 * Classify same-domain page-pair relationship and playbook tension signals.
 *
 * Usage:
 *   node scripts/classify-relationship.mjs --intent-a how_to --intent-b product
 *   node scripts/classify-relationship.mjs --json path/to/pair.json
 *
 * pair.json: { "page_a": { "url", "intent" }, "page_b": { "url", "intent" },
 *             "intended_hubs": [], "triangulation": { "url": "role" } }
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const PAGE_INTENTS = [
  "hub_routing",
  "feature",
  "how_to",
  "integration",
  "product",
  "alternative_comparison",
  "use_case_lp"
];

const HUB_INTENTS = new Set(["hub_routing", "product", "use_case_lp"]);
const SPOKE_INTENTS = new Set([
  "how_to",
  "feature",
  "integration",
  "alternative_comparison"
]);
const BLOG_INTENTS = new Set(["how_to"]);
const LANDING_INTENTS = new Set(["product", "use_case_lp", "hub_routing"]);

export function isHubIntent(intent) {
  return HUB_INTENTS.has(intent);
}

export function isSpokeIntent(intent) {
  return SPOKE_INTENTS.has(intent);
}

/**
 * @returns {"hub_spoke_ok"|"hub_vs_hub"|"spoke_vs_spoke"|"hub_same_intent"}
 */
export function classifyRelationship(intentA, intentB) {
  if (!PAGE_INTENTS.includes(intentA) || !PAGE_INTENTS.includes(intentB)) {
    throw new Error(`Invalid intent — use: ${PAGE_INTENTS.join(", ")}`);
  }

  const aHub = isHubIntent(intentA);
  const bHub = isHubIntent(intentB);

  if (aHub && bHub) {
    return intentA === intentB ? "hub_same_intent" : "hub_vs_hub";
  }
  if (!aHub && !bHub) {
    return intentA === intentB ? "spoke_vs_spoke" : "spoke_vs_spoke";
  }
  return "hub_spoke_ok";
}

/**
 * @returns {"accidental_vs_intended"|"blog_vs_landing"|"none"}
 */
export function detectPlaybookTension(pageA, pageB, options = {}) {
  const intended = new Set(options.intended_hubs ?? []);
  const triangulation = options.triangulation ?? {};

  const roleA = triangulation[pageA.url];
  const roleB = triangulation[pageB.url];
  const aIntended = intended.has(pageA.url);
  const bIntended = intended.has(pageB.url);

  if (
    (BLOG_INTENTS.has(pageA.intent) && LANDING_INTENTS.has(pageB.intent)) ||
    (BLOG_INTENTS.has(pageB.intent) && LANDING_INTENTS.has(pageA.intent))
  ) {
    return "blog_vs_landing";
  }

  const accidentalRoles = new Set(["accidental_hub", "de_facto_pillar"]);
  const isAccidentalA =
    accidentalRoles.has(roleA) || (isHubIntent(pageA.intent) && !aIntended);
  const isAccidentalB =
    accidentalRoles.has(roleB) || (isHubIntent(pageB.intent) && !bIntended);

  if ((isAccidentalA && bIntended) || (isAccidentalB && aIntended)) {
    return "accidental_vs_intended";
  }

  return "none";
}

export function classifySeverity(rankA, rankB, options = {}) {
  if (options.is_pre_publish) {
    return "pre_publish_risk";
  }
  if (rankA <= 20 && rankB <= 20) {
    return "active";
  }
  if (rankA <= 50 && rankB <= 50) {
    return "emerging";
  }
  return "emerging";
}

function parseArgs(argv) {
  const args = { intentA: null, intentB: null, json: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--intent-a") {
      args.intentA = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--intent-b") {
      args.intentB = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json") {
      args.json = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);

  if (args.json) {
    const payload = JSON.parse(readFileSync(args.json, "utf8"));
    const relationship = classifyRelationship(
      payload.page_a.intent,
      payload.page_b.intent
    );
    const playbook_tension = detectPlaybookTension(
      payload.page_a,
      payload.page_b,
      payload
    );
    const severity = classifySeverity(
      payload.page_a.rank,
      payload.page_b.rank,
      payload
    );
    console.log(
      JSON.stringify({ relationship, playbook_tension, severity }, null, 2)
    );
    return;
  }

  if (!args.intentA || !args.intentB) {
    console.error(
      "Usage: --intent-a TYPE --intent-b TYPE  OR  --json pair.json"
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      { relationship: classifyRelationship(args.intentA, args.intentB) },
      null,
      2
    )
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
