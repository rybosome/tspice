import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "checks all three compiled surface handlers before reading result storage",
  () => {
    const native = getNativeAddon();
    try {
      native.kclear();
      for (const file of ["audit-geometry.bsp", "audit-geometry.tf"])
        native.furnsh(
          fileURLToPath(
            new URL(
              "../../py-parity-checking/fixtures/kernels/" + file,
              import.meta.url,
            ),
          ),
        );
      for (const fn of [native.dnearp, native.surfpv, native.tangpt])
        expect(() => Reflect.apply(fn, native, [])).toThrow();
      expect(() =>
        Reflect.apply(native.dnearp, native, [[1, 2, 3], 2, 2, 2]),
      ).toThrow();
      expect(() =>
        native.surfpv([1, 0, 0, 0, 0, NaN], [-1, 0, 0, 0, 0, 0], 2, 2, 2),
      ).toThrow();
      expect(() =>
        native.tangpt(
          "ELLIPSOID",
          "100101",
          Infinity,
          "AUDIT_GEOMETRY_FIXED",
          "NONE",
          "TANGENT POINT",
          "100102",
          "J2000",
          [-1, 0, 0],
        ),
      ).toThrow();
      expect(() =>
        native.tangpt(
          "ELLIPSOID",
          "100101",
          0,
          "AUDIT_GEOMETRY_FIXED",
          "NONE",
          "TANGENT POINT",
          "100102",
          "J2000",
          [0, 0, 0],
        ),
      ).toThrow(/ZEROVECTOR/);
      expect(native.dnearp([0, 0, 0, 1, 2, 3], 1, 1, 1)).toEqual({
        found: false,
        position: [1, 0, 0],
        altitude: -1,
      });
      expect(
        native.surfpv([5, 0, 0, 0, 1, 2], [-1, 0, 0, 0, 0, 0], 2, 2, 2),
      ).toEqual({ found: true, state: [2, 0, 0, 0, 1, 2] });
      expect(
        native.tangpt(
          "ELLIPSOID",
          "100101",
          0,
          "AUDIT_GEOMETRY_FIXED",
          "NONE",
          "TANGENT POINT",
          "100102",
          "J2000",
          [-1, 0, 0],
        ).tanpt,
      ).toEqual([0, 4, 3]);
      expect(native.failed()).toBe(false);
    } finally {
      native.kclear();
    }
  },
);
