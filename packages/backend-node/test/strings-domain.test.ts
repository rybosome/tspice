import { describe, expect, it, vi } from "vitest";
import { createStringsApi } from "../src/domains/strings.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method =
  | "cmprss"
  | "eqstr"
  | "iswhsp"
  | "lastnb"
  | "lcase"
  | "ucase"
  | "matchi"
  | "matchw";
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  nativeArgs: readonly unknown[];
  text: readonly number[];
  chars: readonly number[];
  ints: readonly number[];
  output: boolean | string | number;
}[] = [
  {
    name: "cmprss",
    args: [" ", 1, " Å  b "],
    nativeArgs: [" ", 1, " Å  b ", 8],
    text: [2],
    chars: [0],
    ints: [1, 3],
    output: " Å b ",
  },
  {
    name: "eqstr",
    args: [" a\t", "A"],
    nativeArgs: [" a\t", "A"],
    text: [0, 1],
    chars: [],
    ints: [],
    output: true,
  },
  {
    name: "iswhsp",
    args: ["\t\f"],
    nativeArgs: ["\t\f"],
    text: [0],
    chars: [],
    ints: [],
    output: true,
  },
  {
    name: "lastnb",
    args: ["é🙂  "],
    nativeArgs: ["é🙂  "],
    text: [0],
    chars: [],
    ints: [],
    output: 5,
  },
  {
    name: "lcase",
    args: ["\uFEFFA\t "],
    nativeArgs: ["\uFEFFA\t ", 7],
    text: [0],
    chars: [],
    ints: [1],
    output: "\uFEFFa\t ",
  },
  {
    name: "ucase",
    args: ["éa "],
    nativeArgs: ["éa ", 5],
    text: [0],
    chars: [],
    ints: [1],
    output: "éA ",
  },
  {
    name: "matchi",
    args: ["Ab\t", "a+?", "+", "?"],
    nativeArgs: ["Ab\t", "a+?", "+", "?"],
    text: [0, 1],
    chars: [2, 3],
    ints: [],
    output: true,
  },
  {
    name: "matchw",
    args: ["Ab", "a?", "*", "?"],
    nativeArgs: ["Ab", "a?", "*", "?"],
    text: [0, 1],
    chars: [2, 3],
    ints: [],
    output: false,
  },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each test configures only its invoked method, including malformed results.
  return createStringsApi(native as NativeAddon);
}

describe("native string adapter", () => {
  for (const spec of cases) {
    it(`${spec.name} forwards the exact text, single-byte arguments and output byte capacity`, () => {
      const call = vi.fn().mockReturnValue(spec.output);
      const api = apiFor({ [spec.name]: call });
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toBe(
        spec.output,
      );
      expect(call).toHaveBeenCalledOnce();
      expect(call).toHaveBeenCalledWith(...spec.nativeArgs);
    });

    it(`${spec.name} rejects embedded NUL, unpaired surrogates and invalid argument types`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const position of spec.text)
        for (const bad of [
          null,
          undefined,
          1,
          false,
          {},
          1n,
          new String("wrapped"),
          "a\0b",
          "\uD800",
          "x\uDFFF",
          "\uD800A",
        ]) {
          const args = [...spec.args];
          args[position] = bad;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
      for (const position of spec.chars)
        for (const bad of [
          null,
          undefined,
          1,
          false,
          {},
          "",
          "ab",
          "é",
          "🙂",
          "\uD800",
        ]) {
          const args = [...spec.args];
          args[position] = bad;
          expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
            TypeError,
          );
        }
      for (const position of spec.ints)
        for (const bad of [
          null,
          "1",
          1n,
          NaN,
          Infinity,
          -Infinity,
          1.5,
          -2147483649,
          2147483648,
        ]) {
          const args = [...spec.args];
          args[position] = bad;
          expect(() =>
            Reflect.apply(api[spec.name], undefined, args),
          ).toThrow();
        }
      expect(call).not.toHaveBeenCalled();
    });

    it(`${spec.name} validates native output and recovers`, () => {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      const invalid: unknown[] = [null, undefined, {}, [], 1n];
      if (typeof spec.output === "boolean") invalid.push(0, 1, "true");
      else if (typeof spec.output === "number")
        invalid.push(-2, 8, 1.5, Infinity, NaN, "1");
      else
        invalid.push(0, true, "\uD800", "a\0b", "overflow beyond the buffer");
      for (const value of invalid) {
        call.mockReturnValueOnce(value);
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
      call.mockReturnValueOnce(spec.output);
      expect(Reflect.apply(api[spec.name], undefined, spec.args)).toBe(
        spec.output,
      );
    });

    it(`${spec.name} preserves the original native error`, () => {
      const error = new Error("SPICE(EMPTYSTRING)");
      const api = apiFor({
        [spec.name]: () => {
          throw error;
        },
      });
      expect(() => Reflect.apply(api[spec.name], undefined, spec.args)).toThrow(
        error,
      );
    });
  }

  it("limits positive capacities to the largest possible result and delegates all invalid signed capacities", () => {
    for (const name of ["cmprss", "lcase", "ucase"] as const) {
      const call = vi.fn();
      const api = apiFor({ [name]: call });
      const min = name === "cmprss" ? 1 : 2;
      const prefix = name === "cmprss" ? ["\0", -2147483648] : [];
      for (const input of ["", "A", "é", "𐀀"]) {
        const full = Math.max(min, Buffer.byteLength(input) + 1);
        for (const requested of [undefined, 2147483647, full, min]) {
          call.mockReturnValueOnce("");
          expect(
            Reflect.apply(api[name], undefined, [...prefix, input, requested]),
          ).toBe("");
          expect(call).toHaveBeenLastCalledWith(
            ...prefix,
            input,
            Math.min(full, requested ?? full),
          );
        }
      }
      const invalidCapacity = new Error("SPICE(STRINGTOOSHORT)");
      for (const lenout of [-2147483648, -1, 0, ...(min === 2 ? [1] : [])]) {
        call.mockImplementationOnce(() => {
          throw invalidCapacity;
        });
        expect(() =>
          Reflect.apply(api[name], undefined, [...prefix, "ab", lenout]),
        ).toThrow(invalidCapacity);
        expect(call).toHaveBeenLastCalledWith(...prefix, "ab", lenout);
      }
    }
  });

  it("passes NUL and control characters by value as delimiter and wildcard tokens", () => {
    const cmprss = vi.fn().mockReturnValue("xy");
    const matchi = vi.fn().mockReturnValue(true);
    const matchw = vi.fn().mockReturnValue(true);
    const api = apiFor({ cmprss, matchi, matchw });
    for (const byte of ["\0", "\t", "\x7f"]) {
      api.cmprss(byte, -1, "xy");
      expect(cmprss).toHaveBeenLastCalledWith(byte, -1, "xy", 3);
      api.matchi("Ab", "ab", byte, byte);
      expect(matchi).toHaveBeenLastCalledWith("Ab", "ab", byte, byte);
      api.matchw("ab", "ab", byte, byte);
      expect(matchw).toHaveBeenLastCalledWith("ab", "ab", byte, byte);
    }
  });
});

describe("actual native CSPICE string boundary", () => {
  const itNative = it.runIf(nodeAddonAvailable());
  itNative(
    "retains blanks, BOM, complete UTF-8 scalars and negative-one byte index",
    () => {
      const native = getNativeAddon();
      expect(native.cmprss(" ", 1, "  A  b  ", 9)).toBe(" A b ");
      expect(native.cmprss("\0", -2147483648, "\uFEFFé ", 2147483647)).toBe(
        "\uFEFFé ",
      );
      expect(native.lcase("\uFEFFÉAb \t", 2147483647)).toBe("\uFEFFÉab \t");
      expect(native.ucase("éab \t", 2147483647)).toBe("éAB \t");
      expect(native.lastnb("é🙂   ")).toBe(5);
      expect(native.lastnb("   ")).toBe(-1);
      expect(native.lastnb(" \t ")).toBe(1);
      expect(native.eqstr("", " ")).toBe(false);
      expect(native.iswhsp("")).toBe(true);
      expect(native.matchi("Ab", "a?", "\0", "?")).toBe(true);
      expect(native.matchw("Ab", "a?", "\0", "?")).toBe(false);
    },
  );

  itNative(
    "rejects malformed UTF-8 truncation and preserves every complete character boundary",
    () => {
      const native = getNativeAddon();
      for (const name of ["cmprss", "lcase", "ucase"] as const) {
        const prefix = name === "cmprss" ? ["\0", 1] : [];
        for (const capacity of [2, 4, 5, 6])
          expect(() =>
            Reflect.apply(native[name], native, [...prefix, "é🙂", capacity]),
          ).toThrow(/valid UTF-8/);
        expect(Reflect.apply(native[name], native, [...prefix, "é🙂", 3])).toBe(
          "é",
        );
        expect(Reflect.apply(native[name], native, [...prefix, "é🙂", 7])).toBe(
          "é🙂",
        );
      }
    },
  );

  itNative(
    "rejects invalid caller representations before CSPICE and preserves real diagnostics",
    () => {
      const native = getNativeAddon();
      native.reset();
      try {
        for (const spec of cases) {
          for (const index of spec.text)
            for (const bad of ["x\0y", "\uD800", "\uDFFF"]) {
              const args = [...spec.nativeArgs];
              args[index] = bad;
              expect(() =>
                Reflect.apply(native[spec.name], native, args),
              ).toThrow(TypeError);
            }
          for (const index of spec.chars) {
            const args = [...spec.nativeArgs];
            args[index] = "é";
            expect(() =>
              Reflect.apply(native[spec.name], native, args),
            ).toThrow(TypeError);
          }
          for (const index of spec.ints) {
            const args = [...spec.nativeArgs];
            args[index] = 1.5;
            expect(() =>
              Reflect.apply(native[spec.name], native, args),
            ).toThrow(TypeError);
          }
        }
        expect(() => native.cmprss(" ", 1, "x", -2147483648)).toThrow(
          /STRINGTOOSHORT/,
        );
        expect(() => native.lcase("", 1)).toThrow(/STRINGTOOSHORT/);
        expect(() => native.ucase("x", 0)).toThrow(/STRINGTOOSHORT/);
        expect(() => native.matchi("", "*", "*", "?")).toThrow(/EMPTYSTRING/);
        expect(() => native.matchw("x", "", "*", "?")).toThrow(/EMPTYSTRING/);
        expect(native.failed()).toBe(false);
        expect(native.cmprss(" ", 2, "abc", 1)).toBe("");
        expect(native.ucase("", 2)).toBe("");
        expect(native.matchw(" ", " ", "*", "?")).toBe(true);
      } finally {
        native.reset();
      }
    },
  );
});
