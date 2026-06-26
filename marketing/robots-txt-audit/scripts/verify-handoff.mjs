#!/usr/bin/env node
/**
 * Validate robots-txt-audit handoff JSON (schema v1.0).
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-handoff.mjs
 *   node scripts/verify-handoff.mjs examples/example-audit.handoff.fixture.json
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseRobotsTxt } from "./parse-robots-txt.mjs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const MODES = new Set(["audit", "recommend", "generate"]);
const CHECK_STATUS = new Set(["pass", "fail", "warn", "na"]);
const POLICIES = new Set([
  "max_discovery",
  "block_training_allow_answers",
  "restrictive",
  "audit_only"
]);

/** Apex + www robots.txt URLs per SKILL Step 1 */
export function canonicalDiscoveryUrls(domain) {
  const bare = String(domain)
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "")
    .replace(/^www\./i, "");
  return [
    `https://${bare}/robots.txt`,
    `https://www.${bare}/robots.txt`
  ];
}

function defaultHandoffFixtures() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith(".handoff.fixture.json"))
    .map((name) => path.join(examplesDir, name))
    .sort();
}

function loadHandoff(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return { filePath, data: JSON.parse(raw) };
}

function runChecks(data) {
  const checks = [];

  checks.push({
    id: "G1",
    pass: () => data.handoff_version === "1.0"
  });

  checks.push({
    id: "G2",
    pass: () => data.skill === "robots-txt-audit"
  });

  checks.push({
    id: "G3",
    pass: () => MODES.has(data.mode)
  });

  checks.push({
    id: "G4",
    pass: () =>
      typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0
  });

  checks.push({
    id: "G5",
    pass: () => {
      const policy = data.inputs?.crawl_policy ?? "audit_only";
      return POLICIES.has(policy);
    }
  });

  checks.push({
    id: "G6",
    pass: () => {
      const d = data.discovery;
      return (
        d &&
        typeof d.found === "boolean" &&
        Array.isArray(d.urls_checked) &&
        d.urls_checked.length >= 1
      );
    }
  });

  checks.push({
    id: "G7",
    pass: () => {
      if (!data.discovery.found) {
        return data.discovery.resolved_url === null;
      }
      return (
        typeof data.discovery.resolved_url === "string" &&
        data.discovery.resolved_url.length > 0
      );
    }
  });

  checks.push({
    id: "G8",
    pass: () => {
      const p = data.parsed;
      return (
        p &&
        typeof p.group_count === "number" &&
        typeof p.rule_count === "number" &&
        Array.isArray(p.user_agent_tokens) &&
        Array.isArray(p.sitemap_directives)
      );
    }
  });

  checks.push({
    id: "G9",
    pass: () => {
      const c = data.crawlability;
      return (
        c &&
        typeof c.key_pages_provided === "number" &&
        (typeof c.fully_crawlable === "number" || c.fully_crawlable === null) &&
        Array.isArray(c.blocked_key_pages)
      );
    }
  });

  checks.push({
    id: "G10",
    pass: () =>
      Array.isArray(data.audit_checks) &&
      data.audit_checks.length >= 1 &&
      data.audit_checks.every(
        (row) =>
          typeof row.id === "string" &&
          typeof row.name === "string" &&
          CHECK_STATUS.has(row.status) &&
          typeof row.note === "string"
      )
  });

  checks.push({
    id: "G11",
    pass: () => {
      if (data.mode === "generate") {
        return (
          typeof data.draft_robots_txt === "string" &&
          data.draft_robots_txt.length > 0
        );
      }
      return (
        data.draft_robots_txt === null ||
        typeof data.draft_robots_txt === "string"
      );
    }
  });

  checks.push({
    id: "G12",
    pass: () =>
      typeof data.deployment_note === "string" && data.deployment_note.length > 0
  });

  checks.push({
    id: "G13",
    pass: () => {
      if (!data.draft_robots_txt) {
        return true;
      }
      const parsed = parseRobotsTxt(data.draft_robots_txt);
      if (parsed.groupCount < 1 || parsed.ruleCount < 1) {
        return false;
      }
      if (data.inputs?.crawl_policy === "max_discovery") {
        const { assessment } = assessRobotsTxtContent(
          data.draft_robots_txt,
          "max_discovery",
          data.inputs.domain
        );
        return assessment.policy_compliance?.compliant === true;
      }
      return true;
    }
  });

  checks.push({
    id: "G14",
    pass: () => {
      const summary = data.policy_summary;
      return (
        summary &&
        typeof summary.search_bots === "string" &&
        typeof summary.ai_answer_bots === "string" &&
        typeof summary.ai_training_bots === "string"
      );
    }
  });

  checks.push({
    id: "G15",
    pass: () => {
      const provided = data.inputs.key_pages ?? [];
      if (!Array.isArray(provided)) {
        return false;
      }
      return data.crawlability.key_pages_provided === provided.length;
    }
  });

  checks.push({
    id: "G16",
    pass: () => {
      if (data.inputs?.crawl_policy !== "max_discovery") {
        return true;
      }
      const pc = data.policy_compliance;
      return (
        pc &&
        pc.policy === "max_discovery" &&
        typeof pc.compliant === "boolean" &&
        Array.isArray(pc.violations)
      );
    }
  });

  checks.push({
    id: "G17",
    pass: () => {
      if (!data.discovery?.found) {
        return true;
      }
      const sv = data.sitemap_validation;
      if (!sv) {
        return false;
      }
      return (
        typeof sv.present === "boolean" &&
        Array.isArray(sv.urls) &&
        typeof sv.status === "string" &&
        Array.isArray(sv.issues) &&
        Array.isArray(sv.endpoint_fetch)
      );
    }
  });

  checks.push({
    id: "G18",
    pass: () => {
      if (!data.discovery?.found || data.mode === "generate") {
        return true;
      }
      const matrix = data.crawler_matrix;
      return (
        Array.isArray(matrix) &&
        matrix.length >= 1 &&
        matrix.every(
          (row) =>
            typeof row.token === "string" &&
            typeof row.indexing_crawl === "string" &&
            typeof row.training_crawl === "string" &&
            typeof row.rule_source === "string"
        )
      );
    }
  });

  checks.push({
    id: "G19",
    pass: () => {
      const provided = data.crawlability?.key_pages_provided ?? 0;
      if (provided === 0) {
        return data.crawlability.fully_crawlable === null;
      }
      return typeof data.crawlability.fully_crawlable === "number";
    }
  });

  checks.push({
    id: "G20",
    pass: () => {
      if (!data.discovery?.found) {
        return true;
      }
      const sv = data.sitemap_validation;
      if (!sv?.present) {
        return true;
      }
      const hasFetch = sv.endpoint_fetch?.some((row) => row.status !== null);
      const hasR7e = data.audit_checks?.some((row) => row.id === "R7e");
      return hasFetch && hasR7e;
    }
  });

  checks.push({
    id: "G21",
    pass: () => {
      if (data.inputs?.crawl_policy !== "max_discovery") {
        return true;
      }
      const pc = data.policy_compliance;
      return pc && pc.policy === "max_discovery" && typeof pc.compliant === "boolean";
    }
  });

  checks.push({
    id: "G22",
    pass: () => {
      if (data.inputs?.crawl_policy !== "max_discovery") {
        return true;
      }
      if (data.policy_compliance?.compliant === true) {
        return true;
      }
      return (data.policy_compliance?.violations?.length ?? 0) >= 1;
    }
  });

  checks.push({
    id: "G23",
    pass: () => {
      if (data.inputs?.crawl_policy !== "max_discovery") {
        return true;
      }
      if (data.policy_compliance?.compliant !== false) {
        return true;
      }
      return data.mode === "recommend";
    }
  });

  checks.push({
    id: "G24",
    pass: () => {
      if (data.inputs?.crawl_policy !== "max_discovery") {
        return true;
      }
      if (data.policy_compliance?.compliant !== false) {
        return true;
      }
      const r4 = data.audit_checks?.find((row) => row.id === "R4");
      return r4?.status === "fail";
    }
  });

  checks.push({
    id: "G25",
    pass: () => {
      if (data.inputs?.crawl_policy !== "audit_only") {
        return true;
      }
      return data.policy_compliance === null;
    }
  });

  checks.push({
    id: "G26",
    pass: () => {
      if (!data.discovery?.found || data.mode === "generate") {
        return true;
      }
      const matrix = data.crawler_matrix;
      if (matrix === null || matrix === undefined) {
        return false;
      }
      if (typeof matrix === "string") {
        return false;
      }
      return true;
    }
  });

  checks.push({
    id: "G27",
    pass: () => {
      const domain = data.inputs?.domain;
      if (!domain) {
        return true;
      }
      const expected = canonicalDiscoveryUrls(domain);
      const checked = data.discovery?.urls_checked ?? [];
      return expected.every((url) => checked.includes(url));
    }
  });

  return checks;
}

function verifyFile(filePath) {
  const { data } = loadHandoff(filePath);
  const checks = runChecks(data);
  let failed = false;

  console.log(filePath);
  for (const check of checks) {
    const ok = check.pass();
    console.log(ok ? `PASS ${check.id}` : `FAIL ${check.id}`);
    if (!ok) {
      failed = true;
    }
  }
  console.log("");
  return failed;
}

function main() {
  const targets =
    process.argv.length > 2
      ? process.argv.slice(2).map((p) => path.resolve(process.cwd(), p))
      : defaultHandoffFixtures();

  if (targets.length === 0) {
    console.error("No .handoff.fixture.json files found in examples/");
    process.exit(1);
  }

  let anyFailed = false;
  for (const file of targets) {
    if (verifyFile(file)) {
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.error("One or more G-layer handoff checks failed.");
    process.exit(1);
  }

  console.log(`All G1–G27 passed for ${targets.length} handoff fixture(s).`);
}

main();
