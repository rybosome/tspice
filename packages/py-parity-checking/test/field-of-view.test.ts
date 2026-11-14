import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  async function withFov(check: (raw: SpiceSync["raw"]) => void) {
    const c = await spiceClients.toSync({ backend });
    try {
      const raw = c.spice.raw;
      raw.kclear();
      for (const path of [
        "audit-fov.ti",
        "audit-geometry.bsp",
        "audit-geometry.tf",
      ])
        raw.furnsh({
          path,
          bytes: fs.readFileSync(
            new URL(`../fixtures/kernels/${path}`, import.meta.url),
          ),
        });
      check(raw);
    } finally {
      try {
        c.spice.raw.kclear();
      } finally {
        await c.dispose();
      }
    }
  }

  run(
    `${backend} returns all owned corner rows and preserves the angle-defined axes`,
    async () =>
      withFov((raw) => {
        const original = raw.getfov(-817103, 4),
          named = raw.getfvn(" audit_rect ", 4);
        expect(original).toEqual(named);
        const y = Math.tan(Math.PI / 18),
          z = Math.tan(Math.PI / 36);
        for (const [i, [dy, dz]] of [
          [y, z],
          [-y, z],
          [-y, -z],
          [y, -z],
        ].entries()) {
          const [a, b, c] = original.bounds[i]!;
          expect(Math.abs(b / a - dy!)).toBeLessThan(3e-15);
          expect(Math.abs(c / a - dz!)).toBeLessThan(3e-15);
        }
        expect(original.bsight).toEqual([1, 0, 0]);
        original.bsight[0] = 123;
        original.bounds[0]![0] = 88;
        expect(raw.getfov(-817103, 2147483647)).toEqual(named);
        expect(raw.getfvn("AUDIT_CIRCLE", 1)).toEqual({
          shape: "CIRCLE",
          frame: "J2000",
          bsight: [2, 0, 0],
          n: 1,
          bounds: [[3, 0.75, 0]],
        });
      }),
  );
  run(
    `${backend} observes text byte widths, UTF-8 validity and recovery`,
    async () =>
      withFov((raw) => {
        const frame = "\uFEFF測定";
        raw.pcpool("INS-817101_FOV_FRAME", [frame]);
        expect(raw.getfov(-817101, 1, 7, 7).frame).toBe("\uFEFF測");
        expect(() => raw.getfvn("AUDIT_CIRCLE", 1, 7, 6)).toThrow();
        expect(raw.getfvn("AUDIT_CIRCLE", 1).frame).toBe(frame);
        expect(() => raw.getfvn("UNLISTED CAMERA", 1)).toThrow(
          /IDCODENOTFOUND/,
        );
        expect(() => raw.getfov(-817101, 1, 2)).toThrow();
        expect(raw.failed()).toBe(false);
      }),
  );
  run(
    `${backend} snapshots a finite ray and compares the actual cone against independent near-edge directions`,
    async () =>
      withFov((raw) => {
        const dir: [number, number, number] = [1, 0.25, 0];
        let reads = 0;
        Object.defineProperty(dir, 1, {
          get() {
            if (++reads > 1) throw new Error("duplicate read");
            return 0.249999;
          },
        });
        const visible = (v: readonly [number, number, number]) =>
          raw.fovray("AUDIT_CIRCLE", v, "J2000", "NONE", "100103", 0);
        expect(visible(dir)).toBe(true);
        expect(reads).toBe(1);
        for (const x of [0.125, 1, 100])
          for (const y of [0.2499, 0.2501, -0.2499, -0.2501])
            expect(visible([x, x * y, 0])).toBe(Math.abs(y) < 0.25);
        for (const bad of [[1, 0], [NaN, 0, 0], [Infinity, 0, 0], "abc"])
          expect(() => Reflect.apply(visible, undefined, [bad])).toThrow();
        expect(() => visible([0, 0, 0])).toThrow(/ZEROVECTOR/);
        expect(visible([1, 0, 0])).toBe(true);
      }),
  );
  run(
    `${backend} distinguishes point and ellipsoid contacts during the authored observer track`,
    async () =>
      withFov((raw) => {
        const inFov = (et: number, extended: boolean) =>
          raw.fovtrg(
            "AUDIT_CIRCLE",
            "100101",
            extended ? "ELLIPSOID" : "POINT",
            extended ? "AUDIT_GEOMETRY_FIXED" : "",
            "NONE",
            "100103",
            et,
          );
        for (const sign of [-1, 1]) {
          expect(inFov(sign * 49.999, false)).toBe(true);
          expect(inFov(sign * 50.001, false)).toBe(false);
          expect(inFov(sign * 57, true)).toBe(true);
          expect(inFov(sign * 100, true)).toBe(false);
        }
        raw.kclear();
        expect(() => inFov(0, false)).toThrow();
        expect(raw.failed()).toBe(false);
      }),
  );
  run(
    `${backend} enforces integer, ET and string representation before dispatch`,
    async () =>
      withFov((raw) => {
        for (const v of [NaN, 1.25, 2147483648]) {
          expect(() => raw.getfov(v, 1)).toThrow();
          expect(() => raw.getfov(-817101, v)).toThrow();
        }
        for (const v of [-2147483648, -715827883])
          expect(() => raw.getfvn("AUDIT_CIRCLE", v)).toThrow(/room/);
        expect(() => raw.getfvn("AUDIT\0CIRCLE", 1)).toThrow();
        expect(() =>
          raw.fovtrg(
            "AUDIT_CIRCLE",
            "100101",
            "POINT",
            "",
            "NONE",
            "100103",
            NaN,
          ),
        ).toThrow();
        expect(() =>
          raw.fovray("AUDIT_CIRCLE", [1, 0, 0], "J2000", "NONE", "\ud800", 0),
        ).toThrow();
        expect(raw.getfov(-817101, 1).n).toBe(1);
      }),
  );
}
