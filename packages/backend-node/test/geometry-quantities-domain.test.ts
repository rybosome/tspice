import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
import { getNativeAddon, type NativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";
function mockNative(
  name: keyof NativeAddon,
  implementation: (...args: never[]) => unknown,
) {
  // The test provides one native entry. Fail if the adapter uses any other entry.
  return new Proxy({} as NativeAddon, {
    get(_target, key) {
      if (key !== name)
        throw new Error("Unexpected native entry " + String(key));
      return implementation;
    },
  });
}

const ops = [
  ["phaseq", [4, "targ", "light", "obs", "LT"]],
  ["lspcn", ["body", 7, "CN"]],
  [
    "trgsep",
    [3, "first", "SPHERE", "f1", "second", "POINT", "f2", "obs", "NONE"],
  ],
] as const;
for (const [name, args] of ops) {
  it(`${name} delegates all arguments in CSPICE order and preserves native errors`, () => {
    const call = vi.fn((..._args: unknown[]) => -0.31);
    const api = createGeometryApi(mockNative(name, call));
    const invoke = (a: readonly unknown[]) => Reflect.apply(api[name], api, a);
    expect(invoke(args)).toBe(-0.31);
    expect(call).toHaveBeenCalledWith(...args);
    for (let i = 0; i < args.length; i++) {
      for (const invalid of typeof args[i] === "number"
        ? [NaN, Infinity]
        : [null, "\0", "\uDCA0"]) {
        const bad: unknown[] = [...args];
        bad[i] = invalid;
        expect(() => invoke(bad)).toThrow();
      }
    }
    expect(call).toHaveBeenCalledTimes(1);
    const error = new Error("native geometry diagnostic");
    call.mockImplementation(() => {
      throw error;
    });
    expect(() => invoke(args)).toThrow(error);
  });
  it(`${name} rejects malformed return values`, () => {
    const api = createGeometryApi(mockNative(name, () => "0"));
    expect(() => Reflect.apply(api[name], api, args)).toThrow(/numeric/);
  });
}
it.runIf(nodeAddonAvailable())(
  "compiled addon rejects malformed JS values before scientific work and retains native error recovery",
  () => {
    const n = getNativeAddon();
    n.kclear();
    try {
      for (const [name, args] of ops) {
        expect(() => Reflect.apply(n[name], n, [])).toThrow();
        for (let i = 0; i < args.length; i++) {
          const bad: unknown[] = [...args];
          bad[i] = typeof args[i] === "number" ? NaN : "\uD800";
          expect(() => Reflect.apply(n[name], n, bad)).toThrow();
        }
      }
      for (const file of [
        "audit-geometry.bsp",
        "audit-seasonal-pole.tpc",
        "audit-geometry.tf",
      ]) {
        n.furnsh(
          fileURLToPath(
            new URL(
              `../../py-parity-checking/fixtures/kernels/${file}`,
              import.meta.url,
            ),
          ),
        );
      }
      expect(() => n.phaseq(0, "100101", "SUN", "SUN", "NONE")).toThrow(
        /BODIESNOTDISTINCT/,
      );
      expect(n.phaseq(0, "100101", "SUN", "100102", "NONE")).toBeCloseTo(
        0.12458734013080974,
        13,
      );
      expect(() => n.lspcn("100101", 0, "invalid")).toThrow(/INVALIDOPTION/);
      expect(n.lspcn("100101", 0, "NONE")).toBeCloseTo(2.071875507862086, 13);
      expect(() =>
        n.trgsep(
          0,
          "100101",
          "SPHERE",
          "frame1",
          "100103",
          "SPHERE",
          "",
          "100104",
          "NONE",
        ),
      ).toThrow(/EMPTYSTRING/);
      expect(
        n.trgsep(
          0,
          "100101",
          "SPHERE",
          "ignored",
          "100103",
          "SPHERE",
          "unused",
          "100104",
          "NONE",
        ),
      ).toBeCloseTo(-0.17557087767604718, 13);
      expect(n.failed()).toBe(false);
    } finally {
      n.kclear();
    }
  },
);
