import { describe, expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "lstlec" | "lstled" | "lstlei" | "lstltc" | "lstltd" | "lstlti";
const chars = Object.freeze(["", "B\t", "B", "B ", "é"]);
const doubles = Object.freeze([-Infinity, -0, 0, 0.5, Infinity]);
const ints = Object.freeze([-2147483648, -1, -1, 4, 2147483647]);
const cases: readonly {
  name: Method;
  key: string | number;
  values: readonly string[] | readonly number[];
  result: number;
  invalid: readonly unknown[];
}[] = [
  {
    name: "lstlec",
    key: "B",
    values: chars,
    result: 3,
    invalid: [null, "a\0b", "\ud800", "\udfff"],
  },
  {
    name: "lstltc",
    key: "B",
    values: chars,
    result: 1,
    invalid: [null, "a\0b", "\ud800", "\udfff"],
  },
  {
    name: "lstled",
    key: 0,
    values: doubles,
    result: 2,
    invalid: [null, "1", 1n, NaN],
  },
  {
    name: "lstltd",
    key: 0,
    values: doubles,
    result: 0,
    invalid: [null, "1", 1n, NaN],
  },
  {
    name: "lstlei",
    key: -1,
    values: ints,
    result: 2,
    invalid: [0.5, 2147483648, -2147483649, NaN],
  },
  {
    name: "lstlti",
    key: -1,
    values: ints,
    result: 0,
    invalid: [0.5, 2147483648, -2147483649, NaN],
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Only the specified mock is invoked, including deliberately malformed output.
  return createCoordsVectorsApi(native as NativeAddon);
}

describe.each(cases)("$name sorted-bound adapter", (spec) => {
  it("preserves values and snapshots the array length and each element once", () => {
    const seen = new Set<string>();
    const input = new Proxy([...spec.values], {
      get(target, key, receiver) {
        if (
          typeof key === "string" &&
          (key === "length" || /^\d+$/.test(key))
        ) {
          if (seen.has(key)) throw new Error("Repeated property read");
          seen.add(key);
        }
        return Reflect.get(target, key, receiver);
      },
    });
    const call = vi.fn(() => spec.result);
    const api = apiFor({ [spec.name]: call });
    expect(Reflect.apply(api[spec.name], undefined, [spec.key, input])).toBe(
      spec.result,
    );
    const args: readonly unknown[] = call.mock.calls[0]!;
    expect(args).toEqual([spec.key, spec.values]);
    // Compare identity without passing the read-once input to the matcher.
    expect(Object.is(args[1], input)).toBe(false);
  });
  it("rejects undefined key or element domains, sparse arrays and oversized counts before dispatch", () => {
    const call = vi.fn();
    const api = apiFor({ [spec.name]: call });
    for (const bad of spec.invalid) {
      expect(() =>
        Reflect.apply(api[spec.name], undefined, [bad, spec.values]),
      ).toThrow();
      expect(() =>
        Reflect.apply(api[spec.name], undefined, [
          spec.key,
          [...spec.values, bad],
        ]),
      ).toThrow();
    }
    const hole = [...spec.values];
    delete hole[0];
    for (const value of [
      hole,
      new Float64Array(2),
      null,
      new DataView(new ArrayBuffer(8)),
    ])
      expect(() =>
        Reflect.apply(api[spec.name], undefined, [spec.key, value]),
      ).toThrow();
    const tooLarge = new Proxy([], {
      get(_, key) {
        if (key === "length")
          return spec.name.endsWith("c") ? 1073741824 : 2147483648;
        throw new Error("Unexpected traversal");
      },
    });
    expect(() =>
      Reflect.apply(api[spec.name], undefined, [spec.key, tooLarge]),
    ).toThrow(/length/);
    expect(call).not.toHaveBeenCalled();
  });
  it("accepts the absence sentinel and rejects invalid native indices", () => {
    for (const index of [
      NaN,
      Infinity,
      0.5,
      -2,
      spec.values.length,
      "0",
      null,
    ]) {
      const api = apiFor({ [spec.name]: vi.fn(() => index) });
      expect(() =>
        Reflect.apply(api[spec.name], undefined, [spec.key, spec.values]),
      ).toThrow(/index/);
    }
    const api = apiFor({ [spec.name]: vi.fn(() => -1) });
    expect(Reflect.apply(api[spec.name], undefined, [spec.key, []])).toBe(-1);
    const wrong = apiFor({ [spec.name]: vi.fn(() => 0) });
    expect(() =>
      Reflect.apply(wrong[spec.name], undefined, [spec.key, []]),
    ).toThrow(/index/);
  });
});

describe.skipIf(!nodeAddonAvailable())("native sorted bounds", () => {
  it.each(cases)(
    "handles duplicates, empty arrays and invalid inputs in $name",
    (spec) => {
      const native = getNativeAddon();
      expect(
        Reflect.apply(native[spec.name], native, [spec.key, spec.values]),
      ).toBe(spec.result);
      expect(Reflect.apply(native[spec.name], native, [spec.key, []])).toBe(-1);
      expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
      for (const value of spec.invalid) {
        expect(() =>
          Reflect.apply(native[spec.name], native, [value, spec.values]),
        ).toThrow();
        expect(() =>
          Reflect.apply(native[spec.name], native, [spec.key, [value]]),
        ).toThrow();
      }
      expect(
        Reflect.apply(native[spec.name], native, [spec.key, spec.values]),
      ).toBe(spec.result);
    },
  );

  it("packs spaces and UTF-8 bytes consistently at endpoint and interior comparisons", () => {
    const native = getNativeAddon();
    const rows = Object.freeze(["A", "B\t", "B", "Z"]);
    expect(native.lstlec("B\t", rows)).toBe(1);
    expect(native.lstltc("B", rows)).toBe(1);
    expect(native.lstlec("", ["", " ", "  ", "A"])).toBe(2);
    expect(native.lstltc("", ["", " ", "  ", "A"])).toBe(-1);
    const unicode = Object.freeze(["a", "é", "é ", "🙂"]);
    expect(native.lstlec("é", unicode)).toBe(2);
    expect(native.lstltc("🙂", unicode)).toBe(2);
  });

  it("returns the last valid infinity index under each relation", () => {
    const native = getNativeAddon();
    expect(native.lstled(-Infinity, [-Infinity, -Infinity, 1])).toBe(1);
    expect(native.lstltd(-Infinity, [-Infinity, -Infinity, 1])).toBe(-1);
    expect(native.lstled(Infinity, [0, Infinity, Infinity])).toBe(2);
    expect(native.lstltd(Infinity, [0, Infinity, Infinity])).toBe(0);
  });
});
