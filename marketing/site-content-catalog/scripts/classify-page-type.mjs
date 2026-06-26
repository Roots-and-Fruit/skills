#!/usr/bin/env node
/**
 * Classify page_type from URL (and optional title). SSOT for catalog heuristics.
 *
 * Usage:
 *   node classify-page-type.mjs --url "https://example.com/pricing"
 *   node classify-page-type.mjs --file ../examples/sitemap-urls.fixture.json
 *
 * Fixture shape: { "items": [ { "url": "...", "title": "..." }, ... ] }
 * Output: JSON array with page_type per item.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  BLOG_SITEMAP_POST_TYPES,
  SITEMAP_POST_TYPE_PAGE_TYPE
} from "./wordpress-sitemap.mjs";

export const PAGE_TYPES = [
  "blog_post",
  "landing_page",
  "product_page",
  "feature_page",
  "integration_page",
  "comparison_page",
  "documentation",
  "other"
];

const DATE_IN_PATH = /\/(\d{4})[/-](\d{2})/;

function parseArgs(argv) {
  let url = null;
  let file = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--url") {
      url = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (argv[i] === "--file") {
      file = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return { url, file };
}

function pathnameFromUrl(urlString) {
  try {
    const u = new URL(urlString);
    return decodeURIComponent(u.pathname).toLowerCase();
  } catch {
    return urlString.toLowerCase();
  }
}

function pathSegments(pathname) {
  return pathname.split("/").filter(Boolean);
}

/**
 * @param {string} url
 * @param {string} [title]
 * @param {{ sitemap_post_type?: string | null }} [options]
 * First-match wins — keep in sync with REFERENCE.md classification order.
 */
export function classifyPageType(url, title = "", options = {}) {
  const pathname = pathnameFromUrl(url);
  const segments = pathSegments(pathname);
  const joined = pathname;
  const titleLower = (title || "").toLowerCase();
  const sitemapPostType = (options.sitemap_post_type ?? "").toLowerCase() || null;

  if (/\/(docs|help|support|documentation)(\/|$)/.test(joined)) {
    return "documentation";
  }

  if (
    /\/(blog|articles|posts|news)(\/|$)/.test(joined) ||
    DATE_IN_PATH.test(joined) ||
    (sitemapPostType && BLOG_SITEMAP_POST_TYPES.has(sitemapPostType))
  ) {
    return "blog_post";
  }

  if (/\/(integrations|integrates)(\/|$)/.test(joined)) {
    return "integration_page";
  }

  if (
    /\/(vs|versus|alternative|alternatives|compare)(\/|$|-)/.test(joined) ||
    /-vs-/.test(joined) ||
    /\bvs\b/.test(titleLower)
  ) {
    return "comparison_page";
  }

  if (/\/(pricing|products|product)(\/|$)/.test(joined)) {
    return "product_page";
  }

  if (/\/(features|feature)(\/|$)/.test(joined)) {
    return "feature_page";
  }

  if (segments.length <= 1 && segments.length > 0) {
    if (sitemapPostType && SITEMAP_POST_TYPE_PAGE_TYPE[sitemapPostType]) {
      return SITEMAP_POST_TYPE_PAGE_TYPE[sitemapPostType];
    }
    if (sitemapPostType && !BLOG_SITEMAP_POST_TYPES.has(sitemapPostType)) {
      return "other";
    }
    return "landing_page";
  }

  if (pathname === "/" || segments.length === 0) {
    return "landing_page";
  }

  if (/\/(solutions|platform)(\/|$)/.test(joined)) {
    return "landing_page";
  }

  if (sitemapPostType === "page") {
    return "landing_page";
  }

  if (sitemapPostType && !BLOG_SITEMAP_POST_TYPES.has(sitemapPostType)) {
    return "other";
  }

  return "other";
}

function loadItems(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data.items)) {
    throw new Error("Fixture must have items[]");
  }
  return data.items;
}

function main() {
  const { url, file } = parseArgs(process.argv);

  if (url) {
    const page_type = classifyPageType(url);
    console.log(JSON.stringify({ url, page_type }, null, 2));
    return;
  }

  if (file) {
    const resolved = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    const items = loadItems(resolved);
    const out = items.map((row) => ({
      url: row.url,
      title: row.title ?? "",
      page_type: classifyPageType(row.url, row.title ?? "", {
        sitemap_post_type: row.sitemap_post_type ?? null
      })
    }));
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.error("Provide --url or --file");
  process.exit(2);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
