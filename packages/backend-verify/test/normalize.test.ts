import { describe, expect, it } from "vitest";

import { normalizeForCompare } from "../src/compare/normalize.js";

describe("normalizeForCompare (deterministic sorting)", () => {
  it("does not rely on JSON.stringify tie-breaks (NaN/null, -0/0)", () => {
    const input = new Map<unknown, unknown>([
      [NaN, 0],
      [null, -0],
    ]);

    const out = normalizeForCompare(input) as Array<[unknown, unknown]>;

    // Sorting should be deterministic even though JSON.stringify(NaN) === "null"
    // and JSON.stringify(-0) === "0".
    expect(out).toHaveLength(2);

    // Keys: null should sort before NaN with our deterministic keying.
    expect(out[0]?.[0]).toBe(null);
    expect(typeof out[1]?.[0]).toBe("number");
    expect(Number.isNaN(out[1]?.[0] as number)).toBe(true);

    // Values: preserve the sign of zero.
    expect(Object.is(out[0]?.[1], -0)).toBe(true);
    expect(Object.is(out[1]?.[1], 0)).toBe(true);
  });

  it("can sort objects containing bigint without throwing", () => {
    const input = new Map<unknown, unknown>([
      [{ a: 2n }, "x"],
      [{ a: 1n }, "x"],
    ]);

    const out = normalizeForCompare(input) as Array<[unknown, unknown]>;

    expect(out).toEqual([
      [{ a: 1n }, "x"],
      [{ a: 2n }, "x"],
    ]);
  });

  it("sorts Set values deterministically when JSON.stringify collides", () => {
    const input = new Set<unknown>([Infinity, null, NaN]);

    const out = normalizeForCompare(input) as unknown[];

    // Should contain the same values, but in a deterministic order.
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(null);
    expect(out[1]).toBe(Infinity);
    expect(Number.isNaN(out[2] as number)).toBe(true);
  });
});
