import { describe, expect, it, vi } from "vitest";
import { createStringsApi } from "../src/domains/strings.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const specs = [
  {
    name: "nextwd",
    args: ["é x"],
    forward: ["é x", 5, 5],
    result: { next: "é", rest: "x" },
  },
  {
    name: "nthwd",
    args: ["é x", 1],
    forward: ["é x", 1, 5],
    result: { word: "x", loc: 3 },
  },
  {
    name: "lparse",
    args: ["x,y", ",", 999, 1000],
    forward: ["x,y", ",", 4, 4],
    result: { n: 2, items: ["x", "y"] },
  },
  {
    name: "lparsm",
    args: ["a;b", "; ", 2, 3],
    forward: ["a;b", "; ", 2, 3],
    result: { n: 2, items: ["a", "b"] },
  },
  {
    name: "lx4dec",
    args: ["3.5", 0],
    forward: ["3.5", 0],
    result: { last: 2, nchar: 3 },
  },
  {
    name: "lx4num",
    args: ["3E4", 0],
    forward: ["3E4", 0],
    result: { last: 2, nchar: 3 },
  },
  {
    name: "lx4sgn",
    args: ["-7", 0],
    forward: ["-7", 0],
    result: { last: 1, nchar: 2 },
  },
  {
    name: "lx4uns",
    args: ["x46", 1],
    forward: ["x46", 1],
    result: { last: 2, nchar: 2 },
  },
  {
    name: "lxqstr",
    args: ["'x'", "'", 0],
    forward: ["'x'", "'", 0],
    result: { last: 2, nchar: 3 },
  },
] as const;

describe("native token adapters", () => {
  for (const spec of specs) {
    it(
      spec.name + " forwards checked arguments and returns owned typed values",
      () => {
        const invoke = vi.fn().mockReturnValue(spec.result);
        // This test double supplies only the method under test.
        const api = createStringsApi({
          [spec.name]: invoke,
        } as Partial<NativeAddon> as NativeAddon);
        const result: unknown = Reflect.apply(api[spec.name], null, spec.args);
        expect(result).toEqual(spec.result);
        expect(result).not.toBe(spec.result);
        if (
          "items" in spec.result &&
          typeof result === "object" &&
          result !== null
        )
          expect(Reflect.get(result, "items")).not.toBe(spec.result.items);
        expect(invoke).toHaveBeenCalledWith(...spec.forward);
      },
    );
    it(spec.name + " rejects invalid text and malformed native results", () => {
      const invoke = vi.fn().mockReturnValue({
        last: 0,
        nchar: -1,
        word: 4,
        loc: "bad",
        next: 1,
        n: 2,
        items: [],
      });
      const api = createStringsApi({
        [spec.name]: invoke,
      } as Partial<NativeAddon> as NativeAddon);
      for (const value of [17, null, "a\0b", "\ud800"]) {
        expect(() =>
          Reflect.apply(api[spec.name], null, [value, ...spec.args.slice(1)]),
        ).toThrow();
      }
      expect(invoke).not.toHaveBeenCalled();
      expect(() => Reflect.apply(api[spec.name], null, spec.args)).toThrow();
    });
  }
  const actual = it.runIf(nodeAddonAvailable());
  actual(
    "preserves independently reported signed decimal counts and inclusive byte locations",
    () => {
      const api = createStringsApi(getNativeAddon());
      for (const name of ["lx4dec", "lx4num"] as const) {
        expect(api[name]("-.25", 0)).toEqual({ last: 3, nchar: 3 });
        expect(api[name]("x+.5", 1)).toEqual({ last: 3, nchar: 2 });
        expect(api[name]("x-.25D+", 1)).toEqual({ last: 4, nchar: 3 });
      }
      expect(api.lx4num("x+.5D2", 1)).toEqual({ last: 5, nchar: 5 });
      expect(api.lx4dec("x+.5D2", 1)).toEqual({ last: 3, nchar: 2 });
    },
  );

  actual(
    "compiled addon enforces scalar argument and capacity bounds, preserves CSPICE errors and recovers",
    () => {
      const n = getNativeAddon();
      for (const spec of specs) {
        expect(() =>
          Reflect.apply(n[spec.name], n, [null, ...spec.forward.slice(1)]),
        ).toThrow();
        expect(() =>
          Reflect.apply(n[spec.name], n, spec.forward.slice(0, -1)),
        ).toThrow();
      }
      expect(() => n.lxqstr("é", "é", 0)).toThrow(/ASCII/);
      expect(() => n.lx4num("1", 1.1)).toThrow();
      expect(() => n.nthwd("x", 1, 2 ** 31)).toThrow();
      expect(() => n.lparse("x".repeat(17000), ",", 30000, 30000)).toThrow(
        /256 MiB/,
      );
      expect(() => n.lparsm("x", "", 2, 2)).toThrow(/EMPTYSTRING/);
      expect(() => n.nextwd("", 1, 2)).toThrow(/STRINGTOOSHORT/);
      expect(n.failed()).toBe(false);
      expect(n.nextwd("  é  b\t  ", 10, 9)).toEqual({ next: "é", rest: "b\t" });
    },
  );
  actual(
    "compiled addon retains complete returned rows, byte indices and empty scanner conventions",
    () => {
      const n = getNativeAddon();
      const held = n.lparse("  x,, a  ", ",", 100, 100);
      n.lparse("changed", ",", 2, 8);
      expect(held).toEqual({ n: 3, items: ["x", "", "a"] });
      expect(() => Reflect.apply(n.lparse, n, ["", "", "0", 2])).toThrow();
      expect(n.nthwd("é b", 1, 10)).toEqual({ word: "b", loc: 3 });
      for (const first of [-2147483648, 2147483646, 2147483647]) {
        for (const fn of ["lx4dec", "lx4num", "lx4sgn", "lx4uns"] as const) {
          expect(n[fn]("", first)).toEqual({
            last: fn === "lx4uns" ? first - 1 : -1,
            nchar: 0,
          });
          expect(n[fn]("2", first)).toEqual({ last: first - 1, nchar: 0 });
        }
        expect(n.lxqstr("", '"', first)).toEqual({ last: first - 1, nchar: 0 });
      }
      expect(() => n.nthwd("é", 0, 2)).toThrow(/UTF-8/);
      expect(() => n.lparsm("é", ",", 1, 2)).toThrow(/UTF-8/);
      expect(n.lparsm("", "", 0, 0)).toEqual({ n: 0, items: [] });
      expect(n.failed()).toBe(false);
    },
  );
});
