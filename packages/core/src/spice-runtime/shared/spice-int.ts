import { formatGot } from "./format-got.js";

export const SPICE_INT32_MIN = -0x80000000; // -2147483648
export const SPICE_INT32_MAX = 0x7fffffff; //  2147483647

export type AssertSpiceInt32Options = {
  /** If provided, enforce `value >= min`. */
  min?: number;
  /** If provided, enforce `value <= max`. */
  max?: number;
};

/**
 * Runtime validation for values that will cross the JS → native boundary as a
 * CSPICE `SpiceInt`.
 *
 * What this checks:
 * - `value` is a **safe integer** (no fractional values, no `NaN`, no `Infinity`).
 * - `value` is within the **signed 32-bit** range.
 * - Optional extra bounds (`opts.min` / `opts.max`).
 *
 * What this does *not* check:
 * - That the value is valid for a specific CSPICE call (e.g. an index being in
 *   range for a particular cell/window).
 * - That the host platform's `SpiceInt` is 32-bit. (Many CSPICE builds use a
 *   wider integer type.) We intentionally validate to 32-bit because:
 *   - the Node addon reads numbers via `Int32Value()`, and
 *   - the WASM backend consumes values as `i32`.
 *
 * If callers pass values outside the 32-bit range, JS → native conversion would
 * otherwise wrap/truncate.
 */
export function assertSpiceInt32(
  value: number,
  label: string,
  opts: AssertSpiceInt32Options = {},
): asserts value is number {
  if (typeof value !== "number") {
    throw new TypeError(`${label}: Expected: a number. Got: ${formatGot(value)}`);
  }

  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label}: Expected: a safe integer. Got: ${formatGot(value)}`);
  }
  if (value < SPICE_INT32_MIN || value > SPICE_INT32_MAX) {
    throw new RangeError(
      `${label}: Expected: a signed 32-bit integer (${SPICE_INT32_MIN}..${SPICE_INT32_MAX}). Got: ${formatGot(value)}`,
    );
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new RangeError(`${label}: Expected: >= ${opts.min}. Got: ${formatGot(value)}`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new RangeError(`${label}: Expected: <= ${opts.max}. Got: ${formatGot(value)}`);
  }
}

/** Assert that a value is a non-negative signed 32-bit integer. */
export function assertSpiceInt32NonNegative(value: number, label: string): asserts value is number {
  assertSpiceInt32(value, label, { min: 0 });
}
