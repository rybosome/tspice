import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createTimeApi } from "../src/domains/time.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

type Method = "sce2t" | "scfmt" | "scpart" | "sctiks";
const start = Object.freeze([0, 1024]),
  stop = Object.freeze([1023, 4095]);
const cases: readonly {
  name: Method;
  args: readonly unknown[];
  out: unknown;
}[] = [
  { name: "sce2t", args: [-12345, 3.5], out: 896 },
  { name: "scfmt", args: [-12345, 7.5, 23], out: "000000.008" },
  { name: "scpart", args: [-12345], out: { pstart: start, pstop: stop } },
  { name: "sctiks", args: [-12345, "  2:3  "], out: 515 },
];

function apiFor(native: Partial<NativeAddon>) {
  // Each boundary test invokes only its specifically configured method.
  return createTimeApi(native as NativeAddon);
}

describe.each(cases)("$name clock adapter", (spec) => {
  it("forwards the exact values and exposes the native output", () => {
    const call = vi.fn(() => spec.out),
      api = apiFor({ [spec.name]: call });
    const out = Reflect.apply(api[spec.name], undefined, spec.args);
    expect(call).toHaveBeenCalledWith(...spec.args);
    expect(out).toEqual(spec.out);
    if (spec.name === "scpart") {
      expect(out).not.toBe(spec.out);
      expect(out.pstart).not.toBe(start);
      expect(out.pstop).not.toBe(stop);
    }
  });
  it("rejects unrepresentable or nonnegatable spacecraft IDs before dispatch", () => {
    const call = vi.fn(),
      api = apiFor({ [spec.name]: call });
    for (const sc of [-2147483648, 2147483648, NaN, 0.5, null, 1n]) {
      expect(() =>
        Reflect.apply(api[spec.name], undefined, [sc, ...spec.args.slice(1)]),
      ).toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("preserves the native error object without returning failed outputs", () => {
    const err = Object.assign(new Error("SPICE(KERNELVARNOTFOUND)"), {
      spiceShort: "SPICE(KERNELVARNOTFOUND)",
    });
    const api = apiFor({
      [spec.name]: vi.fn(() => {
        throw err;
      }),
    });
    let observed: unknown;
    try {
      Reflect.apply(api[spec.name], undefined, spec.args);
    } catch (error) {
      observed = error;
    }
    expect(observed).toBe(err);
  });
});

describe("clock adapter representations", () => {
  it("bounds formatter storage and preserves small logical lengths", () => {
    const native = vi.fn(() => "0"),
      api = apiFor({ scfmt: native });
    expect(api.scfmt(-123, 1)).toBe("0");
    expect(native).toHaveBeenLastCalledWith(-123, 1, 2048);
    for (const room of [2147483647, 3100, 2, 1, 0, -2147483648]) {
      expect(api.scfmt(-123, 1, room)).toBe("0");
      expect(native).toHaveBeenLastCalledWith(-123, 1, Math.min(room, 3100));
    }
  });
  it("requires finite times and ticks, signed32 capacities and well-formed text", () => {
    const call = vi.fn();
    const api = apiFor({ sce2t: call, scfmt: call, sctiks: call });
    for (const value of [NaN, Infinity, -Infinity, "0", null]) {
      expect(() => Reflect.apply(api.sce2t, undefined, [0, value])).toThrow();
      expect(() => Reflect.apply(api.scfmt, undefined, [0, value])).toThrow();
    }
    for (const room of [0.5, NaN, -2147483649, 2147483648])
      expect(() => api.scfmt(0, 1, room)).toThrow();
    for (const text of ["1\0/0", "\ud800", "\udfff", 1n, null]) {
      expect(() => Reflect.apply(api.sctiks, undefined, [0, text])).toThrow();
    }
    expect(call).not.toHaveBeenCalled();
  });
  it("rejects malformed native scalar and partition return values", () => {
    for (const [name, args] of [
      ["sce2t", [0, 0]],
      ["sctiks", [0, "0"]],
      ["scfmt", [0, 0]],
    ] as const) {
      for (const out of [null, 1n, {}, false]) {
        const api = apiFor({ [name]: vi.fn(() => out) });
        expect(() => Reflect.apply(api[name], undefined, args)).toThrow();
      }
    }
    const hole = new Array<number>(1);
    const oversized = new Proxy([], {
      get(_, key) {
        if (key === "length") return 10000;
        throw new Error("Unexpected element read");
      },
    });
    for (const out of [
      null,
      [],
      { pstart: [0], pstop: [] },
      { pstart: [], pstop: null },
      { pstart: [1n], pstop: [1] },
      { pstart: [1], pstop: hole },
      { pstart: oversized, pstop: oversized },
    ]) {
      const api = apiFor({ scpart: vi.fn(() => out) as NativeAddon["scpart"] });
      expect(() => api.scpart(0)).toThrow();
    }
  });
});

const multi = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-two-partition.tsc",
    import.meta.url,
  ),
);
const single = fileURLToPath(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-ck-clock.tsc",
    import.meta.url,
  ),
);
describe.skipIf(!nodeAddonAvailable())("compiled clock operations", () => {
  it.each(cases)(
    "guards $name native argument count and spacecraft negation",
    (spec) => {
      const native = getNativeAddon();
      expect(() => Reflect.apply(native[spec.name], native, [])).toThrow();
      expect(() =>
        Reflect.apply(native[spec.name], native, [
          -2147483648,
          ...spec.args.slice(1),
        ]),
      ).toThrow();
    },
  );

  it("compares rounded encoded ticks and raw partitions on the authored two-partition clock", () => {
    const native = getNativeAddon();
    native.kclear();
    try {
      expect(() => native.sce2t(-12345, 0)).toThrow(/KERNELVARNOTFOUND/);
      expect(native.failed()).toBe(false);
      native.furnsh(multi);
      const data = native.scpart(-12345);
      expect(data).toEqual({ pstart: [0, 1024], pstop: [1023, 4095] });
      data.pstart[0] = 77;
      data.pstop[0] = -1;
      expect(native.scpart(-12345)).toEqual({
        pstart: [0, 1024],
        pstop: [1023, 4095],
      });
      expect(native.sce2t(-12345, 0.5 / 256)).toBe(1);
      expect(native.sce2t(-12345, 1023 / 256)).toBe(1023);
      expect(native.scfmt(-12345, -0.49, 2048)).toBe("000000.000");
      expect(() => native.scfmt(-12345, -0.5, 2048)).toThrow(/VALUEOUTOFRANGE/);
      expect(native.scfmt(-12345, 255.5, 2147483647)).toBe("000001.000");
      expect(native.scfmt(-12345, 256000000, 11)).toBe("1000000.00");
      expect(() => native.scfmt(-12345, 0, 1)).toThrow(/STRINGTOOSHORT/);
      expect(() => native.scfmt(-12345, 0, 3)).toThrow(/SCLKTRUNCATED/);
      expect(native.sctiks(-12345, "1:0")).toBe(256);
      expect(() => native.sctiks(-12345, "")).toThrow(/EMPTYSTRING/);
      expect(native.sctiks(-12345, "0")).toBe(0);
    } finally {
      native.kclear();
    }
  });

  it("contains the formatter's fixed local field and rejects unsafe width arithmetic before conversion", () => {
    const native = getNativeAddon();
    native.kclear();
    try {
      native.furnsh(single);
      expect(() => native.scfmt(-123, 1e30, 2048)).toThrow(
        /28-digit formatter domain/,
      );
      // This one-field kernel uses these values only after the checked shim.
      native.pdpool("SCLK01_OFFSETS_123", [1e30]);
      expect(() => native.scfmt(-123, 0, 2048)).toThrow(
        /28-digit formatter domain/,
      );
      native.pdpool("SCLK01_OFFSETS_123", [-4294967296]);
      expect(() => native.scfmt(-123, 0, 2048)).toThrow(/field width/);
      native.pdpool("SCLK01_OFFSETS_123", [0]);
      expect(native.scfmt(-123, 0, 2048)).toBe("0000000000");
    } finally {
      native.kclear();
    }
  });

  it("checks formatter bounds after partition reads populate the type-1 cache", () => {
    const native = getNativeAddon();
    native.kclear();
    try {
      native.furnsh(single);
      native.pipool("SCLK_DATA_TYPE_123", [2]);
      expect(native.scpart(-123)).toEqual({ pstart: [0], pstop: [4294967295] });
      expect(() => native.scfmt(-123, 1e30, 2048)).toThrow(
        /28-digit formatter domain/,
      );
      expect(native.scfmt(-123, 1, 2048)).toBe("0000000001");
    } finally {
      native.kclear();
    }
  });
});
