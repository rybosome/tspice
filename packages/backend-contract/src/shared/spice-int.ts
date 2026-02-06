export const SPICE_INT32_MIN = -0x80000000; // -2147483648
export const SPICE_INT32_MAX = 0x7fffffff; //  2147483647

export type AssertSpiceInt32Options = {
  /** If provided, enforce `value >= min`. */
  min?: number;
  /** If provided, enforce `value <= max`. */
  max?: number;
};

/**
* Runtime validation for inputs that will be passed to CSPICE as `SpiceInt`.
*
* Implementation note:
* - Both the Node native addon and WASM backend ultimately consume these values
*   as **32-bit signed integers** (`Int32Value` / `i32`).
* - If callers pass non-integers or values outside the 32-bit range, JS →
*   native conversion will wrap/truncate.
*/
export function assertSpiceInt32(
  value: number,
  label: string,
  opts: AssertSpiceInt32Options = {},
): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer`);
  }
  if (value < SPICE_INT32_MIN || value > SPICE_INT32_MAX) {
    throw new RangeError(`${label} must be a 32-bit signed integer`);
  }
  if (opts.min !== undefined && value < opts.min) {
    throw new RangeError(`${label} must be >= ${opts.min}`);
  }
  if (opts.max !== undefined && value > opts.max) {
    throw new RangeError(`${label} must be <= ${opts.max}`);
  }
}

export function assertSpiceInt32NonNegative(value: number, label: string): asserts value is number {
  assertSpiceInt32(value, label, { min: 0 });
}
