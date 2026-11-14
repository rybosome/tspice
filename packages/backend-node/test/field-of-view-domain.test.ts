import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "checks the compiled FOV entry point arguments before consuming results",
  () => {
    const native = getNativeAddon();
    try {
      native.kclear();
      native.furnsh(
        fileURLToPath(
          new URL(
            "../../py-parity-checking/fixtures/kernels/audit-fov.ti",
            import.meta.url,
          ),
        ),
      );
      for (const call of [
        native.getfov,
        native.getfvn,
        native.fovray,
        native.fovtrg,
      ]) {
        expect(() => Reflect.apply(call, native, [])).toThrow();
      }
      expect(() => native.getfov(-817101, 1.5, 81, 81)).toThrow();
      expect(() => native.getfvn("AUDIT_CIRCLE", 1, 1, 81)).toThrow(
        /STRINGTOOSHORT/,
      );
      expect(() =>
        native.fovray(
          "AUDIT_CIRCLE",
          [Infinity, 0, 0],
          "J2000",
          "NONE",
          "100103",
          0,
        ),
      ).toThrow();
      expect(() =>
        native.fovtrg(
          "AUDIT_CIRCLE",
          "100101",
          "POINT",
          "",
          "NONE",
          "100103",
          NaN,
        ),
      ).toThrow();
      expect(native.getfvn("AUDIT_CIRCLE", 1, 81, 81).bounds).toEqual([
        [3, 0.75, 0],
      ]);
      expect(native.failed()).toBe(false);
    } finally {
      native.kclear();
    }
  },
);
