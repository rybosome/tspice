import { assertSpiceInt32 } from "./spice-int.js";

/** Snapshot the complete CK segment payload after checking all scalar counts, byte sizes and field lengths. */
export function packCkWriterData(
  times: readonly number[],
  fields: readonly (readonly [readonly number[], number])[],
  starts?: readonly number[],
  ignoredAv?: readonly number[],
) {
  function length(array: readonly number[]) {
    if (!Array.isArray(array))
      throw new TypeError("Expected CK numeric arrays");
    const size = array.length;
    if (!Number.isInteger(size) || size < 0 || size > 33554432)
      throw new RangeError("CK data exceeds 256 MiB");
    return size;
  }
  const n = length(times),
    nints = starts === undefined ? 0 : length(starts);
  const pieces: Array<readonly [readonly number[], number]> = [[times, n]];
  let total = n + nints;
  for (const [field, width] of fields) {
    const size = length(field);
    if (size !== n * width)
      throw new RangeError(
        "CK field length does not match the time count and record width",
      );
    pieces.push([field, size]);
    total += size;
  }
  if (starts !== undefined) pieces.push([starts, nints]);
  if (total > 33554432) throw new RangeError("CK segment exceeds 256 MiB");
  const data = new Float64Array(total);
  let pos = 0;
  function numberAt(array: readonly number[], i: number) {
    const x = array[i];
    if (typeof x !== "number" || !Number.isFinite(x))
      throw new TypeError("CK data must be finite");
    return x;
  }
  for (const [field, size] of pieces)
    for (let i = 0; i < size; ++i) data[pos++] = numberAt(field, i);
  if (ignoredAv !== undefined) {
    const size = length(ignoredAv);
    if (size !== 0 && size !== 3 * n)
      throw new RangeError(
        "Expected zero or three ignored CK angular velocity values per sample",
      );
    for (let i = 0; i < size; ++i) numberAt(ignoredAv, i);
  }
  return { n, nints, data };
}

/** Validate raw CK segment strings and scalar metadata before invoking an adapter. */
export function checkCkWriter(
  beg: number,
  end: number,
  inst: number,
  ref: string,
  segid: string,
  av: boolean,
) {
  assertSpiceInt32(inst, "CK instrument");
  if (!Number.isFinite(beg) || !Number.isFinite(end))
    throw new RangeError("CK descriptor times must be finite");
  if (typeof av !== "boolean")
    throw new TypeError("CK av flag must be boolean");
  for (const text of [ref, segid])
    if (typeof text !== "string" || text.includes("\0"))
      throw new TypeError("Expected NUL-free CK strings");
}
