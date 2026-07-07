#!/usr/bin/env node
/**
 * Validate seo-cannibalization-audit handoff JSON v1.0.
 *
 * G1–G16 schema · R1–R8 rubric · S1–S4 script parity
 *
 * Usage:
 *   node scripts/verify-handoff.mjs
 *   node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json
 *   node scripts/verify-handoff.mjs examples/blog-vs-pricing.handoff.fixture.json --gold blog-vs-pricing
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PAGE_INTENTS,
  classifyRelationship,
  classifySeverity,
  detectPlaybookTension
} from "./classify-relationship.mjs";
import { RESOLUTIONS, resolveConflict } from "./resolve-conflict.mjs";
import { buildHealthyRelationship } from "./build-healthy-relationship.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const MODES = new Set(["targeted", "playbook_hub_recovery", "full_site"]);
const SEVERITIES = new Set(["active", "emerging", "pre_publish_risk"]);
const RELATIONSHIPS = new Set([
  "hub_spoke_ok",
  "hub_vs_hub",
  "spoke_vs_spoke",
  "hub_same_intent"
]);
const TENSIONS = new Set(["accidental_vs_intended", "blog_vs_landing", "none"]);
const RECOVERY_PHASES = new Set(["5f", "5g", "none"]);
const ARCH_TYPES = new Set([
  "accidental_pillar_blocks_intended",
  "cluster_no_pillar",
  "pillar_without_spokes",
  "spoke_without_pillar"
]);

const GOLD_PROFILES = {
  "blog-vs-pricing": {
    mode: "playbook_hub_recovery",
    conflict_id: "conflict-pricing-blog",
    playbook_tension: "blog_vs_landing",
    resolution: "needs_human_approval",
    recovery_phase: "5f",
    severity: "emerging"
  },
  "hub-spoke-ok": {
    mode: "targeted",
    conflicts_total: 0,
    healthy: 1
  },
  "zero-overlap-hub-spoke-ok": {
    mode: "targeted",
    conflicts_total: 0,
    healthy: 1,
    healthy_keyword: "wordpress core web vitals"
  }
};

function defaultHandoffFixtures() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith(".handoff.fixture.json"))
    .map((name) => path.join(examplesDir, name))
    .sort();
}

function loadHandoff(filePath) {
  return { filePath, data: JSON.parse(readFileSync(filePath, "utf8")) };
}

function parseArgs(argv) {
  const positional = [];
  let gold = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--gold") {
      gold = argv[i + 1];
      i += 1;
    } else {
      positional.push(argv[i]);
    }
  }
  return { paths: positional, gold };
}

function runChecks(data, goldProfile) {
  const checks = [];

  checks.push({ id: "G1", pass: () => data.handoff_version === "1.0" });
  checks.push({
    id: "G2",
    pass: () => data.skill === "seo-cannibalization-audit"
  });
  checks.push({ id: "G3", pass: () => MODES.has(data.mode) });
  checks.push({
    id: "G4",
    pass: () =>
      typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0
  });
  checks.push({
    id: "G5",
    pass: () =>
      Array.isArray(data.inputs?.subject_pages) &&
      data.inputs.subject_pages.length >= 1
  });
  checks.push({
    id: "G6",
    pass: () => data.summary && typeof data.summary.conflicts_total === "number"
  });
  checks.push({
    id: "G7",
    pass: () => Array.isArray(data.conflicts)
  });
  checks.push({
    id: "G8",
    pass: () => Array.isArray(data.healthy_relationships)
  });
  checks.push({
    id: "G9",
    pass: () => Array.isArray(data.architecture_conflicts)
  });
  checks.push({
    id: "G10",
    pass: () => Array.isArray(data.limitations)
  });

  checks.push({
    id: "G11",
    pass: () =>
      data.conflicts.every(
        (c) =>
          typeof c.id === "string" &&
          typeof c.keyword === "string" &&
          SEVERITIES.has(c.severity) &&
          RELATIONSHIPS.has(c.relationship) &&
          TENSIONS.has(c.playbook_tension) &&
          RESOLUTIONS.has(c.resolution) &&
          RECOVERY_PHASES.has(c.recovery_phase) &&
          typeof c.recommended_action === "string" &&
          c.recommended_action.length >= 20 &&
          Array.isArray(c.pages) &&
          c.pages.length >= 2
      )
  });

  checks.push({
    id: "G12",
    pass: () =>
      data.conflicts.every((c) =>
        c.pages.every(
          (p) =>
            typeof p.url === "string" &&
            typeof p.rank === "number" &&
            PAGE_INTENTS.includes(p.intent)
        )
      )
  });

  checks.push({
    id: "G13",
    pass: () =>
      data.healthy_relationships.every(
        (h) =>
          typeof h.keyword === "string" &&
          typeof h.hub_url === "string" &&
          typeof h.spoke_url === "string" &&
          h.relationship === "hub_spoke_ok"
      )
  });

  checks.push({
    id: "G14",
    pass: () =>
      data.architecture_conflicts.every(
        (a) => ARCH_TYPES.has(a.type) && typeof a.description === "string"
      )
  });

  checks.push({
    id: "G15",
    pass: () => {
      const protectedPages = new Set(data.inputs?.protected_pages ?? []);
      return data.conflicts.every((c) => {
        if (c.resolution !== "protected_review") {
          return true;
        }
        return c.pages.some((p) => protectedPages.has(p.url));
      });
    }
  });

  checks.push({
    id: "G16",
    pass: () =>
      data.conflicts.every((c) => {
        if (c.resolution === "redirect_301" || c.resolution === "consolidate") {
          return typeof c.redirect_target === "string" && c.redirect_target.length > 0;
        }
        return c.redirect_target === null || typeof c.redirect_target === "string";
      })
  });

  checks.push({
    id: "G17",
    pass: () => data.summary.conflicts_total === data.conflicts.length
  });

  checks.push({
    id: "G18",
    pass: () => data.summary.healthy === data.healthy_relationships.length
  });

  checks.push({
    id: "G19",
    pass: () => {
      const subjects = new Set(data.inputs?.subject_pages ?? []);
      if (data.conflicts.length > 0 || subjects.size < 2) {
        return true;
      }
      return data.healthy_relationships.length >= 1;
    }
  });

  checks.push({
    id: "G20",
    pass: () => {
      const subjects = new Set(data.inputs?.subject_pages ?? []);
      return data.healthy_relationships.every(
        (h) => subjects.has(h.hub_url) && subjects.has(h.spoke_url)
      );
    }
  });

  checks.push({
    id: "R1",
    pass: () => {
      const protectedPages = new Set(data.inputs?.protected_pages ?? []);
      return data.conflicts.every((c) => {
        const touchesProtected = c.pages.some((p) => protectedPages.has(p.url));
        if (!touchesProtected) {
          return true;
        }
        return c.resolution === "protected_review";
      });
    }
  });

  checks.push({
    id: "R2",
    pass: () =>
      data.conflicts.every((c) => {
        if (c.relationship !== "hub_spoke_ok") {
          return true;
        }
        if (c.playbook_tension !== "none") {
          return c.recovery_phase === "5f";
        }
        return c.resolution === "hub_spoke_ok" && c.recovery_phase === "none";
      })
  });

  checks.push({
    id: "R3",
    pass: () =>
      data.conflicts.every((c) => {
        if (c.playbook_tension === "none") {
          return true;
        }
        return c.recovery_phase === "5f";
      })
  });

  checks.push({
    id: "R4",
    pass: () =>
      data.conflicts.every((c) => {
        if (c.resolution !== "redirect_301") {
          return true;
        }
        return typeof c.redirect_target === "string" && c.redirect_target.length > 0;
      })
  });

  checks.push({
    id: "R5",
    pass: () =>
      data.conflicts.every((c) => c.resolution !== "redirect_301" || c.resolution !== "needs_human_approval")
  });

  checks.push({
    id: "R6",
    pass: () => {
      if (!goldProfile || goldProfile.conflict_id !== "conflict-pricing-blog") {
        return true;
      }
      const conflict = data.conflicts.find((c) => c.id === goldProfile.conflict_id);
      return conflict?.resolution === "needs_human_approval";
    }
  });

  checks.push({
    id: "R7",
    pass: () =>
      data.conflicts.every((c) => {
        if (c.resolution !== "consolidate") {
          return true;
        }
        return typeof c.redirect_target === "string" && c.redirect_target.length > 0;
      })
  });

  if (goldProfile) {
    checks.push({
      id: "R8",
      pass: () => data.mode === goldProfile.mode
    });
    if (goldProfile.conflict_id) {
      checks.push({
        id: "R9",
        pass: () => {
          const c = data.conflicts.find((x) => x.id === goldProfile.conflict_id);
          return (
            c &&
            c.playbook_tension === goldProfile.playbook_tension &&
            c.resolution === goldProfile.resolution &&
            c.recovery_phase === goldProfile.recovery_phase &&
            c.severity === goldProfile.severity
          );
        }
      });
    }
    if (goldProfile.conflicts_total !== undefined) {
      checks.push({
        id: "R10",
        pass: () => data.summary.conflicts_total === goldProfile.conflicts_total
      });
    }
    if (goldProfile.healthy_keyword) {
      checks.push({
        id: "R11",
        pass: () =>
          data.healthy_relationships[0]?.keyword === goldProfile.healthy_keyword
      });
    }
  }

  return checks;
}

function runScriptChecks() {
  const checks = [];
  const pairFixture = path.join(examplesDir, "blog-vs-pricing.pair.fixture.json");
  const pair = JSON.parse(readFileSync(pairFixture, "utf8"));

  checks.push({
    id: "S1",
    pass: () =>
      classifyRelationship(pair.page_a.intent, pair.page_b.intent) === "hub_spoke_ok"
  });

  checks.push({
    id: "S2",
    pass: () => detectPlaybookTension(pair.page_a, pair.page_b, pair) === "blog_vs_landing"
  });

  checks.push({
    id: "S3",
    pass: () => classifySeverity(pair.page_a.rank, pair.page_b.rank) === "emerging"
  });

  checks.push({
    id: "S4",
    pass: () => {
      const relationship = classifyRelationship(pair.page_a.intent, pair.page_b.intent);
      const playbook_tension = detectPlaybookTension(pair.page_a, pair.page_b, pair);
      const severity = classifySeverity(pair.page_a.rank, pair.page_b.rank);
      const result = resolveConflict({
        ...pair,
        relationship,
        playbook_tension,
        severity
      });
      return result.resolution === "needs_human_approval" && result.recovery_phase === "5f";
    }
  });

  const zeroPairFixture = path.join(
    examplesDir,
    "zero-overlap-hub-spoke-ok.pair.fixture.json"
  );
  const zeroPair = JSON.parse(readFileSync(zeroPairFixture, "utf8"));

  checks.push({
    id: "S5",
    pass: () => {
      const row = buildHealthyRelationship(
        zeroPair.page_a,
        zeroPair.page_b,
        "wordpress core web vitals"
      );
      return (
        row?.relationship === "hub_spoke_ok" &&
        row.hub_url === zeroPair.page_b.url &&
        row.spoke_url === zeroPair.page_a.url
      );
    }
  });

  return checks;
}

function runFile(filePath, goldName) {
  const goldProfile = goldName ? GOLD_PROFILES[goldName] : null;
  if (goldName && !goldProfile) {
    console.error(`Unknown gold profile: ${goldName}`);
    process.exit(1);
  }

  const { data } = loadHandoff(filePath);
  const checks = runChecks(data, goldProfile);
  let failed = 0;

  console.log(`\n${path.basename(filePath)}`);
  for (const check of checks) {
    let pass = false;
    try {
      pass = Boolean(check.pass());
    } catch (err) {
      console.log(`FAIL ${check.id} — ${err.message}`);
      failed += 1;
      continue;
    }
    console.log(`${pass ? "PASS" : "FAIL"} ${check.id}`);
    if (!pass) {
      failed += 1;
    }
  }

  return failed;
}

function main() {
  const { paths, gold } = parseArgs(process.argv);
  const targets = paths.length > 0 ? paths.map((p) => path.resolve(p)) : defaultHandoffFixtures();

  let totalFailed = 0;
  for (const filePath of targets) {
    const profile =
      gold ??
      (filePath.includes("zero-overlap-hub-spoke-ok")
        ? "zero-overlap-hub-spoke-ok"
        : null) ??
      (filePath.includes("blog-vs-pricing") ? "blog-vs-pricing" : null) ??
      (filePath.includes("hub-spoke-ok") ? "hub-spoke-ok" : null);
    totalFailed += runFile(filePath, profile);
  }

  console.log("\nscript-parity");
  for (const check of runScriptChecks()) {
    let pass = false;
    try {
      pass = Boolean(check.pass());
    } catch (err) {
      console.log(`FAIL ${check.id} — ${err.message}`);
      totalFailed += 1;
      continue;
    }
    console.log(`${pass ? "PASS" : "FAIL"} ${check.id}`);
    if (!pass) {
      totalFailed += 1;
    }
  }

  if (totalFailed > 0) {
    console.error(`\n${totalFailed} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll checks passed");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
