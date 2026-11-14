import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Snapshot the three finite components of a legacy surface point or ray exactly once. */
export function legacySurfaceInput(value: readonly number[]): Float64Array {
  if (!Array.isArray(value) || value.length !== 3)
    throw new TypeError("Expected a three-component geometry vector");
  const out = new Float64Array(3);
  for (let i = 0; i < 3; i++) {
    const component: unknown = value[i];
    if (typeof component !== "number" || !Number.isFinite(component))
      throw new TypeError("Expected finite geometry components");
    out[i] = component;
  }
  return out;
}

/** Bound the terminal point array before allocation; nonpositive counts reach the scientific diagnostic. */
export function edtermStorage(npts: number): number {
  assertSpiceInt32(npts, "npts");
  if (npts > 11184809)
    throw new RangeError("EDTERM point array exceeds its 256 MiB bound");
  return 4 + 3 * Math.max(1, npts);
}

/** Copy one complete defined result row, including its original IEEE values. */
export function legacySurfaceVector(
  words: Float64Array,
  offset: number,
): [number, number, number] {
  const x = words[offset],
    y = words[offset + 1],
    z = words[offset + 2];
  if (x === undefined || y === undefined || z === undefined)
    throw new RangeError("Missing legacy geometry result row");
  return [x, y, z];
}
