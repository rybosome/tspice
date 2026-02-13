import { describe, expect, it } from "vitest";

import { toNodeNativeBmfMeasures } from "../src/runners/node-native/bmf.js";
import { quantileSorted } from "../src/runners/node-native/stats.js";

describe("node-native/stats: quantileSorted", () => {
  it("computes quantiles with linear interpolation", () => {
    const values = [1, 2, 3, 4];

    expect(quantileSorted(values, 0)).toBe(1);
    expect(quantileSorted(values, 1)).toBe(4);

    // q=0.5 -> rank=1.5 -> (2 + 3)/2
    expect(quantileSorted(values, 0.5)).toBe(2.5);

    // q=0.95 -> rank=2.85 -> 3 + (4-3)*0.85
    expect(quantileSorted(values, 0.95)).toBeCloseTo(3.85);
  });

  it("throws on empty arrays and invalid q", () => {
    expect(() => quantileSorted([], 0.5)).toThrow(/non-empty array/);
    expect(() => quantileSorted([1], -0.1)).toThrow(/\[0, 1\]/);
    expect(() => quantileSorted([1], 1.1)).toThrow(/\[0, 1\]/);
  });
});

describe("node-native BMF mapping", () => {
  it("emits per-metric objects with { value }", () => {
    expect(
      toNodeNativeBmfMeasures({
        latency_p50: 1,
        latency_p95: 2,
        throughput: 3,
      }),
    ).toEqual({
      latency_p50: { value: 1 },
      latency_p95: { value: 2 },
      throughput: { value: 3 },
    });
  });
});
