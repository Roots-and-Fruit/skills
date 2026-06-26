#!/usr/bin/env node
/**
 * Validate information-gain-evaluator handoff JSON.
 *
 * v1.0 — schema checks G1–G14 (legacy)
 * v1.1 — schema G1–G14 + rigorous information-gain checks R1–R18
 *
 * Usage:
 *   node scripts/verify-handoff.mjs [path/to/handoff.json] [--gold PROFILE]
 *
 * Profiles: commercial-vs-diy (fictional mismatch), plugin-readme-practitioner (live aligned-high)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const defaultFixture = path.join(root, "examples", "enterprise-sso.handoff.fixture.json");

const DIMENSION_IDS = [
  "original_data",
  "unique_framework",
  "first_hand_experience",
  "novel_angle",
  "citable_specificity"
];

const CITATION_CORE = ["original_data", "citable_specificity"];

const MODES = new Set(["live_url", "pinned_competitors", "draft_content"]);
const SCORES = new Set(["high", "medium", "low"]);
const BASELINE = new Set(["strong", "adequate", "weak"]);
const FETCH_STATUS = new Set(["ok", "partial", "unfetchable"]);
const CONFIDENCE = new Set(["high", "low"]);
const CITATION_FIT = new Set(["strong", "partial", "poor"]);
const PAGE_FIT = new Set(["aligned", "mismatched"]);

const GOLD_PROFILES = {
  "commercial-vs-diy": {
    overall: "low",
    citation_fit_for_keyword: "poor",
    page_keyword_fit: "mismatched",
    baseline_completeness: "weak",
    dimension_max: {
      novel_angle: "medium"
    },
    dimension_exact: {
      original_data: "low"
    }
  },
  "plugin-readme-practitioner": {
    overall: "high",
    citation_fit_for_keyword: "partial",
    page_keyword_fit: "aligned",
    baseline_completeness: "adequate"
  }
};

const MIN_SNIPPET_LEN = 40;
const MIN_RATIONALE_LEN = 30;

function loadHandoff(argPath) {
  const filePath = argPath ? path.resolve(argPath) : defaultFixture;
  const raw = readFileSync(filePath, "utf8");
  return { filePath, data: JSON.parse(raw) };
}

function scoreCounts(dimensions) {
  const counts = { high: 0, medium: 0, low: 0 };
  for (const dim of dimensions) {
    counts[dim.score] += 1;
  }
  return counts;
}

function dimensionMap(dimensions) {
  return Object.fromEntries(dimensions.map((d) => [d.id, d.score]));
}

/** Legacy v1.0 overall — kept for migration warnings only. */
function computeOverallV10(dimensions) {
  const counts = scoreCounts(dimensions);
  if (counts.low >= 2) {
    return "low";
  }
  if (counts.high === 0 && counts.medium === 5) {
    return "low";
  }
  if (counts.high >= 3 && counts.low === 0) {
    return "high";
  }
  return "medium";
}

/** Rigorous information-gain overall (v1.1). */
function computeOverallV11(dimensions, citationFit, pageKeywordFit) {
  const counts = scoreCounts(dimensions);
  const scores = dimensionMap(dimensions);
  const citationCoreHigh = CITATION_CORE.some((id) => scores[id] === "high");

  if (citationFit === "poor") {
    if (counts.low >= 1 || !citationCoreHigh) {
      return "low";
    }
    return "medium";
  }

  if (pageKeywordFit === "mismatched") {
    if (counts.low >= 2 || (counts.high === 0 && counts.medium === 5)) {
      return "low";
    }
    if (counts.low >= 1 && !citationCoreHigh) {
      return "low";
    }
    return "medium";
  }

  if (counts.low >= 2) {
    return "low";
  }
  if (counts.high === 0 && counts.medium === 5) {
    return "low";
  }
  if (counts.low >= 1 && !citationCoreHigh) {
    return "low";
  }
  if (
    counts.high >= 3 &&
    counts.low === 0 &&
    citationCoreHigh &&
    citationFit !== "poor"
  ) {
    return "high";
  }
  if (
    counts.high >= 2 &&
    counts.low === 0 &&
    citationCoreHigh &&
    citationFit === "strong"
  ) {
    return "high";
  }
  return "medium";
}

function baselineFromPct(pct) {
  if (pct < 50) {
    return "weak";
  }
  if (pct < 80) {
    return "adequate";
  }
  return "strong";
}

function fetchableCompetitors(competitorSet) {
  return competitorSet.filter(
    (c) => c.fetch_status === "ok" || c.fetch_status === "partial"
  );
}

function unfetchableUrls(competitorSet) {
  return new Set(
    competitorSet
      .filter((c) => c.fetch_status === "unfetchable")
      .map((c) => c.url)
  );
}

function runSchemaChecks(data) {
  const checks = [];
  const isV11 = data.handoff_version === "1.1";

  checks.push({
    id: "G1",
    pass: () => data.handoff_version === "1.0" || data.handoff_version === "1.1"
  });

  checks.push({
    id: "G2",
    pass: () => data.skill === "information-gain-evaluator"
  });

  checks.push({
    id: "G3",
    pass: () =>
      Boolean(data.inputs?.primary_keyword) && Boolean(data.inputs?.target_label)
  });

  checks.push({
    id: "G4",
    pass: () => MODES.has(data.mode)
  });

  checks.push({
    id: "G5",
    pass: () => {
      const set = data.competitor_set;
      if (!Array.isArray(set) || set.length < 1 || set.length > 5) {
        return false;
      }
      return set.every(
        (row) => row.url && row.domain && FETCH_STATUS.has(row.fetch_status)
      );
    }
  });

  checks.push({
    id: "G6",
    pass: () => {
      if (!Array.isArray(data.dimensions) || data.dimensions.length !== 5) {
        return false;
      }
      const ids = data.dimensions.map((d) => d.id).sort();
      const expected = [...DIMENSION_IDS].sort();
      return ids.every((id, i) => id === expected[i]);
    }
  });

  checks.push({ id: "G7", pass: () => data.dimensions.every((d) => SCORES.has(d.score)) });

  checks.push({
    id: "G8",
    pass: () =>
      data.dimensions.every(
        (d) =>
          typeof d.finding === "string" &&
          d.finding.length > 0 &&
          typeof d.evidence_target === "string" &&
          d.evidence_target.length > 0
      )
  });

  checks.push({
    id: "G9",
    pass: () =>
      data.dimensions.every(
        (d) =>
          Array.isArray(d.evidence_competitors) &&
          d.evidence_competitors.length >= 1 &&
          d.evidence_competitors.every(
            (e) =>
              typeof e.url === "string" &&
              e.url.length > 0 &&
              typeof e.snippet === "string" &&
              e.snippet.length > 0
          )
      )
  });

  checks.push({
    id: "G10",
    pass: () => {
      if (!SCORES.has(data.overall)) {
        return false;
      }
      if (isV11) {
        return (
          data.overall ===
          computeOverallV11(
            data.dimensions,
            data.citation_fit_for_keyword,
            data.page_keyword_fit
          )
        );
      }
      return data.overall === computeOverallV10(data.dimensions);
    }
  });

  checks.push({
    id: "G11",
    pass: () => BASELINE.has(data.baseline_completeness)
  });

  checks.push({
    id: "G12",
    pass: () =>
      Array.isArray(data.table_stakes) &&
      Array.isArray(data.table_stakes_gaps) &&
      Array.isArray(data.unique_strengths)
  });

  checks.push({
    id: "G13",
    pass: () => {
      const needsRec = data.dimensions.some(
        (d) => d.score === "medium" || d.score === "low"
      );
      if (!needsRec) {
        return true;
      }
      return (
        Array.isArray(data.recommendations) && data.recommendations.length >= 1
      );
    }
  });

  checks.push({
    id: "G14",
    pass: () => {
      if (!CONFIDENCE.has(data.confidence)) {
        return false;
      }
      const unfetchable =
        data.competitor_set?.filter((c) => c.fetch_status === "unfetchable")
          .length ?? 0;
      if (unfetchable >= 3) {
        return data.confidence === "low";
      }
      return true;
    }
  });

  return checks;
}

function runRigorChecks(data) {
  if (data.handoff_version !== "1.1") {
    return [];
  }

  const checks = [];
  const badUrls = unfetchableUrls(data.competitor_set ?? []);
  const fetchable = fetchableCompetitors(data.competitor_set ?? []);

  checks.push({
    id: "R1",
    pass: () => CITATION_FIT.has(data.citation_fit_for_keyword)
  });

  checks.push({
    id: "R2",
    pass: () => PAGE_FIT.has(data.page_keyword_fit)
  });

  checks.push({
    id: "R3",
    pass: () =>
      typeof data.baseline_coverage_pct === "number" &&
      data.baseline_coverage_pct >= 0 &&
      data.baseline_coverage_pct <= 100
  });

  checks.push({
    id: "R4",
    pass: () =>
      data.baseline_completeness === baselineFromPct(data.baseline_coverage_pct)
  });

  checks.push({
    id: "R5",
    pass: () =>
      Array.isArray(data.table_stakes) &&
      data.table_stakes.length >= 5 &&
      data.table_stakes_gaps.length >= 1
  });

  checks.push({
    id: "R6",
    pass: () =>
      typeof data.citation_fit_rationale === "string" &&
      data.citation_fit_rationale.length >= MIN_RATIONALE_LEN
  });

  checks.push({
    id: "R7",
    pass: () =>
      data.dimensions.every(
        (d) =>
          d.evidence_target.length >= MIN_SNIPPET_LEN &&
          d.evidence_competitors.every((e) => e.snippet.length >= MIN_SNIPPET_LEN)
      )
  });

  checks.push({
    id: "R8",
    pass: () =>
      data.dimensions.every((d) =>
        d.evidence_competitors.every((e) => !badUrls.has(e.url))
      )
  });

  checks.push({
    id: "R9",
    pass: () => {
      if (data.citation_fit_for_keyword !== "poor") {
        return true;
      }
      const novel = data.dimensions.find((d) => d.id === "novel_angle");
      return novel?.score !== "high";
    }
  });

  checks.push({
    id: "R10",
    pass: () => {
      if (data.citation_fit_for_keyword !== "poor") {
        return true;
      }
      return data.overall !== "high";
    }
  });

  checks.push({
    id: "R11",
    pass: () => {
      if (data.overall !== "high") {
        return true;
      }
      const scores = dimensionMap(data.dimensions);
      return CITATION_CORE.some((id) => scores[id] === "high");
    }
  });

  checks.push({
    id: "R12",
    pass: () => {
      if (data.page_keyword_fit !== "mismatched") {
        return true;
      }
      return data.citation_fit_for_keyword !== "strong";
    }
  });

  checks.push({
    id: "R13",
    pass: () => {
      if (data.page_keyword_fit !== "mismatched") {
        return true;
      }
      return data.overall !== "high";
    }
  });

  checks.push({
    id: "R14",
    pass: () => {
      if (fetchable.length >= 3) {
        return data.confidence === "high";
      }
      return data.confidence === "low";
    }
  });

  checks.push({
    id: "R15",
    pass: () => {
      if (data.citation_fit_for_keyword !== "strong") {
        return true;
      }
      const scores = dimensionMap(data.dimensions);
      return CITATION_CORE.some((id) => scores[id] === "high");
    }
  });

  checks.push({
    id: "R16",
    pass: () => {
      const scores = dimensionMap(data.dimensions);
      if (scores.novel_angle !== "high") {
        return true;
      }
      return (
        scores.original_data === "high" ||
        scores.citable_specificity === "high" ||
        scores.first_hand_experience === "high"
      );
    }
  });

  checks.push({
    id: "R17",
    pass: () => data.unique_strengths.length >= 2
  });

  checks.push({
    id: "R18",
    pass: () => {
      if (data.overall !== "low") {
        return true;
      }
      return (
        data.citation_fit_for_keyword === "poor" ||
        scoreCounts(data.dimensions).low >= 1
      );
    }
  });

  return checks;
}

function runGoldChecks(data, profileName) {
  const profile = GOLD_PROFILES[profileName];
  if (!profile) {
    return [];
  }

  const checks = [];
  const scores = dimensionMap(data.dimensions);

  if (profile.overall) {
    checks.push({
      id: `P-${profileName}-overall`,
      pass: () => data.overall === profile.overall
    });
  }

  if (profile.citation_fit_for_keyword) {
    checks.push({
      id: `P-${profileName}-citation`,
      pass: () => data.citation_fit_for_keyword === profile.citation_fit_for_keyword
    });
  }

  if (profile.page_keyword_fit) {
    checks.push({
      id: `P-${profileName}-page-fit`,
      pass: () => data.page_keyword_fit === profile.page_keyword_fit
    });
  }

  if (profile.baseline_completeness) {
    checks.push({
      id: `P-${profileName}-baseline`,
      pass: () => data.baseline_completeness === profile.baseline_completeness
    });
  }

  for (const [id, expected] of Object.entries(profile.dimension_exact ?? {})) {
    checks.push({
      id: `P-${profileName}-${id}`,
      pass: () => scores[id] === expected
    });
  }

  for (const [id, maxScore] of Object.entries(profile.dimension_max ?? {})) {
    const rank = { low: 0, medium: 1, high: 2 };
    checks.push({
      id: `P-${profileName}-${id}-max`,
      pass: () => rank[scores[id]] <= rank[maxScore]
    });
  }

  return checks;
}

const args = process.argv.slice(2);
const goldIdx = args.indexOf("--gold");
const goldProfile = goldIdx >= 0 ? args[goldIdx + 1] : null;
const fileArg = args.find((a) => !a.startsWith("--") && a !== goldProfile);

const { filePath, data } = loadHandoff(fileArg);
const allChecks = [
  ...runSchemaChecks(data),
  ...runRigorChecks(data),
  ...(goldProfile ? runGoldChecks(data, goldProfile) : [])
];

let failed = 0;
for (const check of allChecks) {
  const ok = check.pass();
  console.log(`${ok ? "PASS" : "FAIL"} ${check.id}`);
  if (!ok) {
    failed += 1;
  }
}

if (data.handoff_version === "1.0") {
  console.warn(
    "\nWARN: handoff_version 1.0 — rigorous checks R1–R18 skipped. Ship gate requires 1.1."
  );
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed for ${filePath}`);
  if (data.handoff_version === "1.1") {
    const expected = computeOverallV11(
      data.dimensions,
      data.citation_fit_for_keyword,
      data.page_keyword_fit
    );
    console.error(
      `Hint: rigorous overall from dimensions + citation/page fit → "${expected}"`
    );
  }
  process.exit(1);
}

const rigorNote =
  data.handoff_version === "1.1" ? "G1–G14 + R1–R18" : "G1–G14 only (legacy v1.0)";
const goldNote = goldProfile ? ` + gold profile "${goldProfile}"` : "";
console.log(`\nAll checks passed (${rigorNote}${goldNote}) for ${filePath}`);
