import { expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/native.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
import { matrixElementCount } from "@rybosome/tspice-core";

const matrix = [1, 2, 3, 4, 5, 6],
  vector = [-2, 3];
const examples = [
  {
    name: "mequg",
    args: [matrix],
    dimensions: [2, 3],
    result: [0, -0, 1, NaN, Infinity, -Infinity],
  },
  {
    name: "mtxmg",
    args: [matrix, [4, 3, -2, 1]],
    dimensions: [3, 2, 2],
    result: [0, -0, 1, NaN, Infinity, -Infinity],
  },
  {
    name: "mtxvg",
    args: [matrix, vector],
    dimensions: [3, 2],
    result: [Infinity, -0, NaN],
  },
  {
    name: "mxmg",
    args: [matrix, [1, 2, 3, 4, 5, 6]],
    dimensions: [2, 3, 2],
    result: [0, -0, NaN, -Infinity],
  },
  {
    name: "mxmtg",
    args: [matrix, [1, 2, 3]],
    dimensions: [2, 3, 1],
    result: [NaN, -Infinity],
  },
  {
    name: "mxvg",
    args: [matrix, [1, 2, 3]],
    dimensions: [2, 3],
    result: [Infinity, NaN],
  },
  {
    name: "vtmvg",
    args: [vector, matrix, [1, 2, 3]],
    dimensions: [2, 3],
    result: NaN,
  },
  {
    name: "xposeg",
    args: [matrix],
    dimensions: [2, 3],
    result: [Infinity, -0, NaN, 1, 0, 5],
  },
] as const;
function once(input: readonly number[]): number[] {
  const seen = new Set<PropertyKey>();
  return new Proxy([...input], {
    get(target, key, recv) {
      if (key === "length" || (typeof key === "string" && /^\d+$/.test(key))) {
        if (seen.has(key)) throw Error("Repeated input read: " + String(key));
        seen.add(key);
      }
      return Reflect.get(target, key, recv);
    },
  });
}
for (const { name, args, dimensions, result } of examples) {
  it(
    name +
      " validates owned input snapshots and preserves output IEEE components",
    () => {
      const spy = vi.fn((...xs: unknown[]) => {
        void xs;
        return result;
      });
      // This adapter test supplies only the native operation under review.
      const api = createCoordsVectorsApi({
        [name]: spy,
      } as unknown as NativeAddon);
      const inputs = args.map((v) => once(v));
      const output: unknown = Reflect.apply(api[name], api, [
        ...inputs,
        ...dimensions,
      ]);
      expect(output).toEqual(result);
      if (Array.isArray(result)) expect(Object.is(output, result)).toBe(false);
      expect(spy.mock.calls).toHaveLength(1);
      for (let j = 0; j < inputs.length; j++) {
        expect(spy.mock.calls[0]![j]).toEqual(args[j]);
        expect(Object.is(spy.mock.calls[0]![j], inputs[j])).toBe(false);
      }
      expect(spy.mock.calls[0]!.slice(inputs.length)).toEqual(dimensions);
    },
  );
  it(
    name +
      " rejects bad dimensions, incomplete buffers and nonfinite values before dispatch",
    () => {
      const spy = vi.fn();
      const api = createCoordsVectorsApi({
        [name]: spy,
      } as unknown as NativeAddon);
      for (let i = 0; i < dimensions.length; i++) {
        for (const bad of [1.5, NaN, 2147483648, -2147483649]) {
          const dims = dimensions.map((d, j) => (i === j ? bad : d));
          expect(() =>
            Reflect.apply(api[name], api, [...args, ...dims]),
          ).toThrow();
        }
      }
      for (let i = 0; i < args.length; i++) {
        for (const bad of [
          [],
          [...args[i]!, 1],
          args[i]!.map(() => Infinity),
          Array(args[i]!.length),
        ]) {
          const inputs = args.map((a, j) => (i === j ? bad : a));
          expect(() =>
            Reflect.apply(api[name], api, [...inputs, ...dimensions]),
          ).toThrow();
        }
      }
      expect(spy).not.toHaveBeenCalled();
    },
  );
}
it("checks all physical sizes and shapes before reading an input element", () => {
  const api = createCoordsVectorsApi({} as NativeAddon);
  const unreadable = [0];
  Object.defineProperty(unreadable, 0, {
    get() {
      throw Error("premature read");
    },
  });
  expect(() => api.mxmg(unreadable, [], 1, 1, 1)).toThrow(/flat array/);
  expect(() => api.mequg(unreadable, 65536, 65536)).toThrow(/256 MiB/);
  expect(() => api.xposeg([], 1, 33554433)).toThrow(/256 MiB/);
  expect(() => api.mxmg([], [], 2147483647, 0, 1)).toThrow(/loop bound/);
  expect(() => api.mtxmg([], [], 33554433, 0, 0)).toThrow(/loop bound/);
  expect(() => api.mxmtg([], [], 33554433, 0, 0)).toThrow(/loop bound/);
  expect(() => api.mxvg([], [], 33554433, 0)).toThrow(/256 MiB/);
  expect(matrixElementCount(4096, 8192)).toBe(33554432);
});
const itNative = it.runIf(nodeAddonAvailable());
itNative(
  "checks actual addon shapes and implied size before copying or allocating",
  () => {
    const api = getNativeAddon();
    for (const { name, args, dimensions } of examples) {
      expect(() => Reflect.apply(api[name], api, [])).toThrow(/argument count/);
      expect(() =>
        Reflect.apply(api[name], api, [...args, 1.25, ...dimensions.slice(1)]),
      ).toThrow(/32-bit/);
      const missing = args.map((a, i) => (i === args.length - 1 ? [] : a));
      expect(() =>
        Reflect.apply(api[name], api, [...missing, ...dimensions]),
      ).toThrow(/length/);
    }
    expect(() => api.mxmg([], [], 2147483647, 0, 0)).toThrow(/bounds/);
    expect(() => api.mtxmg([], [], 65536, 0, 65536)).toThrow(/bounds/);
    expect(() => api.mequg([], -2, 3)).toThrow(/bounds/);
    expect(() => api.mequg([], -2, -2)).toThrow(/bounds/);
    expect(api.mequg([1, -0, 2], 1, 3)).toEqual([1, -0, 2]);
  },
);
itNative(
  "uses the canonical pinned routines on zero, documented negative, and mutation-safe dimensions",
  () => {
    const api = getNativeAddon();
    expect(api.mxmg([], [], 2, -2147483648, 3)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(api.mtxmg([], [], 3, -1, 2)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(api.xposeg([], -2147483648, 2147483647)).toEqual([]);
    expect(api.xposeg([], 2147483647, 0)).toEqual([]);
    expect(api.mxmtg([], [], 2, 0, 2)).toEqual([0, 0, 0, 0]);
    const left = [2, 3],
      right = [4, 5];
    Object.defineProperty(left, 0, {
      get() {
        right.length = 1;
        return 2;
      },
    });
    expect(() => api.mxmg(left, right, 1, 2, 1)).toThrow(/finite number/);
    expect(api.mxmg([2, 3], [4, 5], 1, 2, 1)).toEqual([23]);
  },
);
