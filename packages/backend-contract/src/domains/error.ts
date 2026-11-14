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
   * Substitute text for the first occurrence of the trimmed marker in the prepared long message. A blank marker does nothing. Blank replacement inserts one space. An empty C string signals EMPTYSTRING. The toolkit truncates the resulting message at 1840 bytes.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/errch_c.html
   */
  errch(marker: string, value: string): void;

  /**
   * Substitute the toolkit-formatted finite double for the first occurrence of the trimmed marker in the prepared long message. The fixed diagnostic field uses 14 significant digits. Empty markers signal EMPTYSTRING.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/errdp_c.html
   */
  errdp(marker: string, value: number): void;

  /**
   * Substitute a signed 32-bit integer in decimal for the first occurrence of the trimmed marker in the prepared long message. Empty markers signal EMPTYSTRING.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/errint_c.html
   */
  errint(marker: string, value: number): void;

  /**
   * Return the current printable traceback in call order. In RETURN mode a pending failure freezes the traceback. The optional signed byte capacity includes NUL and defaults to 4096, enough for all stored names and the overflow annotation. Smaller capacities can truncate; a split UTF-8 sequence cannot be returned as a string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/qcktrc_c.html
   */
  qcktrc(tracelen?: number): string;

  /**
   * Return the CSPICE immediate-return indicator. In RETURN mode it is true while a failure is pending. Ordinary backend exceptions capture diagnostics and reset the toolkit before control reaches the caller.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/return_c.html
   */
  return(): boolean;

  /**
   * Return the number of modules in the current or frozen traceback, including entries beyond the stored-name limit.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trcdep_c.html
   */
  trcdep(): number;

  /**
   * Return the module at zero-based index in the current or frozen traceback. The optional byte capacity includes NUL and defaults to 33. Excess depth can produce the toolkit placeholder. Out-of-range indexes and capacities below two signal toolkit errors; truncated invalid UTF-8 cannot be returned as a string.
   * @see https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/trcnam_c.html
   */
  trcnam(index: number, namlen?: number): string;

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
