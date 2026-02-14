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
export const GETMSG_WHICH_VALUES = ["SHORT", "LONG", "EXPLAIN"] as const;

export type GetmsgWhich = (typeof GETMSG_WHICH_VALUES)[number];

/**
 * Type guard for {@link GetmsgWhich}.
 *
 * Accepts unknown runtime values and returns `true` only for valid CSPICE
 * `getmsg()` selectors.
 */
export function isGetmsgWhich(which: unknown): which is GetmsgWhich {
  return (
    which === "SHORT" ||
    which === "LONG" ||
    which === "EXPLAIN"
  );
}

/**
 * Runtime validation for `getmsg(which)`.
 *
 * Even though `which` is a narrow union type, callers may still pass arbitrary
 * values at runtime (e.g. JS consumers, `as any`, etc.). Backends must reject
 * invalid selectors rather than forwarding them to CSPICE.
 */
export function assertGetmsgWhich(which: unknown): asserts which is GetmsgWhich {
  if (isGetmsgWhich(which)) return;
  const allowed = GETMSG_WHICH_VALUES.map((v) => JSON.stringify(v)).join(" | ");
  throw new TypeError(`getmsg(which) expected one of ${allowed} (got ${JSON.stringify(which)})`);
}

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
