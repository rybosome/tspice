import { describe, expect, it, vi } from "vitest";
import { createCellsWindowsApi } from "../src/domains/cells-windows.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const a = 2 ** 32 + 3,
  b = 2 ** 32 + 5,
  result = 2 ** 32 + 9;
const stats = Object.freeze({
  meas: Infinity,
  avg: -Infinity,
  stddev: NaN,
  shortest: 0,
  longest: 4,
});
type Method =
  | "wncomd"
  | "wncond"
  | "wndifd"
  | "wnelmd"
  | "wnexpd"
  | "wnextd"
  | "wnfild"
  | "wnfltd"
  | "wnincd"
  | "wnintd"
  | "wnreld"
  | "wnsumd"
  | "wnunid";
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  out?: unknown;
  numbers?: readonly number[];
  aliases?: readonly number[];
}[] = [
  { name: "wncomd", args: [-3, 7, a, result], numbers: [0, 1], aliases: [2] },
  { name: "wncond", args: [-3, 7, a], numbers: [0, 1] },
  { name: "wndifd", args: [a, b, result], aliases: [0, 1] },
  { name: "wnelmd", args: [-3, a], out: false, numbers: [0] },
  { name: "wnexpd", args: [-3, 7, a], numbers: [0, 1] },
  { name: "wnextd", args: ["r", a] },
  { name: "wnfild", args: [-3, a], numbers: [0] },
  { name: "wnfltd", args: [-3, a], numbers: [0] },
  { name: "wnincd", args: [7, -3, a], out: true, numbers: [0, 1] },
  { name: "wnintd", args: [a, b, result], aliases: [0, 1] },
  { name: "wnreld", args: [a, "<> ", b], out: true },
  { name: "wnsumd", args: [a], out: stats },
  { name: "wnunid", args: [a, b, result], aliases: [0, 1] },
];

function apiFor(native: Partial<NativeAddon>) {
  // Only the method configured for the current test is invoked.
  return createCellsWindowsApi(native as NativeAddon);
}

describe.each(cases)("$name Node window adapter", (spec) => {
  it("preserves full tokens, scalar order and actual outputs", () => {
    const native = vi.fn(() => spec.out);
    const api = apiFor({ [spec.name]: native });
    const out = Reflect.apply(api[spec.name], undefined, spec.args);
    expect(native).toHaveBeenCalledWith(...spec.args);
    expect(out).toEqual(spec.out);
    if (spec.name === "wnsumd") expect(out).not.toBe(stats);
  });

  it("preserves scientific errors", () => {
    const err = Object.assign(new Error("CSPICE failure"), {
      spiceShort: "SPICE(EXAMPLE)",
    });
    const api = apiFor({
      [spec.name]: vi.fn(() => {
        throw err;
      }),
    });
    expect(() => Reflect.apply(api[spec.name], undefined, spec.args)).toThrow(
      err,
    );
  });
});

describe("window adapter boundaries", () => {
  it("rejects invalid scalar positions and forbidden output aliases before calling native", () => {
    for (const spec of cases) {
      const call = vi.fn();
      const api = apiFor({ [spec.name]: call });
      for (const pos of spec.numbers ?? []) {
        for (const value of [
          Infinity,
          -Infinity,
          NaN,
          "0",
          null,
          undefined,
          1n,
        ]) {
          const args = [...spec.args];
          args[pos] = value;
          expect(() =>
            Reflect.apply(api[spec.name], undefined, args),
          ).toThrow();
        }
      }
      for (const pos of spec.aliases ?? []) {
        const args = [...spec.args];
        args[args.length - 1] = args[pos];
        expect(() => Reflect.apply(api[spec.name], undefined, args)).toThrow(
          /distinct/,
        );
      }
      expect(call).not.toHaveBeenCalled();
    }
  });

  it("checks byte-size/string representation while preserving genuine invalid CSPICE operators", () => {
    const wnreld = vi.fn(() => false),
      wnextd = vi.fn();
    const api = apiFor({ wnreld, wnextd });
    for (const op of ["=\0", "\udfff", 7])
      expect(() => Reflect.apply(api.wnreld, undefined, [a, op, b])).toThrow();
    for (const side of ["", "LR", "é", null])
      expect(() => Reflect.apply(api.wnextd, undefined, [side, a])).toThrow();
    for (const op of ["", " != ", "= ", "λ"]) {
      expect(Reflect.apply(api.wnreld, undefined, [a, op, b])).toBe(false);
      expect(wnreld).toHaveBeenCalledWith(a, op, b);
    }
    Reflect.apply(api.wnextd, undefined, ["\0", a]);
    expect(wnextd).toHaveBeenCalledWith("\0", a);
  });

  it("rejects malformed native predicates, statistics and flattened index positions", () => {
    for (const spec of cases.filter((item) => typeof item.out === "boolean")) {
      for (const out of [0, 1, null, "true"]) {
        const api = apiFor({ [spec.name]: vi.fn(() => out) });
        expect(() =>
          Reflect.apply(api[spec.name], undefined, spec.args),
        ).toThrow();
      }
    }
    for (const key of ["meas", "avg", "stddev", "shortest", "longest"]) {
      for (const value of key === "shortest" || key === "longest"
        ? [-2, 1, 0.5, null, 2147483648]
        : ["0", 1n, null]) {
        const api = apiFor({
          wnsumd: vi.fn(() => ({ ...stats, [key]: value })),
        });
        expect(() => Reflect.apply(api.wnsumd, undefined, [a])).toThrow();
      }
    }
  });
});

describe.skipIf(!nodeAddonAvailable())(
  "native window ownership and state",
  () => {
    it.each(cases)(
      "rejects wrong-kind and freed handles for every $name window argument",
      (spec) => {
        const native = getNativeAddon();
        const allocated = [
          native.newWindow(4),
          native.newWindow(4),
          native.newWindow(4),
        ];
        const [one, two, out] = allocated;
        const wrong = native.newDoubleCell(8);
        const retired = native.newWindow(1);
        native.freeWindow(retired);
        const handles = new Map([
          [a, one],
          [b, two],
          [result, out],
        ]);
        try {
          for (let i = 0; i < spec.args.length; i++) {
            if (
              typeof spec.args[i] !== "number" ||
              !handles.has(Number(spec.args[i]))
            )
              continue;
            for (const bad of [wrong, retired, 0, 2 ** 32 + retired]) {
              const args = spec.args.map((v) =>
                typeof v === "number" && handles.has(v) ? handles.get(v) : v,
              );
              args[i] = bad;
              expect(() =>
                Reflect.apply(native[spec.name], native, args),
              ).toThrow();
            }
          }
          expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
        } finally {
          native.freeCell(wrong);
          for (const w of allocated) native.freeWindow(w);
        }
      },
    );

    it("protects physical output capacity and odd inputs but retains CSPICE summary diagnostics", () => {
      const native = getNativeAddon();
      const w = native.newWindow(2),
        out = native.newWindow(2);
      try {
        native.wninsd(1, 3, w);
        native.ssize(3, out);
        expect(() => native.wnunid(w, w, out)).toThrow(/size|capacity/);
        native.ssize(4, out);
        expect(() => native.wnunid(w, w, w)).toThrow(/distinct/);
        native.wnunid(w, w, out);
        expect(native.wnfetd(out, 0)).toEqual([1, 3]);
        native.scard(1, w);
        expect(() => native.wnelmd(1, w)).toThrow(/even/);
        expect(() => native.wnsumd(w)).toThrow(/INVALIDCARDINALITY/);
        native.scard(2, w);
        expect(native.wnsumd(w)).toEqual({
          meas: 2,
          avg: 2,
          stddev: 0,
          shortest: 0,
          longest: 0,
        });
        native.scard(4, w);
        expect(() => native.wnexpd(0, 0, w)).toThrow(/ordered/);
        native.scard(0, w);
        expect(native.wnelmd(1, w)).toBe(false);
      } finally {
        native.freeWindow(out);
        native.freeWindow(w);
      }
    });

    it("supports zero-capacity empty union inputs and exact alias rules", () => {
      const native = getNativeAddon();
      const zero = native.newWindow(0),
        nonempty = native.newWindow(2),
        out = native.newWindow(2);
      try {
        native.wnunid(zero, zero, out);
        expect(native.wncard(out)).toBe(0);
        native.wninsd(1, 3, nonempty);
        native.wnunid(zero, nonempty, out);
        expect(native.wnfetd(out, 0)).toEqual([1, 3]);
        native.wnintd(nonempty, nonempty, out);
        expect(native.wnfetd(out, 0)).toEqual([1, 3]);
        native.wndifd(nonempty, nonempty, out);
        expect(native.wncard(out)).toBe(0);
        expect(() => native.wncomd(0, 4, nonempty, nonempty)).toThrow(
          /distinct/,
        );
      } finally {
        native.freeWindow(out);
        native.freeWindow(nonempty);
        native.freeWindow(zero);
      }
    });

    it("retains actual partial output control across queries and resynchronizes on reset", () => {
      const native = getNativeAddon();
      const left = native.newWindow(2),
        right = native.newWindow(2),
        out = native.newWindow(1);
      try {
        native.wninsd(1, 3, left);
        native.wninsd(7, 11, left);
        native.wninsd(2, 4, right);
        native.wninsd(6, 8, right);
        expect(() => native.wnintd(left, right, out)).toThrow(/WINDOWEXCESS/);
        expect(native.card(out)).toBe(0);
        expect(native.wncard(out)).toBe(1);
        expect(native.wnfetd(out, 0)).toEqual([2, 3]);
        expect(native.wnelmd(3, out)).toBe(true);
        expect(native.wnsumd(out).meas).toBe(1);
        native.scard(0, out);
        expect(native.wncard(out)).toBe(0);
        native.wninsd(-9, -7, out);
        expect(native.wnfetd(out, 0)).toEqual([-9, -7]);
      } finally {
        native.freeWindow(out);
        native.freeWindow(right);
        native.freeWindow(left);
      }
    });
  },
);
