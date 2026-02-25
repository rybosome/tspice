/** Subset of CSPICE error/status selector tokens used by `getmsg(which)`. */
export const GETMSG_WHICH_VALUES = ["SHORT", "LONG", "EXPLAIN"] as const;

export type GetmsgWhich = (typeof GETMSG_WHICH_VALUES)[number];

/** Type guard for {@link GetmsgWhich}. */
export function isGetmsgWhich(which: unknown): which is GetmsgWhich {
  return (
    which === "SHORT" ||
    which === "LONG" ||
    which === "EXPLAIN"
  );
}

/**
 * Runtime validation for `getmsg(which)` selectors.
 *
 * Even though `which` is a narrow union type, callers may still pass arbitrary
 * values at runtime (e.g. JS consumers, `as any`, etc.). Backends should reject
 * invalid selectors rather than forwarding them to CSPICE.
 */
export function assertGetmsgWhich(which: unknown): asserts which is GetmsgWhich {
  if (isGetmsgWhich(which)) return;
  const allowed = GETMSG_WHICH_VALUES.map((v) => JSON.stringify(v)).join(" | ");
  throw new TypeError(`getmsg(which) expected one of ${allowed} (got ${JSON.stringify(which)})`);
}
