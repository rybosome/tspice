import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "clearc" | "cleard" | "cleari" | "filld" | "filli" | "moved";
const bytes = Object.freeze([9, 128, 0, 255, 1]);
const doubles = Object.freeze([-0, NaN, 1.5, -Infinity, Infinity]);
const integers = Object.freeze([2147483647, -2147483648, 1, 2, 3]);
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  positions: readonly number[];
  count: number;
  result: readonly number[];
  badElement: unknown;
}[] = [
  {
    name: "clearc",
    args: [2, 2, bytes],
    positions: [2],
    count: 0,
    result: [32, 0, 32, 0, 1],
    badElement: 256,
  },
  {
    name: "cleard",
    args: [2, doubles],
    positions: [1],
    count: 0,
    result: [0, 0, 1.5, -Infinity, Infinity],
    badElement: "1",
  },
  {
    name: "cleari",
    args: [2, integers],
    positions: [1],
    count: 0,
    result: [0, 0, 1, 2, 3],
    badElement: 0.5,
  },
  {
    name: "filld",
    args: [-0, 2, doubles],
    positions: [2],
    count: 1,
    result: [-0, -0, 1.5, -Infinity, Infinity],
    badElement: 1n,
  },
  {
    name: "filli",
    args: [-17, 2, integers],
    positions: [2],
    count: 1,
    result: [-17, -17, 1, 2, 3],
    badElement: 2147483648,
  },
  {
    name: "moved",
    args: [doubles, 2, integers],
    positions: [0, 2],
    count: 1,
    result: [-0, NaN, 1, 2, 3],
    badElement: null,
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test calls only the configured method, including malformed return data.
  return createCoordsVectorsApi(native as NativeAddon);
}

function singleRead(input: readonly number[]): number[] {
  const seen = new Set<string>();
  return new Proxy([...input], {
    get(target, key, receiver) {
      if (typeof key === "string" && (key === "length" || /^\d+$/.test(key))) {
        if (seen.has(key)) throw new Error("Repeated storage property read");
        seen.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

describe.each(cases)("$name storage adapter", (spec) => {
  it("forwards owned one-read snapshots and returns an independent complete destination", () => {
    const nativeResult = [...spec.result];
    const native = vi.fn(() => nativeResult);
    const args = [...spec.args];
    for (const i of spec.positions)
      args[i] = singleRead(spec.args[i] as readonly number[]);
    const api = apiFor({ [spec.name]: native });
    const result = Reflect.apply(api[spec.name], undefined, args);
    const call: readonly unknown[] = native.mock.calls[0]!;
    expect(call).toEqual(spec.args);
    // Compare identity without asking the matcher to inspect the read-once input.
    for (const i of spec.positions)
      expect(Object.is(call[i], args[i])).toBe(false);
    expect(result).toEqual(spec.result);
    expect(result).not.toBe(nativeResult);
    nativeResult[0] = 87;
    expect(result).toEqual(spec.result);
  });

  it("rejects out-of-range counts and storage sizes before reading entries", () => {
    const native = vi.fn();
    const api = apiFor({ [spec.name]: native });
    for (const count of [1.2, NaN, 2147483648, -2147483649, 6]) {
      const args = [...spec.args];
      args[spec.count] = count;
      expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow();
    }
    for (const position of spec.positions) {
      const args = [...spec.args];
      args[position] = new Proxy([], {
        get(_, key) {
          if (key === "length") return 2147483648;
          throw new Error("Unexpected element read");
        },
      });
      expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
        /32-bit|length/,
      );
    }
    expect(native).not.toHaveBeenCalled();
  });

  it("validates every input element, including unused suffix storage", () => {
    const native = vi.fn();
    const api = apiFor({ [spec.name]: native });
    for (const position of spec.positions) {
      const hole = [1, 2, 3, 4, 5];
      delete hole[4];
      for (const invalid of [
        new Float64Array(5),
        new DataView(new ArrayBuffer(40)),
        hole,
        [1, 2, 3, 4, spec.badElement],
      ]) {
        const args = [...spec.args];
        args[position] = invalid;
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow();
      }
    }
    expect(native).not.toHaveBeenCalled();
  });

  it("rejects malformed native outputs including wrong suffix type or length", () => {
    const hole = [...spec.result];
    delete hole[hole.length - 1];
    for (const result of [
      null,
      [],
      [...spec.result, 1],
      hole,
      [...spec.result.slice(0, -1), spec.badElement],
    ]) {
      const api = apiFor({ [spec.name]: vi.fn(() => result) });
      expect(() =>
        Reflect.apply(api[spec.name], undefined, spec.args),
      ).toThrow();
    }
  });
});

describe("storage count and element domains", () => {
  it("forwards a short character width so CSPICE can distinguish errors from no-write cases", () => {
    const native = vi.fn((...args: Parameters<NativeAddon["clearc"]>) => [
      ...args[2],
    ]);
    const api = apiFor({ clearc: native });
    expect(api.clearc(-2147483648, -9, bytes)).toEqual(bytes);
    expect(api.clearc(2147483647, 1, [])).toEqual([]);
    expect(native).toHaveBeenCalledTimes(2);
    expect(() => api.clearc(2147483647, 2147483647, bytes)).toThrow();
    expect(() => api.clearc(0, 2147483648, bytes)).toThrow();
    expect(native).toHaveBeenCalledTimes(2);
  });

  it("rejects unsafe moves and invalid integer or double fill values at the boundary", () => {
    const call = vi.fn();
    const api = apiFor({ moved: call, filli: call, filld: call });
    expect(() => api.moved(doubles, -1, doubles)).toThrow();
    expect(() => api.moved([], 1, doubles)).toThrow();
    expect(() => api.moved(doubles, 1, [])).toThrow();
    for (const value of [0.5, 2147483648, NaN])
      expect(() => api.filli(value, 0, [])).toThrow();
    expect(() => Reflect.apply(api.filld, undefined, ["0", 0, []])).toThrow();
    expect(call).not.toHaveBeenCalled();
  });
});

describe.skipIf(!nodeAddonAvailable())("native storage", () => {
  it.each(cases)("returns every element after $name", (spec) => {
    const native = getNativeAddon();
    const out = Reflect.apply(native[spec.name], native, spec.args);
    expect(out).toEqual(spec.result);
    expect(out).not.toBe(spec.args.at(-1));
  });

  it("distinguishes zero or negative no-write counts, genuine width errors and recovery", () => {
    const native = getNativeAddon();
    expect(native.clearc(-2147483648, -2147483648, bytes)).toEqual(bytes);
    expect(native.clearc(0, 0, [])).toEqual([]);
    expect(() => native.clearc(1, 1, [])).toThrow(/STRINGTOOSHORT/);
    expect(native.clearc(1, 3, bytes)).toEqual([32, 32, 0, 255, 1]);
    expect(native.cleard(-1, doubles)).toEqual(doubles);
    expect(native.cleari(-1, integers)).toEqual(integers);
    expect(native.filld(Infinity, -1, doubles)).toEqual(doubles);
    expect(native.filli(-7, -1, integers)).toEqual(integers);
    expect(native.moved([], 0, [])).toEqual([]);
    expect(native.moved(doubles, 5, doubles)).toEqual(doubles);
    expect(() => native.moved(doubles, -1, doubles)).toThrow(/count/);
    expect(native.moved([NaN, Infinity], 2, [1, 2, 3])).toEqual([
      NaN,
      Infinity,
      3,
    ]);
  });

  it("keeps the original checked copy length when another input changes during snapshot", () => {
    const native = getNativeAddon();
    const destination = [3, 4];
    const source = [1, 2];
    Object.defineProperty(source, 0, {
      get() {
        destination.length = 1;
        return 1;
      },
    });
    expect(() => native.moved(source, 2, destination)).toThrow();
    expect(native.moved(source, 1, [4, 5])).toEqual([1, 5]);
  });
});
