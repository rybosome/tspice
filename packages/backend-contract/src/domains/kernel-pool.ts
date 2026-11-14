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
import type { Found, KernelSource } from "../shared/types.js";

export type KernelPoolVarType = "C" | "N";

/** Backend contract for reading/writing kernel pool variables. */
export interface KernelPoolApi {
  /**
   * Check a pool variable’s type and dimension. Returns false for a valid variable. Missing
   * variables, mismatches and invalid operators signal a CSPICE error identifying the caller.
   * N0067 accepts =, <, >, <= and =>. The type is one ASCII byte.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/badkpv_c.html
   */
  badkpv(
    caller: string,
    name: string,
    comp: string,
    size: number,
    divby: number,
    type: string,
  ): boolean;

  /**
   * Read a body constant by signed integer ID and case-sensitive item. The signed maxn is the
   * caller’s room in doubles. Returns the actual dimension and owned values in stored units.
   * Insufficient room, missing constants and character-valued constants signal CSPICE errors.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodvcd_c.html
   */
  bodvcd(
    body: number,
    item: string,
    maxn: number,
  ): { dim: number; values: number[] };

  /**
   * Read a body constant by name or decimal ID string and case-sensitive item. Returns its
   * dimension and owned values in stored units. Insufficient room, unknown bodies and missing
   * or nonnumeric constants signal CSPICE errors. N0067 body-name hashing requires external
   * mapping codes with a representable signed absolute value.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/bodvrd_c.html
   */
  bodvrd(
    body: string,
    item: string,
    maxn: number,
  ): { dim: number; values: number[] };

  /**
   * Clear kernel-pool variables and notify all registered watch agents. The KEEPER loaded-
   * kernel inventory and watch registrations are retained.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/clpool_c.html
   */
  clpool(): void;

  /**
   * Delete a case-sensitive pool variable and update watchers according to CSPICE. Deleting a
   * missing variable is allowed.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/dvpool_c.html
   */
  dvpool(name: string): void;

  /**
   * Load assignments from a text kernel directly into the pool. This operation adds no KEEPER
   * entry. String paths use the backend’s filesystem. A byte source uses a private file for
   * this call and leaves existing staged files intact. A parse error can leave earlier
   * assignments in the pool.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/ldpool_c.html
   */
  ldpool(kernel: KernelSource): void;

  /**
   * Load an ordered buffer of text-kernel assignment lines, read once and encoded as NUL-
   * terminated UTF-8 rows. N0067 processes the first 132 bytes of each line. The byte size of
   * a rectangular table must fit signed 32-bit arithmetic and the backend’s allocation limit.
   * Parse errors can leave earlier assignments in the pool.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/lmpool_c.html
   */
  lmpool(lines: readonly string[]): void;

  /**
   * Read the zero-based logical string from continued character components. The byte capacity
   * includes the terminator. A found result carries the returned text and complete pre-
   * truncation byte size. Missing, wrong-type and out-of-range requests return found false.
   * Capacities below two signal a CSPICE error. A byte-split UTF-8 result raises a decoding
   * error. The adapter rejects a visited component whose significant byte length is exactly
   * one less than the marker’s, avoiding an invalid N0067 comparison. Blank components have
   * significant length one.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/stpool_c.html
   */
  stpool(
    item: string,
    nth: number,
    contin: string,
    lenout: number,
  ): Found<{ nthstr: string; size: number }>;

  /**
   * Read a kernel-pool implementation parameter. Unknown parameters return found false. Names
   * follow CSPICE’s case- and blank-insensitive comparison.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/szpool_c.html
   */
  szpool(name: string): Found<{ n: number }>;

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
