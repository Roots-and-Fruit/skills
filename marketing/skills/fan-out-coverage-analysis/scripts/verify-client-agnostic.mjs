#!/usr/bin/env node
/**
 * Client-agnostic / public skill guardrails (XP1–XP4).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DENYLIST = [
  "paidmembershipspro",
  "memberpress",
  "wpproducttalk",
  "ultimatemember",
  "helpscout.com"
];

const SCAN_DIRS = ["examples", "scripts"];
const SCAN_FILES = ["SKILL.md", "REFERENCE.md", "LAYPERSON-OUTPUT.md", "REQUIREMENTS.md", "EXAMPLES.md"];

function collectFiles() {
  const files = SCAN_FILES.map((name) => path.join(root, name));
  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(root, dir);
    for (const name of readdirSync(fullDir)) {
      if (name.endsWith(".json") || name.endsWith(".mjs") || name.endsWith(".md")) {
        files.push(path.join(fullDir, name));
      }
    }
  }
  return files.filter((filePath) => !filePath.endsWith("verify-client-agnostic.mjs"));
}

function scanDenylist() {
  const hits = [];
  for (const filePath of collectFiles()) {
    const text = readFileSync(filePath, "utf8").toLowerCase();
    for (const term of DENYLIST) {
      if (text.includes(term)) {
        hits.push({ filePath, term });
      }
    }
  }
  return hits;
}

function scanReportsReferences() {
  const hits = [];
  for (const filePath of collectFiles()) {
    if (!filePath.endsWith(".mjs")) {
      continue;
    }
    const text = readFileSync(filePath, "utf8");
    if (/["']reports\/[^"']+\.handoff\.json["']/i.test(text)) {
      hits.push(filePath);
    }
  }
  return hits;
}

function scanHandoffDomains() {
  const hits = [];
  const examplesDir = path.join(root, "examples");
  for (const name of readdirSync(examplesDir)) {
    if (!name.endsWith(".handoff.fixture.json")) {
      continue;
    }
    const data = JSON.parse(readFileSync(path.join(examplesDir, name), "utf8"));
    const domain = data.inputs?.domain;
    if (domain != null && domain !== "example.com") {
      hits.push({ name, domain });
    }
  }
  return hits;
}

function scanFictionalCompetitors() {
  const hits = [];
  const examplesDir = path.join(root, "examples");
  const brandPattern = /\b(slack|teams|zoom|discord|asana)\b/i;
  for (const name of readdirSync(examplesDir)) {
    if (!name.endsWith(".json")) {
      continue;
    }
    const text = readFileSync(path.join(examplesDir, name), "utf8");
    if (brandPattern.test(text) && !text.includes("ProductA")) {
      hits.push(name);
    }
  }
  return hits;
}

const checks = [
  {
    id: "XP1",
    pass: () => scanDenylist().length === 0,
    detail: "no denylisted client domains in skill artifacts"
  },
  {
    id: "XP2",
    pass: () => scanReportsReferences().length === 0,
    detail: "no verifier references to reports/*.handoff.json fixtures"
  },
  {
    id: "XP3",
    pass: () => scanHandoffDomains().length === 0,
    detail: "handoff fixtures use example.com or null domain only"
  },
  {
    id: "XP4",
    pass: () => scanFictionalCompetitors().length === 0,
    detail: "fixture competitor strings use fictional names only"
  }
];

let failed = 0;
for (const check of checks) {
  const pass = check.pass();
  console.log(`${pass ? "PASS" : "FAIL"} ${check.id}: ${check.detail}`);
  if (!pass) {
    failed += 1;
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll XP1–XP4 client-agnostic checks passed.");
