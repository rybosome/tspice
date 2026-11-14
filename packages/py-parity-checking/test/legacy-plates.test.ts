import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixture = (file: string) => ({
  path: file,
  bytes: fs.readFileSync(
    new URL("../fixtures/kernels/" + file, import.meta.url),
  ),
});
const files = [
  "audit-geometry.tf",
  "audit-legacy-plates.tf",
  "audit-geometry.bsp",
  "audit-legacy-plates.bds",
];
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend} radial surface, facet illumination, altitude and solar distance agree with analytic vectors`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of files) raw.furnsh(fixture(f));
      const h = raw.dasopr(files[3]!);
      try {
        const first = raw.dlabfs(h);
        if (!first.found) throw new Error("Missing segment");
        const d = first.descr,
          point = [1, 2 / 3, 1 / 3] as const,
          observer = [10, 4, 3],
          sun = [100, 50, 20],
          normal = [1 / 3, 1 / 2, 1];
        const off = (v: readonly number[], p: readonly number[]) =>
          v.map((x, i) => x - p[i]!);
        const angle = (a: number[], b: number[]) =>
          Math.acos(
            a.reduce((dot, x, i) => dot + x * b[i]!, 0) /
              (Math.hypot(...a) * Math.hypot(...b)),
          );
        const o = off(observer, point),
          s = off(sun, point);
        for (const angles of [
          raw.illum_pl02(h, d, "100101", 0, "NONE", "100102", point),
          raw.illum_plid_pl02(h, d, "100101", 0, "NONE", "100102", point, 1),
        ]) {
          expect(angles.phase).toBeCloseTo(angle(o, s), 13);
          expect(angles.solar).toBeCloseTo(angle(normal, s), 13);
          expect(angles.emissn).toBeCloseTo(angle(normal, o), 13);
        }
        const illuminated = raw.illum_plid_pl02(
          h,
          d,
          "100101",
          0,
          "NONE",
          "100102",
          point,
          1,
        );
        expect(illuminated.trgepc).toBe(0);
        expect(illuminated.srfvec).toEqual(o.map((x) => -x));
        expect([illuminated.visible, illuminated.lit]).toEqual([true, true]);
        const dark = raw.illum_plid_pl02(
          h,
          d,
          "100101",
          0,
          "NONE",
          "100102",
          [-1, -2 / 3, -1 / 3],
          8,
        );
        expect([dark.visible, dark.lit]).toEqual([false, false]);
        const sub = raw.subpt_pl02(
            h,
            d,
            "Intercept",
            "100101",
            0,
            "NONE",
            "100102",
          ),
          sol = raw.subsol_pl02(
            h,
            d,
            "Intercept",
            "100101",
            0,
            "NONE",
            "100102",
          );
        for (const [got, v] of [
          [sub.spoint, observer],
          [sol.spoint, sun],
        ] as const)
          for (const [i, x] of v.entries())
            expect(got[i]).toBeCloseTo(x / (v[0]! / 3 + v[1]! / 2 + v[2]!), 13);
        expect(sub.alt).toBeCloseTo(
          Math.hypot(...off(observer, sub.spoint)),
          13,
        );
        expect(sol.dist).toBeCloseTo(
          Math.hypot(...off(observer, sol.spoint)),
          13,
        );
        const limb = raw.limb_pl02(
            h,
            d,
            "100101",
            0,
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "100102",
            7,
          ),
          term = raw.term_pl02(
            h,
            d,
            "UMBRAL",
            "SUN",
            "100101",
            0,
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "100102",
            7,
          );
        for (const [points, ids] of [
          [limb.lmbpts, limb.pltids],
          [term.trmpts, term.pltids],
        ] as const) {
          expect(points).toHaveLength(7);
          for (const [i, [x, y, z]] of points.entries()) {
            expect(Math.abs(x) / 3 + Math.abs(y) / 2 + Math.abs(z)).toBeCloseTo(
              1,
              13,
            );
            expect(ids[i]).toBe(
              1 + (x < 0 ? 4 : 0) + (y < 0 ? 2 : 0) + (z < 0 ? 1 : 0),
            );
          }
        }
      } finally {
        raw.dascls(h);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend} preserves the primary radii type error and rejects incomplete near-point radii before reuse`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of files) raw.furnsh(fixture(f));
      const h = raw.dasopr(files[3]!);
      try {
        const first = raw.dlabfs(h);
        if (!first.found) throw new Error("Missing segment");
        const call = () =>
          raw.subsol_pl02(
            h,
            first.descr,
            "Ellipsoid near point",
            "100101",
            0,
            "NONE",
            "100102",
          );
        const original = call();
        raw.pdpool("BODY100101_RADII", [3, 2]);
        expect(() => call()).toThrow(/INVALIDCOUNT/);
        raw.pdpool("BODY100101_RADII", [3, 2, 1]);
        expect(call()).toEqual(original);
        raw.pcpool("BODY100101_RADII", ["invalid"]);
        expect(() => call()).toThrow(/TYPEMISMATCH/);
        raw.pdpool("BODY100101_RADII", [3, 2, 1]);
        expect(call()).toEqual(original);
        expect(raw.failed()).toBe(false);
      } finally {
        raw.dascls(h);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend} identical short corrections retain their meaning after an overlength saved aberration key`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of files) raw.furnsh(fixture(f));
      const h = raw.dasopr(files[3]!);
      try {
        const first = raw.dlabfs(h);
        if (!first.found) throw new Error("Missing segment");
        const measure = (flag: string) =>
          raw.illum_plid_pl02(
            h,
            first.descr,
            "100101",
            11,
            flag,
            "100102",
            [1, 2 / 3, 1 / 3],
            1,
          );
        const geometric = measure("LT"),
          stellar = measure("LT+S");
        expect(Math.abs(stellar.emissn - geometric.emissn)).toBeGreaterThan(
          1e-9,
        );
        expect(measure("LT   +S")).toEqual(stellar);
        expect(measure("LT")).toEqual(geometric);
        const inherited = (flag: string) =>
          raw.spkezr("100101", 11, "J2000", flag, "100102");
        const canonical = inherited("LT+S");
        expect(inherited("      LT+S")).toEqual(canonical);
        expect(() => inherited("     ")).toThrow();
        expect(raw.failed()).toBe(false);
        expect(measure("LT")).toEqual(geometric);
      } finally {
        raw.dascls(h);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  for (const mode of ["toSync", "toAsync"] as const)
    test(`${backend} ${mode} cached legacy calls observe kernel unload and file closure`, async () => {
      const client = await spiceClients
          .caching({ maxEntries: 128 })
          [mode]({ backend }),
        raw = client.spice.raw;
      try {
        for (const f of files) await raw.furnsh(fixture(f));
        const h = await raw.dasopr(files[3]!);
        const first = await raw.dlabfs(h);
        if (!first.found) throw new Error("Missing segment");
        const d = first.descr,
          cut = () =>
            raw.limb_pl02(
              h,
              d,
              "100101",
              0,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              1,
            ),
          grid = () => raw.llgrid_pl02(h, d, [[0.31, 0.21]]);
        try {
          const initial = await cut();
          expect(initial.lmbpts).toHaveLength(1);
          expect((await grid()).pltids).toEqual([1]);
          await raw.unload(files[2]!);
          await expect(async () => cut()).rejects.toThrow(/SPK|ephemeris/i);
          await raw.furnsh(fixture(files[2]!));
          expect(await cut()).toEqual(initial);
        } finally {
          await raw.dascls(h);
        }
        await expect(async () => grid()).rejects.toThrow();
      } finally {
        await raw.kclear();
        await client.dispose();
      }
    });
}
