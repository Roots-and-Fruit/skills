#!/usr/bin/env node
/**
 * Assess per-page corpus markdown quality (Q-layer).
 *
 * Usage (from web-scrape-to-md/):
 *   node scripts/assess-page-md.mjs --file examples/good-page.md.fixture.md
 *   node scripts/assess-page-md.mjs --file examples/bad-page-html-dump.md.fixture.md
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HTML_TAG = /<[a-z][a-z0-9]*\b[^>]*>/i;

export function assessPageMd(content, options = {}) {
  const maxLines = options.maxLines ?? 120;
  const minLines = options.minLines ?? 5;
  const lines = content.split(/\r?\n/);
  const nonHeaderLines = lines.filter(
    (line) => line.trim() && !line.startsWith("- **") && !line.startsWith("# ")
  );

  const checks = [
    {
      id: "Q1",
      pass: () => /^#\s+.+/m.test(content)
    },
    {
      id: "Q2",
      pass: () => /\*\*URL:\*\*\s+https?:\/\//i.test(content)
    },
    {
      id: "Q3",
      pass: () => /\*\*(Fetched|Status):\*\*/i.test(content)
    },
    {
      id: "Q4",
      pass: () => !HTML_TAG.test(content)
    },
    {
      id: "Q5",
      pass: () => lines.length >= minLines && lines.length <= maxLines
    },
    {
      id: "Q6",
      pass: () => /^##\s+/m.test(content)
    },
    {
      id: "Q7",
      pass: () => nonHeaderLines.length >= 3
    }
  ];

  return checks.map((check) => ({
    id: check.id,
    pass: Boolean(check.pass())
  }));
}

export function allPassed(results) {
  return results.every((row) => row.pass);
}

function parseArgs(argv) {
  let file = null;
  let maxLines = 120;

  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--file") {
      file = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (argv[i] === "--max-lines") {
      maxLines = Number(argv[i + 1]);
      i += 1;
    }
  }

  return { file, maxLines };
}

function main() {
  const { file, maxLines } = parseArgs(process.argv);
  if (!file) {
    console.error("Usage: node scripts/assess-page-md.mjs --file <path> [--max-lines 120]");
    process.exit(2);
  }

  const content = readFileSync(path.resolve(file), "utf8");
  const results = assessPageMd(content, { maxLines });
  let failed = 0;

  for (const row of results) {
    const status = row.pass ? "PASS" : "FAIL";
    console.log(`${row.id} ${status}`);
    if (!row.pass) {
      failed += 1;
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
