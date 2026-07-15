/**
 * Intent cluster assignment — one canonical row per cluster for coverage/gaps SSOT.
 */
import { salientTokens, isSeedTokenPermutation } from "./normalize-fanout.mjs";
import { normalizeSeedExtras, CLUSTER_MODIFIER_TOKENS } from "./fanout-modifiers.mjs";
import { COVERED_STATUSES, normalizeKeyword, rowSources } from "./fanout-shared.mjs";

function clusterSlug(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function seedOverlapMin(seedTokens) {
  if (seedTokens.length === 0) {
    return 0;
  }
  if (seedTokens.length <= 2) {
    return 1;
  }
  return Math.min(2, seedTokens.length);
}

/**
 * Stable cluster key — merges SERP related + Labs reorderings and seed-adjacent variants.
 */
export function clusterIntentKey(row, seed) {
  if (isSeedTokenPermutation(row.keyword, seed)) {
    return "seed_synonym";
  }

  const sources = rowSources(row);
  if (sources.includes("serp_paa")) {
    return `serp_paa:${clusterSlug(row.keyword)}`;
  }

  const kwTokens = salientTokens(row.keyword);
  const seedTokens = salientTokens(seed);
  const seedSet = new Set(seedTokens);
  const overlap = kwTokens.filter((token) => seedSet.has(token)).length;
  const minOverlap = seedOverlapMin(seedTokens);

  if (overlap >= minOverlap && seedTokens.length > 0) {
    const extras = kwTokens.filter((token) => !seedSet.has(token)).sort();
    if (extras.length === 0) {
      return `intent_sig:${clusterSlug(kwTokens.slice().sort().join("|"))}`;
    }
    const normalizedExtras = normalizeSeedExtras(extras);
    if (normalizedExtras.length === 0) {
      if (extras.includes("reddit") || extras.every((t) => CLUSTER_MODIFIER_TOKENS.has(t))) {
        return "seed_adjacent:modifier_only";
      }
      return `intent_sig:${clusterSlug(kwTokens.slice().sort().join("|"))}`;
    }
    return `seed_adjacent:${clusterSlug(normalizedExtras.join("|"))}`;
  }

  if (row.core_keyword) {
    return `intent_core:${clusterSlug(row.core_keyword)}`;
  }

  return `intent_sig:${clusterSlug(kwTokens.slice().sort().join("|"))}`;
}

function assignClusterId(row, seed) {
  return clusterIntentKey(row, seed);
}

function sourceRank(row) {
  const sources = rowSources(row);
  if (sources.includes("serp_paa")) {
    return 3;
  }
  if (sources.includes("serp_related") || sources.includes("related_searches")) {
    return 2;
  }
  return 1;
}

function matchesSeedSurface(keyword, seed) {
  return normalizeKeyword(keyword) === normalizeKeyword(seed);
}

function isCoveredRow(row) {
  return COVERED_STATUSES.has(row.status);
}

/**
 * Pick canonical row per cluster.
 * @param {object[]} rowsInCluster
 * @param {string | null} seed
 * @param {string | null} clusterId
 * @param {{ useCoverage?: boolean }} [options]
 */
export function pickCanonical(rowsInCluster, seed = null, clusterId = null, options = {}) {
  const { useCoverage = false } = options;
  if (rowsInCluster.length === 0) {
    return null;
  }

  if (clusterId === "seed_synonym" && seed) {
    const sorted = [...rowsInCluster].sort((a, b) => {
      if (useCoverage) {
        const coveredDiff = Number(isCoveredRow(b)) - Number(isCoveredRow(a));
        if (coveredDiff !== 0) {
          return coveredDiff;
        }
      }

      const seedMatchDiff =
        Number(matchesSeedSurface(b.keyword, seed)) - Number(matchesSeedSurface(a.keyword, seed));
      if (seedMatchDiff !== 0) {
        return seedMatchDiff;
      }

      const srcDiff = sourceRank(b) - sourceRank(a);
      if (srcDiff !== 0) {
        return srcDiff;
      }

      return (b.search_volume ?? 0) - (a.search_volume ?? 0);
    });
    return sorted[0];
  }

  const sorted = [...rowsInCluster].sort((a, b) => {
    const srcDiff = sourceRank(b) - sourceRank(a);
    if (srcDiff !== 0) {
      return srcDiff;
    }

    const volA = a.search_volume ?? Number.MAX_SAFE_INTEGER;
    const volB = b.search_volume ?? Number.MAX_SAFE_INTEGER;
    if (volA !== volB) {
      return volA - volB;
    }

    return 0;
  });

  return sorted[0];
}

/** @deprecated alias — use pickCanonical(..., { useCoverage: true }) */
export function pickCanonicalWithCoverage(clusterId, rowsInCluster, seed) {
  return pickCanonical(rowsInCluster, seed, clusterId, { useCoverage: true });
}

/**
 * Reassign is_canonical / cluster_role after coverage statuses are known.
 * @param {object[]} subQueries
 * @param {string} seed
 */
export function refreshClusterCanonicals(subQueries, seed) {
  const byCluster = new Map();

  for (const row of subQueries) {
    const clusterId = row.intent_cluster_id ?? `distinct:${clusterSlug(row.keyword)}`;
    if (!byCluster.has(clusterId)) {
      byCluster.set(clusterId, []);
    }
    byCluster.get(clusterId).push(row);
  }

  const canonicalByCluster = new Map();
  for (const [clusterId, rows] of byCluster) {
    const canonical = pickCanonical(rows, seed, clusterId, { useCoverage: true });
    canonicalByCluster.set(clusterId, canonical?.keyword?.toLowerCase() ?? null);
  }

  return subQueries.map((row) => {
    const clusterId = row.intent_cluster_id ?? `distinct:${clusterSlug(row.keyword)}`;
    const canonicalKey = canonicalByCluster.get(clusterId);
    const isCanonical = row.keyword?.toLowerCase() === canonicalKey;
    return {
      ...row,
      is_canonical: isCanonical,
      cluster_role: isCanonical ? "canonical" : "alias"
    };
  });
}

/**
 * @param {object[]} rows — normalized fan-out rows
 * @param {string} seed
 */
export function assignClusters(rows, seed) {
  const byCluster = new Map();

  for (const row of rows) {
    const clusterId = assignClusterId(row, seed);
    if (!byCluster.has(clusterId)) {
      byCluster.set(clusterId, []);
    }
    byCluster.get(clusterId).push(row);
  }

  const result = [];
  for (const [clusterId, clusterRows] of byCluster) {
    const canonical = pickCanonical(clusterRows, seed, clusterId);
    const canonicalKey = canonical?.keyword?.toLowerCase();

    for (const row of clusterRows) {
      const isCanonical = row.keyword?.toLowerCase() === canonicalKey;
      result.push({
        ...row,
        intent_cluster_id: clusterId,
        is_canonical: isCanonical,
        cluster_role: isCanonical ? "canonical" : "alias"
      });
    }
  }

  return result;
}

export function canonicalRows(rows) {
  return rows.filter((row) => row.is_canonical === true);
}

/**
 * Roll up cluster coverage from row statuses (independent math for verifiers).
 * @param {object[]} subQueries — rows with intent_cluster_id, is_canonical, status
 * @param {{ anchorSerpRank?: number | null }} [options]
 */
export function computeClusterCoverage(subQueries, options = {}) {
  const anchorRank = options.anchorSerpRank ?? null;
  const byCluster = new Map();

  for (const row of subQueries) {
    const clusterId = row.intent_cluster_id ?? `distinct:${clusterSlug(row.keyword)}`;
    if (!byCluster.has(clusterId)) {
      byCluster.set(clusterId, []);
    }
    byCluster.get(clusterId).push(row);
  }

  let clusterCovered = 0;
  let clusterGap = 0;

  for (const [clusterId, rows] of byCluster) {
    const anyCovered = rows.some((row) => COVERED_STATUSES.has(row.status));
    const seedSynonymCovered = clusterId === "seed_synonym" && anchorRank != null && anchorRank > 0;

    if (seedSynonymCovered || anyCovered) {
      clusterCovered += 1;
    } else {
      clusterGap += 1;
    }
  }

  const clusterCount = byCluster.size;
  const clusterCoverageRatePct =
    clusterCount > 0 ? Math.round((clusterCovered / clusterCount) * 100) : 0;

  return {
    cluster_count: clusterCount,
    cluster_covered_count: clusterCovered,
    cluster_gap_count: clusterGap,
    cluster_coverage_rate_pct: clusterCoverageRatePct
  };
}

export function summarizeClusters(canonicalRowsInput) {
  const rows = canonicalRowsInput.filter((row) => row.is_canonical === true);
  return {
    cluster_count: rows.length
  };
}
