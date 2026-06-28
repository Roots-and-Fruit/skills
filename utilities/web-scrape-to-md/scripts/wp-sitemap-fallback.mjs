#!/usr/bin/env node
/**
 * WordPress / Slim SEO sitemap fallback and blog-archive helpers.
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

const GENERIC_BLOG_PATHS = ["/blog/", "/news/", "/posts/", "/insights/"];

/**
 * Blog index URLs to try when sitemap discovery fails.
 * @param {string} domain
 * @param {string[]} [seedUrls] — archive URLs from llms.txt or user input (tried first)
 */
export function blogArchiveCandidates(domain, seedUrls = []) {
  const base = siteBase(domain);
  const seen = new Set();
  const out = [];

  const push = (raw) => {
    if (!raw || typeof raw !== "string") {
      return;
    }
    try {
      const url = raw.startsWith("http")
        ? raw
        : `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
      const normalized = new URL(url).toString();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    } catch {
      /* skip invalid */
    }
  };

  for (const seed of seedUrls) {
    push(seed);
  }
  for (const segment of GENERIC_BLOG_PATHS) {
    push(`${base}${segment.replace(/^\//, "")}`);
  }
  return out;
}

/** Path prefix for post permalinks from a fetched archive index URL. */
export function blogPathPrefixFromArchiveUrl(archiveUrl) {
  const u = new URL(archiveUrl);
  let pathname = u.pathname;
  if (!pathname.endsWith("/")) {
    pathname = `${pathname}/`;
  }
  return pathname;
}

/** Extract same-domain post URLs from archive page fetch (markdown or HTML). */
export function extractArchivePostUrls(content, archiveUrl, domain) {
  const host = normalizeDomain(domain).replace(/^www\./i, "");
  const archivePath = blogPathPrefixFromArchiveUrl(archiveUrl);
  const archiveDepth = archivePath.split("/").filter(Boolean).length;
  const urls = new Set();
  const patterns = [
    /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi,
    /href=["'](https?:\/\/[^"'#]+)["']/gi
  ];

  for (const re of patterns) {
    let match = re.exec(content);
    while (match) {
      try {
        const u = new URL(match[1]);
        const linkHost = u.hostname.replace(/^www\./i, "");
        if (linkHost !== host && !linkHost.endsWith(`.${host}`)) {
          match = re.exec(content);
          continue;
        }
        const depth = u.pathname.split("/").filter(Boolean).length;
        if (depth <= archiveDepth) {
          match = re.exec(content);
          continue;
        }
        if (!u.pathname.startsWith(archivePath.replace(/\/$/, ""))) {
          match = re.exec(content);
          continue;
        }
        urls.add(u.href.endsWith("/") ? u.href : `${u.href}/`);
      } catch {
        /* skip */
      }
      match = re.exec(content);
    }
  }

  return [...urls];
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

/** Heuristic: URL is a blog/post archive index (not a single post). */
export function isArchiveIndexUrl(url) {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    if (segments.length !== 1) {
      return false;
    }
    return /^(blog|news|posts|insights|resources|articles|writing)$/i.test(
      segments[0]
    );
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

/** Lowercase hyphen slug from plain text (WordPress-style permalinks). */
export function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

/**
 * Ordered slug candidates when archive teaser has no permalink.
 * First sentence only; tries full headline, drop-first-word, and drop lead-in variants.
 */
export function slugCandidatesFromTeaser(teaser) {
  const head = String(teaser).split(/[;.!?]/)[0].trim();
  if (!head) {
    return [];
  }

  const candidates = [];
  const push = (phrase) => {
    const slug = slugify(phrase);
    if (slug && !candidates.includes(slug)) {
      candidates.push(slug);
    }
  };

  push(head);
  const words = head.split(/\s+/);
  if (words.length > 3) {
    push(words.slice(1).join(" "));
  }
  push(head.replace(/^(agent|the|a|an|my|our)\s+/i, ""));

  return candidates;
}

/**
 * Build post permalinks from slug candidates under the archive path prefix.
 * @param {string} pathPrefix — from `blogPathPrefixFromArchiveUrl(blog_archive_url)` (never hardcode a site path)
 */
export function postUrlsFromSlugs(domain, slugs, pathPrefix) {
  if (!pathPrefix) {
    throw new Error("pathPrefix required — derive from blog_archive_url");
  }
  const base = siteBase(domain);
  const prefix = pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`;
  const segment = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return slugs.map((slug) => `${base}${segment}${slug}/`.replace(/([^:]\/)\/+/g, "$1"));
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
