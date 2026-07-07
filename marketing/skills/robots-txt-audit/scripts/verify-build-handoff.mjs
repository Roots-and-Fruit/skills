#!/usr/bin/env node
/**
 * BH gates — buildHandoff() must match live assessRobotsTxtContent() output.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { buildHandoff, buildDiscovery, deriveHandoffMode } from "./build-handoff.mjs";
import { HANDOFF_FIXTURE_MANIFEST } from "./handoff-fixture-manifest.mjs";
import { requiresPolicyCompliance } from "./policy-presets.mjs";
import { parseRobotsTxt } from "./parse-robots-txt.mjs";
import { runChecks as runHandoffChecks } from "./verify-handoff.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

let passed = 0;
let failed = 0;

function ok(id, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${id}`);
  } else {
    failed++;
    console.error(`  ✗ ${id}${detail ? ` — ${detail}` : ""}`);
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assessmentFields(assessment) {
  return {
    policy_compliance: assessment.policy_compliance,
    crawler_matrix: assessment.crawler_matrix,
    sitemap_validation: assessment.sitemap_validation,
    syntax_validation: assessment.syntax_validation,
    index_control_validation: assessment.index_control_validation,
    audit_findings: assessment.audit_findings
  };
}

function buildFromEntry(entry) {
  if (entry.generate) {
    return null;
  }
  const content = entry.robotsContent
    ? entry.robotsContent
    : readFileSync(path.join(examplesDir, entry.robotsFile), "utf8");
  const result = assessRobotsTxtContent(
    content,
    entry.policy,
    entry.domain,
    entry.assessOptions ?? {}
  );
  const handoff = buildHandoff({
    assessment: result.assessment,
    parsed: result.parsed,
    inputs: {
      domain: entry.domain,
      key_pages: entry.keyPages,
      crawl_policy: entry.policy,
      ...(entry.robots_deployment ? { robots_deployment: entry.robots_deployment } : {})
    },
    discovery: buildDiscovery({
      domain: entry.domain,
      found: true,
      resolved_url: entry.resolvedUrl
    }),
    modeOverride: entry.modeOverride,
    deployment_note: entry.deployment_note,
    limitations: entry.limitations ?? []
  });
  return { result, handoff };
}

console.log("verify-build-handoff.mjs\n");

for (const entry of HANDOFF_FIXTURE_MANIFEST) {
  if (entry.generate) {
    continue;
  }
  const label = entry.handoffFile.replace(".handoff.fixture.json", "");
  const built = buildFromEntry(entry);
  if (!built) {
    continue;
  }
  const { result, handoff } = built;
  const live = result.assessment;

  ok(
    `BH1_${label}`,
    deepEqual(handoff.policy_compliance, live.policy_compliance)
  );
  ok(
    `BH2a_${label}`,
    deepEqual(handoff.crawler_matrix, live.crawler_matrix)
  );
  ok(
    `BH2b_${label}`,
    deepEqual(handoff.sitemap_validation, live.sitemap_validation)
  );
  ok(
    `BH2c_${label}`,
    deepEqual(handoff.syntax_validation, live.syntax_validation)
  );
  ok(
    `BH2d_${label}`,
    deepEqual(handoff.index_control_validation, live.index_control_validation)
  );
  ok(
    `BH2e_${label}`,
    deepEqual(handoff.audit_findings, live.audit_findings)
  );
}

ok(
  "BH3",
  HANDOFF_FIXTURE_MANIFEST.filter((e) => !e.generate).every((entry) => {
    const { handoff } = buildFromEntry(entry);
    const valid = new Set(["pass", "fail", "warn", "na"]);
    return (
      handoff.audit_checks.length >= 1 &&
      handoff.audit_checks.every((r) => valid.has(r.status))
    );
  })
);

const modeEntry = HANDOFF_FIXTURE_MANIFEST.find(
  (e) => e.handoffFile === "example-max-discovery-recommend.handoff.fixture.json"
);
if (modeEntry) {
  const { handoff } = buildFromEntry(modeEntry);
  ok(
    "BH4",
    handoff.policy_compliance?.compliant === true && handoff.mode === "audit"
  );
}

const recEntry = HANDOFF_FIXTURE_MANIFEST.find(
  (e) => e.handoffFile === "example-recommend.handoff.fixture.json"
);
if (recEntry) {
  const { handoff } = buildFromEntry(recEntry);
  const r4 = handoff.audit_checks.find((r) => r.id === "R4");
  ok(
    "BH5",
    handoff.policy_compliance?.compliant === false && r4?.status === "fail"
  );
}

for (const entry of HANDOFF_FIXTURE_MANIFEST) {
  if (entry.generate) {
    continue;
  }
  const fixturePath = path.join(examplesDir, entry.handoffFile);
  const committed = JSON.parse(readFileSync(fixturePath, "utf8"));
  const { handoff } = buildFromEntry(entry);
  const checks = runHandoffChecks(committed);
  const allPass = checks.every((c) => c.pass());
  ok(`BH7_${entry.handoffFile}`, allPass);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
