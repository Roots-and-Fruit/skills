#!/usr/bin/env node
/**
 * max_discovery contract tests (P-layer extended).
 * Validates violation sets, matrix signals, and audit_only vs max_discovery split.
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-max-discovery-contract.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import {
  FIXTURE_EXPECTATIONS,
  VIOLATION_SHAPE_KEYS,
  includesAll,
  includesNone,
  violationIds
} from "./max-discovery-expectations.mjs";
import { MAX_DISCOVERY_REQUIRED_TOKENS } from "./crawler-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");
const DOMAIN = "example.com";

function loadFixture(name) {
  return readFileSync(path.join(examplesDir, name), "utf8");
}

function assessFixture(name, options = {}) {
  const content = loadFixture(name);
  return assessRobotsTxtContent(content, "max_discovery", DOMAIN, options).assessment;
}

function runExpectationFixture(name) {
  const expected = FIXTURE_EXPECTATIONS[name];
  const assessment = assessFixture(name, expected.fetchOptions ?? {});
  const ids = violationIds(assessment.policy_compliance?.violations ?? []);
  const checks = [];

  checks.push({
    id: `PC1_${name}`,
    pass: () => assessment.policy_compliance?.policy === "max_discovery"
  });

  checks.push({
    id: `PC2_${name}`,
    pass: () => assessment.policy_compliance?.compliant === expected.compliant
  });

  if (expected.requiredViolationIds) {
    checks.push({
      id: `PC3_${name}`,
      pass: () => includesAll(ids, expected.requiredViolationIds)
    });
  }

  if (expected.forbiddenViolationIds) {
    checks.push({
      id: `PC4_${name}`,
      pass: () => includesNone(ids, expected.forbiddenViolationIds)
    });
  }

  if (expected.sitemapStatusWith200) {
    const with200 = assessFixture(name, {
      sitemap_fetch_results: expected.sitemapFetch200 ?? [
        { url: "https://example.com/sitemap.xml", status: 200 }
      ]
    });
    checks.push({
      id: `PC5_${name}`,
      pass: () => with200.sitemap_validation?.status === expected.sitemapStatusWith200
    });
  }

  if (expected.sitemapStatusWith500) {
    const with500 = assessFixture(name, {
      sitemap_fetch_results: [
        {
          url: "https://www.example.com/sitemap_index.xml",
          status: 500
        }
      ]
    });
    checks.push({
      id: `PC6_${name}`,
      pass: () => with500.sitemap_validation?.status === expected.sitemapStatusWith500
    });
    checks.push({
      id: `PC7_${name}`,
      pass: () =>
        with500.sitemap_validation?.issues?.some((i) => i.id === "SM7")
    });
    if (expected.policyCompliantDespiteSitemap500 === false) {
      checks.push({
        id: `PC8_${name}`,
        pass: () => with500.policy_compliance?.compliant === false
      });
    }
  }

  if (expected.trainingTokensBlocked) {
    for (const token of expected.trainingTokensBlocked) {
      checks.push({
        id: `PC9_${token}`,
        pass: () => {
          const row = assessment.crawler_matrix?.find((r) => r.token === token);
          return row?.training_crawl === "blocked";
        }
      });
    }
  }

  if (expected.trainingTokensAllowed) {
    for (const token of expected.trainingTokensAllowed) {
      checks.push({
        id: `PC10_${token}`,
        pass: () => {
          const row = assessment.crawler_matrix?.find((r) => r.token === token);
          return row?.training_crawl === "allowed";
        }
      });
    }
  }

  if (expected.discoveryTokensAllowed) {
    for (const token of expected.discoveryTokensAllowed) {
      checks.push({
        id: `PC11_${token}`,
        pass: () => {
          const row = assessment.crawler_matrix?.find((r) => r.token === token);
          return row?.indexing_crawl === "allowed";
        }
      });
    }
  }

  if (expected.ruleSource) {
    for (const [token, source] of Object.entries(expected.ruleSource)) {
      checks.push({
        id: `PC12_${token}`,
        pass: () => {
          const row = assessment.crawler_matrix?.find((r) => r.token === token);
          return row?.rule_source === source;
        }
      });
    }
  }

  return { label: name, checks };
}

function runViolationShapeSuite() {
  const assessment = assessFixture("example-wp-open.robots.txt.fixture.txt");
  const violations = assessment.policy_compliance?.violations ?? [];
  const checks = [];

  checks.push({
    id: "PC13",
    pass: () => violations.length >= 1
  });

  checks.push({
    id: "PC14",
    pass: () =>
      violations.every((v) =>
        VIOLATION_SHAPE_KEYS.every((key) => typeof v[key] === "string" && v[key].length > 0)
      )
  });

  checks.push({
    id: "PC15",
    pass: () => {
      const trainingBlocks = violations.filter(
        (v) => v.expected === "block" && v.actual === "allowed"
      );
      return trainingBlocks.length >= 3;
    }
  });

  return { label: "violation shape", checks };
}

function runAuditOnlySplitSuite() {
  const wp = loadFixture("example-wp-open.robots.txt.fixture.txt");
  const auditOnly = assessRobotsTxtContent(wp, "audit_only", DOMAIN).assessment;
  const maxDiscovery = assessRobotsTxtContent(wp, "max_discovery", DOMAIN).assessment;
  const checks = [];

  checks.push({
    id: "PC16",
    pass: () => auditOnly.policy_compliance === null
  });

  checks.push({
    id: "PC17",
    pass: () => maxDiscovery.policy_compliance?.compliant === false
  });

  checks.push({
    id: "PC18",
    pass: () =>
      (maxDiscovery.policy_compliance?.violations?.length ?? 0) >
      (auditOnly.policy_compliance?.violations?.length ?? 0)
  });

  return { label: "audit_only vs max_discovery split", checks };
}

function runRequiredTokenCoverageSuite() {
  const assessment = assessFixture("example-wp-open.robots.txt.fixture.txt");
  const violations = assessment.policy_compliance?.violations ?? [];
  const checks = [];

  for (const token of MAX_DISCOVERY_REQUIRED_TOKENS) {
    const row = assessment.crawler_matrix?.find((r) => r.token === token);
    checks.push({
      id: `PC19_${token}`,
      pass: () => Boolean(row)
    });
  }

  checks.push({
    id: "PC20",
    pass: () => assessment.crawler_matrix?.length >= MAX_DISCOVERY_REQUIRED_TOKENS.length
  });

  checks.push({
    id: "PC21",
    pass: () =>
      ["MD_GPTBot", "MD_Google_Extended", "MD_CCBot", "MD_ClaudeBot"].every((id) =>
        violations.some((v) => v.id === id)
      )
  });

  return { label: "required token coverage", checks };
}

function runHandoffDriftSuite() {
  const handoffPath = path.join(
    examplesDir,
    "example-max-discovery-recommend.handoff.fixture.json"
  );
  const handoff = JSON.parse(readFileSync(handoffPath, "utf8"));
  const wp = loadFixture("example-wp-open.robots.txt.fixture.txt");
  const fresh = assessRobotsTxtContent(wp, "max_discovery", DOMAIN, {
    sitemap_fetch_results: [
      { url: "https://www.example.com/sitemap_index.xml", status: 500 }
    ]
  }).assessment;
  const handoffIds = violationIds(handoff.policy_compliance?.violations ?? []);
  const freshIds = violationIds(fresh.policy_compliance?.violations ?? []);
  const checks = [];

  checks.push({
    id: "PC22",
    pass: () => handoff.inputs?.crawl_policy === "max_discovery"
  });

  checks.push({
    id: "PC23",
    pass: () =>
      handoff.policy_compliance?.compliant ===
      fresh.policy_compliance?.compliant
  });

  checks.push({
    id: "PC24",
    pass: () =>
      JSON.stringify(handoffIds) === JSON.stringify(freshIds)
  });

  checks.push({
    id: "PC25",
    pass: () => handoff.mode === "recommend"
  });

  return { label: "max_discovery handoff drift", checks };
}

function verifySuite(suite) {
  let failed = false;
  console.log(suite.label);
  for (const check of suite.checks) {
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
  const suites = [
    runExpectationFixture("example-good.robots.txt.fixture.txt"),
    runExpectationFixture("example-bad-max-discovery.robots.txt.fixture.txt"),
    runExpectationFixture("example-wp-open.robots.txt.fixture.txt"),
    runViolationShapeSuite(),
    runAuditOnlySplitSuite(),
    runRequiredTokenCoverageSuite(),
    runHandoffDriftSuite()
  ];

  let anyFailed = false;
  for (const suite of suites) {
    if (verifySuite(suite)) {
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.error("One or more max_discovery contract checks failed.");
    process.exit(1);
  }

  const totalChecks = suites.reduce((sum, s) => sum + s.checks.length, 0);
  console.log(
    `All max_discovery contract checks passed (${totalChecks} checks across ${suites.length} suites).`
  );
}

main();
