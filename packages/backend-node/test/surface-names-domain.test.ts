import { describe, expect, it, vi } from "vitest";
import { createIdsNamesApi } from "../src/domains/ids-names.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "srfc2s" | "srfcss" | "srfs2c" | "srfscc";
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  ints: readonly number[];
  strings: readonly number[];
}[] = [
  {
    name: "srfc2s",
    args: [-2147483647, 399, 37],
    ints: [0, 1, 2],
    strings: [],
  },
  {
    name: "srfcss",
    args: [-2147483647, " Márs ", 37],
    ints: [0, 2],
    strings: [1],
  },
  { name: "srfs2c", args: [" Sürface  ", " Márs "], ints: [], strings: [0, 1] },
  { name: "srfscc", args: [" Sürface  ", 399], ints: [1], strings: [0] },
];

function apiFor(native: Partial<NativeAddon>) {
  // Isolate the configured native method, including malformed return values.
  return createIdsNamesApi(native as NativeAddon);
}

describe.each(cases)("$name adapter", (spec) => {
  it("preserves exact argument values and returns a new result", () => {
    const value =
      spec.name === "srfc2s" || spec.name === "srfcss"
        ? { surface: " 0  ", isName: true }
        : { found: true, code: -2147483648 };
    const call = vi.fn(() => value),
      api = apiFor({ [spec.name]: call });
    const out = Reflect.apply(api[spec.name], undefined, spec.args);
    expect(call).toHaveBeenCalledWith(...spec.args);
    expect(out).toEqual(value);
    expect(out).not.toBe(value);
  });
  it("validates signed32 scalars, NULs and unpaired UTF-16 before dispatch", () => {
    const call = vi.fn(),
      api = apiFor({ [spec.name]: call });
    for (const position of spec.ints) {
      for (const bad of [
        1.5,
        NaN,
        Infinity,
        -2147483649,
        2147483648,
        "5",
        1n,
        null,
      ]) {
        const args = [...spec.args];
        args[position] = bad;
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow();
      }
    }
    for (const position of spec.strings) {
      for (const bad of [
        "x\0y",
        "\ud800",
        "\udfff",
        null,
        2,
        new String("MARS"),
      ]) {
        const args = [...spec.args];
        args[position] = bad;
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow();
      }
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects an unhashable direct code before calling the native binding", () => {
    if (spec.name !== "srfc2s" && spec.name !== "srfcss") return;
    const call = vi.fn(),
      api = apiFor({ [spec.name]: call });
    const args = [...spec.args];
    args[0] = -2147483648;
    expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow();
    expect(call).not.toHaveBeenCalled();
  });
  it("preserves the original native error", () => {
    const error = new Error("SPICE(EMPTYSTRING)");
    const api = apiFor({
      [spec.name]: vi.fn(() => {
        throw error;
      }),
    });
    let thrown: unknown;
    try {
      Reflect.apply(api[spec.name], undefined, spec.args);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBe(error);
  });
});

describe("surface return representations", () => {
  for (const name of ["srfc2s", "srfcss"] as const) {
    const body = name === "srfc2s" ? 399 : "EARTH";
    it(`${name} preserves fallback, mapped flags and physical capacity`, () => {
      for (const isName of [false, true]) {
        const native = vi.fn(() => ({ surface: "-17", isName }));
        const api = apiFor({ [name]: native });
        for (const length of [
          undefined,
          2147483647,
          38,
          37,
          2,
          1,
          0,
          -2147483648,
        ]) {
          const args = length === undefined ? [-17, body] : [-17, body, length];
          expect(Reflect.apply(api[name], undefined, args)).toEqual({
            surface: "-17",
            isName,
          });
          expect(native).toHaveBeenLastCalledWith(
            -17,
            body,
            Math.min(length ?? 37, 37),
          );
        }
      }
    });
    it(`${name} rejects malformed native result shapes`, () => {
      for (const out of [
        null,
        [],
        {},
        { surface: "0" },
        { surface: 0, isName: false },
        { surface: "91", isName: 1 },
      ]) {
        expect(() =>
          Reflect.apply(apiFor({ [name]: vi.fn(() => out) })[name], undefined, [
            1,
            body,
          ]),
        ).toThrow();
      }
    });
  }
  for (const name of ["srfs2c", "srfscc"] as const) {
    const body = name === "srfs2c" ? "EARTH" : 399;
    it(`${name} omits the code on a miss and retains the whole signed32 domain on success`, () => {
      const miss = {
        found: false,
        get code() {
          throw new Error("Read an unused code");
        },
      };
      expect(
        Reflect.apply(apiFor({ [name]: vi.fn(() => miss) })[name], undefined, [
          "unknown",
          body,
        ]),
      ).toEqual({ found: false });
      for (const code of [-2147483648, -1, 0, 2147483647]) {
        const out = { found: true, code };
        expect(
          Reflect.apply(apiFor({ [name]: vi.fn(() => out) })[name], undefined, [
            "x",
            body,
          ]),
        ).toEqual(out);
      }
      for (const value of [
        null,
        { found: 0 },
        { found: true },
        { found: true, code: 1.5 },
        { found: true, code: 2147483648 },
      ]) {
        expect(() =>
          Reflect.apply(
            apiFor({ [name]: vi.fn(() => value) })[name],
            undefined,
            ["x", body],
          ),
        ).toThrow();
      }
    });
  }
});

describe.skipIf(!nodeAddonAvailable())("native surface buffers", () => {
  it.each(cases)("validates $name arguments in the addon", (spec) => {
    const native = getNativeAddon();
    expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
    for (const i of spec.ints) {
      const args = [...spec.args];
      args[i] = 2147483648;
      expect(() => Reflect.apply(native[spec.name], native, args)).toThrow();
    }
    for (const i of spec.strings) {
      for (const bad of ["a\0b", "\udfff", null]) {
        const args = [...spec.args];
        args[i] = bad;
        expect(() => Reflect.apply(native[spec.name], native, args)).toThrow();
      }
    }
  });

  it("rejects a stored code rounding to INT32_MIN and recovers when the pool is replaced", () => {
    const native = getNativeAddon();
    native.kclear();
    try {
      expect(() => native.srfc2s(-2147483648, 399, 37)).toThrow(
        /surface hash range/,
      );
      expect(() => native.srfcss(-2147483648, "EARTH", 37)).toThrow(
        /surface hash range/,
      );
      native.pcpool("NAIF_SURFACE_NAME", ["Guard test"]);
      native.pipool("NAIF_SURFACE_BODY", [399]);
      native.pdpool("NAIF_SURFACE_CODE", [-2147483647.75]);
      for (const call of [
        () => native.srfc2s(517, 399, 37),
        () => native.srfcss(517, "EARTH", 37),
        () => native.srfs2c("Guard test", "EARTH"),
        () => native.srfscc("Guard test", 399),
      ]) {
        expect(call).toThrow(/surface hash range/);
      }
      native.pipool("NAIF_SURFACE_CODE", [517]);
      expect(native.srfc2s(517, 399, 37)).toEqual({
        surface: "Guard test",
        isName: true,
      });
      expect(native.srfscc("Guard test", 399)).toEqual({
        found: true,
        code: 517,
      });
      expect(native.srfscc("-2147483648", 399)).toEqual({
        found: true,
        code: -2147483648,
      });
      expect(native.srfc2s(-2147483647, 399, 37)).toEqual({
        surface: "-2147483647",
        isName: false,
      });
    } finally {
      native.kclear();
    }
  });

  it("uses bounded output storage, preserves exact flag and rejects a split UTF-8 scalar", () => {
    const native = getNativeAddon();
    native.kclear();
    try {
      native.pcpool("NAIF_SURFACE_NAME", ["MiXé", "-17"]);
      native.pipool("NAIF_SURFACE_CODE", [517, 518]);
      native.pipool("NAIF_SURFACE_BODY", [399, 399]);
      for (const name of ["srfc2s", "srfcss"] as const) {
        const body = name === "srfc2s" ? 399 : "EARTH";
        const call = (code: number, len: number) =>
          Reflect.apply(native[name], native, [code, body, len]);
        expect(call(517, 2147483647)).toEqual({
          surface: "MiXé",
          isName: true,
        });
        expect(call(517, 4)).toEqual({ surface: "MiX", isName: true });
        expect(() => call(517, 5)).toThrow(TypeError);
        expect(call(518, 37)).toEqual({ surface: "-17", isName: true });
        expect(call(-17, 37)).toEqual({ surface: "-17", isName: false });
        for (const len of [-2147483648, 0, 1])
          expect(() => call(517, len)).toThrow(/STRINGTOOSHORT/);
        expect(call(-17, 37)).toEqual({ surface: "-17", isName: false });
      }
      expect(native.srfscc("-17", 399)).toEqual({ found: true, code: 518 });
      expect(native.srfs2c("missing", "EARTH")).toEqual({ found: false });
    } finally {
      native.kclear();
    }
  });
});
