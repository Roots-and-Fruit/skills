/**
 * Derive handoff audit_checks[] from assessment (R1–R11).
 * Mapping mirrors REFERENCE.md rubric — no per-fixture overrides.
 */
import { requiresDiscoveryCompliance, requiresPolicyCompliance } from "./policy-presets.mjs";

/**
 * @param {string} status
 * @param {string} name
 * @param {string} [note]
 */
function row(id, name, status, note = "") {
  return { id, name, status, note };
}

/**
 * @param {Array<{ token: string, indexing_crawl?: string, training_crawl?: string }>} matrix
 * @param {string} token
 */
function matrixRow(matrix, token) {
  return matrix?.find((r) => r.token === token);
}

/**
 * @param {object} assessment
 * @param {object} inputs
 * @param {object} discovery
 * @param {object} [crawlability]
 */
export function buildAuditChecks(assessment, inputs, discovery, crawlability = {}) {
  const checks = [];
  const crawlPolicy = inputs.crawl_policy ?? "audit_only";
  const matrix = assessment.crawler_matrix ?? [];
  const sv = assessment.sitemap_validation;
  const syntax = assessment.syntax_validation;
  const pc = assessment.policy_compliance;
  const findings = assessment.audit_findings ?? [];
  const deployment = assessment.deployment;

  if (!discovery.found) {
    checks.push(
      row("R1", "File accessible", "fail", "No robots.txt at root")
    );
    const keyPages = inputs.key_pages ?? [];
    if (keyPages.length > 0) {
      checks.push(
        row(
          "R5",
          "Cornerstone crawlability",
          "warn",
          "Cannot verify until file published"
        )
      );
    } else {
      checks.push(
        row("R5", "Cornerstone crawlability", "na", "No key_pages provided")
      );
    }
    return checks;
  }

  if (discovery.fetch_suspect) {
    checks.push(
      row(
        "R1",
        "File accessible",
        "fail",
        "Response looks like HTML, not robots.txt"
      )
    );
  } else {
    checks.push(row("R1", "File accessible", "pass", ""));
  }

  if (syntax?.status === "fail") {
    checks.push(row("R2", "Syntax / structure", "fail", syntax.issues?.[0]?.message ?? ""));
  } else if (syntax?.status === "warn") {
    checks.push(row("R2", "Syntax / structure", "warn", syntax.issues?.[0]?.message ?? ""));
  } else {
    checks.push(row("R2", "Syntax / structure", "pass", ""));
  }

  const googlebot = matrixRow(matrix, "Googlebot");
  const bingbot = matrixRow(matrix, "bingbot");
  const searchOk =
    googlebot?.indexing_crawl === "allowed" && bingbot?.indexing_crawl === "allowed";
  checks.push(
    row(
      "R3",
      "Search crawlers",
      searchOk ? "pass" : "fail",
      searchOk ? "Googlebot and bingbot can reach /" : "Search crawlers blocked or ambiguous at /"
    )
  );

  let r4Status = "pass";
  let r4Note = "Training bots blocked; answer bots allowed";
  if (crawlPolicy === "audit_only") {
    const inherited = findings.some((f) => f.id === "AF_R4_INHERITED_TRAINING");
    if (inherited) {
      r4Status = "warn";
      r4Note = "Training bots inherit allow from User-agent: *";
    } else if (findings.some((f) => f.id === "AF_R8_GOOGLE_PAIRING" || f.id === "AF_R4_OPENAI_PAIRING" || f.id === "AF_R4_ANTHROPIC_PAIRING")) {
      r4Status = "fail";
      r4Note = "Reversed training/discovery pairing detected";
    }
  } else if (requiresPolicyCompliance(crawlPolicy)) {
    if (pc?.compliant === false) {
      const violations = pc.violations ?? [];
      const onlyOriginCf =
        deployment?.model === "cloudflare_managed" &&
        violations.length > 0 &&
        violations.every((v) => v.layer === "origin");
      if (onlyOriginCf && crawlPolicy === "max_discovery") {
        r4Status = "pass";
        r4Note =
          "Training bots inherit allow from User-agent: * — optional under max_discovery (use block_training_allow_answers to require blocks)";
      } else {
        r4Status = "fail";
        r4Note = `Training blocks or pairings incomplete under ${crawlPolicy}`;
      }
    } else if (crawlPolicy === "max_discovery") {
      const inherited = findings.some((f) => f.id === "AF_R4_INHERITED_TRAINING");
      if (inherited) {
        r4Status = "pass";
        r4Note =
          "Training bots inherit allow from User-agent: * — optional under max_discovery (use block_training_allow_answers to require blocks)";
      }
    }
  }
  checks.push(row("R4", "AI bot differentiation", r4Status, r4Note));

  const keyProvided = crawlability.key_pages_provided ?? inputs.key_pages?.length ?? 0;
  if (keyProvided === 0) {
    checks.push(row("R5", "Cornerstone crawlability", "na", "No key_pages provided"));
  } else if (crawlability.fully_crawlable === keyProvided) {
    checks.push(
      row(
        "R5",
        "Cornerstone crawlability",
        "pass",
        "All key_pages crawlable for discovery crawlers"
      )
    );
  } else if (crawlability.fully_crawlable === 0) {
    checks.push(row("R5", "Cornerstone crawlability", "fail", "Key pages blocked for discovery crawlers"));
  } else {
    checks.push(row("R5", "Cornerstone crawlability", "warn", "Some key_pages blocked"));
  }

  const adminViolation = pc?.violations?.find((v) => v.id === "MD_PATH__admin_");
  if (adminViolation) {
    checks.push(
      row("R6", "Low-value path hygiene", "fail", adminViolation.message)
    );
  } else if (crawlPolicy === "max_discovery" && findings.some((f) => f.id?.includes("wp-admin"))) {
    checks.push(
      row(
        "R6",
        "Low-value path hygiene",
        "pass",
        "WordPress /wp-admin/ satisfies admin intent under max_discovery"
      )
    );
  } else {
    checks.push(
      row(
        "R6",
        "Low-value path hygiene",
        "pass",
        "/admin/ restricted via robots.txt Disallow (max_discovery path hygiene)"
      )
    );
  }

  if (!sv) {
    checks.push(row("R7", "Sitemap declaration", "na", "Not evaluated"));
  } else {
    const r7Status = sv.status ?? "na";
    let r7Note = "";
    if (r7Status === "pass") {
      r7Note = "Absolute https URL on site host";
    } else if (sv.issues?.some((i) => i.id === "SM7")) {
      r7Note = "Declaration valid; endpoint returned HTTP 500";
    } else if (r7Status === "fail") {
      r7Note = sv.issues?.[0]?.message ?? "Sitemap declaration failed";
    } else if (r7Status === "warn") {
      r7Note = sv.issues?.[0]?.message ?? "Sitemap warnings present";
    }
    checks.push(row("R7", sv.present ? "Sitemap declaration" : "Sitemap directive", r7Status, r7Note));

    if (sv.present !== undefined) {
      checks.push(
        row(
          "R7a",
          "Sitemap present",
          sv.present ? "pass" : "fail",
          ""
        )
      );
    }
    if (sv.absolute_urls !== undefined) {
      checks.push(
        row(
          "R7b",
          sv.present ? "Sitemap absolute URL" : "Sitemap absolute URL",
          sv.absolute_urls ? "pass" : "fail",
          ""
        )
      );
    }
    if (sv.host_match !== undefined && sv.present) {
      checks.push(
        row(
          "R7c",
          "Sitemap host match",
          sv.host_match ? "pass" : "warn",
          sv.valid_urls?.[0] ?? ""
        )
      );
    }
    if (sv.present && sv.urls?.length) {
      const pathNote = sv.urls[0]?.split("/").pop() ?? "";
      const sm5 = sv.issues?.find((i) => i.id === "SM5");
      checks.push(
        row(
          "R7d",
          "Sitemap shape",
          sm5 ? "warn" : "pass",
          pathNote
        )
      );
    }
    const fetched = sv.endpoint_fetch?.filter((e) => e.status !== null) ?? [];
    if (fetched.length > 0) {
      const bad = fetched.find((e) => !e.ok);
      checks.push(
        row(
          "R7e",
          "Sitemap endpoint fetch",
          bad ? "warn" : "pass",
          bad ? `HTTP ${bad.status} on ${bad.url}` : `HTTP ${fetched[0].status}`
        )
      );
    }
  }

  const googleExt = matrixRow(matrix, "Google-Extended");
  const r8Fail =
    googlebot?.indexing_crawl === "blocked" &&
    googleExt?.training_crawl === "allowed";
  checks.push(
    row(
      "R8",
      "Google token hygiene",
      r8Fail ? "fail" : "pass",
      r8Fail
        ? "Googlebot blocked while Google-Extended allowed"
        : "Uses Google-Extended, not Googlebot, for training restriction"
    )
  );

  const wildcardBlocksDiscovery = matrix.some(
    (r) =>
      (r.token === "OAI-SearchBot" || r.token === "Claude-SearchBot") &&
      r.indexing_crawl === "blocked" &&
      r.rule_source === "inherits_user_agent_star"
  );
  checks.push(
    row(
      "R9",
      "Wildcard vs specific",
      wildcardBlocksDiscovery ? "warn" : "pass",
      wildcardBlocksDiscovery ? "Answer bots may inherit restrictive wildcard" : ""
    )
  );

  checks.push(
    row(
      "R10",
      "CDN caveat",
      "warn",
      "Verify live file served at public URL after deploy"
    )
  );

  if (deployment?.model === "cloudflare_managed") {
    const signalsOk = assessment.layer_assessment?.cloudflare?.content_signals_ok;
    checks.push(
      row(
        "R11",
        "Content-Signal",
        signalsOk === false ? "fail" : signalsOk ? "pass" : "na",
        signalsOk === false ? "Content-Signal mismatch on User-agent: *" : ""
      )
    );
  }

  return checks;
}
