import { normalizeUrl } from "./normalize-url.mjs";
import { classifyHubType } from "./classify-hub-type.mjs";
import {
  brandTermsFromDomain,
  classifyQueryIntent,
  QUERY_INTENTS
} from "./classify-query-intent.mjs";

const INTENDED_HUB_INVISIBLE_IMPRESSIONS = 100;
const BRAND_ONLY_CLICK_SHARE = 0.8;
const MISALIGNMENT_MIN_CLICKS = 3;

const INDEXING_NOISE_RE =
  /\/wp-content\/uploads\/|\.(jpg|jpeg|png|gif|webp|svg|pdf)(\?|$)/i;

const JOB_PAGE_RE = /\/(hiring|careers|jobs)(\/|$)/i;

export function isIndexingNoiseUrl(url) {
  try {
    const path = new URL(url).pathname;
    return INDEXING_NOISE_RE.test(path);
  } catch {
    return false;
  }
}

function emptyIntentSplit() {
  const split = {};
  for (const intent of QUERY_INTENTS) {
    split[intent] = { clicks: 0, impressions: 0, query_count: 0 };
  }
  return split;
}

function verdictForIntendedHub({ gscAgg, brandClickShare, topQueries }) {
  if (!gscAgg) {
    return "no_gsc_data";
  }
  if (gscAgg.impressions < INTENDED_HUB_INVISIBLE_IMPRESSIONS) {
    return "invisible";
  }
  if (gscAgg.clicks > 0 && brandClickShare >= BRAND_ONLY_CLICK_SHARE) {
    return "brand_only";
  }
  const hasCommercialQuery = topQueries.some((q) => q.intent === "commercial");
  const hubHint = classifyHubType(gscAgg.url);
  if (
    hasCommercialQuery &&
    hubHint === "commercial" &&
    gscAgg.ctr < 0.01 &&
    gscAgg.impressions >= 1000
  ) {
    return "misaligned";
  }
  if (gscAgg.clicks >= 5 || hasCommercialQuery) {
    return "discovering";
  }
  return "invisible";
}

function isMisalignedLanding(url, queryIntent) {
  const hubHint = classifyHubType(url);
  if (queryIntent === "job" && !JOB_PAGE_RE.test(new URL(url).pathname)) {
    return true;
  }
  if (queryIntent === "commercial" && hubHint === "technical" && !JOB_PAGE_RE.test(new URL(url).pathname)) {
    return true;
  }
  if (queryIntent === "job" && hubHint === "commercial") {
    return true;
  }
  return false;
}

/**
 * @param {object} options
 * @param {string} options.domain
 * @param {Array<{url:string,query:string,clicks:number,impressions:number,position:number}>} options.gscRows
 * @param {string[]} [options.intendedHubs]
 * @param {Map<string, object>} [options.gscByUrl] aggregated GSC pages
 */
export function buildDiscoverySummary(options) {
  const { domain, gscRows = [], intendedHubs = [], gscByUrl = new Map() } = options;
  const brandTerms = brandTermsFromDomain(domain);
  const intent_split = emptyIntentSplit();
  const seenQueries = new Set();

  const byPageQuery = new Map();

  for (const row of gscRows) {
    const url = normalizeUrl(row.url, domain);
    const query = String(row.query || "").toLowerCase().trim();
    if (!url || !query) {
      continue;
    }

    const intent = classifyQueryIntent(query, brandTerms);
    const key = `${url}\0${query}`;
    if (!byPageQuery.has(key)) {
      byPageQuery.set(key, {
        url,
        query,
        clicks: 0,
        impressions: 0,
        intent
      });
    }
    const agg = byPageQuery.get(key);
    agg.clicks += row.clicks || 0;
    agg.impressions += row.impressions || 0;

    if (!seenQueries.has(query)) {
      seenQueries.add(query);
      intent_split[intent].query_count += 1;
    }
    intent_split[intent].clicks += row.clicks || 0;
    intent_split[intent].impressions += row.impressions || 0;
  }

  const misalignments = [];
  for (const entry of byPageQuery.values()) {
    if (entry.clicks < MISALIGNMENT_MIN_CLICKS) {
      continue;
    }
    if (isMisalignedLanding(entry.url, entry.intent)) {
      misalignments.push({
        url: entry.url,
        query: entry.query,
        clicks: entry.clicks,
        impressions: entry.impressions,
        query_intent: entry.intent,
        hub_type_hint: classifyHubType(entry.url)
      });
    }
  }
  misalignments.sort((a, b) => b.clicks - a.clicks);

  const indexing_noise_urls = [
    ...new Set(
      [...byPageQuery.values()]
        .filter((e) => isIndexingNoiseUrl(e.url) && e.impressions > 0)
        .map((e) => e.url)
    )
  ].sort();

  const intended_hubs = intendedHubs.map((raw) => {
    const url = normalizeUrl(raw, domain);
    const gscAgg = gscByUrl.get(url) || null;
    const pageQueries = [...byPageQuery.values()]
      .filter((e) => e.url === url)
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 5)
      .map((e) => ({
        query: e.query,
        clicks: e.clicks,
        impressions: e.impressions,
        intent: e.intent
      }));

    const totalClicks = pageQueries.reduce((s, q) => s + q.clicks, 0);
    const brandClicks = pageQueries
      .filter((q) => q.intent === "brand")
      .reduce((s, q) => s + q.clicks, 0);
    const brandClickShare = totalClicks > 0 ? brandClicks / totalClicks : 0;

    return {
      url,
      verdict: verdictForIntendedHub({
        gscAgg: gscAgg ? { ...gscAgg, url } : null,
        brandClickShare,
        topQueries: pageQueries
      }),
      top_queries: pageQueries,
      gsc_clicks: gscAgg?.clicks ?? 0,
      gsc_impressions: gscAgg?.impressions ?? 0
    };
  });

  return {
    intent_split,
    intended_hubs,
    misalignments: misalignments.slice(0, 25),
    indexing_noise_urls: indexing_noise_urls.slice(0, 50)
  };
}
