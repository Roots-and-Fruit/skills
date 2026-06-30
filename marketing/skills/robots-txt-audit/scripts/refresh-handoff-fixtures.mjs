import { readFileSync, writeFileSync } from "node:fs";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { parseRobotsTxt } from "./parse-robots-txt.mjs";

const wpContent = readFileSync(
  "examples/example-wp-open.robots.txt.fixture.txt",
  "utf8"
);
const wpParsed = parseRobotsTxt(wpContent);
const wpAssessAuditOnly = assessRobotsTxtContent(
  wpContent,
  "audit_only",
  "example.com",
  {
    sitemap_fetch_results: [
      { url: "https://www.example.com/sitemap_index.xml", status: 500 }
    ]
  }
);
const wpAssessMaxDiscovery = assessRobotsTxtContent(
  wpContent,
  "max_discovery",
  "example.com",
  {
    sitemap_fetch_results: [
      { url: "https://www.example.com/sitemap_index.xml", status: 500 }
    ]
  }
);

const auditOnly = {
  handoff_version: "1.0",
  skill: "robots-txt-audit",
  skill_version: "1.3.0",
  mode: "audit",
  inputs: {
    domain: "example.com",
    key_pages: [],
    crawl_policy: "audit_only"
  },
  discovery: {
    found: true,
    urls_checked: [
      "https://example.com/robots.txt",
      "https://www.example.com/robots.txt"
    ],
    resolved_url: "https://example.com/robots.txt"
  },
  parsed: {
    group_count: wpParsed.groupCount,
    rule_count: wpParsed.ruleCount,
    user_agent_tokens: wpParsed.userAgentTokens,
    sitemap_directives: wpParsed.sitemaps
  },
  policy_summary: {
    search_bots: "allowed",
    ai_answer_bots: "allowed",
    ai_training_bots: "allowed"
  },
  crawlability: {
    key_pages_provided: 0,
    fully_crawlable: null,
    blocked_key_pages: []
  },
  crawler_rules: [
    {
      user_agent: "*",
      effective_access: "allowed",
      rules: ["Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php"]
    }
  ],
  audit_checks: [
    { id: "R1", name: "File accessible", status: "pass", note: "" },
    {
      id: "R4",
      name: "AI bot differentiation",
      status: "warn",
      note: "Training bots inherit allow from User-agent: *"
    },
    {
      id: "R5",
      name: "Cornerstone crawlability",
      status: "na",
      note: "No key_pages provided"
    },
    {
      id: "R7",
      name: "Sitemap declaration",
      status: "warn",
      note: "Declaration valid; endpoint returned HTTP 500"
    },
    { id: "R7a", name: "Sitemap present", status: "pass", note: "" },
    { id: "R7b", name: "Sitemap absolute URL", status: "pass", note: "" },
    { id: "R7c", name: "Sitemap host match", status: "pass", note: "" },
    {
      id: "R7d",
      name: "Sitemap shape",
      status: "pass",
      note: "sitemap_index.xml"
    },
    {
      id: "R7e",
      name: "Sitemap endpoint fetch",
      status: "warn",
      note: "HTTP 500 on https://www.example.com/sitemap_index.xml"
    }
  ],
  crawler_matrix: wpAssessAuditOnly.assessment.crawler_matrix,
  sitemap_validation: wpAssessAuditOnly.assessment.sitemap_validation,
  policy_compliance: null,
  audit_findings: wpAssessAuditOnly.assessment.audit_findings,
  draft_robots_txt: null,
  deployment_note:
    "No deployment performed. Live file at https://example.com/robots.txt",
  limitations: [
    "Sitemap URL returned HTTP 500 during fetch — declaration valid, endpoint may be broken",
    "No key_pages supplied for cornerstone crawlability check",
    "max_discovery compliance not evaluated (audit_only policy)"
  ]
};

writeFileSync(
  "examples/example-audit-only.handoff.fixture.json",
  `${JSON.stringify(auditOnly, null, 2)}\n`
);

const maxDiscoveryRecommend = {
  handoff_version: "1.0",
  skill: "robots-txt-audit",
  skill_version: "1.3.0",
  mode: "recommend",
  inputs: {
    domain: "example.com",
    key_pages: [],
    crawl_policy: "max_discovery"
  },
  discovery: {
    found: true,
    urls_checked: [
      "https://example.com/robots.txt",
      "https://www.example.com/robots.txt"
    ],
    resolved_url: "https://example.com/robots.txt"
  },
  parsed: {
    group_count: wpParsed.groupCount,
    rule_count: wpParsed.ruleCount,
    user_agent_tokens: wpParsed.userAgentTokens,
    sitemap_directives: wpParsed.sitemaps
  },
  policy_summary: {
    search_bots: "allowed",
    ai_answer_bots: "allowed",
    ai_training_bots: "allowed"
  },
  crawlability: {
    key_pages_provided: 0,
    fully_crawlable: null,
    blocked_key_pages: []
  },
  crawler_rules: [
    {
      user_agent: "*",
      effective_access: "allowed",
      rules: ["Disallow: /wp-admin/", "Allow: /wp-admin/admin-ajax.php"]
    }
  ],
  audit_checks: [
    { id: "R1", name: "File accessible", status: "pass", note: "" },
    { id: "R2", name: "Syntax / structure", status: "pass", note: "" },
    { id: "R3", name: "Search crawlers", status: "pass", note: "" },
    {
      id: "R4",
      name: "AI bot differentiation",
      status: "fail",
      note: "Training bots inherit allow from User-agent: * under max_discovery"
    },
    {
      id: "R5",
      name: "Cornerstone crawlability",
      status: "na",
      note: "No key_pages provided"
    },
    {
      id: "R6",
      name: "Low-value path hygiene",
      status: "pass",
      note: "WordPress /wp-admin/ satisfies admin intent; /cart/ and /checkout/ gaps in policy_compliance"
    },
    {
      id: "R7",
      name: "Sitemap declaration",
      status: "warn",
      note: "Declaration valid; endpoint HTTP 500"
    },
    { id: "R7a", name: "Sitemap present", status: "pass", note: "" },
    { id: "R7b", name: "Sitemap absolute URL", status: "pass", note: "" },
    { id: "R7c", name: "Sitemap host match", status: "pass", note: "" },
    { id: "R7d", name: "Sitemap shape", status: "pass", note: "" },
    {
      id: "R7e",
      name: "Sitemap endpoint fetch",
      status: "warn",
      note: "HTTP 500 on https://www.example.com/sitemap_index.xml"
    },
    { id: "R8", name: "Google token hygiene", status: "pass", note: "" },
    { id: "R9", name: "Wildcard vs specific", status: "pass", note: "" },
    { id: "R10", name: "CDN caveat", status: "warn", note: "" }
  ],
  crawler_matrix: wpAssessMaxDiscovery.assessment.crawler_matrix,
  sitemap_validation: wpAssessMaxDiscovery.assessment.sitemap_validation,
  policy_compliance: wpAssessMaxDiscovery.assessment.policy_compliance,
  audit_findings: wpAssessMaxDiscovery.assessment.audit_findings,
  draft_robots_txt: null,
  deployment_note:
    "Apply recommended training-crawler blocks; fix sitemap endpoint; re-test with verify-max-discovery-contract.mjs policy expectations.",
  limitations: [
    "Template path violations (/cart/, /checkout/) flagged; /wp-admin/ satisfies admin intent for WordPress"
  ]
};

writeFileSync(
  "examples/example-max-discovery-recommend.handoff.fixture.json",
  `${JSON.stringify(maxDiscoveryRecommend, null, 2)}\n`
);

const good = readFileSync("examples/example-good.robots.txt.fixture.txt", "utf8");
const goodAssess = assessRobotsTxtContent(good, "max_discovery", "example.com", {
  sitemap_fetch_results: [
    { url: "https://example.com/sitemap.xml", status: 200 }
  ]
});

const audit = JSON.parse(
  readFileSync("examples/example-audit.handoff.fixture.json", "utf8")
);
audit.skill_version = "1.3.0";
audit.crawler_matrix = goodAssess.assessment.crawler_matrix;
audit.sitemap_validation = goodAssess.assessment.sitemap_validation;
audit.audit_findings = goodAssess.assessment.audit_findings;
if (!audit.audit_checks.some((row) => row.id === "R7d")) {
  audit.audit_checks.splice(7, 0, {
    id: "R7d",
    name: "Sitemap shape",
    status: "pass",
    note: "sitemap.xml"
  });
}
if (!audit.audit_checks.some((row) => row.id === "R7e")) {
  audit.audit_checks.push({
    id: "R7e",
    name: "Sitemap endpoint fetch",
    status: "pass",
    note: "HTTP 200"
  });
}
writeFileSync(
  "examples/example-audit.handoff.fixture.json",
  `${JSON.stringify(audit, null, 2)}\n`
);

const generate = JSON.parse(
  readFileSync("examples/example-generate.handoff.fixture.json", "utf8")
);
generate.skill_version = "1.3.0";
const draftAssess = assessRobotsTxtContent(
  generate.draft_robots_txt,
  "max_discovery",
  generate.inputs.domain,
  {
    sitemap_fetch_results: [
      { url: "https://example.com/sitemap.xml", status: 200 }
    ]
  }
);
generate.crawler_matrix = draftAssess.assessment.crawler_matrix;
generate.sitemap_validation = draftAssess.assessment.sitemap_validation;
generate.policy_compliance = draftAssess.assessment.policy_compliance;
generate.audit_findings = draftAssess.assessment.audit_findings;
writeFileSync(
  "examples/example-generate.handoff.fixture.json",
  `${JSON.stringify(generate, null, 2)}\n`
);

const recommend = JSON.parse(
  readFileSync("examples/example-recommend.handoff.fixture.json", "utf8")
);
recommend.skill_version = "1.3.0";
const recContent = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /`;
const recAssess = assessRobotsTxtContent(
  recContent,
  "block_training_allow_answers",
  recommend.inputs.domain
);
recommend.crawler_matrix = recAssess.assessment.crawler_matrix;
recommend.audit_findings = recAssess.assessment.audit_findings;
recommend.sitemap_validation = {
  present: false,
  urls: [],
  valid_urls: [],
  host_match: false,
  absolute_urls: false,
  endpoint_fetch: [],
  issues: [
    {
      id: "SM1",
      severity: "fail",
      message: "No Sitemap: directive found"
    }
  ],
  status: "fail"
};
writeFileSync(
  "examples/example-recommend.handoff.fixture.json",
  `${JSON.stringify(recommend, null, 2)}\n`
);

console.log("Handoff fixtures updated.");
