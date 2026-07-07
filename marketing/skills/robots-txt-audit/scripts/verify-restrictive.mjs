#!/usr/bin/env node
/**
 * Restrictive preset P-layer checks (PR1–PR12).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import {
  RESTRICTIVE_ALLOW_TOKENS,
  RESTRICTIVE_BLOCK_ANSWER_TOKENS,
  TRAINING_BLOCK_REQUIRED_TOKENS
} from "./crawler-registry.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");
const DOMAIN = "example.com";

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

console.log("verify-restrictive.mjs\n");

const good = readFileSync(
  path.join(examplesDir, "example-good-restrictive.robots.txt.fixture.txt"),
  "utf8"
);
const { assessment } = assessRobotsTxtContent(good, "restrictive", DOMAIN, {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
});

ok("PR1", assessment.policy_compliance?.policy === "restrictive");
ok("PR2", assessment.policy_compliance?.compliant === true);
ok("PR3", (assessment.policy_compliance?.violations?.length ?? 0) === 0);

for (const token of RESTRICTIVE_ALLOW_TOKENS) {
  const row = assessment.crawler_matrix?.find((r) => r.token === token);
  ok(`PR4_${token}`, row?.indexing_crawl === "allowed");
}

for (const token of RESTRICTIVE_BLOCK_ANSWER_TOKENS) {
  const row = assessment.crawler_matrix?.find((r) => r.token === token);
  ok(`PR5_${token}`, row?.indexing_crawl === "blocked");
}

for (const token of TRAINING_BLOCK_REQUIRED_TOKENS) {
  const row = assessment.crawler_matrix?.find((r) => r.token === token);
  ok(`PR6_${token}`, row?.training_crawl === "blocked");
}

ok(
  "PR7",
  assessment.crawler_matrix?.find((r) => r.token === "OAI-SearchBot")?.policy_expectation ===
    "block"
);

const blockTraining = readFileSync(
  path.join(examplesDir, "example-good-block-training.robots.txt.fixture.txt"),
  "utf8"
);
const btAssess = assessRobotsTxtContent(
  blockTraining,
  "block_training_allow_answers",
  DOMAIN,
  { sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }] }
);
ok(
  "PR8",
  btAssess.assessment.crawler_matrix?.find((r) => r.token === "OAI-SearchBot")
    ?.policy_expectation === "allow"
);
ok(
  "PR9",
  btAssess.assessment.crawler_matrix?.find((r) => r.token === "OAI-SearchBot")
    ?.indexing_crawl === "allowed"
);

const openWildcard = "User-agent: *\nAllow: /\n\nSitemap: https://example.com/sitemap.xml";
const badAssess = assessRobotsTxtContent(openWildcard, "restrictive", DOMAIN, {
  sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
});
ok("PR10", badAssess.assessment.policy_compliance?.compliant === false);
ok(
  "PR11",
  badAssess.assessment.policy_compliance?.violations?.some((v) =>
    v.id.startsWith("MD_RESTRICT_")
  )
);
ok(
  "PR12",
  badAssess.assessment.policy_compliance?.violations?.some((v) => v.id === "MD_GPTBot")
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
