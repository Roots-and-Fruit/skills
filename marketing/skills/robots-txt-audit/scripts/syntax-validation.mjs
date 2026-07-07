/**
 * GSC-like robots.txt syntax validation (SSOT for SY* and SM8 sitemap typos).
 * Agents: read `syntax_validation` from assessRobotsTxtContent() — do not re-lint in prose.
 */

/** @typedef {{ id: string, severity: "warn" | "fail", line?: number, directive?: string, value?: string, message: string }} SyntaxIssue */

/** RFC 9309 / Google Search Central recognized directives (case-insensitive). */
export const ALLOWED_ROBOTS_DIRECTIVES = new Set([
  "user-agent",
  "allow",
  "disallow",
  "sitemap",
  "crawl-delay",
  "content-signal"
]);

/**
 * Non-standard sitemap directive names (case-insensitive key → display name).
 * Schemamap: Yoast SEO schema aggregator (deprecated v27.5; GSC "syntax not understood").
 */
const SITEMAP_TYPO_DIRECTIVES = {
  schemamap: "Schemamap",
  sitemaps: "Sitemaps",
  "site-map": "Site-map",
  site_map: "Site_map"
};

/**
 * Scan raw robots.txt for invalid sitemap directive spellings.
 * @param {string} content
 * @returns {SyntaxIssue[]}
 */
export function detectSitemapDirectiveTypos(content) {
  /** @type {SyntaxIssue[]} */
  const issues = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const withoutComment = raw.split("#")[0].trim();
    if (!withoutComment) {
      continue;
    }

    const colon = withoutComment.indexOf(":");
    if (colon === -1) {
      continue;
    }

    const directiveRaw = withoutComment.slice(0, colon).trim();
    const directive = directiveRaw.toLowerCase();
    const value = withoutComment.slice(colon + 1).trim();

    if (directive === "sitemap") {
      continue;
    }

    const display = SITEMAP_TYPO_DIRECTIVES[directive];
    if (!display) {
      continue;
    }

    const hint =
      directive === "schemamap"
        ? " — Yoast SEO used this non-standard directive; Google Search Console reports syntax not understood. Use Sitemap: instead."
        : " — use Sitemap: (RFC 9309 / Google Search Central).";

    issues.push({
      id: "SM8",
      severity: "warn",
      directive: display,
      line: i + 1,
      value,
      message: `${display}: is not a valid robots.txt directive${hint}`
    });
  }

  return issues;
}

/**
 * Full local syntax lint (GSC-style "syntax not understood" heuristics).
 * @param {string} content
 * @returns {{ status: "pass" | "warn" | "fail", issues: SyntaxIssue[], issue_count: number }}
 */
export function validateRobotsTxtSyntax(content) {
  /** @type {SyntaxIssue[]} */
  const issues = [...detectSitemapDirectiveTypos(content)];
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const withoutComment = raw.split("#")[0].trim();
    if (!withoutComment) {
      continue;
    }

    const colon = withoutComment.indexOf(":");
    if (colon === -1) {
      issues.push({
        id: "SY2",
        severity: "warn",
        line: i + 1,
        message: `Line has no ':' separator — Google Search Console may report syntax not understood: ${withoutComment.slice(0, 80)}`
      });
      continue;
    }

    const directiveRaw = withoutComment.slice(0, colon).trim();
    const directive = directiveRaw.toLowerCase();

    if (!directive) {
      issues.push({
        id: "SY3",
        severity: "warn",
        line: i + 1,
        message: "Empty directive name before ':' — syntax not understood"
      });
      continue;
    }

    if (ALLOWED_ROBOTS_DIRECTIVES.has(directive)) {
      continue;
    }

    if (SITEMAP_TYPO_DIRECTIVES[directive]) {
      continue;
    }

    issues.push({
      id: "SY1",
      severity: "warn",
      line: i + 1,
      directive: directiveRaw,
      message: `${directiveRaw}: is not a recognized robots.txt directive (allowlist: User-agent, Allow, Disallow, Sitemap, Crawl-delay, Content-Signal)`
    });
  }

  const hasFail = issues.some((i) => i.severity === "fail");
  const status = hasFail ? "fail" : issues.length > 0 ? "warn" : "pass";

  return {
    status,
    issues,
    issue_count: issues.length
  };
}

/**
 * @param {SyntaxIssue[]} typos
 * @returns {Array<{ id: string, severity: "warn", directive: string, line: number, value: string, message: string }>}
 */
export function sitemapTypoIssuesForMerge(typos) {
  return typos
    .filter((i) => i.id === "SM8")
    .map((i) => ({
      id: i.id,
      severity: "warn",
      directive: i.directive ?? "Schemamap",
      line: i.line ?? 0,
      value: i.value ?? "",
      message: i.message
    }));
}

/**
 * Merge SM8 typo issues into sitemap validation result.
 * @param {ReturnType<typeof import("./assess-policy.mjs").validateSitemaps>} sitemapValidation
 * @param {ReturnType<sitemapTypoIssuesForMerge>} typos
 */
export function mergeSitemapTyposIntoValidation(sitemapValidation, typos) {
  if (!typos.length) {
    return sitemapValidation;
  }

  const issues = [...sitemapValidation.issues];

  for (const typo of typos) {
    issues.push({
      id: typo.id,
      severity: typo.severity,
      message: typo.message
    });
  }

  const sm1 = issues.find((i) => i.id === "SM1");
  if (sm1 && !sitemapValidation.present) {
    const typoList = typos.map((t) => t.directive).join(", ");
    sm1.message = `No Sitemap: directive found (found invalid ${typoList} — crawlers ignore unknown directives)`;
  }

  const hasFail = issues.some((i) => i.severity === "fail");

  return {
    ...sitemapValidation,
    sitemap_typos: typos,
    issues,
    status: hasFail ? "fail" : issues.length > 0 ? "warn" : "pass"
  };
}
