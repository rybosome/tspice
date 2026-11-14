import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  async function withSurface(check: (raw: SpiceSync["raw"]) => void) {
    const c = await spiceClients.toSync({ backend });
    try {
      const raw = c.spice.raw;
      raw.kclear();
      for (const path of ["audit-geometry.bsp", "audit-geometry.tf"])
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
    `${backend} differentiates an independently projected moving sphere point`,
    async () =>
      withSurface((raw) => {
        const sample: [number, number, number, number, number, number] = [
          3, 4, 1, 1.5, -2, 3,
        ];
        const sol = raw.dnearp(sample, 2, 2, 2);
        if (!sol.found) throw new Error("regular sphere derivative missing");
        function projection(t: number) {
          const p = [3 + 1.5 * t, 4 - 2 * t, 1 + 3 * t],
            radius = Math.hypot(...p);
          return [...p.map((x) => (2 * x) / radius), radius - 2];
        }
        const h = 1e-5,
          plus = projection(h),
          minus = projection(-h),
          center = projection(0);
        [...sol.position, sol.altitude].forEach((value, i) =>
          expect(value).toBeCloseTo(center[i]!, 12),
        );
        [...sol.velocity, sol.altitudeRate].forEach((value, i) =>
          expect(
            Math.abs(value - (plus[i]! - minus[i]!) / (2 * h)),
          ).toBeLessThan(8e-10),
        );
        sol.position[0] = 100;
        sol.velocity[1] = 500;
        expect(raw.dnearp(sample, 2, 2, 2).position[0]).toBeCloseTo(
          center[0]!,
          12,
        );
        expect(raw.dnearp([0, 0, 0, 1, 2, 3], 1, 1, 1)).toEqual({
          found: false,
          position: [1, 0, 0],
          altitude: -1,
        });
      }),
  );
  run(
    `${backend} differentiates the forward quadratic root for a ray with moving origin and direction`,
    async () =>
      withSurface((raw) => {
        const state = raw.surfpv(
          [5, 1, 0.1, 0.5, -2, 3],
          [-2, -0.2, 0, 0.02, 0.01, 0.1],
          3,
          2,
          1,
        );
        if (!state.found) throw new Error("missing moving intercept");
        function intersection(t: number) {
          const origin = [5 + 0.5 * t, 1 - 2 * t, 0.1 + 3 * t],
            direction = [-2 + 0.02 * t, -0.2 + 0.01 * t, 0.1 * t],
            axes = [3, 2, 1];
          const d = direction.map((x, i) => x / axes[i]!),
            v = origin.map((x, i) => x / axes[i]!);
          const a = d.reduce((s, x) => s + x * x, 0),
            b = d.reduce((s, x, i) => s + x * v[i]!, 0),
            c = v.reduce((s, x) => s + x * x, -1);
          const k = (-b - Math.sqrt(b * b - a * c)) / a;
          return origin.map((x, i) => x + k * direction[i]!);
        }
        const h = 1e-5,
          plus = intersection(h),
          minus = intersection(-h),
          center = intersection(0);
        state.state
          .slice(0, 3)
          .forEach((v, i) => expect(v).toBeCloseTo(center[i]!, 11));
        state.state
          .slice(3)
          .forEach((v, i) =>
            expect(Math.abs(v - (plus[i]! - minus[i]!) / (2 * h))).toBeLessThan(
              6e-9,
            ),
          );
        for (const x of [2, 2.1])
          expect(
            raw.surfpv([x, -4, 0, 0, 0.2, 0], [0, 1, 0, 0, 0, 0.1], 2, 2, 2),
          ).toEqual({ found: false });
      }),
  );
  run(
    `${backend} returns complete tangent, surface and observer geometry across contact and correction loci`,
    async () =>
      withSurface((raw) => {
        const calculate = (
          d: readonly [number, number, number],
          cor = "NONE",
          loc = "TANGENT POINT",
          et = 0,
        ) =>
          raw.tangpt(
            "ELLIPSOID",
            "100101",
            et,
            "AUDIT_GEOMETRY_FIXED",
            cor,
            loc,
            "100102",
            "J2000",
            d,
          );
        const observer = [10, 4, 3],
          axes = [3, 2, 1];
        for (const direction of [
          [-1, 0, 0],
          [-10, -4, -3],
          [1, 0, 0],
        ] as const) {
          const v = calculate(direction),
            length = Math.hypot(...direction);
          expect(v.trgepc).toBe(0);
          expect(
            v.srfpt.reduce((s, x, i) => s + (x / axes[i]!) ** 2, 0),
          ).toBeCloseTo(1, 12);
          expect(
            Math.hypot(...v.tanpt.map((x, i) => x - v.srfpt[i]!)),
          ).toBeCloseTo(v.alt, 11);
          for (let i = 0; i < 3; i++) {
            expect(v.tanpt[i]).toBeCloseTo(
              observer[i]! + (v.range * direction[i]!) / length,
              11,
            );
            expect(v.srfvec[i]).toBeCloseTo(v.srfpt[i]! - observer[i]!, 11);
          }
        }
        const front = calculate([-10, -4, -3]);
        expect(front.alt).toBe(0);
        expect(calculate([1, 0, 0]).range).toBe(0);
        expect(calculate([-1, 0, 0]).tanpt).toEqual([0, 4, 3]);
        for (const cor of ["CN", "XCN"]) {
          const a = calculate([-1, 0, 0], cor, "TANGENT POINT", 3500),
            b = calculate([-1, 0, 0], cor, "SURFACE POINT", 3500);
          expect(Math.sign(a.trgepc - 3500)).toBe(cor === "CN" ? -1 : 1);
          expect(Math.abs(a.trgepc - b.trgepc)).toBeGreaterThan(1e-8);
        }
        front.srfpt[0] = 42;
        expect(calculate([-10, -4, -3]).srfpt[0]).toBeLessThan(3);
      }),
  );
  run(
    `${backend} snapshots once, rejects malformed inputs and recovers after ordered toolkit errors`,
    async () =>
      withSurface((raw) => {
        const v: [number, number, number, number, number, number] = [
          3, 4, 0, 3, 4, 0,
        ];
        let reads = 0;
        Object.defineProperty(v, 0, {
          get() {
            if (++reads > 1) throw new Error("duplicate read");
            return 3;
          },
        });
        expect(raw.dnearp(v, 2, 2, 2).altitude).toBeCloseTo(3, 12);
        expect(reads).toBe(1);
        expect(() =>
          raw.surfpv([5, 0, 0, 0, 1, 2], [-1, 0, Infinity, 0, 0, 0], 2, 2, 2),
        ).toThrow();
        expect(() =>
          raw.tangpt(
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
        expect(() =>
          raw.tangpt(
            "ELLIPSOID",
            "UNMAPPED TARGET",
            0,
            "AUDIT_GEOMETRY_FIXED",
            "INVALID",
            "TANGENT POINT",
            "100102",
            "J2000",
            [-1, 0, 0],
          ),
        ).toThrow(/INVALIDOPTION/);
        expect(() =>
          raw.tangpt(
            "ELLIPSOID",
            "UNMAPPED TARGET",
            0,
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "TANGENT POINT",
            "100102",
            "J2000",
            [-1, 0, 0],
          ),
        ).toThrow(/IDCODENOTFOUND/);
        expect(raw.failed()).toBe(false);
      }),
  );
}
