/**
* Contract conventions:
* - Inputs are assumed validated at the backend boundary; the contract itself is primarily type-level.
* - Methods throw on invalid arguments or SPICE errors.
* - Lookups that may legitimately miss return `Found<T>` (`{ found: false }`) instead of throwing.
*
* Error policy:
* - Backend methods throw for SPICE-signaled failures.
* - "Found-style" routines (e.g. `bodn2c`, `bodc2n`, `namfrm`, ...) must **not** throw when
*   SPICE reports "not found" via a `found` output flag; they return `{ found: false }`.
*/

/** Subset of CSPICE error/status utilities exposed by tspice backends. */
export interface ErrorApi {
  /** Return `true` if the CSPICE error status is currently set. */
  failed(): boolean;

  /** Reset/clear the CSPICE error status and messages. */
  reset(): void;

  /** Get a CSPICE error message component. */
  getmsg(which: "SHORT" | "LONG" | "EXPLAIN"): string;

  /** Set the long error message text used by `sigerr()`. */
  setmsg(message: string): void;

  /** Signal a CSPICE error with the provided short error code (e.g. `"SPICE(BADTIME)"`). */
  sigerr(short: string): void;

  /** (Optional) Add `name` to the CSPICE traceback stack. */
  chkin?(name: string): void;

  /** (Optional) Remove `name` from the CSPICE traceback stack. */
  chkout?(name: string): void;
}
