#!/usr/bin/env node
/**
 * WordPress / Slim SEO sitemap fallback URL candidates when root sitemap fails.
 *
 * Usage:
 *   node scripts/wp-sitemap-fallback.mjs --domain example.com
 *   node scripts/wp-sitemap-fallback.mjs --domain example.com --blog-archive
 */
import { fileURLToPath } from "node:url";
import path from "node:path";

export function normalizeDomain(domain) {
  return String(domain)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

export function siteBase(domain) {
  return `https://${normalizeDomain(domain)}`;
}

/** Child sitemaps to try when /sitemap.xml returns HTTP error (Slim SEO, Yoast, core WP). */
export function childSitemapCandidates(domain) {
  const base = siteBase(domain);
  return [
    `${base}/sitemap-post-type-post.xml`,
    `${base}/sitemap-post-type-page.xml`,
    `${base}/post-sitemap.xml`,
    `${base}/page-sitemap.xml`,
    `${base}/wp-sitemap-posts-post-1.xml`,
    `${base}/wp-sitemap-posts-page-1.xml`
  ];
}

/** Blog index paths to fetch for recent post link extraction when sitemap unavailable. */
export function blogArchiveCandidates(domain) {
  const base = siteBase(domain);
  return [`${base}/articles/`, `${base}/blog/`, `${base}/news/`];
}

/** Extract <loc> URLs from sitemap XML text (stdlib only). */
export function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match = re.exec(xml);
  while (match) {
    locs.push(match[1].trim());
    match = re.exec(xml);
  }
  return locs;
}

/** Heuristic: llms.txt line links to a blog/articles archive index. */
export function isArchiveIndexUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return /\/(articles|blog|news|posts)$/i.test(pathname);
  } catch {
    return false;
  }
}

/** Goal text triggers freshness / recent-post discovery. */
export function goalNeedsFreshness(goal) {
  const text = String(goal).toLowerCase();
  return /\b(blog|article|post|corpus|research|content|publish|recent|latest|news)\b/.test(
    text
  );
}

function parseArgs(argv) {
  let domain = null;
  let blogArchive = false;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--domain") {
      domain = argv[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (argv[i] === "--blog-archive") {
      blogArchive = true;
    }
  }
  return { domain, blogArchive };
}

function main() {
  const { domain, blogArchive } = parseArgs(process.argv);
  if (!domain) {
    console.error(
      "Usage: node scripts/wp-sitemap-fallback.mjs --domain <domain> [--blog-archive]"
    );
    process.exit(2);
  }
  const urls = blogArchive
    ? blogArchiveCandidates(domain)
    : childSitemapCandidates(domain);
  for (const url of urls) {
    console.log(url);
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
