export const SPICE_INT32_MIN = -0x80000000; // -2147483648
export const SPICE_INT32_MAX = 0x7fffffff; //  2147483647

/**
 * Optional bounds used by runtime `SpiceInt` validators in `@rybosome/tspice-core`.
 */
export type AssertSpiceInt32Options = {
  /** If provided, enforce `value >= min`. */
  min?: number;
  /** If provided, enforce `value <= max`. */
  max?: number;
};
