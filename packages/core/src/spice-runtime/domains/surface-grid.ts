import { assertSpiceInt32 } from "../shared/spice-int.js";

const maxRows = Math.floor(268435456 / 24);

/** Snapshot finite coordinate rows once. A zero count still has non-null ABI storage. */
export function surfaceGrid(
  rows: readonly (readonly number[])[],
  width: 2 | 3,
) {
  if (!Array.isArray(rows)) throw new TypeError("Expected surface grid array");
  const count = rows.length;
  if (!Number.isSafeInteger(count) || count < 0 || count > maxRows)
    throw new RangeError("Surface grid exceeds buffer bound");
  const words = new Float64Array(Math.max(1, count) * width);
  for (let i = 0; i < count; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length !== width)
      throw new TypeError("Invalid surface row width");
    for (let j = 0; j < width; j++) {
      const value: unknown = row[j];
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new TypeError("Expected finite surface coordinate");
      words[i * width + j] = value;
    }
  }
  return { count, words };
}

/** Bound positive capacities before allocation; invalid scientific counts get non-null sentinel storage. */
export function surfaceCutLimits(ncuts: number, maxn: number) {
  assertSpiceInt32(ncuts, "ncuts");
  assertSpiceInt32(maxn, "maxn");
  if (maxn > maxRows)
    throw new RangeError("Surface output exceeds buffer bound");
  return {
    rows: Math.max(1, maxn),
    counts: ncuts > 0 && ncuts <= maxn ? ncuts : 1,
  };
}

/** Copy the defined three-component rows of a packed toolkit result. */
export function surfaceVectors(
  words: Float64Array,
  count: number,
): [number, number, number][] {
  if (count < 0 || words.length < count * 3)
    throw new RangeError("Short surface result");
  return Array.from({ length: count }, (_, i) => [
    words[i * 3]!,
    words[i * 3 + 1]!,
    words[i * 3 + 2]!,
  ]);
}

/** Check all returned per-cut counts before reading dense output rows. */
export function surfaceCutCount(counts: Int32Array, maxn: number): number {
  let total = 0;
  for (const count of counts) {
    if (count < 0 || count > maxn - total)
      throw new RangeError("Invalid returned surface counts");
    total += count;
  }
  return total;
}
