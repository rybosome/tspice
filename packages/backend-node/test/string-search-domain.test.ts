import { describe, expect, it, vi } from "vitest";
import { createStringsApi } from "../src/domains/strings.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const positions = ["cpos", "cposr", "ncpos", "ncposr", "pos", "posr"] as const;

function apiFor(native: Partial<NativeAddon>) {
  // Only the method under test is provided, including deliberately bad results.
  return createStringsApi(native as NativeAddon);
}

describe.each(positions)("%s search adapter", (name) => {
  it("forwards byte strings and the exact public start to the shared C boundary", () => {
    const native = vi.fn().mockReturnValue(2);
    const api = apiFor({ [name]: native });
    expect(api[name]("ı A", "ñ ", 2147483647)).toBe(2);
    expect(native).toHaveBeenCalledWith("ı A", "ñ ", 2147483647);
  });

  it("rejects malformed text and indices before dispatch", () => {
    const native = vi.fn(),
      api = apiFor({ [name]: native });
    for (const bad of [null, "\0", "\ud800", "\udfff", 7]) {
      expect(() =>
        Reflect.apply(api[name], undefined, [bad, "a", 0]),
      ).toThrow();
      expect(() =>
        Reflect.apply(api[name], undefined, ["a", bad, 0]),
      ).toThrow();
    }
    for (const start of [2147483648, -2147483649, 0.5, NaN, null, "0"]) {
      expect(() =>
        Reflect.apply(api[name], undefined, ["a", "x", start]),
      ).toThrow();
    }
    expect(native).not.toHaveBeenCalled();
  });

  it("rejects malformed native results and preserves thrown diagnostics", () => {
    const native = vi.fn(),
      api = apiFor({ [name]: native });
    for (const bad of [2, -2, 0.5, NaN, Infinity, 1n, null]) {
      native.mockReturnValue(bad);
      expect(() => api[name]("é", " ", 0)).toThrow(/search index/);
    }
    const failure = new Error("instrumented backend failure");
    native.mockImplementation(() => {
      throw failure;
    });
    let got: unknown;
    try {
      api[name]("é", " ", 0);
    } catch (error) {
      got = error;
    }
    expect(got).toBe(failure);
  });
});

it("snapshots esrchc rows exactly once and forwards owned, unchanged strings", () => {
  const original = Object.freeze(["", " B ", "😀"]);
  const seen: PropertyKey[] = [];
  const rows = new Proxy(original, {
    get(target, key, receiver) {
      if (seen.includes(key)) throw new Error("repeated property read");
      seen.push(key);
      return Reflect.get(target, key, receiver);
    },
  });
  const native = vi.fn().mockReturnValue(1);
  expect(apiFor({ esrchc: native }).esrchc("b", rows)).toBe(1);
  expect(native.mock.calls[0]![1] === rows).toBe(false);
  expect(native.mock.calls[0]![1]).toEqual(original);
  expect(seen).toEqual(["length", "0", "1", "2"]);
});

it("rejects malformed esrchc rows and out-of-bounds rectangular layouts before dispatch", () => {
  const native = vi.fn(),
    api = apiFor({ esrchc: native });
  for (const bad of [
    null,
    {},
    [undefined],
    new Array(1),
    ["good", "x\0"],
    ["\udc00"],
    [1],
  ]) {
    expect(() => Reflect.apply(api.esrchc, undefined, ["x", bad])).toThrow();
  }
  const tooMany = new Proxy([], {
    get(_, key) {
      if (key === "length") return 1073741824;
      throw Error("unexpected entry access");
    },
  });
  expect(() => api.esrchc("v", tooMany)).toThrow(/byte limit/);
  const tooWide = new Proxy(["é"], {
    get(target, key, receiver) {
      if (key === "length") return 1073741823;
      return Reflect.get(target, key, receiver);
    },
  });
  expect(() => api.esrchc("v", tooWide)).toThrow(/byte limit/);
  expect(native).not.toHaveBeenCalled();
  for (const bad of [-2, 1, null, 0.5]) {
    native.mockReturnValue(bad);
    expect(() => api.esrchc("v", ["v"])).toThrow(/search index/);
  }
});

describe.skipIf(!nodeAddonAvailable())(
  "compiled string search bindings",
  () => {
    it.each(positions)(
      "%s enforces the native boundary and preserves directional extreme-start behavior",
      (name) => {
        const native = getNativeAddon(),
          search = native[name];
        for (const args of [
          [],
          ["v", "x"],
          ["v", "\0", 0],
          [0, "a", 0],
          ["v", "a", "0"],
          ["v", "a", 2147483648],
        ]) {
          expect(() => Reflect.apply(search, native, args)).toThrow();
        }
        const expected = {
          cpos: -1,
          cposr: 4,
          ncpos: -1,
          ncposr: 3,
          pos: -1,
          posr: 4,
        };
        expect(search("ababa", "a", 2147483647)).toBe(expected[name]);
        expect(search("ababa", "a", 2147483646)).toBe(expected[name]);
        expect(search("abc", "", 0)).toBe(-1);
        expect(search("", "a", 0)).toBe(-1);
      },
    );
    it("distinguishes byte membership, substring positions and equivalent rows", () => {
      const native = getNativeAddon();
      expect(native.cpos("ı", "ñ", 0)).toBe(1); // UTF-8 continuation byte B1.
      expect(native.ncposr("é", "ê", 1)).toBe(1);
      expect(native.posr("ababa", "aba", 2)).toBe(2);
      expect(native.posr("ababa", "aba", 1)).toBe(0);
      expect(native.esrchc("", [" ", "", ""])).toBe(1);
      expect(native.esrchc("\t", ["", " ", "\t"])).toBe(1);
      expect(native.esrchc("é A", ["ÉA", "éa", "é A"])).toBe(1);
      expect(native.esrchc("x", [])).toBe(-1);
    });
    it("reads native row accessors once and propagates their exception before CSPICE", () => {
      const native = getNativeAddon(),
        rows = ["first", "second"];
      let reads = 0;
      Object.defineProperty(rows, 0, {
        get() {
          reads++;
          return "first";
        },
      });
      expect(native.esrchc("second", rows)).toBe(1);
      expect(reads).toBe(1);
      const failure = new Error("caller index threw");
      Object.defineProperty(rows, 1, {
        get() {
          throw failure;
        },
      });
      let got: unknown;
      try {
        native.esrchc("second", rows);
      } catch (error) {
        got = error;
      }
      expect(got).toBe(failure);
      expect(native.failed()).toBe(false);
      expect(native.esrchc("x", ["x"])).toBe(0);
    });
  },
);
