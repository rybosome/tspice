/**
 * Kernel pool API contract.
 *
 * Contract conventions:
 * - Backends MUST validate inputs as described below and throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 *
 * Terminology used in validation semantics:
 * - "not empty or whitespace-only" means `value.trim().length > 0`.
 * - "finite integer" means `Number.isFinite(value) && Number.isInteger(value)`.
 *
 * Empty arrays:
 * - `pdpool`/`pipool`/`pcpool` accept `values: []` as a no-op; existing values/type remain unchanged.
 * - `swpool` accepts `names: []` and watches nothing (but still arms the agent so the next
 *   `cvpool(agent)` returns `true`).
 */
import type { Found } from "../shared/types.js";

export type KernelPoolVarType = "C" | "N";

/** Backend contract for reading/writing kernel pool variables. */
export interface KernelPoolApi {
  // --- Read ---------------------------------------------------------------

  /**
   * Get numeric (double) kernel pool values, preserving order and caller units.
   * Missing/wrong-type variables return `{ found: false }`; a page past the end
   * returns a found result with an empty values array.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gdpool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a signed 32-bit integer >= 0 (0-based).
   * - `room` must be a signed 32-bit integer > 0.
   */
  gdpool(
    name: string,
    start: number,
    room: number,
  ): Found<{ values: number[] }>;

  /**
   * Get numeric values rounded to nearest integers (halfway values away from zero).
   * Out-of-range values signal SPICE(INTOUTOFRANGE). Missing/wrong-type variables
   * return `{ found: false }`; a page past the end is found with empty values.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gipool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a signed 32-bit integer >= 0 (0-based).
   * - `room` must be a signed 32-bit integer > 0.
   */
  gipool(
    name: string,
    start: number,
    room: number,
  ): Found<{ values: number[] }>;

  /**
   * Get character values in stored order, preserving leading and trimming trailing
   * padding blanks. Empty/blank values are valid. Missing/wrong-type variables
   * return `{ found: false }`; a page past the end is found with empty values.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gcpool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `start` must be a signed 32-bit integer >= 0 (0-based).
   * - `room` must be a signed 32-bit integer > 0.
   */
  gcpool(
    name: string,
    start: number,
    room: number,
  ): Found<{ values: string[] }>;

  /**
   * Get variable names matching a case-sensitive template in CSPICE order, which
   * is not generally sorted. No match returns `{ found: false }`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/gnpool_c.html
   *
   * Wildcards:
   * - `*` matches any substring
   * - `%` matches any single character
   *
   * Validation semantics:
   * - `template` must not be empty or whitespace-only.
   * - `start` must be a signed 32-bit integer >= 0 (0-based).
   * - `room` must be a signed 32-bit integer > 0.
   */
  gnpool(
    template: string,
    start: number,
    room: number,
  ): Found<{ values: string[] }>;

  /**
   * Get kernel pool variable type (`C` or `N`) and size.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dtpool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   */
  dtpool(name: string): Found<{ n: number; type: KernelPoolVarType }>;

  // --- Write --------------------------------------------------------------

  /**
   * Put numeric (double) values into the kernel pool. A nonempty write replaces
   * previous values and changes the type to numeric.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pdpool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (a no-op preserving the previous value/type).
   * - Each value must be finite (no `NaN` / `±Infinity`).
   */
  pdpool(name: string, values: readonly number[]): void;

  /**
   * Put numeric (integer) values into the kernel pool. A nonempty write replaces
   * previous values and changes the type to numeric.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pipool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (a no-op preserving the previous value/type).
   * - Each value must be a safe integer in the signed 32-bit range
   *   [-2147483648, 2147483647].
   */
  pipool(name: string, values: readonly number[]): void;

  /**
   * Put character values into the kernel pool, including empty/blank strings.
   * A nonempty write replaces previous values and changes the type to character.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/pcpool_c.html
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   * - `values` may be empty (a no-op preserving the previous value/type).
   */
  pcpool(name: string, values: readonly string[]): void;

  // --- Control ------------------------------------------------------------

  /**
   * Set up a kernel pool "watch" for `agent`.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/swpool_c.html
   *
   * After calling `swpool`, the next `cvpool(agent)` call will return `true`.
   * Re-registering adds watched names; it does not remove previous names.
   * Agents consume notifications independently; reading clears their update flag.
   *
   * Validation semantics:
   * - `agent` must not be empty or whitespace-only.
   * - `names` may be empty (watch nothing).
   */
  swpool(agent: string, names: readonly string[]): void;

  /**
   * Check whether watched variables for `agent` have been updated since the last call.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/cvpool_c.html
   *
   * Validation semantics:
   * - `agent` must not be empty or whitespace-only.
   */
  cvpool(agent: string): boolean;

  /**
   * Check existence of a *numeric* kernel pool variable.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/expool_c.html
   *
   * NOTE: This does not detect character-valued variables; use `dtpool` if you need a
   * general existence/type check.
   *
   * Validation semantics:
   * - `name` must not be empty or whitespace-only.
   */
  expool(name: string): boolean;
}
