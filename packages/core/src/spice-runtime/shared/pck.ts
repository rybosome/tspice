import { assertSpiceInt32 } from "./spice-int.js";

/** Validate N0067 type 2 record dimensions and snapshot the caller's coefficients. */
export function copyPckCoefficients(
  n: number,
  degree: number,
  values: readonly number[],
): number[] {
  assertSpiceInt32(n, "pckw02 record count");
  assertSpiceInt32(degree, "pckw02 degree");
  if (!Array.isArray(values))
    throw new TypeError("Expected a PCK coefficient array");
  const count = values.length;
  if (
    degree < 0 ||
    degree > 41 ||
    count > 33554432 ||
    count !== Math.max(0, n) * 3 * (degree + 1)
  )
    throw new RangeError("Invalid type 2 PCK coefficient dimensions");
  const copy: number[] = [];
  for (let i = 0; i < count; ++i) {
    const entry = values[i];
    if (typeof entry !== "number" || !Number.isFinite(entry))
      throw new TypeError("Expected finite PCK coefficients");
    copy.push(entry);
  }
  return copy;
}

/** Validate a NUL-free CSPICE input string, retaining blank and empty inputs. */
export function requirePckString(value: string): string {
  if (typeof value !== "string" || value.includes("\0"))
    throw new TypeError("Expected a NUL-free PCK string");
  return value;
}
