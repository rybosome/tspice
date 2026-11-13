/**
 * Contract conventions:
 * - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
 * - Methods throw on invalid arguments or SPICE errors.
 * - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
 */

/** Subset of CSPICE error/status utilities exposed by tspice backends. */
export const GETMSG_WHICH_VALUES = ["SHORT", "LONG", "EXPLAIN"] as const;

export type GetmsgWhich = (typeof GETMSG_WHICH_VALUES)[number];

/**
 * Backend contract for SPICE error/status utilities (`failed/reset/getmsg/...`).
 *
 * Runtime selector validation helpers (e.g. `assertGetmsgWhich`) live in
 * `@rybosome/tspice-core`.
 */
export interface ErrorApi {
  /**
   * Return whether the CSPICE error status is set. Backend calls normally capture
   * and reset that status before throwing, so a caught SPICE error leaves false.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/failed_c.html
   */
  failed(): boolean;

  /**
   * Clear CSPICE error status/messages and backend structured error buffers.
   * Repeated resets are safe. Caller-managed traceback entries still need chkout.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/reset_c.html
   */
  reset(): void;

  /**
   * Return the selected CSPICE message, preserving leading blanks. A prepared
   * LONG message is readable before signaling; reset clears SHORT/LONG. The
   * selector is restricted to uppercase contract values. Thrown SPICE errors
   * carry captured details because the backend resets CSPICE before throwing.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/getmsg_c.html
   */
  getmsg(which: GetmsgWhich): string;

  /**
   * Set/replace the long diagnostic for a subsequent signal without setting
   * failure status. CSPICE truncates text beyond its 1840-character buffer.
   * Empty text signals EMPTYSTRING.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/setmsg_c.html
   */
  setmsg(message: string): void;

  /**
   * Signal a CSPICE error (for example SPICE(BADTIME)). The backend captures
   * diagnostic/trace details, resets CSPICE, and throws; callers can then recover.
   * CSPICE truncates the short code to 25 characters. Empty text signals EMPTYSTRING.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/sigerr_c.html
   */
  sigerr(short: string): void;

  /**
   * Push a routine name onto the CSPICE traceback stack. Empty names signal
   * EMPTYSTRING. Pair with chkout when leaving that routine.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chkin_c.html
   */
  chkin(name: string): void;

  /**
   * Pop the matching routine name from the CSPICE traceback stack. Empty names
   * signal EMPTYSTRING; mismatched/unbalanced names are CSPICE diagnostic misuse.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/chkout_c.html
   */
  chkout(name: string): void;
}
