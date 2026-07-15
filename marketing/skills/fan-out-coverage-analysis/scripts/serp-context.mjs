/**
 * SERP context normalization — intent_split SSOT and lane mismatch detection.
 */

const LANE_MISMATCH_THRESHOLD = 0.6;

/**
 * @param {object} serpContext
 * @returns {"single" | "mixed"}
 */
export function normalizeIntentSplit(serpContext) {
  const lanes = serpContext?.intent_lanes_detected ?? [];
  const counts = serpContext?.lane_counts ?? {};
  const meaningful = lanes.filter((lane) => (counts[lane] ?? 0) > 0);
  if (meaningful.length >= 2) {
    return "mixed";
  }
  return serpContext?.intent_split === "mixed" ? "mixed" : "single";
}

/**
 * @param {object} serpContext
 * @returns {string | null}
 */
export function dominantSerpLane(serpContext) {
  const counts = serpContext?.lane_counts ?? {};
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const [bestLane, bestCount] = entries.reduce(
    (best, entry) => (entry[1] > best[1] ? entry : best),
    entries[0]
  );

  if (bestCount / total < LANE_MISMATCH_THRESHOLD) {
    return null;
  }
  return bestLane;
}

/**
 * @param {object} serpContext
 * @param {string | null | undefined} chosenLane
 */
export function detectLaneMismatch(serpContext, chosenLane) {
  const dominant = dominantSerpLane(serpContext);
  if (!dominant || !chosenLane || dominant === chosenLane) {
    return null;
  }

  const counts = serpContext?.lane_counts ?? {};
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const pct = total > 0 ? Math.round((counts[dominant] / total) * 100) : 0;

  return { dominant, chosenLane, pct };
}

/**
 * Normalize serp_context and append lane notes to limitations.
 * @param {object} handoff
 */
export function normalizeHandoffSerpContext(handoff) {
  const serp = { ...(handoff.serp_context ?? {}) };
  serp.intent_split = normalizeIntentSplit(serp);

  const limitations = [...(handoff.limitations ?? [])];
  const mismatch = detectLaneMismatch(serp, handoff.inputs?.intent_lane ?? null);

  if (mismatch) {
    const note = `SERP is ${mismatch.dominant.replace(/_/g, " ")}-dominant (${mismatch.pct}% of classified results); analysis lane is ${mismatch.chosenLane.replace(/_/g, " ")} — write-next may not match listicle/commercial SERP intent.`;
    if (!limitations.some((line) => line.includes("dominant"))) {
      limitations.push(note);
    }
  }

  return {
    ...handoff,
    serp_context: serp,
    limitations,
    lane_mismatch: mismatch ?? undefined
  };
}
