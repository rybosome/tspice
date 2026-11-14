import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "checks the six scalar search bindings and preserves owned windows after errors",
  () => {
    const n = getNativeAddon(),
      c = n.newWindow(2),
      r = n.newWindow(2);
    try {
      n.kclear();
      for (const file of ["audit-geometry.bsp", "audit-geometry.tf"])
        n.furnsh(
          fileURLToPath(
            new URL(
              "../../py-parity-checking/fixtures/kernels/" + file,
              import.meta.url,
            ),
          ),
        );
      n.wninsd(-5, 5, c);
      for (const method of [
        n.gfpa,
        n.gfposc,
        n.gfrr,
        n.gfsntc,
        n.gfsubc,
        n.gfilum,
      ])
        expect(() => Reflect.apply(method, n, [])).toThrow();
      expect(() =>
        n.gfrr("100101", "NONE", "100103", ">", 0, 0, 0.25, 2 ** 31, c, r),
      ).toThrow(/SpiceInt/);
      expect(() =>
        n.gfposc(
          "100101",
          "J2000",
          "NONE",
          "100103",
          "RECTANGULAR",
          "Y",
          "<",
          1,
          0,
          0.25,
          24,
          c,
          c,
        ),
      ).toThrow(/distinct/);
      expect(() =>
        n.gfilum(
          "ELLIPSOID",
          "EMISSION",
          "100101",
          "SUN",
          "AUDIT_GEOMETRY_FIXED",
          "NONE",
          "100103",
          [NaN, 0, 0],
          ">",
          0,
          0,
          0.25,
          24,
          c,
          r,
        ),
      ).toThrow();
      n.gfrr("100101", "NONE", "100103", ">", 0, 0, 0.25, 24, c, r);
      const [left, right] = n.wnfetd(r, 0);
      expect(Math.abs(left)).toBeLessThan(1e-6);
      expect(right).toBe(5);
      expect(n.wnfetd(c, 0)).toEqual([-5, 5]);
      expect(n.failed()).toBe(false);
    } finally {
      n.freeWindow(r);
      n.freeWindow(c);
      n.kclear();
    }
  },
);
