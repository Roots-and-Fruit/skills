/**
 * Small shared primitives — no business logic, no normalize-fanout import (avoids cycles).
 */

export const COVERED_STATUSES = new Set(["hub", "spoke", "broken_spoke", "hub_serp_only"]);

export const TIER_RANK = { serp_native: 4, core: 3, facet_drift: 2, adjacent: 1 };
export const PRIORITY_RANK = { high: 3, medium: 2, low: 1 };

export function rowSources(row) {
  const raw = row.sources ?? row.source ?? [];
  return Array.isArray(raw) ? raw : [raw];
}

export function normalizeKeyword(keyword) {
  return String(keyword ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function isSuggestionOnlyPermutation(row) {
  if (row.dimension !== "core_variant" || row.on_seed_serp) {
    return false;
  }
  const sources = rowSources(row);
  return sources.length > 0 && sources.every((s) => s === "suggestions");
}

export function isRootAnchorUrl(anchorUrl) {
  if (!anchorUrl) {
    return true;
  }
  try {
    const url = new URL(anchorUrl);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return true;
  }
}
