/** Capture caller-owned data before passing it through either plate ABI. */
export function snapshotPlateInput(
  values: readonly number[],
  field:
    "vertices" | "plates" | "corpar" | "iverts" | "point" | "v1" | "v2" | "v3",
  maxBytes: number,
): number[] {
  if (!Array.isArray(values))
    throw new TypeError(`Expected ${field} to be a numeric array`);
  const count = values.length,
    bytes = field === "plates" ? 4 : 8;
  if (
    !Number.isSafeInteger(count) ||
    count < 0 ||
    count > Math.floor(maxBytes / bytes)
  )
    throw new RangeError(`${field} exceeds backend buffer size`);
  if (field === "vertices" || field === "plates") {
    if (count % 3 !== 0)
      throw new RangeError(`${field} must contain complete triples`);
  } else if (field !== "corpar" && count !== (field === "iverts" ? 9 : 3))
    throw new RangeError(`Invalid ${field} length`);
  const copy: number[] = [];
  for (let i = 0; i < count; i++) {
    const value: unknown = values[i];
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new TypeError(`Expected finite ${field}[${i}]`);
    if (
      field === "plates" &&
      (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
    )
      throw new RangeError("Plate indices must be signed 32-bit integers");
    copy.push(value);
  }
  return copy;
}

/** Decode an owned backend result, retaining every numeric IEEE output. */
export function readPlateResult(value: unknown, width: number): number[] {
  if (!Array.isArray(value) || value.length !== width)
    throw new TypeError("Unexpected plate result length");
  const result: number[] = [];
  for (let i = 0; i < width; ++i) {
    const entry: unknown = value[i];
    if (typeof entry !== "number")
      throw new TypeError("Expected numeric plate result");
    result.push(entry);
  }
  return result;
}
