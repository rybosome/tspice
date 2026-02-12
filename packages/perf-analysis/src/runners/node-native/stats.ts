export function quantileSorted(valuesSortedAsc: readonly number[], q: number): number {
  if (valuesSortedAsc.length === 0) {
    throw new Error("quantileSorted() requires a non-empty array");
  }

  if (!Number.isFinite(q) || q < 0 || q > 1) {
    throw new RangeError(`quantileSorted() q must be in [0, 1] (got ${q})`);
  }

  if (valuesSortedAsc.length === 1) {
    return valuesSortedAsc[0]!;
  }

  // Linear interpolation between closest ranks.
  const rank = q * (valuesSortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);

  const a = valuesSortedAsc[lo]!;
  const b = valuesSortedAsc[hi]!;
  if (lo === hi) return a;

  const t = rank - lo;
  return a + (b - a) * t;
}
