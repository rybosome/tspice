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
  /** Return `true` if the CSPICE error status is currently set. */
  failed(): boolean;

  /** Reset/clear the CSPICE error status and messages. */
  reset(): void;

  /** Get a CSPICE error message component. */
  getmsg(which: GetmsgWhich): string;

  /** Set the long error message text used by `sigerr()`. */
  setmsg(message: string): void;

  /** Signal a CSPICE error with the provided short error code (e.g. `"SPICE(BADTIME)"`). */
  sigerr(short: string): void;

  /** Add `name` to the CSPICE traceback stack. */
  chkin(name: string): void;

  /** Remove `name` from the CSPICE traceback stack. */
  chkout(name: string): void;
}
