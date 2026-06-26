/**
 * Percentile helpers for matrix thresholds.
 */

export function percentileRank(value, sortedValues) {
  if (!sortedValues.length) {
    return 0;
  }
  let below = 0;
  for (const v of sortedValues) {
    if (v < value) {
      below++;
    }
  }
  return below / sortedValues.length;
}

export function percentileValue(sortedValues, p) {
  if (!sortedValues.length) {
    return 0;
  }
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil(p * sortedValues.length) - 1)
  );
  return sortedValues[idx];
}

export function median(sortedValues) {
  return percentileValue(sortedValues, 0.5);
}

export function isHigh(value, sortedValues, threshold = 0.5) {
  return percentileRank(value, sortedValues) >= threshold;
}
