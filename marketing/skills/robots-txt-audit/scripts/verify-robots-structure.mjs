#!/usr/bin/env node
/**
 * Validate robots.txt structure (S-layer).
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-robots-structure.mjs
 *   node scripts/verify-robots-structure.mjs examples/example-good.robots.txt.fixture.txt
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findGroupForAgent,
  isPathAllowedForAgent,
  parseRobotsTxt
} from "./parse-robots-txt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

function defaultFixtures() {
  return readdirSync(examplesDir)
    .filter((name) => name.startsWith("example-good") && name.endsWith(".robots.txt.fixture.txt"))
    .map((name) => path.join(examplesDir, name))
    .sort();
}

function runStructureChecks(parsed, content, options = {}) {
  const checks = [];

  checks.push({
    id: "S1",
    pass: () => parsed.groupCount >= 1
  });

  checks.push({
    id: "S2",
    pass: () => parsed.userAgentTokens.length >= 1
  });

  checks.push({
    id: "S3",
    pass: () => parsed.sitemaps.length >= 1
  });

  checks.push({
    id: "S4",
    pass: () => {
      const googlebot = findGroupForAgent(parsed.groups, "Googlebot");
      return googlebot && isPathAllowedForAgent(parsed.groups, "Googlebot", "/");
    }
  });

  checks.push({
    id: "S5",
    pass: () => {
      if (options.expectRestrictive) {
        return !isPathAllowedForAgent(parsed.groups, "OAI-SearchBot", "/pricing");
      }
      const searchBot = findGroupForAgent(parsed.groups, "OAI-SearchBot");
      return searchBot && isPathAllowedForAgent(parsed.groups, "OAI-SearchBot", "/pricing");
    }
  });

  if (options.expectTrainingBlocks) {
    checks.push({
      id: "S6",
      pass: () => !isPathAllowedForAgent(parsed.groups, "GPTBot", "/")
    });
  }

  checks.push({
    id: "S7",
    pass: () => !isPathAllowedForAgent(parsed.groups, "*", "/admin/")
  });

  checks.push({
    id: "S8",
    pass: () => content.includes("Sitemap:")
  });

  return checks;
}

function verifyFile(filePath) {
  const content = readFileSync(filePath, "utf8");
  const parsed = parseRobotsTxt(content);
  const expectTrainingBlocks = path.basename(filePath).includes("block-training");
  const expectRestrictive = path.basename(filePath).includes("restrictive");
  const checks = runStructureChecks(parsed, content, {
    expectTrainingBlocks: expectTrainingBlocks || expectRestrictive,
    expectRestrictive
  });
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
      : defaultFixtures();

  if (targets.length === 0) {
    console.error("No example-good*.robots.txt.fixture.txt files found in examples/");
    process.exit(1);
  }

  let anyFailed = false;
  for (const file of targets) {
    if (verifyFile(file)) {
      anyFailed = true;
    }
  }

  if (anyFailed) {
    console.error("One or more S-layer structure checks failed.");
    process.exit(1);
  }

  console.log(`All S1–S8 structure checks passed for ${targets.length} fixture(s).`);
}

main();
