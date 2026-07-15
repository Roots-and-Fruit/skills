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
import { syncSerpContextFanout } from "./detail-report.mjs";
import { applyCoverageToHandoff } from "./apply-coverage.mjs";
import { normalizeHandoffSerpContext, normalizeIntentSplit } from "./serp-context.mjs";
import { applyPriorityPipeline } from "./apply-priority.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_VERSION = "2.12.0";

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

function resolveIntentFile(mergedPath, intentFile) {
  if (intentFile) {
    return path.resolve(intentFile);
  }
  if (!mergedPath) {
    return null;
  }
  const base = mergedPath.replace(/-merged\.json$/i, "");
  const candidate = `${base}-intents.json`;
  try {
    readFileSync(path.resolve(candidate), "utf8");
    return path.resolve(candidate);
  } catch {
    return null;
  }
}

function loadIntentsMap(intentFile) {
  if (!intentFile) {
    return {};
  }
  const data = loadJson(intentFile);
  if (data.intents && typeof data.intents === "object") {
    return data.intents;
  }
  return data;
}

async function main() {
  const opts = parseArgs(process.argv);

  if (!opts.seed || !opts.merged) {
    console.error(
      "Usage: node scripts/run-fanout.mjs --seed <kw> --merged <file.json> [--lane L] [--intent-split mixed|single] [--ranked-file ranked.json] [--intent-file f] [--partial handoff.json] [--output out.json] [--write-reports]"
    );
    process.exit(2);
  }

  let handoff = opts.partial ? loadJson(opts.partial) : {};
  const serpContext = handoff.serp_context ?? {};
  const intentSplit = normalizeIntentSplit(serpContext) || opts.intentSplit;

  const merged = loadJson(opts.merged);
  const items = Array.isArray(merged) ? merged : merged.items ?? [];
  const normalized = await normalizeFanoutItems(items, opts.seed, opts.lane, intentSplit);

  const intentPath = resolveIntentFile(opts.merged, opts.intentFile);
  const intents = intentPath ? loadIntentsMap(intentPath) : {};

  const applied = applyPriorityPipeline(normalized, {
    intentSplit,
    lane: opts.lane,
    seed: opts.seed,
    intents,
    serpContext
  });

  const domain = handoff.inputs?.domain ?? "";
  const siteProfile =
    handoff.inputs?.site_profile ??
    (/wikipedia\.org$/i.test(domain) ? "encyclopedia" : null);

  handoff = {
    handoff_version: "1.2",
    skill: "fan-out-coverage-analysis",
    skill_version: SKILL_VERSION,
    mode: handoff.mode ?? "keyword_only",
    generated_at: handoff.generated_at ?? new Date().toISOString(),
    inputs: {
      ...(handoff.inputs ?? { primary_keyword: opts.seed }),
      primary_keyword: handoff.inputs?.primary_keyword ?? opts.seed,
      ...(siteProfile ? { site_profile: siteProfile } : {})
    },
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

  handoff = syncSerpContextFanout(handoff);
  handoff = normalizeHandoffSerpContext(handoff);

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
