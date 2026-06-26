#!/usr/bin/env node
/**
 * Run page-type classification (T1–T13) and WordPress sitemap rules (W1–W8).
 *
 * Usage (from site-content-catalog/):
 *   node scripts/verify-scorecard.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyPageType } from "./classify-page-type.mjs";
import {
  filterContentChildSitemaps,
  parseChildSitemapPostType,
  shouldIncludeChildSitemap
} from "./wordpress-sitemap.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const sitemapFixture = path.join(root, "examples", "sitemap-urls.fixture.json");
const wpUrlFixture = path.join(root, "examples", "wordpress-sitemap-urls.fixture.json");
const wpIndexFixture = path.join(
  root,
  "examples",
  "wordpress-sitemap-index.fixture.json"
);

const { items } = JSON.parse(readFileSync(sitemapFixture, "utf8"));
const wpItems = JSON.parse(readFileSync(wpUrlFixture, "utf8")).items;
const wpIndex = JSON.parse(readFileSync(wpIndexFixture, "utf8"));

const byUrl = new Map(items.map((row) => [row.url, row]));

const checks = [
  {
    id: "T1",
    pass: () =>
      classifyPageType("https://example.com/blog/2024/product-launch") === "blog_post"
  },
  {
    id: "T2",
    pass: () => classifyPageType("https://example.com/pricing") === "product_page"
  },
  {
    id: "T3",
    pass: () =>
      classifyPageType("https://example.com/integrations/stripe") === "integration_page"
  },
  {
    id: "T4",
    pass: () => classifyPageType("https://example.com/docs/api") === "documentation"
  },
  {
    id: "T5",
    pass: () =>
      classifyPageType("https://example.com/vs/competitor-a") === "comparison_page"
  },
  {
    id: "T6",
    pass: () =>
      classifyPageType("https://example.com/features/analytics") === "feature_page"
  },
  {
    id: "T7",
    pass: () => classifyPageType("https://example.com/") === "landing_page"
  },
  {
    id: "T8",
    pass: () =>
      classifyPageType("https://example.com/about/team/org-chart/deep/nested") ===
      "other"
  },
  {
    id: "T9",
    pass: () => {
      const row = byUrl.get("https://example.com/articles/guides");
      return row && classifyPageType(row.url) === row.expected;
    }
  },
  {
    id: "T10",
    pass: () =>
      classifyPageType("https://example.com/not-intuitive-and-time-to-value", "", {
        sitemap_post_type: "post"
      }) === "blog_post"
  },
  {
    id: "T11",
    pass: () =>
      classifyPageType("https://example.com/about", "", {
        sitemap_post_type: "page"
      }) === "landing_page"
  },
  {
    id: "T12",
    pass: () =>
      classifyPageType("https://example.com/legacy-flat-slug") === "landing_page"
  },
  {
    id: "T13",
    pass: () =>
      classifyPageType("https://example.com/tips/what-is-gutenberg", "", {
        sitemap_post_type: "tips"
      }) === "other"
  },
  {
    id: "T14",
    pass: () =>
      wpItems.every(
        (row) =>
          classifyPageType(row.url, row.title ?? "", {
            sitemap_post_type: row.sitemap_post_type ?? null
          }) === row.expected
      )
  },
  {
    id: "W1",
    pass: () => parseChildSitemapPostType("https://example.com/post-sitemap.xml") === "post"
  },
  {
    id: "W2",
    pass: () => parseChildSitemapPostType("https://example.com/post-sitemap2.xml") === "post"
  },
  {
    id: "W3",
    pass: () => parseChildSitemapPostType("https://example.com/page-sitemap.xml") === "page"
  },
  {
    id: "W4",
    pass: () => !shouldIncludeChildSitemap("https://example.com/category-sitemap.xml")
  },
  {
    id: "W5",
    pass: () => !shouldIncludeChildSitemap("https://example.com/attachment-sitemap.xml")
  },
  {
    id: "W6",
    pass: () =>
      parseChildSitemapPostType("https://example.com/wp-sitemap-posts-post-1.xml") ===
      "post"
  },
  {
    id: "W7",
    pass: () =>
      parseChildSitemapPostType("https://example.com/wp-sitemap-posts-page-1.xml") ===
      "page"
  },
  {
    id: "W8",
    pass: () => {
      const included = filterContentChildSitemaps(wpIndex.child_sitemaps);
      const includedTypes = new Set(
        included.map((loc) => parseChildSitemapPostType(loc)).filter(Boolean)
      );
      const excludedTypes = wpIndex.child_sitemaps
        .filter((loc) => !shouldIncludeChildSitemap(loc))
        .map((loc) => parseChildSitemapPostType(loc))
        .filter(Boolean);

      const expectsIncluded = wpIndex.expected_included_post_types.every((t) =>
        includedTypes.has(t)
      );
      const expectsExcluded = wpIndex.expected_excluded_post_types.every((t) =>
        excludedTypes.includes(t)
      );
      return expectsIncluded && expectsExcluded && includedTypes.has("post");
    }
  },
  {
    id: "T15",
    pass: () =>
      classifyPageType("https://example.com/podcasts/glam-that-plugin", "", {
        sitemap_post_type: "page"
      }) === "landing_page"
  },
  {
    id: "W9",
    pass: () =>
      !shouldIncludeChildSitemap(
        "https://example.com/ngl_template_category-sitemap.xml"
      ) &&
      !shouldIncludeChildSitemap("https://example.com/ngl_pattern_category-sitemap.xml")
  }
];

let failed = 0;
for (const check of checks) {
  const ok = check.pass();
  console.log(`${ok ? "PASS" : "FAIL"} ${check.id}`);
  if (!ok) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`\n${failed} scorecard check(s) failed.`);
  process.exit(1);
}

console.log("\nAll T1–T15 and W1–W9 scorecard checks passed.");

