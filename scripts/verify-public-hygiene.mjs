#!/usr/bin/env node
/**
 * Repo-wide public hygiene gate — blocks client/internal pollution before push.
 *
 * Usage (from repo root):
 *   node scripts/verify-public-hygiene.mjs
 *
 * Config: scripts/banned-patterns.json
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(__dirname, "banned-patterns.json");

const TEXT_EXTENSIONS = new Set([
  ".md",
  ".json",
  ".mjs",
  ".js",
  ".csv",
  ".txt",
  ".yml",
  ".yaml",
  ".sh"
]);

function loadConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function posixRel(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function listTrackedFiles() {
  try {
    const out = execFileSync("git", ["ls-files", "-z"], {
      cwd: REPO_ROOT,
      encoding: "buffer"
    });
    return out
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((rel) => path.join(REPO_ROOT, rel));
  } catch {
    return walkFiles(REPO_ROOT).filter((abs) => {
      const rel = posixRel(abs);
      return !rel.startsWith(".git/") && rel !== ".git";
    });
  }
}

function walkFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") {
      continue;
    }
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(abs, acc);
    } else if (entry.isFile()) {
      acc.push(abs);
    }
  }
  return acc;
}

function globToRegExp(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{GLOBSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/\{\{GLOBSTAR\}\}/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i");
}

function matchesAnyGlob(relPosix, globs) {
  return globs.some(({ pattern }) => globToRegExp(pattern).test(relPosix));
}

function isExcluded(relPosix, excludes) {
  return excludes.some((entry) => relPosix === entry || relPosix.endsWith(`/${entry}`));
}

function scanBannedSubstrings(files, config) {
  const failures = [];
  const regexes = config.banned_substrings.map((rule) => ({
    id: rule.id,
    note: rule.note,
    re: new RegExp(rule.pattern, rule.flags ?? "i")
  }));

  for (const abs of files) {
    const rel = posixRel(abs);
    if (isExcluded(rel, config.substring_scan_exclude)) {
      continue;
    }
    const ext = path.extname(abs).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) {
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    for (const { id, note, re } of regexes) {
      if (re.test(text)) {
        failures.push({
          id,
          file: rel,
          message: `Banned substring (${note ?? re.source})`
        });
      }
    }
  }
  return failures;
}

function scanBannedPaths(files, config) {
  const failures = [];
  for (const abs of files) {
    const rel = posixRel(abs);
    for (const rule of config.banned_path_globs) {
      if (globToRegExp(rule.pattern).test(rel)) {
        failures.push({
          id: rule.id,
          file: rel,
          message: `Banned path (${rule.note ?? rule.pattern})`
        });
      }
    }
  }
  return failures;
}

function scanFixtureNaming(files) {
  const failures = [];
  for (const abs of files) {
    const rel = posixRel(abs);
    if (!/\/examples\//.test(rel)) {
      continue;
    }
    const base = path.basename(rel);
    if (!base.endsWith(".handoff.json")) {
      continue;
    }
    if (base.endsWith(".handoff.sample.json")) {
      continue;
    }
    if (!/\.fixture\./.test(base)) {
      failures.push({
        id: "F1",
        file: rel,
        message: "examples/ handoff files must use .fixture. in the filename"
      });
    }
  }
  return failures;
}

function normalizeHost(host) {
  return host.replace(/^www\./i, "").toLowerCase();
}

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function scanFixtureDomains(files, config) {
  const failures = [];
  const domainAllow = new Set(config.fixture_domain_allowlist.map((d) => d.toLowerCase()));
  const urlAllow = new Set(config.fixture_url_host_allowlist.map((d) => d.toLowerCase()));

  for (const abs of files) {
    const rel = posixRel(abs);
    if (!rel.includes("/examples/") || !rel.endsWith(".json")) {
      continue;
    }
    if (!/\.fixture\./.test(path.basename(rel))) {
      continue;
    }
    let data;
    try {
      data = JSON.parse(fs.readFileSync(abs, "utf8"));
    } catch {
      failures.push({ id: "F0", file: rel, message: "Invalid JSON in fixture" });
      continue;
    }

    const inputDomain = data?.inputs?.domain;
    if (typeof inputDomain === "string" && inputDomain.length > 0) {
      const domain = inputDomain.toLowerCase();
      if (!domainAllow.has(domain)) {
        failures.push({
          id: "F2",
          file: rel,
          message: `inputs.domain "${inputDomain}" not in allowlist`
        });
      }
    }

    const urlFields = [
      data?.inputs?.target_url,
      data?.inputs?.anchor_url
    ].filter((value) => typeof value === "string");

    for (const url of urlFields) {
      const host = hostFromUrl(url);
      if (host && !urlAllow.has(normalizeHost(host))) {
        failures.push({
          id: "F3",
          file: rel,
          message: `Fixture URL host "${host}" not in allowlist`
        });
      }
    }
  }
  return failures;
}

function scanSkillInvocationNames(files) {
  const failures = [];
  for (const abs of files) {
    const rel = posixRel(abs);
    if (!rel.endsWith("SKILL.md")) {
      continue;
    }
    const text = fs.readFileSync(abs, "utf8");
    const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!block) {
      continue;
    }
    const nameMatch = block[1].match(/^name:\s*(.+)$/m);
    if (!nameMatch) {
      continue;
    }
    const name = nameMatch[1].trim();
    if (/\s/.test(name)) {
      failures.push({
        id: "N1",
        file: rel,
        message: `Frontmatter name "${name}" contains spaces — use hyphens for slash invocation (e.g. ${name.replace(/\s+/g, "-")})`
      });
    }
  }
  return failures;
}

function main() {
  const config = loadConfig();
  const files = listTrackedFiles();
  const failures = [
    ...scanBannedPaths(files, config),
    ...scanBannedSubstrings(files, config),
    ...scanFixtureNaming(files),
    ...scanFixtureDomains(files, config),
    ...scanSkillInvocationNames(files)
  ];

  if (failures.length === 0) {
    console.log(`PASS public hygiene (${files.length} tracked files)`);
    return;
  }

  console.error(`FAIL public hygiene (${failures.length} issue(s)):\n`);
  for (const failure of failures) {
    console.error(`  [${failure.id}] ${failure.file}: ${failure.message}`);
  }
  console.error("\nSee CONTRIBUTING.md and scripts/banned-patterns.json.");
  process.exit(1);
}

main();
