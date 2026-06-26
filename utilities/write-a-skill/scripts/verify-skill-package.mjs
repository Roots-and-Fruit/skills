#!/usr/bin/env node
/**
 * Verify a skill folder matches the declared package tier (write-a-skill standard).
 *
 * Usage (from write-a-skill/):
 *   node scripts/verify-skill-package.mjs --path ../../marketing/site-content-catalog --tier C --public
 *   node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json
 *
 * Options:
 *   --path <dir>       Skill root directory
 *   --tier <A|B|C>     Declared package tier
 *   --public           Require REQUIREMENTS.md (public marketing / playbook skills)
 *   --run-verifiers    Tier C: also run scripts/verify-*.mjs (except this script)
 *   --fixture <file>   Batch mode: { "packages": [ { "id", "path", "tier", "public"?, "run_verifiers"? } ] }
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRITE_A_SKILL_ROOT = path.resolve(__dirname, "..");

const TIERS = new Set(["A", "B", "C"]);

function parseArgs(argv) {
  let skillPath = null;
  let tier = null;
  let fixture = null;
  let isPublic = false;
  let runVerifiers = false;

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--path") {
      skillPath = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--tier") {
      tier = (argv[i + 1] ?? "").toUpperCase();
      i += 1;
      continue;
    }
    if (arg === "--fixture") {
      fixture = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (arg === "--public") {
      isPublic = true;
      continue;
    }
    if (arg === "--run-verifiers") {
      runVerifiers = true;
    }
  }

  return { skillPath, tier, fixture, isPublic, runVerifiers };
}

function resolveSkillPath(p) {
  if (path.isAbsolute(p)) {
    return p;
  }
  return path.resolve(process.cwd(), p);
}

function readSkillMd(skillRoot) {
  const file = path.join(skillRoot, "SKILL.md");
  if (!fs.existsSync(file)) {
    return null;
  }
  return fs.readFileSync(file, "utf8");
}

function hasFrontmatterDescription(content) {
  return /^---[\s\S]*?\ndescription:\s*>?[\s\S]*?---/m.test(content);
}

function parseFrontmatterBlock(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return match ? match[1] : null;
}

function extractDescription(content) {
  const block = parseFrontmatterBlock(content);
  if (!block) {
    return "";
  }
  const folded = block.match(/description:\s*>\s*\r?\n((?:[ \t].+\r?\n?)+)/);
  if (folded) {
    return folded[1]
      .split(/\r?\n/)
      .map((line) => line.replace(/^[ \t]+/, ""))
      .join(" ")
      .trim();
  }
  const inline = block.match(/description:\s*(.+)/);
  return inline ? inline[1].trim() : "";
}

function isModelInvokedSkill(content) {
  const block = parseFrontmatterBlock(content) ?? "";
  return !/disable-model-invocation:\s*true/i.test(block);
}

function countTriggerPhrases(description) {
  const match = description.match(/(?:Use when|Use for|Use before)\b([\s\S]*)$/i);
  if (!match) {
    return 0;
  }
  return match[1]
    .split(/\s*,\s*|\s+or\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 3).length;
}

function globExists(dir, patternFn) {
  if (!fs.existsSync(dir)) {
    return false;
  }
  const names = fs.readdirSync(dir);
  return names.some(patternFn);
}

function isMarketingDomainSkill(skillRoot) {
  const normalized = skillRoot.replace(/\\/g, "/");
  return (
    normalized.includes("/marketing/") &&
    !normalized.includes("/utilities/") &&
    !normalized.endsWith("/marketing")
  );
}

function buildChecks(skillRoot, tier, options) {
  const { isPublic, runVerifiers } = options;
  const skillMd = readSkillMd(skillRoot);
  const marketingDomain = isMarketingDomainSkill(skillRoot);
  const checks = [];

  checks.push({
    id: "P1",
    pass: () => skillMd !== null,
    detail: "SKILL.md exists"
  });

  checks.push({
    id: "P2",
    pass: () => skillMd && hasFrontmatterDescription(skillMd),
    detail: "SKILL.md has YAML frontmatter with description"
  });

  if (skillMd && isModelInvokedSkill(skillMd)) {
    const description = extractDescription(skillMd);
    checks.push({
      id: "P13",
      pass: () => /^(?:Use when|Use for|Use before)\b/i.test(description),
      detail: "description starts with Use when / Use for / Use before (model-invoked)"
    });
    checks.push({
      id: "P14",
      pass: () => countTriggerPhrases(description) >= 2,
      detail: "description trigger line has ≥2 distinct user phrases"
    });
  }

  checks.push({
    id: "P3",
    pass: () => skillMd && /## Done definition/i.test(skillMd),
    detail: "SKILL.md has Done definition section"
  });

  const needsRequirements =
    (isPublic && TIERS.has(tier)) ||
    (marketingDomain && (tier === "B" || tier === "C"));

  if (needsRequirements) {
    checks.push({
      id: "P4",
      pass: () => fs.existsSync(path.join(skillRoot, "REQUIREMENTS.md")),
      detail: "REQUIREMENTS.md exists (public / tier B+)"
    });
  }

  if (marketingDomain && (tier === "B" || tier === "C")) {
    checks.push({
      id: "P5",
      pass: () => skillMd && /## Input policy/i.test(skillMd),
      detail: "SKILL.md has Input policy (marketing domain)"
    });
  }

  if (tier === "B" || tier === "C") {
    checks.push({
      id: "P6",
      pass: () => fs.existsSync(path.join(skillRoot, "REFERENCE.md")),
      detail: "REFERENCE.md exists (tier B+)"
    });
    checks.push({
      id: "P7",
      pass: () => fs.existsSync(path.join(skillRoot, "EXAMPLES.md")),
      detail: "EXAMPLES.md exists (tier B+)"
    });
  }

  if (tier === "C") {
    const examplesDir = path.join(skillRoot, "examples");
    const scriptsDir = path.join(skillRoot, "scripts");

    checks.push({
      id: "P8",
      pass: () =>
        globExists(examplesDir, (n) => n.startsWith("SCORECARD-") && n.endsWith(".md")),
      detail: "examples/SCORECARD-*.md exists"
    });

    checks.push({
      id: "P9",
      pass: () =>
        globExists(
          examplesDir,
          (n) => n.endsWith(".json") && (n.includes("fixture") || n.includes(".handoff."))
        ),
      detail: "examples/*fixture*.json exists"
    });

    checks.push({
      id: "P10",
      pass: () =>
        globExists(
          scriptsDir,
          (n) => n.startsWith("verify-") && n.endsWith(".mjs") && n !== "verify-skill-package.mjs"
        ),
      detail: "scripts/verify-*.mjs exists"
    });

    checks.push({
      id: "P11",
      pass: () =>
        skillMd &&
        (/ship bar/i.test(skillMd) ||
          /node scripts\/verify-/i.test(skillMd)),
      detail: "SKILL.md documents ship bar / verify command"
    });

    if (runVerifiers) {
      checks.push({
        id: "P12",
        pass: () => runChildVerifiers(skillRoot),
        detail: "child verify-*.mjs scripts exit 0"
      });
    }
  }

  return checks;
}

function runChildVerifiers(skillRoot) {
  const scriptsDir = path.join(skillRoot, "scripts");
  if (!fs.existsSync(scriptsDir)) {
    return false;
  }
  const verifiers = fs
    .readdirSync(scriptsDir)
    .filter(
      (n) =>
        n.startsWith("verify-") &&
        n.endsWith(".mjs") &&
        n !== "verify-skill-package.mjs"
    );

  if (verifiers.length === 0) {
    return false;
  }

  for (const name of verifiers) {
    execFileSync(process.execPath, [path.join(scriptsDir, name)], {
      cwd: skillRoot,
      stdio: "pipe"
    });
  }
  return true;
}

function runPackage(label, skillRoot, tier, options) {
  const checks = buildChecks(skillRoot, tier, options);
  let failed = 0;

  console.log(`\n=== ${label} ===`);
  console.log(`Path: ${skillRoot}`);
  console.log(`Tier: ${tier}`);

  for (const check of checks) {
    let ok = false;
    try {
      ok = check.pass();
    } catch (err) {
      console.log(`FAIL ${check.id} — ${check.detail} (${err.message})`);
      failed += 1;
      continue;
    }
    console.log(`${ok ? "PASS" : "FAIL"} ${check.id} — ${check.detail}`);
    if (!ok) {
      failed += 1;
    }
  }

  return failed;
}

function loadFixture(fixturePath) {
  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.resolve(process.cwd(), fixturePath);
  const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (!Array.isArray(data.packages)) {
    throw new Error("Fixture must have packages[]");
  }
  return { resolved, data };
}

function main() {
  const { skillPath, tier, fixture, isPublic, runVerifiers } = parseArgs(process.argv);

  if (fixture) {
    const { data } = loadFixture(fixture);
    let totalFailed = 0;
    for (const pkg of data.packages) {
      const root = resolveSkillPath(
        path.isAbsolute(pkg.path)
          ? pkg.path
          : path.resolve(WRITE_A_SKILL_ROOT, pkg.path)
      );
      const pkgTier = (pkg.tier ?? "").toUpperCase();
      if (!TIERS.has(pkgTier)) {
        console.error(`Invalid tier for ${pkg.id}: ${pkg.tier}`);
        process.exit(2);
      }
      const failed = runPackage(pkg.id ?? root, root, pkgTier, {
        isPublic: Boolean(pkg.public),
        runVerifiers: Boolean(pkg.run_verifiers)
      });
      totalFailed += failed;
    }
    if (totalFailed > 0) {
      console.error(`\n${totalFailed} package check(s) failed.`);
      process.exit(1);
    }
    console.log("\nAll fixture package checks passed.");
    return;
  }

  if (!skillPath || !tier) {
    console.error(
      "Usage: node scripts/verify-skill-package.mjs --path <dir> --tier <A|B|C> [--public] [--run-verifiers]"
    );
    console.error(
      "   or: node scripts/verify-skill-package.mjs --fixture examples/skill-packages.fixture.json"
    );
    process.exit(2);
  }

  if (!TIERS.has(tier)) {
    console.error(`Invalid tier: ${tier}`);
    process.exit(2);
  }

  const root = resolveSkillPath(skillPath);
  const failed = runPackage("single", root, tier, { isPublic, runVerifiers });
  if (failed > 0) {
    console.error(`\n${failed} package check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll package checks passed.");
}

main();
