import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  async function withSearch(f: (s: SpiceSync) => void, cached = false) {
    const client = cached
      ? spiceClients.caching({ noStorePrefixes: ["kit.", "raw.wn"] })
      : spiceClients;
    const c = await client.toSync({ backend });
    try {
      const raw = c.spice.raw;
      raw.kclear();
      raw.gfstol(1e-6);
      for (const path of [
        "audit-geometry.bsp",
        "audit-geometry.tf",
        "audit-fov.ti",
        "audit-ck-clock.tsc",
        "audit-pointing.bc",
        "audit-gf-ray.tf",
      ])
        raw.furnsh({
          path,
          bytes: fs.readFileSync(
            new URL("../fixtures/kernels/" + path, import.meta.url),
          ),
        });
      f(c.spice);
    } finally {
      try {
        c.spice.raw.gfstol(1e-6);
        c.spice.raw.kclear();
      } finally {
        await c.dispose();
      }
    }
  }
  run(
    `${backend} reruns cached searches after the result window changes`,
    async () =>
      withSearch(({ raw, kit }) => {
        const confinement = kit.newWindow(3),
          result = kit.newWindow(5);
        try {
          raw.wninsd(-100, 100, confinement);
          const calls = [
            () =>
              raw.gfoclt(
                "FULL",
                "100101",
                "ELLIPSOID",
                "AUDIT_GEOMETRY_FIXED",
                "100103",
                "ELLIPSOID",
                "AUDIT_OCCULT_SMALL",
                "NONE",
                "100104",
                2,
                confinement,
                result,
              ),
            () =>
              raw.gftfov(
                "AUDIT_CIRCLE",
                "100101",
                "POINT",
                "",
                "NONE",
                "100103",
                2,
                confinement,
                result,
              ),
            () =>
              raw.gfrfov(
                "AUDIT_CIRCLE",
                [1, 0, 0],
                "J2000",
                "NONE",
                "100103",
                2,
                confinement,
                result,
              ),
          ];
          for (const search of calls) {
            search();
            expect(raw.wncard(result)).toBe(1);
            raw.wninsd(500, 600, result);
            expect(raw.wncard(result)).toBe(2);
            search();
            expect(raw.wncard(result)).toBe(1);
            expect(raw.wnfetd(result, 0)[1]).toBeLessThanOrEqual(100);
          }
        } finally {
          kit.freeWindow(result);
          kit.freeWindow(confinement);
        }
      }, true),
  );
  run(
    `${backend} resolves a moving target center and a larger finite limb within a circular detector`,
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(4),
          r = kit.newWindow(4);
        try {
          raw.wninsd(-150, 150, c);
          raw.wninsd(1000, 1010, r);
          raw.gftfov(
            "AUDIT_CIRCLE",
            "100101",
            "POINT",
            "",
            "NONE",
            "100103",
            2,
            c,
            r,
          );
          expect(raw.wncard(r)).toBe(1);
          // The moving observer sees (20,-0.1*t,0). |y/x| <= 1/4 gives |t| <= 50.
          const center = raw.wnfetd(r, 0);
          expect(Math.abs(center[0] + 50)).toBeLessThan(1e-6);
          expect(Math.abs(center[1] - 50)).toBeLessThan(1e-6);
          raw.gftfov(
            "AUDIT_CIRCLE",
            "100101",
            "ELLIPSOID",
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "100103",
            3,
            c,
            r,
          );
          const limb = raw.wnfetd(r, 0);
          expect(limb[0]).toBeLessThan(center[0]);
          expect(limb[1]).toBeGreaterThan(center[1]);
          for (const [edge, sign] of [
            [limb[0], 1],
            [limb[1], -1],
          ] as const) {
            const visible = (t: number) =>
              raw.fovtrg(
                "AUDIT_CIRCLE",
                "100101",
                "ELLIPSOID",
                "AUDIT_GEOMETRY_FIXED",
                "NONE",
                "100103",
                t,
              );
            expect(visible(edge + sign * 0.001)).toBe(true);
            expect(visible(edge - sign * 0.001)).toBe(false);
          }
          expect(raw.wnfetd(c, 0)).toEqual([-150, 150]);
          expect(raw.gfstep(0)).toBe(3);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    `${backend} resolves both CK camera crossings and snapshots the ray once`,
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(2),
          r = kit.newWindow(2);
        try {
          raw.wninsd(0, 10, c);
          const m = raw.pxform("AUDIT_GF_CAMERA", "J2000", 5);
          const d: [number, number, number] = [m[0], m[3], m[6]],
            ray: [number, number, number] = [...d];
          let reads = 0;
          Object.defineProperty(ray, 0, {
            get() {
              if (++reads > 1) throw new Error("ray read twice");
              return d[0];
            },
          });
          raw.gfrfov(
            "AUDIT_GF_CAMERA",
            ray,
            "J2000",
            "NONE",
            "100103",
            0.5,
            c,
            r,
          );
          expect(reads).toBe(1);
          const [a, b] = raw.wnfetd(r, 0);
          expect(a).toBeGreaterThan(2);
          expect(b).toBeLessThan(8);
          expect((a + b) / 2).toBeCloseTo(5, 6);
          for (const [t, expected] of [
            [a - 0.001, false],
            [a + 0.001, true],
            [b - 0.001, true],
            [b + 0.001, false],
          ] as const)
            expect(
              raw.fovray("AUDIT_GF_CAMERA", d, "J2000", "NONE", "100103", t),
            ).toBe(expected);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    `${backend} distinguishes full and partial occlusion and recovers from invalid window use`,
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(4),
          r = kit.newWindow(4);
        try {
          raw.wninsd(-200, 200, c);
          const search = (type: string) =>
            raw.gfoclt(
              type,
              "100101",
              "ELLIPSOID",
              "AUDIT_GEOMETRY_FIXED",
              "100103",
              "ELLIPSOID",
              "AUDIT_OCCULT_SMALL",
              "NONE",
              "100104",
              2,
              c,
              r,
            );
          search("FULL");
          const full = raw.wnfetd(r, 0);
          search("PARTIAL");
          expect(raw.wncard(r)).toBe(2);
          const left = raw.wnfetd(r, 0),
            right = raw.wnfetd(r, 1);
          expect(left[1]).toBeCloseTo(full[0], 6);
          expect(right[0]).toBeCloseTo(full[1], 6);
          // At the midpoint the apparent nearer disk completely covers the smaller disk.
          expect(
            raw.occult(
              "100101",
              "ELLIPSOID",
              "AUDIT_GEOMETRY_FIXED",
              "100103",
              "ELLIPSOID",
              "AUDIT_OCCULT_SMALL",
              "NONE",
              "100104",
              0,
            ),
          ).toBe(3);
          expect(() =>
            raw.gftfov(
              "AUDIT_CIRCLE",
              "100101",
              "POINT",
              "",
              "NONE",
              "100103",
              1,
              c,
              c,
            ),
          ).toThrow(/distinct/);
          expect(() =>
            raw.gfrfov(
              "AUDIT_CIRCLE",
              [1, 0, 0],
              "J2000",
              "NONE",
              "100103",
              0,
              c,
              r,
            ),
          ).toThrow(/INVALIDSTEP/);
          expect(raw.failed()).toBe(false);
          search("ANNULAR");
          expect(raw.wncard(r)).toBe(0);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    `${backend} rejects a step too small to advance the confinement epoch and expired handles`,
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(1),
          r = kit.newWindow(1),
          expired = kit.newWindow(1);
        kit.freeWindow(expired);
        try {
          raw.wninsd(10, 11, c);
          expect(() =>
            raw.gftfov(
              "AUDIT_CIRCLE",
              "100101",
              "POINT",
              "",
              "NONE",
              "100103",
              Number.MIN_VALUE,
              c,
              r,
            ),
          ).toThrow(/advance/);
          expect(() =>
            raw.gfrfov(
              "AUDIT_CIRCLE",
              [1, 0, 0],
              "J2000",
              "NONE",
              "100103",
              2,
              c,
              expired,
            ),
          ).toThrow();
          raw.gftfov(
            "AUDIT_CIRCLE",
            "100101",
            "POINT",
            "",
            "NONE",
            "100103",
            0.5,
            c,
            r,
          );
          expect(raw.wnfetd(r, 0)).toEqual([10, 11]);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
}
