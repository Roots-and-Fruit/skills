#!/usr/bin/env node
/**
 * v1.3.0 effectiveness checks — proves WP admin alt, SM4 warn, audit_findings.
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-v1_3-changes.mjs
 *
 * Corpus fixtures read from gitignored research/ when present.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessRobotsTxtContent,
  isRobotsTxtFetchSuspect
} from "./assess-policy.mjs";
import { violationIds } from "./max-discovery-expectations.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const SKILLS_REPO_ROOT = path.resolve(SKILL_ROOT, "../../..");
const CORPUS_ROOT = path.join(
  SKILLS_REPO_ROOT,
  "research/corpus/plugin-saas-crawl-policy"
);
const REGRESSION_ROOT = path.join(CORPUS_ROOT, "skill-regression");
const EXAMPLES = path.join(SKILL_ROOT, "examples");

function loadCorpusRobots(id) {
  const file = path.join(CORPUS_ROOT, "raw", id, "robots.txt");
  if (!existsSync(file)) {
    return null;
  }
  return readFileSync(file, "utf8");
}

function loadExample(name) {
  return readFileSync(path.join(EXAMPLES, name), "utf8");
}

function loadSynthetic(name) {
  const file = path.join(REGRESSION_ROOT, "synthetic", name);
  if (!existsSync(file)) {
    return null;
  }
  return readFileSync(file, "utf8");
}

function assess(content, policy, host, options = {}) {
  return assessRobotsTxtContent(content, policy, host, options).assessment;
}

function ids(assessment) {
  return violationIds(assessment.policy_compliance?.violations ?? []);
}

function runSuite() {
  const checks = [];

  // --- Authored fixtures (always available) ---

  const wpOpen = loadExample("example-wp-open.robots.txt.fixture.txt");
  const wpMax = assess(wpOpen, "max_discovery", "example.com");
  checks.push({
    id: "V13-01",
    label: "WP-open: /wp-admin/ satisfies admin path (no MD_PATH__admin_)",
    pass: () =>
      !ids(wpMax).includes("MD_PATH__admin_") &&
      ids(wpMax).includes("MD_PATH__cart_") &&
      ids(wpMax).includes("MD_PATH__checkout_")
  });

  const wpAudit = assess(wpOpen, "audit_only", "example.com", {
    sitemap_fetch_results: [
      { url: "https://www.example.com/sitemap_index.xml", status: 500 }
    ]
  });
  checks.push({
    id: "V13-02",
    label: "audit_only: policy_compliance null",
    pass: () => wpAudit.policy_compliance === null
  });
  checks.push({
    id: "V13-03",
    label: "audit_findings: inherited training bots (AF_R4_INHERITED_TRAINING)",
    pass: () =>
      wpAudit.audit_findings?.some((f) => f.id === "AF_R4_INHERITED_TRAINING") &&
      wpAudit.audit_findings.find((f) => f.id === "AF_R4_INHERITED_TRAINING")?.tier ===
        "warn"
  });
  checks.push({
    id: "V13-04",
    label: "audit_findings: SM7 sitemap 500 surfaced under R7",
    pass: () => wpAudit.audit_findings?.some((f) => f.id === "AF_SM7")
  });

  const badSitemap = loadExample("example-bad-sitemap.robots.txt.fixture.txt");
  const badSitemapAssess = assess(badSitemap, "max_discovery", "example.com");
  checks.push({
    id: "V13-05",
    label: "SM4 off-host: sitemap status warn (not fail)",
    pass: () => badSitemapAssess.sitemap_validation?.status === "warn"
  });
  checks.push({
    id: "V13-06",
    label: "SM4 off-host: does not fail max_discovery compliance",
    pass: () => badSitemapAssess.policy_compliance?.compliant === true
  });
  checks.push({
    id: "V13-07",
    label: "SM4 off-host: issue severity warn",
    pass: () =>
      badSitemapAssess.sitemap_validation?.issues?.every(
        (i) => i.id !== "SM4" || i.severity === "warn"
      ) &&
      badSitemapAssess.sitemap_validation?.issues?.some((i) => i.id === "SM4")
  });

  const good = loadExample("example-good.robots.txt.fixture.txt");
  const goodAssess = assess(good, "max_discovery", "example.com", {
    sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
  });
  checks.push({
    id: "V13-08",
    label: "No regression: example-good still max_discovery compliant",
    pass: () => goodAssess.policy_compliance?.compliant === true
  });

  const htmlSynthetic = loadSynthetic("html-disguised.robots.txt");
  checks.push({
    id: "V13-09",
    label: "isRobotsTxtFetchSuspect detects HTML-as-200",
    pass: () => htmlSynthetic !== null && isRobotsTxtFetchSuspect(htmlSynthetic)
  });
  if (htmlSynthetic) {
    const htmlAssess = assess(htmlSynthetic, "audit_only", "broken.example", {
      discovery: { fetch_suspect: true }
    });
    checks.push({
      id: "V13-10",
      label: "audit_findings: AF_R1_HTML when fetch_suspect",
      pass: () =>
        htmlAssess.audit_findings?.some(
          (f) => f.id === "AF_R1_HTML" && f.tier === "fail"
        )
    });
  } else {
    checks.push({
      id: "V13-10",
      label: "audit_findings: AF_R1_HTML when fetch_suspect (skipped — no local corpus)",
      pass: () => true
    });
  }

  // --- Corpus fixtures (local research/) ---

  const corpusAvailable = existsSync(CORPUS_ROOT);
  if (!corpusAvailable) {
    checks.push({
      id: "V13-CORPUS",
      label: "Corpus fixtures (skipped — research/ not present)",
      pass: () => true
    });
    return checks;
  }

  const rankmath = loadCorpusRobots("rankmath");
  if (rankmath) {
    const rm = assess(rankmath, "max_discovery", "rankmath.com");
    checks.push({
      id: "V13-11",
      label: "Corpus rankmath: /wp-admin/ clears MD_PATH__admin_",
      pass: () => !ids(rm).includes("MD_PATH__admin_")
    });
  }

  const woocommerce = loadCorpusRobots("woocommerce");
  if (woocommerce) {
    const wc = assess(woocommerce, "max_discovery", "woocommerce.com");
    checks.push({
      id: "V13-12",
      label: "Corpus woocommerce: /wp-admin/ clears MD_PATH__admin_",
      pass: () => !ids(wc).includes("MD_PATH__admin_")
    });
  }

  const yoast = loadCorpusRobots("yoast");
  if (yoast) {
    const ys = assess(yoast, "max_discovery", "yoast.com");
    checks.push({
      id: "V13-13",
      label: "Corpus yoast: still flags MD_PATH__admin_ (no /wp-admin/ block)",
      pass: () => ids(ys).includes("MD_PATH__admin_")
    });
  }

  const notion = loadCorpusRobots("notion");
  if (notion) {
    const notionAudit = assess(notion, "audit_only", "notion.so");
    const notionMax = assess(notion, "max_discovery", "notion.so");
    checks.push({
      id: "V13-14",
      label: "Corpus notion audit_only: off-host sitemaps warn only",
      pass: () => notionAudit.sitemap_validation?.status === "warn"
    });
    checks.push({
      id: "V13-15",
      label: "Corpus notion max_discovery: no MD_SITEMAP_VALID from off-host alone",
      pass: () => !ids(notionMax).includes("MD_SITEMAP_VALID")
    });
  }

  const salesforce = loadCorpusRobots("salesforce");
  if (salesforce) {
    const sf = assess(salesforce, "max_discovery", "salesforce.com");
    checks.push({
      id: "V13-16",
      label: "Corpus salesforce: restrictive posture unchanged (GPTBot blocked)",
      pass: () => {
        const gpt = sf.crawler_matrix?.find((r) => r.token === "GPTBot");
        return gpt?.training_crawl === "blocked";
      }
    });
  }

  return checks;
}

function main() {
  const checks = runSuite();
  let failed = false;

  console.log("robots-txt-audit v1.3.0 effectiveness checks\n");

  for (const check of checks) {
    const ok = check.pass();
    console.log(`${ok ? "PASS" : "FAIL"} ${check.id} — ${check.label}`);
    if (!ok) {
      failed = true;
    }
  }

  console.log("");
  if (failed) {
    console.error("One or more v1.3.0 effectiveness checks failed.");
    process.exit(1);
  }

  console.log(`All ${checks.length} v1.3.0 effectiveness checks passed.`);
}

main();
