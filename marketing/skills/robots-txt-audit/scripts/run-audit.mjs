#!/usr/bin/env node
/**
 * Primary agent entry: assess robots.txt, write reports, print layperson summary.
 *
 * Usage:
 *   node scripts/run-audit.mjs --robots path/to/fetched.txt --domain example.com --policy max_discovery
 *   node scripts/run-audit.mjs --robots path/to/fetched.txt --domain example.com --policy max_discovery --recheck
 *   node scripts/run-audit.mjs --robots path/to/fetched.txt --domain example.com --policy max_discovery --sitemap-fetch path/to/fetches.json
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeAuditReports } from "./build-layperson-summary.mjs";
import { canonicalDiscoveryUrls } from "./policy-presets.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = {
    robots: null,
    domain: null,
    policy: "audit_only",
    recheck: false,
    outputDir: null,
    handoffJson: false,
    keyPages: [],
    sitemapFetch: null,
    indexControl: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--recheck") {
      opts.recheck = true;
    } else if (arg === "--handoff-json") {
      opts.handoffJson = true;
    } else if (arg === "--robots") {
      opts.robots = argv[++i];
    } else if (arg === "--domain") {
      opts.domain = argv[++i];
    } else if (arg === "--policy") {
      opts.policy = argv[++i];
    } else if (arg === "--output-dir") {
      opts.outputDir = argv[++i];
    } else if (arg === "--key-pages") {
      opts.keyPages = JSON.parse(readFileSync(argv[++i], "utf8"));
    } else if (arg === "--sitemap-fetch") {
      opts.sitemapFetch = JSON.parse(readFileSync(argv[++i], "utf8"));
    } else if (arg === "--index-control") {
      opts.indexControl = JSON.parse(readFileSync(argv[++i], "utf8"));
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.robots || !opts.domain) {
    console.error(
      "Usage: node scripts/run-audit.mjs --robots <file> --domain <domain> [--policy crawl_policy] [--recheck] [--sitemap-fetch fetches.json] [--index-control probes.json] [--key-pages pages.json] [--output-dir dir] [--handoff-json]"
    );
    process.exit(2);
  }

  const robotsPath = path.resolve(opts.robots);
  const content = readFileSync(robotsPath, "utf8");
  const fetchedUrls = canonicalDiscoveryUrls(opts.domain);

  const { summaryMarkdown, detailPath, result } = writeAuditReports(
    opts.domain,
    content,
    opts.policy,
    {
      outputDir: opts.outputDir,
      recheck: opts.recheck,
      fetchedUrls,
      key_pages: opts.keyPages,
      sitemap_fetch_results: opts.sitemapFetch,
      index_control_results: opts.indexControl
    }
  );

  console.log(summaryMarkdown);

  if (opts.handoffJson) {
    const detail = readFileSync(detailPath, "utf8");
    const match = detail.match(/## Handoff JSON \(v1\.0\)\s+```json\s+([\s\S]*?)```/);
    if (match) {
      console.log(match[1].trim());
    }
  }

  console.error(`\nDetail report written: ${detailPath}`);
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}

export { parseArgs };
