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


  it("tolerates trig reduction noise by default (regression)", () => {
    // 2π is mathematically equivalent to 0, but trig reduction during
    // normalization yields a tiny non-zero residual.
    const res = compareValues(2 * Math.PI, 0, { angleWrapPi: true });
    expect(res).toEqual({ ok: true });
  });

  it("does not apply implicit ANGLE_WRAP_EPS when tolerances are explicit", () => {
    const res = compareValues(2 * Math.PI, 0, { angleWrapPi: true, tolAbs: 0, tolRel: 0 });
    expect(res.ok).toBe(false);
  });

  it("uses a fixed angular scale for tolRel near 0 (regression)", () => {
    // Previous behavior scaled tolRel by max(|actual|, |expected|); near 0 that
    // makes the allowed diff effectively 0.
    const actual = 1e-6;
    const expected = 0;
    const res = compareValues(actual, expected, { angleWrapPi: true, tolRel: 1e-6 });
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
