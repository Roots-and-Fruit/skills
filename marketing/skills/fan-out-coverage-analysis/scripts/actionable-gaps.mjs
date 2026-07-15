/**
 * Shared fan-out gap selection: priority_sub_queries ∩ coverage status,
 * with seed-token permutation demotion (not separate content jobs).
 */
import { isSeedTokenPermutation, salientTokens } from "./normalize-fanout.mjs";
import { isOffTopicDemotablePaa } from "./fanout-modifiers.mjs";
import { dominantSerpLane } from "./serp-context.mjs";
import {
  COVERED_STATUSES,
  PRIORITY_RANK,
  TIER_RANK,
  isSuggestionOnlyPermutation,
  rowSources
} from "./fanout-shared.mjs";

export { rowSources, isSuggestionOnlyPermutation, isSeedTokenPermutation };

export function subQueryIndex(handoff) {
  const map = new Map();
  for (const row of handoff.sub_queries ?? []) {
    map.set(String(row.keyword).toLowerCase(), row);
  }
  return map;
}

export function isQuestionRow(row) {
  const kw = String(row.keyword ?? "");
  return (
    row.dimension === "question" ||
    rowSources(row).includes("serp_paa") ||
    /^(what|how|why|can|does|do|is|are)\b/i.test(kw)
  );
}

function clusterHasCoverage(handoff, clusterId) {
  if (!clusterId) {
    return false;
  }
  return (handoff.sub_queries ?? []).some(
    (row) => row.intent_cluster_id === clusterId && COVERED_STATUSES.has(row.status)
  );
}

export function isActionableFanoutRow(row, seed, handoff = null) {
  if (
    handoff &&
    row.intent_cluster_id === "seed_synonym" &&
    isSeedTokenPermutation(row.keyword, seed) &&
    clusterHasCoverage(handoff, "seed_synonym")
  ) {
    return false;
  }

  if (isSuggestionOnlyPermutation(row) && isSeedTokenPermutation(row.keyword, seed)) {
    return false;
  }
  return true;
}

/**
 * Layperson + action-plan SSOT: tier-ordered priority_sub_queries that need content work.
 */
export function buildActionableGaps(handoff) {
  const mode = handoff.mode ?? "keyword_only";
  const seed = handoff.inputs?.primary_keyword ?? "";
  const byKw = subQueryIndex(handoff);
  const questionGaps = [];
  const otherGaps = [];
  const weakCoverage = [];
  const seen = new Set();

  const pushRow = (bucket, row) => {
    const key = String(row.keyword ?? "").toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    bucket.push(row);
    seen.add(key);
  };

  for (const prio of handoff.priority_sub_queries ?? []) {
    const key = String(prio.keyword ?? "").toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    const full = { ...prio, ...(byKw.get(key) ?? {}) };

    if (!isActionableFanoutRow(full, seed, handoff)) {
      continue;
    }

    if (mode === "keyword_only") {
      if (full.priority !== "low") {
        pushRow(otherGaps, full);
      }
      continue;
    }

    const status = full.status;
    if (status === "gap" || status === "broken_spoke") {
      if (isQuestionRow(full)) {
        pushRow(questionGaps, full);
      } else {
        pushRow(otherGaps, full);
      }
      continue;
    }

    if (status === "hub_serp_only" && (full.relevance_tier === "serp_native" || isQuestionRow(full))) {
      pushRow(weakCoverage, { ...full, coverage_weak: true });
    }
  }

  if (mode === "domain_coverage" && questionGaps.length === 0 && otherGaps.length === 0) {
    for (const row of handoff.sub_queries ?? []) {
      if (row.status !== "gap" || row.priority === "low") {
        continue;
      }
      if (isQuestionRow(row)) {
        pushRow(questionGaps, row);
      } else {
        pushRow(otherGaps, row);
      }
    }
  }

  return [...questionGaps, ...otherGaps, ...weakCoverage];
}

/** Canonical rows that rank page 2+ — strengthen, not net-new URLs. */
export function brokenSpokeRows(handoff) {
  return (handoff.sub_queries ?? []).filter(
    (row) =>
      row.status === "broken_spoke" &&
      row.is_canonical !== false &&
      row.cluster_role !== "alias"
  );
}

/**
 * Write-next shortlist — may blend PAA + commercial related when zero cluster coverage on tool SERPs.
 * @param {object} handoff
 * @param {number} [maxItems]
 */
export function buildWriteNextGaps(handoff, maxItems = 6) {
  const actionable = buildActionableGaps(handoff);
  const seed = handoff.inputs?.primary_keyword ?? "";
  const seedTokens = salientTokens(seed);
  const chosenLane = handoff.inputs?.intent_lane ?? null;
  const paaCtx = { chosenLane, seedTokens };
  let netNewGaps = actionable.filter((row) => row.status === "gap");
  if (chosenLane === "primary_topic") {
    netNewGaps = netNewGaps.filter((row) => !isOffTopicDemotablePaa(row.keyword, paaCtx));
  }

  const summary = handoff.coverage_summary ?? {};
  const dominant = dominantSerpLane(handoff.serp_context ?? {});
  const commercialSERP =
    chosenLane === "tool_discovery" || dominant === "tool_discovery";
  const clusterCovered = summary.cluster_covered_count ?? 0;
  const zeroCoverage = handoff.mode === "domain_coverage" && clusterCovered === 0;
  const partialToolDiscovery =
    handoff.mode === "domain_coverage" && clusterCovered > 0 && commercialSERP;

  if ((!zeroCoverage && !partialToolDiscovery) || !commercialSERP) {
    return netNewGaps.slice(0, maxItems);
  }

  const questionRows = netNewGaps.filter((row) => isQuestionRow(row));
  const demotableQuestions = questionRows.filter((row) =>
    isOffTopicDemotablePaa(row.keyword, paaCtx)
  );
  const primaryQuestions = questionRows.filter(
    (row) => !isOffTopicDemotablePaa(row.keyword, paaCtx)
  );
  const questionGaps = partialToolDiscovery
    ? [...primaryQuestions.slice(0, 2), ...demotableQuestions.slice(0, 2)]
    : primaryQuestions.slice(0, 3);
  const questionKeys = new Set(questionGaps.map((row) => row.keyword.toLowerCase()));
  const relatedGaps = netNewGaps
    .filter(
      (row) =>
        !questionKeys.has(row.keyword.toLowerCase()) &&
        !isOffTopicDemotablePaa(row.keyword, paaCtx) &&
        (row.relevance_tier === "serp_native" || row.on_seed_serp)
    )
    .sort((a, b) => (b.search_volume ?? 0) - (a.search_volume ?? 0));

  if (partialToolDiscovery) {
    return [...relatedGaps.slice(0, 3), ...questionGaps, ...relatedGaps.slice(3)].slice(
      0,
      maxItems
    );
  }

  return [...questionGaps, ...relatedGaps].slice(0, maxItems);
}

/** Uncovered or covered-cluster seed permutations — not separate content jobs. */
export function coreVariantPermutationRows(handoff) {
  const seed = handoff.inputs?.primary_keyword ?? "";
  const seedSynonymCovered = clusterHasCoverage(handoff, "seed_synonym");

  return (handoff.sub_queries ?? []).filter((row) => {
    if (!isSeedTokenPermutation(row.keyword, seed)) {
      return false;
    }
    if (seedSynonymCovered && row.intent_cluster_id === "seed_synonym") {
      return true;
    }
    return row.status === "gap" && isSuggestionOnlyPermutation(row);
  });
}

export function sortGapsForHandoff(rows) {
  return [...rows].sort((a, b) => {
    const priorityDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const tierDiff = (TIER_RANK[b.relevance_tier] ?? 0) - (TIER_RANK[a.relevance_tier] ?? 0);
    if (tierDiff !== 0) {
      return tierDiff;
    }

    const questionDiff = Number(isQuestionRow(b)) - Number(isQuestionRow(a));
    if (questionDiff !== 0) {
      return questionDiff;
    }

    const serpDiff = Number(Boolean(b.on_seed_serp)) - Number(Boolean(a.on_seed_serp));
    if (serpDiff !== 0) {
      return serpDiff;
    }

    const variantDiff =
      Number(a.dimension === "core_variant") - Number(b.dimension === "core_variant");
    if (variantDiff !== 0) {
      return variantDiff;
    }

    return (b.search_volume ?? 0) - (a.search_volume ?? 0);
  });
}
