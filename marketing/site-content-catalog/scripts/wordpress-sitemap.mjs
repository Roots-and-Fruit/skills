#!/usr/bin/env node
/**
 * WordPress / Yoast / core sitemap child detection — SSOT for content post-type sitemaps.
 *
 * Usage:
 *   node wordpress-sitemap.mjs --child "https://example.com/post-sitemap.xml"
 *   node wordpress-sitemap.mjs --file ../examples/wordpress-sitemap-index.fixture.json
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/** Sitemap slug → page_type when URL heuristics do not already decide. */
export const SITEMAP_POST_TYPE_PAGE_TYPE = {
  post: "blog_post",
  page: "landing_page"
};

/** Included in discovery; map to blog_post unless URL rules override earlier. */
export const BLOG_SITEMAP_POST_TYPES = new Set(["post"]);

/**
 * Child sitemap post-type slugs that are never content inventory (taxonomies, media, authors).
 */
export const EXCLUDED_SITEMAP_POST_TYPES = new Set([
  "attachment",
  "category",
  "post_tag",
  "tag",
  "author",
  "post_format",
  "product_cat",
  "product_tag"
]);

/** Suffixes on custom taxonomy sitemaps (e.g. newsletterglue_cat-sitemap.xml). */
export const EXCLUDED_SITEMAP_SUFFIXES = [
  "_cat",
  "_tag",
  "_category",
  "-cat",
  "-tag",
  "-category"
];

function pathnameFromUrl(urlString) {
  try {
    return decodeURIComponent(new URL(urlString).pathname).toLowerCase();
  } catch {
    return String(urlString).toLowerCase();
  }
}

/**
 * Extract WordPress content post-type slug from a child sitemap URL.
 * Supports Yoast/RankMath `{type}-sitemap.xml` and core `wp-sitemap-posts-{type}-N.xml`.
 */
export function parseChildSitemapPostType(sitemapUrl) {
  const pathname = pathnameFromUrl(sitemapUrl);

  const coreMatch = pathname.match(/wp-sitemap-posts-([a-z0-9_-]+)-\d+\.xml$/i);
  if (coreMatch) {
    return coreMatch[1].toLowerCase();
  }

  const yoastMatch = pathname.match(/\/([a-z0-9_-]+)-sitemap\d*\.xml$/i);
  if (yoastMatch) {
    return yoastMatch[1].toLowerCase();
  }

  return null;
}

export function isExcludedSitemapPostType(postType) {
  if (!postType) {
    return false;
  }
  const slug = postType.toLowerCase();
  if (EXCLUDED_SITEMAP_POST_TYPES.has(slug)) {
    return true;
  }
  if (slug.startsWith("pa_")) {
    return true;
  }
  return EXCLUDED_SITEMAP_SUFFIXES.some((suffix) => slug.endsWith(suffix));
}

/**
 * True when this child sitemap should be fetched for the content catalog.
 */
export function shouldIncludeChildSitemap(sitemapUrl) {
  const postType = parseChildSitemapPostType(sitemapUrl);
  if (!postType) {
    return true;
  }
  return !isExcludedSitemapPostType(postType);
}

/**
 * Filter sitemap index <loc> entries to content post-type child sitemaps.
 */
export function filterContentChildSitemaps(sitemapLocs) {
  return sitemapLocs.filter((loc) => shouldIncludeChildSitemap(loc));
}

/**
 * Summarize included child sitemaps for handoff discovery_summary.content_sitemaps[].
 */
export function summarizeContentSitemaps(entries) {
  return entries.map((row) => ({
    sitemap_url: row.sitemap_url,
    post_type: row.post_type,
    url_count: typeof row.url_count === "number" ? row.url_count : 0
  }));
}

function parseArgs(argv) {
  let child = null;
  let file = null;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--child") {
      child = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (argv[i] === "--file") {
      file = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return { child, file };
}

function main() {
  const { child, file } = parseArgs(process.argv);

  if (child) {
    const postType = parseChildSitemapPostType(child);
    console.log(
      JSON.stringify(
        {
          sitemap_url: child,
          post_type: postType,
          include: shouldIncludeChildSitemap(child)
        },
        null,
        2
      )
    );
    return;
  }

  if (file) {
    const resolved = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    const data = JSON.parse(fs.readFileSync(resolved, "utf8"));
    const locs = data.child_sitemaps ?? data.sitemap_locs ?? [];
    const included = filterContentChildSitemaps(locs).map((sitemap_url) => ({
      sitemap_url,
      post_type: parseChildSitemapPostType(sitemap_url),
      include: true
    }));
    const excluded = locs
      .filter((loc) => !shouldIncludeChildSitemap(loc))
      .map((sitemap_url) => ({
        sitemap_url,
        post_type: parseChildSitemapPostType(sitemap_url),
        include: false
      }));
    console.log(JSON.stringify({ included, excluded }, null, 2));
    return;
  }

  console.error("Provide --child or --file");
  process.exit(2);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main();
}
