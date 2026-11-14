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
      for (const path of ["audit-geometry.bsp", "audit-geometry.tf"])
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
    backend +
      " finds range-rate and rectangular-coordinate crossings at independently calculated epochs",
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(3),
          r = kit.newWindow(5);
        try {
          raw.wninsd(-10, 10, c);
          raw.wninsd(100, 140, r);
          const t = 2.8317;
          // Target minus observer is (20, -0.1*t, 0) km, with constant velocity (0,-0.1,0).
          const rate = (0.01 * t) / Math.hypot(20, 0.1 * t);
          raw.gfrr("100101", "NONE", "100103", "=", rate, 0, 0.25, 24, c, r);
          const [a, b] = raw.wnfetd(r, 0);
          expect(a).toBe(b);
          expect(Math.abs(a - t)).toBeLessThan(1e-6);
          raw.gfposc(
            "100101",
            "J2000",
            "NONE",
            "100103",
            "RECTANGULAR",
            "Y",
            ">",
            -0.1 * t,
            0,
            0.25,
            24,
            c,
            r,
          );
          const [start, end] = raw.wnfetd(r, 0);
          expect(start).toBe(-10);
          expect(Math.abs(end - t)).toBeLessThan(1e-6);
          expect(raw.wnfetd(c, 0)).toEqual([-10, 10]);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    backend +
      " distinguishes a ray intercept from the center-line subpoint on a triaxial body",
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(3),
          r = kit.newWindow(5);
        try {
          raw.wninsd(-10, 10, c);
          const t = 2.8317,
            ray: [number, number, number] = [1, 0, 0];
          let reads = 0;
          Object.defineProperty(ray, 0, {
            get() {
              if (++reads > 1) throw Error("read direction twice");
              return 1;
            },
          });
          raw.gfsntc(
            "100101",
            "AUDIT_GEOMETRY_FIXED",
            "ELLIPSOID",
            "NONE",
            "100103",
            "J2000",
            ray,
            "RECTANGULAR",
            "Y",
            "=",
            0.1 * t,
            0,
            0.25,
            24,
            c,
            r,
          );
          expect(reads).toBe(1);
          expect(Math.abs(raw.wnfetd(r, 0)[0] - t)).toBeLessThan(1e-6);
          // Intersection of the target-to-observer ray with x²/9+y²/4=1.
          const subY = (0.1 * t) / Math.hypot(20 / 3, (0.1 * t) / 2);
          raw.gfsubc(
            "100101",
            "AUDIT_GEOMETRY_FIXED",
            "Intercept: ellipsoid",
            "NONE",
            "100103",
            "RECTANGULAR",
            "Y",
            "=",
            subY,
            0,
            0.25,
            24,
            c,
            r,
          );
          expect(Math.abs(raw.wnfetd(r, 0)[0] - t)).toBeLessThan(1e-6);
          expect(subY).toBeLessThan((0.1 * t) / 6);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    backend +
      " locates a phase crossing and both symmetric emission-angle contacts",
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(3),
          r = kit.newWindow(5);
        try {
          raw.wninsd(-10, 10, c);
          const t = 2.8317,
            phase = raw.phaseq(t, "100101", "SUN", "100103", "NONE");
          raw.gfpa(
            "100101",
            "SUN",
            "NONE",
            "100103",
            "=",
            phase,
            0,
            0.25,
            24,
            c,
            r,
          );
          expect(Math.abs(raw.wnfetd(r, 0)[0] - t)).toBeLessThan(1e-6);
          // From (-3,0,0) the observer is (-17,0.1*t,0) relative to the surface point.
          const emission = Math.atan2(0.1 * t, 17);
          raw.gfilum(
            "ELLIPSOID",
            "EMISSION",
            "100101",
            "SUN",
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "100103",
            [-3, 0, 0],
            "=",
            emission,
            0,
            0.25,
            24,
            c,
            r,
          );
          expect(raw.wncard(r)).toBe(2);
          expect(Math.abs(raw.wnfetd(r, 0)[0] + t)).toBeLessThan(1e-6);
          expect(Math.abs(raw.wnfetd(r, 1)[0] - t)).toBeLessThan(1e-6);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }),
  );
  run(
    backend +
      " recomputes scalar searches with a reused result on a cached transport and recovers from errors",
    async () =>
      withSearch(({ raw, kit }) => {
        const c = kit.newWindow(3),
          r = kit.newWindow(3),
          expired = kit.newWindow(1);
        kit.freeWindow(expired);
        try {
          raw.wninsd(-5, 5, c);
          const search = () =>
            raw.gfrr("100101", "NONE", "100103", ">", -0.1, 0, 0.25, 24, c, r);
          search();
          raw.wninsd(90, 100, r);
          expect(raw.wncard(r)).toBe(2);
          search();
          expect(raw.wncard(r)).toBe(1);
          expect(() =>
            raw.gfrr(
              "100101",
              "NONE",
              "100103",
              ">",
              0,
              0,
              0.25,
              24,
              c,
              expired,
            ),
          ).toThrow();
          expect(() =>
            raw.gfrr("100101", "NONE", "100103", ">", 0, 0, 0.25, 24, c, c),
          ).toThrow(/distinct/);
          expect(() =>
            raw.gfrr(
              "100101",
              "NONE",
              "100103",
              ">",
              0,
              0,
              0.25,
              4_000_000,
              c,
              r,
            ),
          ).toThrow(/workspace/);
          expect(() =>
            raw.gfilum(
              "ELLIPSOID",
              "EMISSION",
              "100101",
              "SUN",
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100103",
              [Infinity, 0, 0],
              ">",
              0,
              0,
              0.25,
              24,
              c,
              r,
            ),
          ).toThrow();
          search();
          expect(raw.wnfetd(r, 0)).toEqual([-5, 5]);
          expect(raw.failed()).toBe(false);
        } finally {
          kit.freeWindow(r);
          kit.freeWindow(c);
        }
      }, true),
  );
}
