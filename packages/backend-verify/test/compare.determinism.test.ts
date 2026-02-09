import { describe, expect, it } from "vitest";

import { compareValues } from "../src/compare/compare.js";
import { formatMismatchReport } from "../src/compare/report.js";

describe("compareValues / formatMismatchReport (determinism)", () => {
  it("produces stable mismatch output regardless of object-key insertion order", () => {
    const expected = { x: 0 };

    // Same logical object, different key insertion order.
    const actualA = { x: { b: 2, a: 1 } };
    const actualB = { x: { a: 1, b: 2 } };

    const resA = compareValues(actualA, expected);
    const resB = compareValues(actualB, expected);

    expect(resA).toEqual(resB);

    expect(resA.ok).toBe(false);
    if (resA.ok) return;

    const report = formatMismatchReport(resA.mismatches);
    expect(report).toContain('{"a":1,"b":2}');
  });

  it("orders key-related mismatches deterministically", () => {
    const actual = { b: 999, d: 4, a: 1 };
    const expected = { c: 3, b: 2, a: 1 };

    const result = compareValues(actual, expected);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.mismatches.map((m) => m.path)).toEqual(["$.c", "$.d", "$.b"]);

    expect(formatMismatchReport(result.mismatches)).toBe(
      [
        "$.c: missing key in actual",
        "  expected: 3",
        "  actual:   undefined",
        "$.d: unexpected key in actual",
        "  expected: undefined",
        "  actual:   4",
        "$.b: number mismatch: actual=999 expected=2 (diff=997, rel=0.997997997997998)",
        "  expected: 2",
        "  actual:   999",
      ].join("\n"),
    );
  });
});
