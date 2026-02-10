import { describe, expect, it } from "vitest";

import { compareValues } from "../src/compare/compare.js";

describe("compareValues angleWrapPi", () => {
  it("treats pi and -pi as equal when enabled", () => {
    const res = compareValues(Math.PI, -Math.PI, { angleWrapPi: true });
    expect(res).toEqual({ ok: true });
  });

  it("wraps deltas across the branch cut (regression)", () => {
    // Old behavior normalized each value independently and compared
    // abs(wrap(a) - wrap(b)), which makes values near +/-pi look very far apart.
    const actual = Math.PI - 0.001;
    const expected = -Math.PI + 0.001;
    const res = compareValues(actual, expected, { angleWrapPi: true, tolAbs: 0.01 });
    expect(res).toEqual({ ok: true });
  });

  it("keeps raw values and includes wrapped diagnostics on mismatch", () => {
    const actual = Math.PI - 0.001;
    const expected = -Math.PI + 0.1;
    const res = compareValues(actual, expected, { angleWrapPi: true, tolAbs: 0.01 });
    expect(res.ok).toBe(false);
    if (res.ok) return;

    const m = res.mismatches[0]!;
    expect(m.actual).toBe(actual);
    expect(m.expected).toBe(expected);
    expect(m.message).toContain("angleWrapPi");
    expect(m.message).toContain("wrappedActual=");
    expect(m.message).toContain("wrappedExpected=");
    expect(m.message).toContain("delta=");
  });

  it("does not treat pi and -pi as equal by default", () => {
    const res = compareValues(Math.PI, -Math.PI);
    expect(res.ok).toBe(false);
  });
});
