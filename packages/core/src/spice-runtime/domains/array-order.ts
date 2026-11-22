import { assertSpiceInt32 } from "../shared/spice-int.js";
import { sortedNumericInputs, sortedCharacterInputs } from "./sorted-bounds.js";

const integerBytes = 4;
const nativeLimit = 0x7fffffff;
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function countOf(
  values: readonly unknown[],
  bytes: number,
  maximum: number,
): number {
  if (!Array.isArray(values)) throw new TypeError("Expected an array");
  const count = values.length;
  assertSpiceInt32(count, "array length", {
    min: 0,
    max: Math.floor(maximum / bytes),
  });
  return count;
}

/** Capture each element exactly once. IEEE doubles are valid data for direct CSPICE comparisons and moves. */
export function orderDoubles(
  values: readonly number[],
  maximum = nativeLimit,
): Float64Array {
  const count = countOf(values, 8, maximum),
    copy = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const value = values[i];
    if (typeof value !== "number") throw new TypeError("Expected a double");
    copy[i] = value;
  }
  return copy;
}

/** Snapshot signed integers using the shared sorted-array element/count checks. */
export function orderIntegers(
  values: readonly number[],
  maximum = nativeLimit,
): Int32Array {
  return Int32Array.from(
    sortedNumericInputs(0, values, "int", Math.floor(maximum / integerBytes))
      .values,
  );
}

/** A reorder may only follow a permutation with one distinct source index for every destination. */
export function orderPermutation(
  order: readonly number[],
  count: number,
  maximum = nativeLimit,
): Int32Array {
  if (countOf(order, integerBytes, maximum) !== count)
    throw new RangeError("Permutation length differs from data");
  const seen = new Uint8Array(count);
  const result = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const source = order[i];
    if (typeof source !== "number")
      throw new TypeError("Expected a permutation index");
    assertSpiceInt32(source, "permutation index");
    if (source < 0 || source >= count || seen[source])
      throw new RangeError("Invalid zero-based permutation");
    seen[source] = 1;
    result[i] = source;
  }
  return result;
}

/** Capture logical values as the canonical SpiceBoolean 0/1 integer representation. */
export function orderLogicals(
  values: readonly boolean[],
  maximum = nativeLimit,
): Int32Array {
  const count = countOf(values, integerBytes, maximum),
    result = new Int32Array(count);
  for (let i = 0; i < count; i++) {
    const value = values[i];
    if (typeof value !== "boolean") throw new TypeError("Expected a boolean");
    result[i] = value ? 1 : 0;
  }
  return result;
}

/** Capture validated UTF-8 rows in a rectangular C array. ORDERC supplies blank padding to its comparison. */
export function orderRows(
  values: readonly string[],
  pad: boolean,
  maximum = nativeLimit,
): { bytes: Uint8Array; width: number; count: number } {
  const { rows, width } = sortedCharacterInputs(
    "",
    values,
    maximum,
    Math.floor(maximum / integerBytes),
  );
  const bytes = new Uint8Array(rows.length * width);
  for (let i = 0; i < rows.length; i++) {
    const row = bytes.subarray(i * width, (i + 1) * width - 1);
    if (pad) row.fill(32);
    encoder.encodeInto(rows[i]!, row);
  }
  return { bytes, width, count: rows.length };
}

/** Preserve CSPICE's C string result for each row, including tabs, BOM and any surviving trailing spaces. */
export function readOrderRows(
  bytes: Uint8Array,
  width: number,
  count: number,
): string[] {
  if (!(bytes instanceof Uint8Array) || bytes.length !== count * width)
    throw new TypeError("Invalid returned string table");
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const row = bytes.subarray(i * width, (i + 1) * width);
    const end = row.indexOf(0);
    if (end < 0) throw new TypeError("Unterminated returned string row");
    result.push(decoder.decode(row.subarray(0, end)));
  }
  return result;
}
