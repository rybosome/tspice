import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const names = [
  "bschoc",
  "bschoi",
  "bsrchc",
  "bsrchd",
  "bsrchi",
  "isrchc",
  "isrchd",
  "isrchi",
] as const;
type Method = (typeof names)[number];
const order = Object.freeze([4, 1, 3, 2, 0]);
function sample(name: Method) {
  const indirect = name.startsWith("bscho");
  const chars = name.endsWith("c");
  const values: readonly (number | string)[] = chars
    ? indirect
      ? ["Z", "B ", "B", "B  ", "A"]
      : ["A", "B ", "B", "B  ", "Z"]
    : indirect
      ? [9, 2, 2, 2, -3]
      : [-3, 2, 2, 2, 9];
  return {
    indirect,
    key: chars ? "B" : 2,
    values,
    index: indirect ? 3 : name.startsWith("b") ? 2 : 1,
  };
}
function readOnce<T>(values: readonly T[]) {
  const reads = new Set<string>();
  return new Proxy([...values], {
    get(target, key, receiver) {
      if (typeof key === "string" && (key === "length" || /^\d+$/.test(key))) {
        if (reads.has(key)) throw new Error("Repeated input read");
        reads.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}
function apiFor(name: Method, method: (...args: unknown[]) => unknown) {
  // These tests invoke only the named binding.
  return createCoordsVectorsApi({
    [name]: method,
  } as Partial<NativeAddon> as NativeAddon);
}

describe.each(names)("%s native adapter", (name) => {
  const { indirect, key, values, index } = sample(name);
  const tail = indirect ? [order] : [];
  it("snapshots all input slots and preserves the physical search result", () => {
    const input = readOnce(values);
    const indices = readOnce(order);
    const delegate = vi.fn((..._args: unknown[]) => index);
    const api = apiFor(name, delegate);
    expect(
      Reflect.apply(api[name], undefined, [
        key,
        input,
        ...(indirect ? [indices] : []),
      ]),
    ).toBe(index);
    const passed = delegate.mock.calls[0]!;
    expect(Object.is(passed[1], input)).toBe(false);
    if (indirect) expect(Object.is(passed[2], indices)).toBe(false);
    expect(passed).toEqual([key, values, ...tail]);
  });
  it("rejects invalid element types, holes and oversized counts before dispatch", () => {
    const delegate = vi.fn();
    const api = apiFor(name, delegate);
    const bad = name.endsWith("c")
      ? ["\0", "\ud800", null]
      : name.endsWith("i")
        ? [1.1, 2147483648, -2147483649, NaN, null]
        : name === "bsrchd"
          ? [NaN, null, "0"]
          : [null, "0"];
    for (const value of bad) {
      expect(() =>
        Reflect.apply(api[name], undefined, [value, values, ...tail]),
      ).toThrow();
      expect(() =>
        Reflect.apply(api[name], undefined, [
          key,
          [value],
          ...(indirect ? [[0]] : []),
        ]),
      ).toThrow();
    }
    expect(() =>
      Reflect.apply(api[name], undefined, [
        key,
        Array(1),
        ...(indirect ? [[0]] : []),
      ]),
    ).toThrow();
    const limit = indirect
      ? 536870911
      : name.endsWith("c") || name.startsWith("b")
        ? 1073741823
        : 2147483646;
    const large = new Proxy([], {
      get(_, k) {
        if (k === "length") return limit + 1;
        throw new Error("Unexpected item traversal");
      },
    });
    expect(() =>
      Reflect.apply(api[name], undefined, [key, large, ...tail]),
    ).toThrow(/length/);
    expect(delegate).not.toHaveBeenCalled();
  });
  it("requires a valid physical index or the exact miss sentinel", () => {
    for (const answer of [-2, values.length, 0.5, NaN, Infinity, null]) {
      const api = apiFor(name, () => answer);
      expect(() =>
        Reflect.apply(api[name], undefined, [key, values, ...tail]),
      ).toThrow(/index/);
    }
    expect(
      Reflect.apply(apiFor(name, () => -1)[name], undefined, [
        key,
        [],
        ...(indirect ? [[]] : []),
      ]),
    ).toBe(-1);
  });
});

describe.skipIf(!nodeAddonAvailable())("linked native array searches", () => {
  it.each(names)(
    "%s preserves the toolkit duplicate choice and empty result",
    (name) => {
      const native = getNativeAddon();
      const { indirect, key, values, index } = sample(name);
      expect(
        Reflect.apply(native[name], native, [
          key,
          values,
          ...(indirect ? [order] : []),
        ]),
      ).toBe(index);
      expect(
        Reflect.apply(native[name], native, [
          key,
          [],
          ...(indirect ? [[]] : []),
        ]),
      ).toBe(-1);
      expect(() => Reflect.apply(native[name], native, [])).toThrow();
    },
  );
  it.each(["bschoc", "bschoi"] as const)(
    "%s validates copied order on direct addon entry and recovers",
    (name) => {
      const native = getNativeAddon(),
        { key, values, index } = sample(name);
      for (const bad of [
        [0, 1],
        [4, 1, 3, 2, 2],
        [4, 1, 3, 2, -1],
        [4, 1, 3, 2, 5],
        [4, 1, 3, 2, 0.5],
        [4, 1, 3, 2, 2147483648],
      ])
        expect(() =>
          Reflect.apply(native[name], native, [key, values, bad]),
        ).toThrow();
      // The first array's getter can shorten the second after both lengths are checked.
      const mutableOrder = [...order],
        changing = [...values];
      Object.defineProperty(changing, 0, {
        get() {
          mutableOrder.pop();
          return values[0];
        },
      });
      expect(() =>
        Reflect.apply(native[name], native, [key, changing, mutableOrder]),
      ).toThrow();
      expect(Reflect.apply(native[name], native, [key, values, order])).toBe(
        index,
      );
    },
  );
  it("preserves case, trailing-space equality, unsigned UTF-8 and significant tabs", () => {
    const native = getNativeAddon();
    const rows = ["B\t", "B", "B  ", "b", "é", "😀"];
    expect(native.bsrchc("B\t", rows)).toBe(0);
    expect(native.bsrchc("B", rows)).toBe(2);
    expect(native.bsrchc("😀 ", rows)).toBe(5);
    expect(native.isrchc("B  ", rows)).toBe(1);
    expect(native.isrchc("b", rows)).toBe(3);
    expect(native.isrchc("É", rows)).toBe(-1);
  });
  it("distinguishes linear IEEE equality from the ordered binary domain", () => {
    const native = getNativeAddon();
    const values = [NaN, Infinity, -0, -Infinity, NaN, 0];
    expect(native.isrchd(NaN, values)).toBe(-1);
    expect(native.isrchd(0, values)).toBe(2);
    expect(native.isrchd(-Infinity, values)).toBe(3);
    expect(native.bsrchd(-Infinity, [-Infinity, -0, 0, Infinity])).toBe(0);
    expect(() => native.bsrchd(NaN, [0])).toThrow();
    expect(() => native.bsrchd(0, [NaN])).toThrow();
    expect(native.bsrchi(2147483647, [-2147483648, 2147483647])).toBe(1);
  });
});
