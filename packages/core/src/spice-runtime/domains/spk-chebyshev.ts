import { assertSpiceInt32 } from "../shared/spice-int.js";

/** Snapshot a complete flat input. Invalid count and degree are diagnosed before CSPICE reads any record. */
export function copySpkChebyshevData(
  type: 2 | 3 | 20,
  n: number,
  degree: number,
  data: readonly number[] | Float64Array,
): Float64Array {
  assertSpiceInt32(n, "n");
  assertSpiceInt32(degree, "degree");
  if (!Array.isArray(data) && !(data instanceof Float64Array))
    throw new TypeError("Expected a flat coefficient array or Float64Array");
  const length = data.length;
  if (!Number.isSafeInteger(length) || length < 0 || length > 33554432)
    throw new RangeError("SPK coefficient buffer exceeds 256 MiB");
  if (n <= 0 || degree < 0 || degree > (type === 20 ? 50 : 27))
    return new Float64Array(0);
  const stride = (type === 3 ? 6 : 3) * (degree + (type === 20 ? 2 : 1));
  if (n * stride !== length)
    throw new RangeError(
      "SPK coefficient length must match record count and polynomial degree",
    );
  const copy = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const word = data[i];
    if (typeof word !== "number" || !Number.isFinite(word))
      throw new RangeError(
        "Expected finite SPK coefficients and midpoint positions",
      );
    copy[i] = word;
  }
  return copy;
}

/** Check common writer fields before copying coefficient records or entering the toolkit. */
export function validateSpkWriterFields(
  body: number,
  center: number,
  frame: string,
  segid: string,
  ...numbers: number[]
): void {
  assertSpiceInt32(body, "body");
  assertSpiceInt32(center, "center");
  for (const s of [frame, segid])
    if (typeof s !== "string" || s.includes("\0"))
      throw new TypeError(
        "Expected an SPK frame and segment identifier without embedded NULs",
      );
  if (!numbers.every(Number.isFinite))
    throw new RangeError(
      "Expected finite SPK epochs, interval length and scales",
    );
}
