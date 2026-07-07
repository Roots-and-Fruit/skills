#!/usr/bin/env node
/**
 * Deterministic resolution for a cannibalization conflict pair.
 *
 * Usage:
 *   node scripts/resolve-conflict.mjs --json path/to/pair.json
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  classifyRelationship,
  classifySeverity,
  detectPlaybookTension,
  isHubIntent
} from "./classify-relationship.mjs";

export const RESOLUTIONS = new Set([
  "hub_spoke_ok",
  "differentiate",
  "redirect_301",
  "consolidate",
  "protected_review",
  "needs_human_approval"
]);

export const RECOVERY_PHASES = new Set(["5f", "5g", "none"]);

/**
 * @param {object} input
 * @returns {{ resolution: string, redirect_target: string|null, recovery_phase: string, recommended_action: string }}
 */
export function resolveConflict(input) {
  const {
    page_a: pageA,
    page_b: pageB,
    relationship,
    severity,
    playbook_tension = "none",
    protected_pages = [],
    intended_hubs = []
  } = input;

  const protectedSet = new Set(protected_pages);
  const intendedSet = new Set(intended_hubs);

  for (const page of [pageA, pageB]) {
    if (protectedSet.has(page.url)) {
      return {
        resolution: "protected_review",
        redirect_target: null,
        recovery_phase: "5f",
        recommended_action:
          "Protected page — do not recommend retire or 301 without explicit user approval. Flag for human review."
      };
    }
  }

  const intendedUrl = [pageA.url, pageB.url].find((u) => intendedSet.has(u));
  const accidentalUrl = [pageA.url, pageB.url].find(
    (u) => intendedUrl && u !== intendedUrl
  );

  if (
    (playbook_tension === "accidental_vs_intended" ||
      playbook_tension === "blog_vs_landing") &&
    intendedUrl &&
    accidentalUrl
  ) {
    const accidentalPage = accidentalUrl === pageA.url ? pageA : pageB;
    if (accidentalPage.rank <= 20 && (accidentalPage.monthly_volume ?? 0) > 10) {
      return {
        resolution: "needs_human_approval",
        redirect_target: intendedUrl,
        recovery_phase: "5f",
        recommended_action:
          "Accidental page ranks in top 20 — do not 301 without approval. Strengthen intended hub, demote accidental page to spoke, or plan migration per Phase 5f transition tree."
      };
    }
    return {
      resolution: "differentiate",
      redirect_target: null,
      recovery_phase: "5f",
      recommended_action:
        "Differentiate intents, link accidental content to intended hub, and begin content migration toward the intended hub as cluster owner."
    };
  }

  if (relationship === "hub_spoke_ok") {
    return {
      resolution: "hub_spoke_ok",
      redirect_target: null,
      recovery_phase: "none",
      recommended_action:
        "Healthy hub-and-spoke overlap — keep both pages; strengthen internal links from spoke to hub."
    };
  }

  const stronger = pageA.rank <= pageB.rank ? pageA : pageB;
  const weaker = stronger === pageA ? pageB : pageA;

  if (weaker.rank > 20 && (weaker.monthly_volume ?? 0) < 10) {
    return {
      resolution: "redirect_301",
      redirect_target: stronger.url,
      recovery_phase: "5g",
      recommended_action:
        "Weaker page has negligible rankings — consolidate with 301 to stronger page after backlink check and internal link updates."
    };
  }

  if (relationship === "hub_vs_hub" || relationship === "hub_same_intent") {
    if (stronger.rank <= 10 && (stronger.monthly_volume ?? 0) > 20) {
      return {
        resolution: "needs_human_approval",
        redirect_target: isHubIntent(weaker.intent) ? stronger.url : null,
        recovery_phase: "5f",
        recommended_action:
          "Two hub-intent pages compete — resolve via Phase 5f: pick cluster owner, differentiate, or migrate content before any 301."
      };
    }
    return {
      resolution: "differentiate",
      redirect_target: null,
      recovery_phase: "5f",
      recommended_action:
        "Differentiate titles, metas, and anchor text; assign one page as cluster hub and demote or refocus the other."
    };
  }

  if (relationship === "spoke_vs_spoke") {
    return {
      resolution: "consolidate",
      redirect_target: stronger.url,
      recovery_phase: "5g",
      recommended_action:
        "Two spokes overlap on the same intent — merge into the stronger URL or differentiate sub-intents; document redirect target if consolidating."
    };
  }

  if (severity === "pre_publish_risk") {
    return {
      resolution: "needs_human_approval",
      redirect_target: null,
      recovery_phase: "5f",
      recommended_action:
        "Pre-publish risk — new page would compete with an existing top-10 URL. Differentiate intent or target a distinct keyword before launch."
    };
  }

  return {
    resolution: "differentiate",
    redirect_target: null,
    recovery_phase: "5f",
    recommended_action:
      "Overlap detected — differentiate on-page signals and internal linking before considering consolidation."
  };
}

function main() {
  const jsonPath = process.argv[process.argv.indexOf("--json") + 1];
  if (!jsonPath) {
    console.error("Usage: node scripts/resolve-conflict.mjs --json pair.json");
    process.exit(1);
  }

  const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
  const relationship =
    payload.relationship ??
    classifyRelationship(payload.page_a.intent, payload.page_b.intent);
  const playbook_tension =
    payload.playbook_tension ??
    detectPlaybookTension(payload.page_a, payload.page_b, payload);
  const severity =
    payload.severity ??
    classifySeverity(payload.page_a.rank, payload.page_b.rank, payload);

  const result = resolveConflict({
    ...payload,
    relationship,
    playbook_tension,
    severity
  });

  console.log(JSON.stringify({ relationship, playbook_tension, severity, ...result }, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
