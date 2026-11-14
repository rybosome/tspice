import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const target = "100101",
  frame = "AUDIT_GEOMETRY_FIXED";
const geom = ["audit-geometry.tf", "audit-geometry.bsp", "audit-geometry.bds"];
const fixture = (file: string) => ({
  path: file,
  bytes: fs.readFileSync(
    new URL("../fixtures/kernels/" + file, import.meta.url),
  ),
});
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: ellipsoid and plate grids obey the defining radial and normal equations`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of geom) raw.furnsh(fixture(f));
      const rows = [
        [0.31, 0.21],
        [-0.71, 0.15],
        [2.13, -0.49],
      ] as const;
      for (const method of ["ELLIPSOID", "DSK/UNPRIORITIZED"]) {
        const points = raw.latsrf(method, target, 0, frame, rows),
          normals = raw.srfnrm(method, target, 0, frame, points);
        expect(points.length).toBe(rows.length);
        expect(normals.length).toBe(rows.length);
        for (const [i, [lon, lat]] of rows.entries()) {
          const [x, y, z] = points[i]!;
          const [u, v, w] = normals[i]!;
          const direction = [
            Math.cos(lon) * Math.cos(lat),
            Math.sin(lon) * Math.cos(lat),
            Math.sin(lat),
          ];
          const gradient =
            method === "ELLIPSOID"
              ? [x / 9, y / 4, z]
              : [Math.sign(x) / 3, Math.sign(y) / 2, Math.sign(z)];
          expect(
            method === "ELLIPSOID"
              ? Math.hypot(x / 3, y / 2, z)
              : Math.abs(x / 3) + Math.abs(y / 2) + Math.abs(z),
          ).toBeCloseTo(1, 13);
          for (const [j, a] of [x, y, z].entries())
            expect(a / Math.hypot(x, y, z)).toBeCloseTo(direction[j]!, 13);
          for (const [j, a] of [u, v, w].entries())
            expect(a).toBeCloseTo(gradient[j]! / Math.hypot(...gradient), 13);
        }
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: limb and terminator points satisfy ellipsoid tangency with the actual observer and illuminator states`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of geom) raw.furnsh(fixture(f));
      const args = [
        target,
        11,
        frame,
        "NONE",
        "CENTER",
        "100102",
        [0, 0, 1],
        Math.PI / 2,
        4,
        0.03,
        1e-8,
        8,
      ] as const;
      const limb = raw.limbpt("TANGENT/ELLIPSOID", ...args),
        term = raw.termpt("PENUMBRAL/TANGENT/ELLIPSOID", "100103", ...args);
      const obs = [10.11, 3.978, 3.033],
        src = [-20, 1.1, 0];
      for (const [points, epochs, vecs, isLimb] of [
        [limb.points, limb.epochs, limb.tangts, true],
        [term.points, term.epochs, term.trmvcs, false],
      ] as const) {
        expect(points.length).toBe(4);
        expect(epochs).toEqual([11, 11, 11, 11]);
        for (const [i, [x, y, z]] of points.entries()) {
          const normal = [x / 9, y / 4, z],
            point = [x, y, z];
          expect(Math.hypot(x / 3, y / 2, z)).toBeCloseTo(1, 13);
          for (const [j, val] of vecs[i]!.entries())
            expect(val).toBeCloseTo(point[j]! - obs[j]!, 13);
          const relative = (isLimb ? obs : src).map((v, j) => v - point[j]!);
          const projected =
            normal.reduce((sum, v, j) => sum + v * relative[j]!, 0) /
            Math.hypot(...normal);
          expect(Math.abs(projected)).toBeCloseTo(isLimb ? 0 : 1, 12);
        }
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: corrected cumulative LIMBPT capacity signals OUTOFROOM and then returns all six dense results`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const f of [geom[0]!, geom[1]!, "audit-surface-cuts.bds"])
        raw.furnsh(fixture(f));
      const args = [
        "TANGENT/DSK/UNPRIORITIZED/SURFACES=103",
        target,
        0,
        frame,
        "NONE",
        "CENTER",
        "100104",
        [0, 0, 1],
        Math.PI / 2,
        4,
        0.005,
        1e-9,
      ] as const;
      expect(() => raw.limbpt(...args, 4)).toThrow(/OUTOFROOM/);
      expect(raw.failed()).toBe(false);
      const result = raw.limbpt(...args, 6);
      expect(result.npts).toEqual([3, 1, 1, 1]);
      expect(result.epochs).toEqual([0, 0, 0, 0, 0, 0]);
      expect(result.points).toHaveLength(6);
      expect(result.tangts).toHaveLength(6);
      const p = result.points[0]!,
        q = result.tangts[0]!;
      expect(q[0]).toBeCloseTo(p[0] - 20, 12);
      const x = p[0];
      p[0] = 999;
      expect(raw.limbpt(...args, 6).points[0]![0]).toBe(x);
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  for (const mode of ["toSync", "toAsync"] as const)
    test(`${backend} ${mode}: cached surface calls reread kernels for identical arguments`, async () => {
      const client = await spiceClients
          .caching({ maxEntries: 128 })
          [mode]({ backend }),
        raw = client.spice.raw;
      try {
        for (const f of geom) await raw.furnsh(fixture(f));
        const method = "DSK/UNPRIORITIZED",
          ref = [0.31, 0.21] as const;
        const grid = () => raw.latsrf(method, target, 0, frame, [ref]);
        const first = await grid();
        const norm = () => raw.srfnrm(method, target, 0, frame, first);
        expect(await norm()).toHaveLength(1);
        const args = [
          target,
          0,
          frame,
          "NONE",
          "CENTER",
          "100102",
          [0, 0, 1],
          1,
          1,
          0.03,
          1e-8,
          2,
        ] as const;
        const limb = () => raw.limbpt("TANGENT/ELLIPSOID", ...args);
        const term = () =>
          raw.termpt("UMBRAL/TANGENT/ELLIPSOID", "100103", ...args);
        expect((await limb()).npts).toEqual([1]);
        expect((await term()).npts).toEqual([1]);
        await raw.unload("audit-geometry.bsp");
        await expect(async () => limb()).rejects.toThrow(/SPK|ephemeris/i);
        await expect(async () => term()).rejects.toThrow(/SPK|ephemeris/i);
        await raw.unload("audit-geometry.bds");
        await expect(async () => norm()).rejects.toThrow(/NOLOADEDDSKFILES/);
        await raw.furnsh(fixture("audit-dsk-ray-outer.bds"));
        const changed = await grid();
        for (const [j, v] of first[0]!.entries())
          expect(changed[0]![j]).toBeCloseTo(v * 2, 13);
      } finally {
        await raw.kclear();
        await client.dispose();
      }
    });
}
