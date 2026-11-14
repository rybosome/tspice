import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "checks the three search bindings and preserves owned windows after errors",
  () => {
    const n = getNativeAddon(),
      c = n.newWindow(2),
      r = n.newWindow(2);
    try {
      n.kclear();
      for (const file of [
        "audit-geometry.bsp",
        "audit-geometry.tf",
        "audit-fov.ti",
      ])
        n.furnsh(
          fileURLToPath(
            new URL(
              "../../py-parity-checking/fixtures/kernels/" + file,
              import.meta.url,
            ),
          ),
        );
      n.wninsd(-5, 5, c);
      for (const method of [n.gfoclt, n.gfrfov, n.gftfov])
        expect(() => Reflect.apply(method, n, [])).toThrow();
      expect(() =>
        n.gfrfov(
          "AUDIT_CIRCLE",
          [1, NaN, 0],
          "J2000",
          "NONE",
          "100103",
          1,
          c,
          r,
        ),
      ).toThrow();
      expect(() =>
        n.gftfov(
          "AUDIT_CIRCLE",
          "100101",
          "POINT",
          "",
          "NONE",
          "100103\0X",
          1,
          c,
          r,
        ),
      ).toThrow(/NUL/);
      expect(() =>
        n.gfoclt(
          "ANY",
          "100101",
          "ELLIPSOID",
          "AUDIT_GEOMETRY_FIXED",
          "100104",
          "POINT",
          "",
          "NONE",
          "100103",
          Infinity,
          c,
          r,
        ),
      ).toThrow();
      n.gfrfov("AUDIT_CIRCLE", [1, 0, 0], "J2000", "NONE", "100103", 1, c, r);
      expect(n.wnfetd(r, 0)).toEqual([-5, 5]);
      expect(n.wnfetd(c, 0)).toEqual([-5, 5]);
      expect(n.failed()).toBe(false);
    } finally {
      n.freeWindow(r);
      n.freeWindow(c);
      n.kclear();
    }
  },
);
