import { assertSpiceInt32 } from "../shared/spice-int.js";
type Words = readonly number[] | Float64Array;

function lengthOf(values: Words): number {
  if (!Array.isArray(values) && !(values instanceof Float64Array))
    throw new TypeError("Expected a flat SPK14 buffer");
  const n = values.length;
  if (!Number.isSafeInteger(n) || n < 0 || n > 33554432)
    throw new RangeError("SPK14 buffer exceeds 256 MiB");
  return n;
}
function copy(values: Words, n: number): Float64Array {
  const data = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const value = values[i];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new RangeError("Expected finite SPK14 record words and epochs");
    data[i] = value;
  }
  return data;
}
/** Capture complete packet storage using the successfully opened segment’s degree. */
export function copySpk14Packets(
  degree: number | undefined,
  count: number,
  records: Words,
  epochs: Words,
) {
  assertSpiceInt32(count, "count");
  if (count <= 0 || degree === undefined)
    return { data: new Float64Array(0), times: new Float64Array(0) };
  const words = lengthOf(records),
    n = lengthOf(epochs);
  if (n !== count || words !== count * (2 + 6 * (degree + 1)))
    throw new RangeError("Incomplete type 14 record or epoch buffer");
  if (words + n > 33554432) throw new RangeError("SPK14 batch exceeds 256 MiB");
  return { data: copy(records, words), times: copy(epochs, n) };
}
