/**
 * Detail report helpers — SERP fan-out SSOT from sub_queries, cluster rollup tables.
 */
import { COVERED_STATUSES, isRootAnchorUrl, rowSources } from "./fanout-shared.mjs";
import { computeClusterCoverage } from "./intent-clusters.mjs";

function normalizeKey(keyword) {
  return String(keyword ?? "").toLowerCase().trim();
}

function escapeTableCell(value) {
  return String(value ?? "—").replace(/\|/g, "\\|");
}

/**
 * PAA + related lists derived from accepted sub_queries (post-normalize SSOT).
 */
export function deriveSerpFanoutFromSubQueries(subQueries) {
  const peopleAlsoAsk = [];
  const relatedSearches = [];
  const seenPaa = new Set();
  const seenRelated = new Set();

  for (const row of subQueries ?? []) {
    const sources = rowSources(row);
    const key = normalizeKey(row.keyword);
    if (!key) {
      continue;
    }

    if (sources.includes("serp_paa") && !seenPaa.has(key)) {
      peopleAlsoAsk.push(row.keyword);
      seenPaa.add(key);
      continue;
    }

    if (
      (sources.includes("serp_related") || sources.includes("related_searches")) &&
      row.is_canonical !== false &&
      !seenRelated.has(key)
    ) {
      relatedSearches.push(row.keyword);
      seenRelated.add(key);
    }
  }

  return { people_also_ask: peopleAlsoAsk, related_searches: relatedSearches };
}

/**
 * Align handoff serp_context fan-out arrays with ingested sub_queries.
 */
export function syncSerpContextFanout(handoff) {
  const derived = deriveSerpFanoutFromSubQueries(handoff.sub_queries);
  const serp = { ...(handoff.serp_context ?? {}) };
  const limitations = [...(handoff.limitations ?? [])];

  if (derived.people_also_ask.length > 0) {
    const prior = serp.people_also_ask ?? [];
    if (
      prior.length > 0 &&
      prior.length !== derived.people_also_ask.length &&
      !limitations.some((line) => line.includes("PAA list synced from ingested"))
    ) {
      limitations.push(
        `PAA list synced from ingested sub_queries (${derived.people_also_ask.length} accepted vs ${prior.length} in live SERP snapshot).`
      );
    }
    serp.people_also_ask = derived.people_also_ask;
  }

  if (derived.related_searches.length > 0) {
    serp.related_searches = derived.related_searches;
  }

  return { ...handoff, serp_context: serp, limitations };
}

function clusterRollupStatus(rows) {
  const realCovered = rows.some((row) =>
    ["hub", "spoke", "broken_spoke"].some((status) => row.status === status)
  );
  const anyHubSerpOnly = rows.some((row) => row.status === "hub_serp_only");
  if (!realCovered && !anyHubSerpOnly) {
    return "gap";
  }
  if (realCovered) {
    return "covered";
  }
  return "weak";
}

function weakCoverageIntro(handoff) {
  const anchorUrl = handoff.inputs?.anchor_url;
  if (anchorUrl && !isRootAnchorUrl(anchorUrl)) {
    return "_Hub URL ranks live for seed; dedicated content may still be thin._";
  }
  return "_Homepage ranks live for seed; dedicated content may still be thin._";
}

function clusterRollupRows(subQueries) {
  const byCluster = new Map();

  for (const row of subQueries ?? []) {
    const clusterId = row.intent_cluster_id ?? `distinct:${normalizeKey(row.keyword)}`;
    if (!byCluster.has(clusterId)) {
      byCluster.set(clusterId, []);
    }
    byCluster.get(clusterId).push(row);
  }

  const coveredStatuses = COVERED_STATUSES;

  return [...byCluster.entries()].map(([clusterId, rows]) => {
    const canonical = rows.find((row) => row.is_canonical === true) ?? rows[0];
    const anyCovered = rows.some((row) => coveredStatuses.has(row.status));
    return {
      clusterId,
      canonicalKeyword: canonical?.keyword ?? "—",
      status: clusterRollupStatus(rows),
      covered: anyCovered,
      rowCount: rows.length
    };
  });
}

export function buildDetailReportMarkdown(handoff) {
  const ingested = deriveSerpFanoutFromSubQueries(handoff.sub_queries);
  const serpMeta = { ...(handoff.serp_context ?? {}) };
  delete serpMeta.people_also_ask;
  delete serpMeta.related_searches;

  const clusterRows = clusterRollupRows(handoff.sub_queries);
  const weakCoverage = (handoff.sub_queries ?? []).filter(
    (row) => row.status === "hub_serp_only" && row.is_canonical !== false
  );
  const facetDrift = (handoff.sub_queries ?? []).filter(
    (row) => row.relevance_tier === "facet_drift"
  );

  const sections = [
    `# Fan-out detail report — ${handoff.inputs?.primary_keyword ?? "keyword"}`,
    "",
    `**Mode:** ${handoff.mode}`,
    `**Generated:** ${handoff.generated_at ?? ""}`,
    `**Skill:** ${handoff.skill ?? "fan-out-coverage-analysis"} ${handoff.skill_version ?? ""}`,
    "",
    "## SERP fan-out ingested (SSOT)",
    "",
    "Accepted after normalize — use this list for PAA and related fan-out, not the shallow live SERP snapshot alone.",
    "",
    `### People Also Ask (${ingested.people_also_ask.length})`,
    ""
  ];

  if (ingested.people_also_ask.length === 0) {
    sections.push("- _(none accepted)_", "");
  } else {
    for (const question of ingested.people_also_ask) {
      sections.push(`- ${question}`);
    }
    sections.push("");
  }

  sections.push(`### Related searches (${ingested.related_searches.length})`, "");
  if (ingested.related_searches.length === 0) {
    sections.push("- _(none accepted)_", "");
  } else {
    for (const related of ingested.related_searches) {
      sections.push(`- ${related}`);
    }
    sections.push("");
  }

  sections.push(
    "## Live SERP metadata",
    "",
    "_AI Overview, lanes, anchor rank, organic domains — fan-out lists above are ingested SSOT._",
    "",
    "```json",
    JSON.stringify(serpMeta, null, 2),
    "```",
    "",
    "## Coverage summary",
    "",
    "```json",
    JSON.stringify(handoff.coverage_summary ?? {}, null, 2),
    "```",
    ""
  );

  if (handoff.mode === "domain_coverage" && clusterRows.length > 0) {
    const anchorRank = handoff.serp_context?.anchor_serp_rank ?? null;
    const clusterStats = computeClusterCoverage(handoff.sub_queries ?? [], {
      anchorSerpRank: anchorRank
    });
    sections.push(
      "## Intent clusters",
      "",
      `Rollup: **${clusterStats.cluster_covered_count}/${clusterStats.cluster_count}** covered (${clusterStats.cluster_coverage_rate_pct}%).`,
      "",
      "| Cluster | Canonical keyword | Status | Rows |",
      "|---------|-------------------|--------|------|"
    );
    for (const row of clusterRows.sort((a, b) => Number(b.covered) - Number(a.covered))) {
      sections.push(
        `| ${escapeTableCell(row.clusterId)} | ${escapeTableCell(row.canonicalKeyword)} | ${escapeTableCell(row.status)} | ${row.rowCount} |`
      );
    }
    sections.push("");
  }

  if (handoff.serp_context?.intent_split === "mixed") {
    sections.push(
      "## SERP intent note",
      "",
      `This SERP mixes lanes: ${(handoff.serp_context.intent_lanes_detected ?? []).join(", ")}. Analysis lane: **${handoff.inputs?.intent_lane ?? "—"}**.`,
      ""
    );
  }

  sections.push(
    "## Sub-queries (coverage map)",
    "",
    "| Keyword | Tier | Priority | Status | Cluster | Intent | Source |",
    "|---------|------|----------|--------|---------|--------|--------|"
  );

  for (const row of handoff.sub_queries ?? []) {
    const sources = rowSources(row).join(", ");
    sections.push(
      `| ${escapeTableCell(row.keyword)} | ${escapeTableCell(row.relevance_tier)} | ${escapeTableCell(row.priority)} | ${escapeTableCell(row.status ?? "—")} | ${escapeTableCell(row.intent_cluster_id ?? "—")} | ${escapeTableCell(row.search_intent ?? "—")} | ${escapeTableCell(sources)} |`
    );
  }

  if (weakCoverage.length > 0) {
    sections.push("", "## Weak coverage (hub_serp_only)", "");
    sections.push(weakCoverageIntro(handoff), "");
    for (const row of weakCoverage) {
      const rank = row.rank_group != null ? ` (~#${row.rank_group})` : "";
      sections.push(`- ${row.keyword}${rank}`);
    }
  }

  if (facetDrift.length > 0) {
    sections.push("", "## Facet drift (not priority unless lane pivot)", "");
    for (const row of facetDrift) {
      sections.push(`- ${row.keyword}`);
    }
  }

  sections.push(
    "",
    "## Priority sub-queries",
    "",
    "```json",
    JSON.stringify(handoff.priority_sub_queries ?? [], null, 2),
    "```",
    "",
    `## Gaps (shortlist ${(handoff.gaps ?? []).length} of ${handoff.coverage_summary?.gaps_row_total ?? "—"} row gaps, ${handoff.coverage_summary?.cluster_gap_count ?? "—"} cluster gaps)`,
    "",
    "```json",
    JSON.stringify(handoff.gaps ?? [], null, 2),
    "```",
    ""
  );

  if ((handoff.hub_spoke_map ?? []).length > 0) {
    sections.push(
      "## Hub / spoke map",
      "",
      "```json",
      JSON.stringify(handoff.hub_spoke_map ?? [], null, 2),
      "```",
      ""
    );
  }

  sections.push(
    "## Limitations",
    "",
    ...(handoff.limitations ?? []).map((line) => `- ${line}`),
    "",
    "## Handoff JSON",
    "",
    "```json",
    JSON.stringify(handoff, null, 2),
    "```",
    ""
  );

  return sections.join("\n");
}
