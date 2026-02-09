import { describe, expect, it } from "vitest";

import { normalizeForCompare } from "../src/compare/normalize.js";

describe("normalizeForCompare (deterministic sorting)", () => {
  it("does not rely on JSON.stringify tie-breaks (NaN/null, -0/0)", () => {
    const input = new Map<unknown, unknown>([
      [NaN, 0],
      [null, -0],
    ]);

    const out = normalizeForCompare(input) as {
      $type: string;
      $tag: string;
      props: { entries: Array<[unknown, unknown]> };
    };

    expect(out.$type).toBe("Map");
    expect(out.$tag).toBe("[object Map]");
    expect("size" in (out.props as unknown as Record<string, unknown>)).toBe(false);

    const entries = out.props.entries;

    // Sorting should be deterministic even though JSON.stringify(NaN) === "null"
    // and JSON.stringify(-0) === "0".
    expect(entries).toHaveLength(2);

    // Keys: null should sort before NaN with our deterministic keying.
    expect(entries[0]?.[0]).toBe(null);
    expect(typeof entries[1]?.[0]).toBe("number");
    expect(Number.isNaN(entries[1]?.[0] as number)).toBe(true);

    // Values: preserve the sign of zero.
    expect(Object.is(entries[0]?.[1], -0)).toBe(true);
    expect(Object.is(entries[1]?.[1], 0)).toBe(true);
  });

  it("can sort objects containing bigint without throwing", () => {
    const input = new Map<unknown, unknown>([
      [{ a: 2n }, "x"],
      [{ a: 1n }, "x"],
    ]);

    const out = normalizeForCompare(input) as {
      props: { entries: Array<[unknown, unknown]> };
    };

    expect(out.props.entries).toEqual([
      [{ a: 2n }, "x"],
      [{ a: 1n }, "x"],
    ]);
  });

  it("sorts Set values deterministically when JSON.stringify collides", () => {
    const input = new Set<unknown>([Infinity, null, NaN]);

    const out = normalizeForCompare(input) as {
      $type: string;
      $tag: string;
      props: { values: unknown[] };
    };

    expect(out.$type).toBe("Set");
    expect(out.$tag).toBe("[object Set]");
    expect("size" in (out.props as unknown as Record<string, unknown>)).toBe(false);

    const values = out.props.values;

    // Should contain the same values, but in a deterministic order.
    expect(values).toHaveLength(3);
    expect(values[0]).toBe(null);
    expect(values[1]).toBe(Infinity);
    expect(Number.isNaN(values[2] as number)).toBe(true);
  });
});
