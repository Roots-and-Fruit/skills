#!/usr/bin/env node
/**
 * Validate fan-out-coverage-analysis handoff JSON (schema v1.1).
 *
 * G1–G18 — schema shape for both modes
 * R1–R10 — rubric anti-drift (profile-specific where noted)
 *
 * Usage (from fan-out-coverage-analysis/):
 *   node scripts/verify-handoff.mjs
 *   node scripts/verify-handoff.mjs examples/wordpress-plugin-marketing-v2.3.handoff.fixture.json
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignClusters } from "./intent-clusters.mjs";
import { assignPriority, buildPrioritySubQueries } from "./apply-priority.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

const MODES = new Set(["keyword_only", "domain_coverage"]);
const INTENT_SPLIT = new Set(["single", "mixed"]);
const RELEVANCE_TIERS = new Set(["serp_native", "core", "facet_drift", "adjacent"]);
const DIMENSIONS = new Set([
  "core_variant",
  "detail_drill",
  "facet_drift",
  "question",
  "long_tail",
  "adjacent_topic"
]);
const SEARCH_INTENTS = new Set([
  "informational",
  "navigational",
  "commercial",
  "transactional"
]);
const PRIORITIES = new Set(["high", "medium", "low"]);
const STATUSES = new Set(["hub", "spoke", "broken_spoke", "gap", "hub_serp_only"]);
const AIO_SOURCES = new Set(["live_serp", "labs_index", "none"]);
const INTENT_LANES = new Set([
  "primary_topic",
  "tool_discovery",
  "community",
  "directory",
  "platform_meta",
  "other"
]);

const TIER_RANK = {
  serp_native: 4,
  core: 3,
  facet_drift: 2,
  adjacent: 1
};

const PLATFORM_META_PAA =
  /\b(outdated|replacing|moving away|leaving|what is replacing|still relevant|is .+ dead)\b/i;

function defaultHandoffFixtures() {
  return readdirSync(examplesDir)
    .filter((name) => name.endsWith(".handoff.fixture.json"))
    .map((name) => path.join(examplesDir, name))
    .sort();
}

function loadHandoff(filePath) {
  const raw = readFileSync(filePath, "utf8");
  return { filePath, data: JSON.parse(raw) };
}

function subQueryByKeyword(data, keyword) {
  const target = keyword.toLowerCase();
  return (data.sub_queries ?? []).find((row) => row.keyword?.toLowerCase() === target);
}

function hasKeyword(data, keyword) {
  return Boolean(subQueryByKeyword(data, keyword));
}

function tierOf(data, keyword) {
  return subQueryByKeyword(data, keyword)?.relevance_tier ?? null;
}

function isWordpressGolden(filePath) {
  return /wordpress-plugin-marketing-v2\.3\.handoff\.fixture\.json$/i.test(filePath);
}

function isDomainGolden(filePath) {
  return /enterprise-sso-domain\.handoff\.fixture\.json$/i.test(filePath);
}

function isClusterPriorityGolden(filePath) {
  return /cluster-priority\.handoff\.fixture\.json$/i.test(filePath);
}

function isV12Handoff(data) {
  return data.handoff_version === "1.2";
}

function runSchemaChecks(data) {
  const checks = [];

  checks.push({
    id: "G1",
    pass: () => data.handoff_version === "1.1" || data.handoff_version === "1.2"
  });

  checks.push({
    id: "G2",
    pass: () => data.skill === "fan-out-coverage-analysis"
  });

  checks.push({
    id: "G3",
    pass: () => typeof data.skill_version === "string" && /^\d+\.\d+\.\d+$/.test(data.skill_version)
  });

  checks.push({
    id: "G4",
    pass: () => MODES.has(data.mode)
  });

  checks.push({
    id: "G5",
    pass: () => {
      const ts = Date.parse(data.generated_at ?? "");
      return Number.isFinite(ts);
    }
  });

  checks.push({
    id: "G6",
    pass: () =>
      typeof data.inputs?.primary_keyword === "string" && data.inputs.primary_keyword.length > 0
  });

  checks.push({
    id: "G7",
    pass: () => {
      if (data.mode === "keyword_only") {
        return data.inputs?.domain === null;
      }
      return typeof data.inputs?.domain === "string" && data.inputs.domain.length > 0;
    }
  });

  checks.push({
    id: "G8",
    pass: () => {
      const ctx = data.serp_context;
      return (
        ctx &&
        typeof ctx.ai_overview_present === "boolean" &&
        Array.isArray(ctx.people_also_ask) &&
        Array.isArray(ctx.related_searches) &&
        Array.isArray(ctx.intent_lanes_detected) &&
        INTENT_SPLIT.has(ctx.intent_split) &&
        typeof ctx.lane_counts === "object"
      );
    }
  });

  checks.push({
    id: "G9",
    pass: () => {
      const source = data.serp_context?.ai_overview_source;
      return source === undefined || AIO_SOURCES.has(source);
    }
  });

  checks.push({
    id: "G10",
    pass: () => Array.isArray(data.sub_queries) && data.sub_queries.length >= 1
  });

  checks.push({
    id: "G11",
    pass: () =>
      data.sub_queries.every(
        (row) =>
          typeof row.keyword === "string" &&
          row.keyword.length > 0 &&
          RELEVANCE_TIERS.has(row.relevance_tier) &&
          DIMENSIONS.has(row.dimension) &&
          PRIORITIES.has(row.priority) &&
          Array.isArray(row.source) &&
          row.source.length >= 1 &&
          typeof row.on_seed_serp === "boolean"
      )
  });

  checks.push({
    id: "G12",
    pass: () =>
      data.sub_queries.every(
        (row) => row.search_intent === null || SEARCH_INTENTS.has(row.search_intent)
      )
  });

  checks.push({
    id: "G13",
    pass: () => {
      if (data.mode !== "keyword_only") {
        return true;
      }
      return (
        Array.isArray(data.priority_sub_queries) && data.priority_sub_queries.length >= 1
      );
    }
  });

  checks.push({
    id: "G14",
    pass: () => {
      if (data.mode !== "keyword_only") {
        return true;
      }
      return data.priority_sub_queries.every(
        (row) =>
          typeof row.keyword === "string" &&
          RELEVANCE_TIERS.has(row.relevance_tier) &&
          PRIORITIES.has(row.priority) &&
          typeof row.rationale === "string" &&
          row.rationale.length >= 10
      );
    }
  });

  checks.push({
    id: "G15",
    pass: () => {
      if (data.mode !== "domain_coverage") {
        return true;
      }
      const summary = data.coverage_summary;
      return (
        summary &&
        typeof summary.sub_query_count === "number" &&
        typeof summary.covered_count === "number" &&
        typeof summary.gap_count === "number" &&
        typeof summary.coverage_rate_pct === "number" &&
        Array.isArray(data.gaps) &&
        Array.isArray(data.hub_spoke_map)
      );
    }
  });

  checks.push({
    id: "G16",
    pass: () => {
      if (data.mode !== "domain_coverage") {
        return true;
      }
      return data.sub_queries.every(
        (row) =>
          STATUSES.has(row.status) &&
          (row.covering_url === null || typeof row.covering_url === "string")
      );
    }
  });

  checks.push({
    id: "G17",
    pass: () => Array.isArray(data.limitations) && data.limitations.length >= 1
  });

  checks.push({
    id: "G18",
    pass: () => {
      if (data.mode !== "domain_coverage" || isV12Handoff(data)) {
        return true;
      }
      const summary = data.coverage_summary;
      const expected =
        summary.sub_query_count > 0
          ? Math.round((summary.covered_count / summary.sub_query_count) * 100)
          : 0;
      const rate = summary.labs_coverage_rate_pct ?? summary.coverage_rate_pct;
      return rate === expected;
    }
  });

  checks.push({
    id: "G18a",
    pass: () => {
      if (data.mode !== "domain_coverage" || !isV12Handoff(data)) {
        return true;
      }
      const summary = data.coverage_summary;
      if (summary.cluster_count == null) {
        return false;
      }
      const expected =
        summary.cluster_count > 0
          ? Math.round((summary.cluster_covered_count / summary.cluster_count) * 100)
          : 0;
      return summary.cluster_coverage_rate_pct === expected;
    }
  });

  checks.push({
    id: "G18b",
    pass: () => {
      if (data.mode !== "domain_coverage") {
        return true;
      }
      const summary = data.coverage_summary;
      if (!isV12Handoff(data)) {
        const expected =
          summary.sub_query_count > 0
            ? Math.round((summary.covered_count / summary.sub_query_count) * 100)
            : 0;
        const rate = summary.labs_coverage_rate_pct ?? summary.coverage_rate_pct;
        return rate === expected;
      }
      if (summary.labs_coverage_rate_pct == null) {
        return true;
      }
      const labsCovered = (data.sub_queries ?? []).filter((row) =>
        ["hub", "spoke", "broken_spoke"].includes(row.status)
      ).length;
      const expected =
        summary.sub_query_count > 0
          ? Math.round((labsCovered / summary.sub_query_count) * 100)
          : 0;
      return summary.labs_coverage_rate_pct === expected;
    }
  });

  checks.push({
    id: "G20",
    pass: () => {
      if (!isV12Handoff(data)) {
        return true;
      }
      return (data.sub_queries ?? []).every((row) => typeof row.intent_cluster_id === "string");
    }
  });

  checks.push({
    id: "G21",
    pass: () => {
      if (!isV12Handoff(data)) {
        return true;
      }
      const byCluster = new Map();
      for (const row of data.sub_queries ?? []) {
        const clusterId = row.intent_cluster_id;
        if (!byCluster.has(clusterId)) {
          byCluster.set(clusterId, 0);
        }
        if (row.is_canonical === true) {
          byCluster.set(clusterId, byCluster.get(clusterId) + 1);
        }
      }
      return [...byCluster.values()].every((count) => count === 1);
    }
  });

  checks.push({
    id: "G19",
    pass: () => {
      const rank = data.serp_context?.anchor_serp_rank ?? data.coverage_summary?.anchor_serp_rank;
      return rank === undefined || rank === null || (Number.isFinite(rank) && rank > 0);
    }
  });

  checks.push({
    id: "G22",
    pass: () => {
      if (data.mode !== "domain_coverage" || data.coverage_summary?.gaps_shortlist_count == null) {
        return true;
      }
      const summary = data.coverage_summary;
      return (
        summary.gaps_shortlist_count === (data.gaps ?? []).length &&
        summary.gaps_row_total >= summary.gaps_shortlist_count
      );
    }
  });

  checks.push({
    id: "G23",
    pass: () => {
      if (data.mode !== "domain_coverage" || data.coverage_summary?.gaps_row_total == null) {
        return true;
      }
      const summary = data.coverage_summary;
      const rowTotal = summary.gaps_row_total;
      const shortlist = summary.gaps_shortlist_count ?? (data.gaps ?? []).length;
      const cap = 12;
      if (shortlist !== (data.gaps ?? []).length || shortlist > rowTotal) {
        return false;
      }
      if (rowTotal > cap && shortlist === rowTotal) {
        return false;
      }
      return true;
    }
  });

  return checks;
}

function runRubricChecks(data, filePath) {
  const checks = [];

  checks.push({
    id: "R1",
    pass: () => !hasKeyword(data, "mailpoet"),
    detail: "zero-overlap brand excluded"
  });

  checks.push({
    id: "R2",
    pass: () => {
      const banned = (data.sub_queries ?? []).filter((row) =>
        PLATFORM_META_PAA.test(row.keyword ?? "")
      );
      return banned.length === 0;
    },
    detail: "platform-meta PAA not in sub_queries"
  });

  checks.push({
    id: "R3",
    pass: () => {
      if (data.serp_context?.intent_split !== "mixed") {
        return true;
      }
      const primary = (data.inputs?.primary_keyword ?? "").toLowerCase();
      const driftNative = (data.sub_queries ?? []).filter((row) => {
        if (!row.on_seed_serp || row.relevance_tier !== "serp_native") {
          return false;
        }
        if (row.dimension === "question" || row.source?.includes("serp_paa")) {
          return false;
        }
        const kw = row.keyword ?? "";
        if (kw.toLowerCase() === primary) {
          return false;
        }
        if (/\b(email|newsletter)\b/i.test(kw) && /\b(free|jobs|course|pdf)\b/i.test(kw)) {
          return true;
        }
        return /\b(email|newsletter)\b/i.test(kw);
      });
      return driftNative.length === 0;
    },
    detail: "email/newsletter commercial modifiers not serp_native when mixed"
  });

  if (data.serp_context?.intent_split === "mixed") {
    checks.push({
      id: "R15",
      pass: () => {
        const primary = (data.inputs?.primary_keyword ?? "").toLowerCase();
        const bad = (data.sub_queries ?? []).filter((row) => {
          if (!row.on_seed_serp || row.relevance_tier !== "serp_native") {
            return false;
          }
          const lane = row.intent_lane ?? data.inputs?.intent_lane;
          if (lane === "tool_discovery") {
            return false;
          }
          const kw = row.keyword ?? "";
          if (kw.toLowerCase() === primary) {
            return false;
          }
          return /\b(free|jobs|course|pdf|download)\b/i.test(kw);
        });
        return bad.length === 0;
      },
      detail: "mixed SERP: primary_topic commercial modifier rows not serp_native"
    });
  }

  checks.push({
    id: "R4",
    pass: () => {
      if (data.mode !== "keyword_only") {
        return true;
      }
      const rows = data.priority_sub_queries ?? [];
      if (rows.length < 2) {
        return true;
      }
      for (let i = 1; i < rows.length; i += 1) {
        const prev = TIER_RANK[rows[i - 1].relevance_tier] ?? 0;
        const curr = TIER_RANK[rows[i].relevance_tier] ?? 0;
        if (curr > prev) {
          return false;
        }
      }
      return true;
    },
    detail: "priority_sub_queries tier-ordered (serp_native first)"
  });

  checks.push({
    id: "R5",
    pass: () => {
      if (data.mode !== "keyword_only" || data.serp_context?.intent_split !== "mixed") {
        return true;
      }
      const facetInPriority = (data.priority_sub_queries ?? []).filter(
        (row) => row.relevance_tier === "facet_drift" && row.priority === "high"
      );
      return facetInPriority.length === 0;
    },
    detail: "facet_drift not high in priority_sub_queries when mixed"
  });

  checks.push({
    id: "R6",
    pass: () => {
      if (data.mode !== "domain_coverage") {
        return true;
      }
      return (data.gaps ?? []).every((gap) => {
        const row = subQueryByKeyword(data, gap.keyword);
        return row?.status === "gap";
      });
    },
    detail: "gaps[] align with gap status in sub_queries"
  });

  if (isWordpressGolden(filePath)) {
    checks.push({
      id: "R7",
      pass: () => data.serp_context?.intent_split === "mixed",
      detail: "wordpress golden: intent_split mixed"
    });

    checks.push({
      id: "R8",
      pass: () => tierOf(data, "wordpress email marketing plugin free") === "facet_drift",
      detail: "wordpress golden: email related demoted"
    });

    checks.push({
      id: "R9",
      pass: () =>
        data.priority_sub_queries?.[0]?.keyword?.toLowerCase() ===
        "how to promote a wordpress plugin",
      detail: "wordpress golden: GTM PAA first in priority_sub_queries"
    });

    checks.push({
      id: "R10",
      pass: () => tierOf(data, "wordpress email marketing plugin") === "facet_drift",
      detail: "wordpress golden: Labs facet drift tagged"
    });

    checks.push({
      id: "R11",
      pass: () => {
        const highKeywords = new Set(
          (data.sub_queries ?? [])
            .filter((row) => row.priority === "high")
            .map((row) => row.keyword.toLowerCase())
        );
        const priorityKeywords = new Set(
          (data.priority_sub_queries ?? []).map((row) => row.keyword.toLowerCase())
        );
        for (const kw of highKeywords) {
          if (!priorityKeywords.has(kw)) {
            return false;
          }
        }
        return true;
      },
      detail: "wordpress golden: all high sub_queries in priority_sub_queries"
    });
  }

  if (isDomainGolden(filePath)) {
    checks.push({
      id: "R7",
      pass: () => data.serp_context?.intent_split === "single",
      detail: "domain golden: intent_split single"
    });

    checks.push({
      id: "R8",
      pass: () => data.coverage_summary?.gap_count === 1,
      detail: "domain golden: gap_count matches fixture"
    });
  }

  if (isClusterPriorityGolden(filePath)) {
    checks.push({
      id: "R12",
      pass: () => {
        const paaGaps = (data.sub_queries ?? []).filter(
          (row) =>
            row.is_canonical === true &&
            row.source?.includes("serp_paa") &&
            row.status === "gap"
        );
        const priorityKeys = new Set(
          (data.priority_sub_queries ?? []).map((row) => row.keyword.toLowerCase())
        );
        return paaGaps.every((row) => priorityKeys.has(row.keyword.toLowerCase()));
      },
      detail: "cluster-priority: canonical PAA gaps in priority_sub_queries"
    });

    checks.push({
      id: "R13",
      pass: () => {
        const aliasKeys = new Set(
          (data.sub_queries ?? [])
            .filter((row) => row.cluster_role === "alias")
            .map((row) => row.keyword.toLowerCase())
        );
        return (data.priority_sub_queries ?? []).every(
          (row) => !aliasKeys.has(row.keyword.toLowerCase())
        );
      },
      detail: "cluster-priority: no alias rows in priority_sub_queries"
    });
  }

  return checks;
}

function verifyFile(filePath) {
  const { data } = loadHandoff(filePath);
  const checks = [...runSchemaChecks(data), ...runRubricChecks(data, filePath)];

  let failed = 0;
  console.log(`\n${path.basename(filePath)}`);
  for (const check of checks) {
    const ok = check.pass();
    const suffix = check.detail ? ` — ${check.detail}` : "";
    console.log(`${ok ? "PASS" : "FAIL"} ${check.id}${suffix}`);
    if (!ok) {
      failed += 1;
    }
  }

  return failed;
}

function main() {
  const argPath = process.argv[2];
  const targets = argPath ? [path.resolve(argPath)] : defaultHandoffFixtures();

  if (targets.length === 0) {
    console.error("No *.handoff.fixture.json files found in examples/");
    process.exit(2);
  }

  let totalFailed = 0;
  for (const filePath of targets) {
    totalFailed += verifyFile(filePath);
  }

  if (totalFailed > 0) {
    console.error(`\n${totalFailed} check(s) failed.`);
    process.exit(1);
  }

  const noPaaFixture = JSON.parse(
    readFileSync(path.join(examplesDir, "no-paa-priority.fixture.json"), "utf8")
  );
  const clustered = assignClusters(noPaaFixture.rows, noPaaFixture.seed);
  const enriched = clustered.map((row) => ({
    ...row,
    priority: assignPriority(
      row,
      noPaaFixture.intent_split,
      noPaaFixture.intent_lane,
      noPaaFixture.seed
    )
  }));
  const priorityRows = buildPrioritySubQueries(enriched, {
    seed: noPaaFixture.seed,
    intentLane: noPaaFixture.intent_lane
  });
  const r14Pass =
    priorityRows[0]?.relevance_tier === "serp_native" &&
    (noPaaFixture.expected.priority_order ?? []).every(
      (keyword, index) =>
        priorityRows[index]?.keyword?.toLowerCase() === keyword.toLowerCase()
    );
  console.log(`\n${r14Pass ? "PASS" : "FAIL"} R14 — no-paa priority policy tier-ordered`);
  if (!r14Pass) {
    process.exit(1);
  }

  console.log(`\nAll G + R checks passed for ${targets.length} handoff fixture(s).`);
}

main();
