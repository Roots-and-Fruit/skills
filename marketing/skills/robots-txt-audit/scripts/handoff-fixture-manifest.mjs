/**
 * Declarative manifest for handoff fixture regeneration.
 * Each entry describes inputs to buildHandoff — not expected JSON output.
 */
export const HANDOFF_FIXTURE_MANIFEST = [
  {
    handoffFile: "example-audit-only.handoff.fixture.json",
    robotsFile: "example-wp-open.robots.txt.fixture.txt",
    domain: "example.com",
    policy: "audit_only",
    keyPages: [],
    assessOptions: {
      sitemap_fetch_results: [
        { url: "https://www.example.com/sitemap_index.xml", status: 500 }
      ]
    },
    resolvedUrl: "https://example.com/robots.txt",
    deployment_note:
      "No deployment performed. Live file at https://example.com/robots.txt",
    limitations: [
      "Sitemap URL returned HTTP 500 during fetch — declaration valid, endpoint may be broken",
      "No key_pages supplied for cornerstone crawlability check",
      "max_discovery compliance not evaluated (audit_only policy)"
    ]
  },
  {
    handoffFile: "example-max-discovery-recommend.handoff.fixture.json",
    robotsFile: "example-wp-open.robots.txt.fixture.txt",
    domain: "example.com",
    policy: "max_discovery",
    keyPages: [],
    modeOverride: "audit",
    assessOptions: {
      sitemap_fetch_results: [
        { url: "https://www.example.com/sitemap_index.xml", status: 500 }
      ]
    },
    resolvedUrl: "https://example.com/robots.txt",
    deployment_note:
      "No deployment needed for max_discovery compliance. Investigate sitemap endpoint HTTP 500; re-test after fix.",
    limitations: [
      "max_discovery compliant for WordPress open fixture; /wp-admin/ satisfies admin path intent",
      "Sitemap URL returned HTTP 500 during fetch — fix endpoint or hosting"
    ]
  },
  {
    handoffFile: "example-audit.handoff.fixture.json",
    robotsFile: "example-good.robots.txt.fixture.txt",
    domain: "example.com",
    policy: "max_discovery",
    keyPages: [
      "https://example.com/",
      "https://example.com/pricing",
      "https://example.com/guides/enterprise-sso"
    ],
    assessOptions: {
      sitemap_fetch_results: [{ url: "https://example.com/sitemap.xml", status: 200 }]
    },
    resolvedUrl: "https://example.com/robots.txt",
    deployment_note:
      "No deployment needed — file already live at https://example.com/robots.txt. Re-test after CDN or WAF changes.",
    limitations: []
  },
  {
    handoffFile: "example-cloudflare-managed-origin-append.handoff.fixture.json",
    robotsFile: "example-cloudflare-managed-origin-append.robots.txt.fixture.txt",
    domain: "example.com",
    policy: "max_discovery",
    keyPages: [],
    robots_deployment: "auto",
    assessOptions: {},
    resolvedUrl: "https://example.com/robots.txt",
    modeOverride: "recommend"
  },
  {
    handoffFile: "example-recommend.handoff.fixture.json",
    robotsContent:
      "User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /",
    domain: "example.com",
    policy: "block_training_allow_answers",
    keyPages: ["https://example.com/", "https://example.com/pricing"],
    assessOptions: {},
    resolvedUrl: "https://example.com/robots.txt",
    deployment_note:
      "Apply recommended snippets; keep rollback copy; test in Google Search Console and Bing robots tester; monitor logs 48h.",
    limitations: ["No sitemap cross-check performed"]
  },
  {
    handoffFile: "example-generate.handoff.fixture.json",
    generate: true,
    domain: "example.com",
    policy: "max_discovery",
    keyPages: [
      "https://example.com/",
      "https://example.com/pricing",
      "https://example.com/guides/enterprise-sso"
    ]
  }
];
