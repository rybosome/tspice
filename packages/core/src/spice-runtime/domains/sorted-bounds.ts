import { assertSpiceInt32, SPICE_INT32_MAX } from "../shared/spice-int.js";

function boundCount(values: unknown, maximum: number): number {
  if (!Array.isArray(values)) throw new TypeError("values must be an array");
  const count = values.length;
  assertSpiceInt32(count, "values.length", { min: 0, max: maximum });
  return count;
}

function boundNumber(value: unknown, kind: "int" | "double" | "ieee"): number {
  if (typeof value !== "number" || (kind !== "ieee" && Number.isNaN(value)))
    throw new TypeError("Expected an ordered numeric search value");
  if (kind === "int") assertSpiceInt32(value, "search value");
  return value;
}

/** Snapshot numeric search values and check the element count before traversal. The linear IEEE search accepts NaN. */
export function sortedNumericInputs(
  key: number,
  values: readonly number[],
  kind: "int" | "double" | "ieee",
  maximumCount = SPICE_INT32_MAX,
): { key: number; values: number[] } {
  const checkedKey = boundNumber(key, kind);
  const count = boundCount(values, maximumCount);
  const snapshot: number[] = [];
  for (let i = 0; i < count; i++) snapshot.push(boundNumber(values[i], kind));
  return { key: checkedKey, values: snapshot };
}

function boundTextLength(value: string, maxBytes: number): number {
  if (typeof value !== "string")
    throw new TypeError("Expected a search string");
  if (value.length > maxBytes)
    throw new RangeError("Search string exceeds its UTF-8 byte limit");
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const unit = value.charCodeAt(i);
    if (unit === 0)
      throw new TypeError("Search string contains an embedded NUL");
    if (unit < 0x80) bytes++;
    else if (unit < 0x800) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdfff) {
      const next = value.charCodeAt(i + 1);
      if (unit > 0xdbff || !(next >= 0xdc00 && next <= 0xdfff))
        throw new TypeError(
          "Search string contains an unpaired UTF-16 surrogate",
        );
      i++;
      bytes += 4;
    } else bytes += 3;
    if (bytes > maxBytes)
      throw new RangeError("Search string exceeds its UTF-8 byte limit");
  }
  return bytes;
}

/** Snapshot character rows and determine a checked rectangular stride in UTF-8 bytes including the NUL terminator. */
export function sortedCharacterInputs(
  key: string,
  values: readonly string[],
  maxBytes = SPICE_INT32_MAX,
  maximumCount = Math.floor(maxBytes / 2),
): {
  keyBytes: number;
  rows: string[];
  width: number;
} {
  const keyBytes = boundTextLength(key, maxBytes - 1);
  const count = boundCount(
    values,
    Math.min(maximumCount, Math.floor(maxBytes / 2)),
  );
  const maxRowBytes = Math.floor(maxBytes / Math.max(1, count)) - 1;
  const rows: string[] = [];
  let width = 2;
  for (let i = 0; i < count; i++) {
    const row = values[i];
    if (typeof row !== "string")
      throw new TypeError("Expected a search string");
    width = Math.max(width, boundTextLength(row, maxRowBytes) + 1);
    rows.push(row);
  }
  return { keyBytes, rows, width };
}

/** Snapshot the zero-based permutation consumed by the two indirect binary searches. */
export function searchOrderInput(
  order: readonly number[],
  count: number,
): number[] {
  if (!Array.isArray(order) || order.length !== count)
    throw new RangeError("Search order and values must have the same length");
  const snapshot: number[] = [];
  const seen = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const index: unknown = order[i];
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= count ||
      seen[index]
    )
      throw new RangeError(
        "Expected a permutation of zero-based search indices",
      );
    seen[index] = 1;
    snapshot.push(index);
  }
  return snapshot;
}

/** Preserve CSPICE's -1 sentinel and check every returned index against the owned input length. */
export function sortedBoundResult(value: unknown, count: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < -1 ||
    value >= count
  ) {
    throw new RangeError("Expected a zero-based sorted search index or -1");
  }
  return value;
}
