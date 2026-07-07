#!/usr/bin/env node
/**
 * Chain merge → normalize → apply-priority → apply-coverage → handoff merge → layperson reports.
 *
 * Usage:
 *   node scripts/run-fanout.mjs \
 *     --seed "wordpress product go to market" \
 *     --lane primary_topic \
 *     --intent-split mixed \
 *     --merged path/to/merged.json \
 *     --ranked-file path/to/ranked.json \
 *     --partial path/to/handoff-partial.json \
 *     --output path/to/handoff.json \
 *     --write-reports
 *
 * Build merged.json from MCP exports:
 *   node scripts/merge-expansion-input.mjs --serp serp.json --labs related.json -o merged.json
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeFanoutItems } from "./normalize-fanout.mjs";
import { writeFanoutReports } from "./build-layperson-summary.mjs";
import { applyCoverageToHandoff } from "./apply-coverage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_VERSION = "2.8.0";

function parseArgs(argv) {
  const opts = {
    seed: "",
    lane: null,
    intentSplit: "single",
    merged: null,
    rankedFile: null,
    intentFile: null,
    partial: null,
    output: null,
    writeReports: false,
    outputDir: null
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write-reports") {
      opts.writeReports = true;
    } else if (arg === "--seed") {
      opts.seed = argv[++i] ?? "";
    } else if (arg === "--lane") {
      opts.lane = argv[++i] ?? null;
    } else if (arg === "--intent-split") {
      opts.intentSplit = argv[++i] ?? "single";
    } else if (arg === "--merged") {
      opts.merged = argv[++i] ?? null;
    } else if (arg === "--ranked-file" || arg === "--ranked") {
      opts.rankedFile = argv[++i] ?? null;
    } else if (arg === "--intent-file") {
      opts.intentFile = argv[++i] ?? null;
    } else if (arg === "--partial") {
      opts.partial = argv[++i] ?? null;
    } else if (arg === "--output") {
      opts.output = argv[++i] ?? null;
    } else if (arg === "--output-dir") {
      opts.outputDir = argv[++i] ?? null;
    }
  }

  return opts;
}

function loadJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

async function runApplyPriority(rows, intentSplit, lane, intentFile) {
  const { execFileSync } = await import("node:child_process");
  const script = path.join(__dirname, "apply-priority.mjs");
  const args = [
    script,
    "--intent-split",
    intentSplit
  ];
  if (lane) {
    args.push("--lane", lane);
  }
  if (intentFile) {
    args.push("--intent-file", path.resolve(intentFile));
  }
  const stdout = execFileSync(process.execPath, args, {
    input: JSON.stringify(rows),
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.seed || !opts.merged) {
    console.error(
      "Usage: node scripts/run-fanout.mjs --seed <kw> --merged <file.json> [--lane L] [--intent-split mixed|single] [--ranked-file ranked.json] [--intent-file f] [--partial handoff.json] [--output out.json] [--write-reports]"
    );
    process.exit(2);
  }

  const merged = loadJson(opts.merged);
  const items = Array.isArray(merged) ? merged : merged.items ?? [];
  const normalized = await normalizeFanoutItems(items, opts.seed, opts.lane);
  const applied = await runApplyPriority(
    normalized,
    opts.intentSplit,
    opts.lane,
    opts.intentFile
  );

  let handoff = opts.partial ? loadJson(opts.partial) : {};
  handoff = {
    handoff_version: "1.1",
    skill: "fan-out-coverage-analysis",
    skill_version: SKILL_VERSION,
    mode: handoff.mode ?? "keyword_only",
    generated_at: handoff.generated_at ?? new Date().toISOString(),
    inputs: handoff.inputs ?? { primary_keyword: opts.seed },
    serp_context: handoff.serp_context ?? {},
    limitations: handoff.limitations ?? [],
    ...handoff,
    sub_queries: applied.sub_queries,
    priority_sub_queries: applied.priority_sub_queries
  };

  if (handoff.mode === "domain_coverage" && opts.rankedFile) {
    const ranked = loadJson(opts.rankedFile);
    handoff = applyCoverageToHandoff(handoff, ranked);
  }

  if (opts.output) {
    const outPath = path.resolve(opts.output);
    writeFileSync(outPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
    console.error(`Handoff written: ${outPath}`);
  }

  if (opts.writeReports) {
    const { summaryMarkdown, detailPath } = writeFanoutReports(handoff, {
      outputDir: opts.outputDir ? path.resolve(opts.outputDir) : undefined
    });
    console.error(`Detail report: ${detailPath}`);
    console.log(summaryMarkdown);
  } else if (!opts.output) {
    process.stdout.write(`${JSON.stringify(handoff, null, 2)}\n`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
