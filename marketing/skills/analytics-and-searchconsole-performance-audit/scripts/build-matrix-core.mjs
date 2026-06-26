import { readFileSync } from "node:fs";
import { parseCsv, rowsToObjects, pickField, parseNumber } from "./parse-csv.mjs";
import { normalizeUrl } from "./normalize-url.mjs";
import { classifyHubType } from "./classify-hub-type.mjs";
import { percentileRank, isHigh } from "./percentile.mjs";
import {
  brandTermsFromDomain,
  classifyQueryIntent
} from "./classify-query-intent.mjs";
import {
  buildDiscoverySummary,
  isIndexingNoiseUrl
} from "./build-discovery-summary.mjs";

export const SKILL_VERSION = "1.3.1";

export const ANALYSIS_MODES = new Set([
  "discovery_only",
  "discovery_plus_conversions"
]);

const INTENDED_HUB_INVISIBLE_IMPRESSIONS = 100;
const BRAND_ONLY_CLICK_SHARE = 0.8;

const PAGE_ALIASES = ["page", "top_pages", "landing_page", "landingpage", "url"];
const QUERY_ALIASES = ["query", "top_queries", "search_query", "queries"];
const IMPRESSION_ALIASES = ["impressions", "impression"];
const CLICK_ALIASES = ["clicks", "click"];
const POSITION_ALIASES = ["position", "average_position", "avg_position"];

const GA4_PAGE_ALIASES = [
  "landing_page",
  "landingpage",
  "page_path",
  "page_path_screen_class",
  "page"
];
const SESSION_ALIASES = ["sessions", "session"];
const ENGAGEMENT_RATE_ALIASES = ["engagement_rate", "engaged_sessions_rate"];

function parseGscRow(row, domain) {
  const pageRaw = pickField(row, PAGE_ALIASES);
  const query = pickField(row, QUERY_ALIASES);
  const url = normalizeUrl(pageRaw, domain);
  if (!url) {
    return null;
  }
  return {
    url,
    query: query ? String(query).toLowerCase() : "",
    impressions: parseNumber(pickField(row, IMPRESSION_ALIASES)),
    clicks: parseNumber(pickField(row, CLICK_ALIASES)),
    position: parseNumber(pickField(row, POSITION_ALIASES))
  };
}

export function parseGscQueryRows(text, domain) {
  const rows = rowsToObjects(parseCsv(text));
  const out = [];
  for (const row of rows) {
    const parsed = parseGscRow(row, domain);
    if (parsed && parsed.query) {
      out.push(parsed);
    }
  }
  return out;
}

export function parseGscQueriesCsv(text, domain) {
  const rows = rowsToObjects(parseCsv(text));
  const byPage = new Map();

  for (const row of rows) {
    const parsed = parseGscRow(row, domain);
    if (!parsed) {
      continue;
    }

    const { url, query, impressions, clicks, position } = parsed;

    if (!byPage.has(url)) {
      byPage.set(url, {
        url,
        impressions: 0,
        clicks: 0,
        position_weighted_sum: 0,
        queries: new Set()
      });
    }

    const agg = byPage.get(url);
    agg.impressions += impressions;
    agg.clicks += clicks;
    agg.position_weighted_sum += position * impressions;
    if (query) {
      agg.queries.add(query);
    }
  }

  return [...byPage.values()].map((p) => ({
    url: p.url,
    impressions: p.impressions,
    clicks: p.clicks,
    ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
    avg_position: p.impressions > 0 ? p.position_weighted_sum / p.impressions : 0,
    query_breadth: p.queries.size
  }));
}

export function parseGa4LandingCsv(text, domain, conversionEvents = []) {
  const rows = rowsToObjects(parseCsv(text));
  const byPage = new Map();

  for (const row of rows) {
    const pageRaw = pickField(row, GA4_PAGE_ALIASES);
    const url = normalizeUrl(pageRaw, domain);
    if (!url) {
      continue;
    }

    const sessions = parseNumber(pickField(row, SESSION_ALIASES));
    const engagementRateRaw = pickField(row, ENGAGEMENT_RATE_ALIASES);
    const engagement_rate =
      engagementRateRaw !== null ? parseNumber(engagementRateRaw) : null;

    const conversions = {};
    for (const eventName of conversionEvents) {
      const key = eventName.toLowerCase().replace(/\s+/g, "_");
      const count = parseNumber(row[key] ?? row[eventName] ?? row[eventName.toLowerCase()]);
      conversions[eventName] = count;
    }

    if (!byPage.has(url)) {
      byPage.set(url, {
        url,
        sessions: 0,
        engagement_rate_sum: 0,
        engagement_rate_count: 0,
        conversions: Object.fromEntries(conversionEvents.map((e) => [e, 0]))
      });
    }

    const agg = byPage.get(url);
    agg.sessions += sessions;
    if (engagement_rate !== null && engagement_rate > 0) {
      agg.engagement_rate_sum += engagement_rate;
      agg.engagement_rate_count += 1;
    }
    for (const eventName of conversionEvents) {
      agg.conversions[eventName] += conversions[eventName] || 0;
    }
  }

  return [...byPage.values()].map((p) => {
    const conversion_total = conversionEvents.reduce(
      (sum, e) => sum + (p.conversions[e] || 0),
      0
    );
    return {
      url: p.url,
      sessions: p.sessions,
      engagement_rate:
        p.engagement_rate_count > 0
          ? p.engagement_rate_sum / p.engagement_rate_count
          : null,
      conversions: p.conversions,
      conversion_total
    };
  });
}

function computeVisibilityScore(page, clickRanks, impressionRanks, ctrRanks, positionRanks) {
  const clickP = percentileRank(page.clicks, clickRanks);
  const impressionP = percentileRank(page.impressions, impressionRanks);
  const ctrP = percentileRank(page.ctr, ctrRanks);
  const positionP = percentileRank(-page.avg_position, positionRanks.map((v) => -v));

  let score = clickP * 0.4 + ctrP * 0.25 + positionP * 0.2 + impressionP * 0.15;

  if (page.avg_position > 20 && page.impressions > 0) {
    score *= 0.85;
  }

  return Number(score.toFixed(4));
}

function computeValueScore(page, conversionTotals, sessionRanks) {
  const conversionTotal = page.conversion_total || 0;
  const conversionP = percentileRank(
    conversionTotal,
    conversionTotals.length ? conversionTotals : [0]
  );
  const sessionP = percentileRank(page.sessions || 0, sessionRanks);

  if (conversionTotal > 0) {
    return Number((conversionP * 0.85 + sessionP * 0.15).toFixed(4));
  }
  return Number((sessionP * 0.35).toFixed(4));
}

function assignQuadrant(
  highVisibility,
  highValue,
  hasGsc,
  hasGa4,
  pageHasGsc,
  analysisMode
) {
  if (!hasGsc && !hasGa4) {
    return "unclassified";
  }

  if (analysisMode === "discovery_only") {
    if (pageHasGsc) {
      return highVisibility ? "high_visibility_unvalued" : "low_visibility_unvalued";
    }
    return "low_visibility_unvalued";
  }

  if (hasGsc && !hasGa4) {
    return highVisibility ? "high_visibility_unvalued" : "low_visibility_unvalued";
  }
  if (!hasGsc && hasGa4) {
    return highValue ? "high_value_untracked" : "low_value_untracked";
  }
  if (highVisibility && highValue) {
    return "unicorn";
  }
  if (highVisibility && !highValue) {
    return "accidental_hub";
  }
  if (!highVisibility && highValue) {
    return "hidden_gem";
  }
  return "prune_candidate";
}

function brandClickShareForPage(url, gscRows, domain) {
  const brandTerms = brandTermsFromDomain(domain);
  let brand = 0;
  let total = 0;
  for (const row of gscRows) {
    if (row.url !== url) {
      continue;
    }
    total += row.clicks || 0;
    if (classifyQueryIntent(row.query, brandTerms) === "brand") {
      brand += row.clicks || 0;
    }
  }
  return total > 0 ? brand / total : 0;
}

function buildFlags(page, gsc, ga4, intendedSet, protectedSet, ctx) {
  const {
    hasGsc,
    analysisMode,
    domain,
    gscRows,
    discoveryEntry
  } = ctx;
  const flags = [];

  if (intendedSet.has(page.url)) {
    flags.push("intended_hub");
  }
  if (protectedSet.has(page.url)) {
    flags.push("protected");
  }
  if (isIndexingNoiseUrl(page.url)) {
    flags.push("indexing_noise");
  }
  if (gsc && gsc.query_breadth >= 20 && gsc.avg_position > 15) {
    flags.push("false_hub_warning");
  }
  if (gsc && gsc.impressions >= 1000 && gsc.ctr < 0.01) {
    flags.push("low_ctr_high_impressions");
  }
  if (
    analysisMode === "discovery_plus_conversions" &&
    hasGsc &&
    ga4 &&
    ga4.conversion_total > 0 &&
    gsc &&
    gsc.clicks < 5
  ) {
    flags.push("converts_without_search_clicks");
  }

  if (intendedSet.has(page.url) && gsc) {
    if (gsc.impressions < INTENDED_HUB_INVISIBLE_IMPRESSIONS) {
      flags.push("intended_hub_invisible");
    }
    const brandShare = brandClickShareForPage(page.url, gscRows, domain);
    if (gsc.clicks > 0 && brandShare >= BRAND_ONLY_CLICK_SHARE) {
      flags.push("intended_hub_brand_only");
    }
  }

  if (discoveryEntry?.verdict === "misaligned") {
    flags.push("query_intent_misalignment");
  }

  return flags;
}

function recommendedReview(quadrant, flags, analysisMode) {
  if (flags.includes("protected")) {
    return "Protected page — review manually; do not auto-prune.";
  }
  if (flags.includes("intended_hub_invisible")) {
    return "Intended hub has little or no organic discovery — prioritize spokes, internal links, and query-targeted copy.";
  }
  if (flags.includes("query_intent_misalignment")) {
    return "Queries reaching this URL may not match page intent — review SERP targeting and internal routing.";
  }
  if (flags.includes("indexing_noise")) {
    return "Likely indexing noise (media/asset URL) — review noindex or canonical policy.";
  }
  switch (quadrant) {
    case "unicorn":
      return analysisMode === "discovery_only"
        ? "Strong organic visibility — validate query intent mix in discovery summary."
        : "Protect and replicate patterns on underperforming hubs.";
    case "accidental_hub":
      return "Review for spoke extraction, hub retrofit, or commercial routing.";
    case "hidden_gem":
      return "Increase organic visibility with spokes and internal links from high-traffic pages.";
    case "prune_candidate":
      return "Review for consolidate, redirect, or improve — not auto-delete.";
    case "protected_review":
      return "Protected page flagged as low performer — manual review only.";
    case "high_visibility_unvalued":
      return analysisMode === "discovery_only"
        ? "High search visibility — confirm query intent aligns with page role."
        : "GSC-only: high search visibility; add GA4 export to assess business value.";
    case "low_visibility_unvalued":
      return analysisMode === "discovery_only"
        ? "Low or no search visibility — candidate for discovery investment or consolidation."
        : "GSC-only: low search visibility; validate with GA4 before pruning.";
    case "high_value_untracked":
      return "GA4-only: converts or engages; check GSC for search opportunity.";
    case "low_value_untracked":
      return "GA4-only: low business signals; check GSC for accidental traffic.";
    default:
      return "Insufficient data for classification.";
  }
}

function confidenceFor(page, hasGsc, hasGa4, analysisMode) {
  if (hasGsc && hasGa4) {
    if (analysisMode === "discovery_only") {
      if (page.gsc?.clicks >= 10 || page.gsc?.impressions >= 500) {
        return "high";
      }
      return "medium";
    }
    if (page.gsc?.clicks >= 10 || page.ga4?.conversion_total > 0) {
      return "high";
    }
    return "medium";
  }
  return "low";
}

export function buildPerformanceMatrix(options) {
  const {
    domain,
    gscPages = [],
    gscRows = [],
    ga4Pages = [],
    conversionEvents = [],
    intendedHubs = [],
    protectedPages = [],
    dateRange = null,
    visibilityThreshold = 0.5,
    valueThreshold = 0.5,
    analysisMode = "discovery_plus_conversions"
  } = options;

  const normalizedAnalysisMode = ANALYSIS_MODES.has(analysisMode)
    ? analysisMode
    : "discovery_plus_conversions";

  const hasGsc = gscPages.length > 0;
  const hasGa4 = ga4Pages.length > 0;

  const limitations = [];
  if (!hasGsc) {
    limitations.push(
      "No GSC data — GA4-only mode; visibility and query intent unknown."
    );
    if (normalizedAnalysisMode === "discovery_only") {
      limitations.push(
        "discovery_only requires GSC page×query data — discovery summary omitted."
      );
    }
  }
  if (!hasGa4) {
    limitations.push("No GA4 data — sessions and conversions unknown.");
  }
  if (
    normalizedAnalysisMode === "discovery_plus_conversions" &&
    !conversionEvents.length &&
    hasGa4
  ) {
    limitations.push(
      "No conversion_events configured — value score uses sessions only."
    );
  }
  if (normalizedAnalysisMode === "discovery_only" && hasGa4 && conversionEvents.length) {
    limitations.push(
      "discovery_only mode — conversion events ignored for quadrant assignment; GA4 sessions used for landing context only."
    );
  }

  const intendedSet = new Set(
    intendedHubs.map((u) => normalizeUrl(u, domain)).filter(Boolean)
  );
  const protectedSet = new Set(
    protectedPages.map((u) => normalizeUrl(u, domain)).filter(Boolean)
  );

  const urlSet = new Set();
  for (const p of gscPages) {
    urlSet.add(p.url);
  }
  for (const p of ga4Pages) {
    urlSet.add(p.url);
  }

  const gscByUrl = new Map(gscPages.map((p) => [p.url, p]));
  const ga4ByUrl = new Map(ga4Pages.map((p) => [p.url, p]));

  const discovery =
    hasGsc && gscRows.length > 0
      ? buildDiscoverySummary({
          domain,
          gscRows,
          intendedHubs: [...intendedSet],
          gscByUrl
        })
      : null;

  const discoveryByUrl = new Map(
    (discovery?.intended_hubs || []).map((h) => [h.url, h])
  );

  const clickRanks = gscPages.map((p) => p.clicks).sort((a, b) => a - b);
  const impressionRanks = gscPages.map((p) => p.impressions).sort((a, b) => a - b);
  const ctrRanks = gscPages.map((p) => p.ctr).sort((a, b) => a - b);
  const positionRanks = gscPages.map((p) => p.avg_position).sort((a, b) => a - b);
  const conversionTotals = ga4Pages.map((p) => p.conversion_total).sort((a, b) => a - b);
  const sessionRanks = ga4Pages.map((p) => p.sessions).sort((a, b) => a - b);

  const visibilityScores = [];
  const valueScores = [];

  const pages = [...urlSet].map((url) => {
    const gsc = gscByUrl.get(url) || null;
    const ga4 = ga4ByUrl.get(url) || null;

    const visibility_score =
      gsc !== null
        ? computeVisibilityScore(
            gsc,
            clickRanks,
            impressionRanks,
            ctrRanks,
            positionRanks
          )
        : null;

    const value_score =
      ga4 !== null && normalizedAnalysisMode === "discovery_plus_conversions"
        ? computeValueScore(ga4, conversionTotals, sessionRanks)
        : null;

    if (visibility_score !== null) {
      visibilityScores.push(visibility_score);
    }
    if (value_score !== null) {
      valueScores.push(value_score);
    }

    return {
      url,
      gsc,
      ga4,
      visibility_score,
      value_score,
      hub_type_hint: classifyHubType(url)
    };
  });

  const visSorted = visibilityScores.sort((a, b) => a - b);
  const valSorted = valueScores.sort((a, b) => a - b);

  for (const page of pages) {
    const highVisibility =
      page.visibility_score !== null
        ? isHigh(page.visibility_score, visSorted, visibilityThreshold)
        : false;
    const highValue =
      page.value_score !== null
        ? isHigh(page.value_score, valSorted, valueThreshold)
        : false;

    let quadrant = assignQuadrant(
      highVisibility,
      highValue,
      hasGsc,
      hasGa4,
      page.gsc !== null,
      normalizedAnalysisMode
    );

    if (protectedSet.has(page.url) && quadrant === "prune_candidate") {
      quadrant = "protected_review";
    }
    if (
      normalizedAnalysisMode === "discovery_only" &&
      flagsWouldBeIndexingNoise(page.url) &&
      quadrant === "high_visibility_unvalued"
    ) {
      quadrant = "accidental_hub";
    }

    page.quadrant = quadrant;
    page.flags = buildFlags(page, page.gsc, page.ga4, intendedSet, protectedSet, {
      hasGsc,
      analysisMode: normalizedAnalysisMode,
      domain,
      gscRows,
      discoveryEntry: discoveryByUrl.get(page.url)
    });

    if (
      intendedSet.has(page.url) &&
      (page.quadrant === "hidden_gem" ||
        page.flags.includes("intended_hub_invisible") ||
        page.flags.includes("intended_hub_brand_only"))
    ) {
      page.flags.push("building_toward_intent");
    }

    page.confidence = confidenceFor(
      page,
      hasGsc,
      hasGa4,
      normalizedAnalysisMode
    );
    page.recommended_review = recommendedReview(
      page.quadrant,
      page.flags,
      normalizedAnalysisMode
    );
  }

  const handoff = {
    handoff_version: "1.0",
    skill: "analytics-and-searchconsole-performance-audit",
    skill_version: SKILL_VERSION,
    generated_at: new Date().toISOString(),
    mode: hasGsc && hasGa4 ? "full" : hasGsc ? "gsc_only" : hasGa4 ? "ga4_only" : "empty",
    inputs: {
      domain,
      date_range: dateRange,
      analysis_mode: normalizedAnalysisMode,
      conversion_events:
        normalizedAnalysisMode === "discovery_plus_conversions"
          ? conversionEvents
          : [],
      intended_hubs: [...intendedSet],
      protected_pages: [...protectedSet],
      visibility_threshold: visibilityThreshold,
      value_threshold: valueThreshold
    },
    summary: {
      total_pages: pages.length,
      gsc_pages: gscPages.length,
      ga4_pages: ga4Pages.length,
      quadrant_counts: summarizeQuadrants(pages)
    },
    top_by_quadrant: topByQuadrant(pages, 10),
    pages,
    limitations
  };

  if (discovery) {
    handoff.discovery = discovery;
  }

  return handoff;
}

function flagsWouldBeIndexingNoise(url) {
  return isIndexingNoiseUrl(url);
}

function summarizeQuadrants(pages) {
  const counts = {};
  for (const page of pages) {
    counts[page.quadrant] = (counts[page.quadrant] || 0) + 1;
  }
  return counts;
}

function topByQuadrant(pages, limit) {
  const groups = {};
  for (const page of pages) {
    if (!groups[page.quadrant]) {
      groups[page.quadrant] = [];
    }
    groups[page.quadrant].push(page);
  }

  const result = {};
  for (const [quadrant, list] of Object.entries(groups)) {
    result[quadrant] = list
      .sort((a, b) => {
        const vis = (b.visibility_score || 0) - (a.visibility_score || 0);
        if (vis !== 0) {
          return vis;
        }
        return (b.value_score || 0) - (a.value_score || 0);
      })
      .slice(0, limit)
      .map((p) => ({
        url: p.url,
        visibility_score: p.visibility_score,
        value_score: p.value_score,
        flags: p.flags
      }));
  }
  return result;
}

export function loadCsvFile(filePath) {
  return readFileSync(filePath, "utf8");
}
