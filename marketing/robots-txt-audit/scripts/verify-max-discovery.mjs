#!/usr/bin/env node
/**
 * max_discovery policy compliance (P-layer).
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-max-discovery.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const DOMAIN = "example.com";

function loadFixture(name) {
  return readFileSync(path.join(examplesDir, name), "utf8");
}

function runPositiveFixture() {
  const content = loadFixture("example-good.robots.txt.fixture.txt");
  const { assessment } = assessRobotsTxtContent(content, "max_discovery", DOMAIN, {
    sitemap_fetch_results: [
      { url: "https://example.com/sitemap.xml", status: 200 }
    ]
  });
  const checks = [];

  checks.push({
    id: "P1",
    pass: () => assessment.policy_compliance?.compliant === true
  });

  checks.push({
    id: "P2",
    pass: () => assessment.sitemap_validation?.status === "pass"
  });

  checks.push({
    id: "P3",
    pass: () =>
      assessment.sitemap_validation?.urls?.includes(
        "https://example.com/sitemap.xml"
      )
  });

  checks.push({
    id: "P4",
    pass: () => {
      const gpt = assessment.crawler_matrix?.find((r) => r.token === "GPTBot");
      return gpt?.training_crawl === "blocked";
    }
  });

  checks.push({
    id: "P5",
    pass: () => {
      const search = assessment.crawler_matrix?.find(
        (r) => r.token === "OAI-SearchBot"
      );
      return search?.indexing_crawl === "allowed";
    }
  });

  checks.push({
    id: "P6",
    pass: () => {
      const google = assessment.crawler_matrix?.find(
        (r) => r.token === "Googlebot"
      );
      return google?.indexing_crawl === "allowed";
    }
  });

  checks.push({
    id: "P7",
    pass: () => {
      const ext = assessment.crawler_matrix?.find(
        (r) => r.token === "Google-Extended"
      );
      return ext?.training_crawl === "blocked";
    }
  });

  checks.push({
    id: "P8",
    pass: () => assessment.policy_compliance?.violations?.length === 0
  });

  return { label: "example-good.robots.txt.fixture.txt", checks };
}

function runNegativeFixture() {
  const content = loadFixture("example-bad-max-discovery.robots.txt.fixture.txt");
  const { assessment } = assessRobotsTxtContent(content, "max_discovery", DOMAIN);
  const checks = [];

  checks.push({
    id: "P9",
    pass: () => assessment.policy_compliance?.compliant === false
  });

  checks.push({
    id: "P10",
    pass: () =>
      assessment.policy_compliance?.violations?.some(
        (v) => v.token === "Googlebot"
      )
  });

  checks.push({
    id: "P11",
    pass: () =>
      assessment.policy_compliance?.violations?.some((v) => v.token === "GPTBot")
  });

  checks.push({
    id: "P12",
    pass: () => assessment.sitemap_validation?.present === false
  });

  checks.push({
    id: "P13",
    pass: () =>
      assessment.policy_compliance?.violations?.some(
        (v) => v.id === "MD_OPENAI_PAIRING"
      )
  });

  return { label: "example-bad-max-discovery.robots.txt.fixture.txt", checks };
}

function runBadSitemapFixture() {
  const content = loadFixture("example-bad-sitemap.robots.txt.fixture.txt");
  const { assessment } = assessRobotsTxtContent(content, "max_discovery", DOMAIN);
  const checks = [];

  checks.push({
    id: "P14",
    pass: () => assessment.sitemap_validation?.status === "fail"
  });

  checks.push({
    id: "P15",
    pass: () =>
      assessment.sitemap_validation?.issues?.some((i) => i.id === "SM4")
  });

  checks.push({
    id: "P16",
    pass: () => assessment.policy_compliance?.compliant === false
  });

  return { label: "example-bad-sitemap.robots.txt.fixture.txt", checks };
}

function runSitemapFetchSuite() {
  const content = loadFixture("example-good.robots.txt.fixture.txt");
  const checks = [];

  const okResult = assessRobotsTxtContent(content, "max_discovery", DOMAIN, {
    sitemap_fetch_results: [
      { url: "https://example.com/sitemap.xml", status: 200 }
    ]
  });
  checks.push({
    id: "P19",
    pass: () =>
      okResult.assessment.sitemap_validation?.status === "pass" &&
      !okResult.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM7")
  });

  const warnResult = assessRobotsTxtContent(content, "max_discovery", DOMAIN, {
    sitemap_fetch_results: [
      { url: "https://example.com/sitemap.xml", status: 500 }
    ]
  });
  checks.push({
    id: "P20",
    pass: () =>
      warnResult.assessment.sitemap_validation?.status === "warn" &&
      warnResult.assessment.sitemap_validation?.issues?.some((i) => i.id === "SM7")
  });

  checks.push({
    id: "P21",
    pass: () =>
      warnResult.assessment.policy_compliance?.compliant === true
  });

  return { label: "sitemap endpoint fetch (SM7)", checks };
}

function runGenerateHandoffDraft() {
  const fixtures = readdirSync(examplesDir).filter((name) =>
    name.endsWith(".handoff.fixture.json")
  );
  const generateFixture = fixtures.find((name) => name.includes("generate"));
  if (!generateFixture) {
    return null;
  }

  const data = JSON.parse(
    readFileSync(path.join(examplesDir, generateFixture), "utf8")
  );
  const { assessment } = assessRobotsTxtContent(
    data.draft_robots_txt,
    "max_discovery",
    data.inputs.domain
  );
  const checks = [];

  checks.push({
    id: "P17",
    pass: () => assessment.policy_compliance?.compliant === true
  });

  checks.push({
    id: "P18",
    pass: () => assessment.sitemap_validation?.status === "pass"
  });

  return { label: `${generateFixture} (draft_robots_txt)`, checks };
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
    runPositiveFixture(),
    runNegativeFixture(),
    runBadSitemapFixture(),
    runSitemapFetchSuite()
  ];

  const handoffSuite = runGenerateHandoffDraft();
  if (handoffSuite) {
    suites.push(handoffSuite);
  }

  let anyFailed = false;
  for (const suite of suites) {
    if (verifySuite(suite)) {
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.error("One or more P-layer max_discovery checks failed.");
    process.exit(1);
  }

  const totalChecks = suites.reduce((sum, s) => sum + s.checks.length, 0);
  console.log(
    `All P-layer checks passed (${totalChecks} checks across ${suites.length} suites).`
  );
}

main();
