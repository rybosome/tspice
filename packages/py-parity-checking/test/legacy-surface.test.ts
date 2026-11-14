import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const files = [
  "audit-geometry.tf",
  "audit-geometry.bsp",
  "audit-legacy-frame.tf",
];
const load = (name: string) => ({
  path: name,
  bytes: fs.readFileSync(
    new URL("../fixtures/kernels/" + name, import.meta.url),
  ),
});
const magnitude = (v: readonly number[]) => Math.hypot(...v);
const unit = (v: readonly number[]) => v.map((x) => x / magnitude(v));
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((t, x, i) => t + x * b[i]!, 0);
const angle = (a: readonly number[], b: readonly number[]) =>
  Math.acos(dot(unit(a), unit(b)));
const diff = (a: readonly number[], b: readonly number[]) =>
  a.map((x, i) => x - b[i]!);
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: geometric illumination, radial points and nearest normals match the analytic triaxial surface`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      files.forEach((f) => raw.furnsh(load(f)));
      const obs = [10, 4, 3],
        sun = [100, 50, 20],
        p = [1.8, 1.6, 0] as const;
      const norm = [p[0] / 9, p[1] / 4, 0],
        a = raw.illum("100101", 0, "NONE", "100102", p);
      expect(a.phase).toBeCloseTo(angle(diff(sun, p), diff(obs, p)), 13);
      expect(a.solar).toBeCloseTo(angle(norm, diff(sun, p)), 13);
      expect(a.emissn).toBeCloseTo(angle(norm, diff(obs, p)), 13);
      for (const [isSun, body] of [
        [false, obs],
        [true, sun],
      ] as const) {
        const result = raw.subpt("Intercept", "100101", 0, "NONE", "100102");
        const radial = isSun
          ? raw.subsol("Intercept", "100101", 0, "NONE", "100102")
          : result.spoint;
        const near = isSun
          ? raw.subsol("Near point", "100101", 0, "NONE", "100102")
          : raw.subpt("Near point", "100101", 0, "NONE", "100102").spoint;
        for (const [i, v] of radial.entries())
          expect(v).toBeCloseTo(
            body[i]! / Math.hypot(body[0]! / 3, body[1]! / 2, body[2]!),
            13,
          );
        const gradient = unit([near[0] / 9, near[1] / 4, near[2]]),
          motion = unit(diff(body, near));
        for (const [i, v] of gradient.entries())
          expect(v).toBeCloseTo(motion[i]!, 12);
        if (!isSun)
          expect(result.alt).toBeCloseTo(magnitude(diff(body, radial)), 13);
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: surface and center epochs differ, while misses and scalar results preserve owned fields`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      files.forEach((f) => raw.furnsh(load(f)));
      const hit = raw.srfxpt(
        "ELLIPSOID",
        "100101",
        0,
        "LT",
        "100104",
        "J2000",
        [-1, 0, 0],
      );
      expect(hit.found).toBe(true);
      if (!hit.found) throw new Error("Expected x-axis intercept");
      expect(hit.spoint).toEqual([3, 0, 0]);
      expect(hit.dist).toBe(17);
      expect(hit.obspos[0]).toBe(20);
      expect(Math.abs(hit.obspos[1])).toBe(0);
      expect(Math.abs(hit.obspos[2])).toBe(0);
      expect(hit.trgepc).toBeCloseTo(-17 / 299792.458, 15);
      expect(
        raw.srfxpt(
          "ELLIPSOID",
          "100101",
          0,
          "LT",
          "100104",
          "J2000",
          [1, 0, 0],
        ),
      ).toEqual({ found: false });
      const t = raw.edterm(
        "PENUMBRAL",
        "100103",
        "100101",
        0,
        "AUDIT_GEOMETRY_FIXED",
        "LT",
        "100104",
        7,
      );
      expect(t.trgepc).toBeCloseTo(-20 / 299792.458, 15);
      expect(t.obspos[0]).toBe(20);
      expect(Math.abs(t.obspos[1])).toBe(0);
      expect(Math.abs(t.obspos[2])).toBe(0);
      expect(t.trmpts).toHaveLength(7);
      const v = t.trmpts[0]![0];
      t.trmpts[0]![0] = 999;
      hit.spoint[0] = 999;
      expect(
        raw.edterm(
          "PENUMBRAL",
          "100103",
          "100101",
          0,
          "AUDIT_GEOMETRY_FIXED",
          "LT",
          "100104",
          7,
        ).trmpts[0]![0],
      ).toBe(v);
      expect(() =>
        raw.subpt("Intercept", "100101", 20000, "LT", "100104"),
      ).toThrow(/SPKINSUFFDATA/);
      expect(raw.failed()).toBe(false);
      expect(
        raw.subpt("Intercept", "100101", 0, "NONE", "100104").spoint,
      ).toEqual([3, 0, 0]);
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  test(`${backend}: both ordered EDTERM boundaries touch the finite source sphere on opposite sides`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      files.forEach((f) => raw.furnsh(load(f)));
      for (const type of ["UMBRAL", "PENUMBRAL"]) {
        const set = raw.edterm(
          type,
          "100103",
          "100101",
          11,
          "AUDIT_GEOMETRY_FIXED",
          "NONE",
          "100102",
          9,
        );
        expect(set.trmpts.length).toBe(9);
        expect(set.trgepc).toBe(11);
        for (const p of set.trmpts) {
          expect(Math.hypot(p[0] / 3, p[1] / 2, p[2])).toBeCloseTo(1, 13);
          const normal = unit([p[0] / 9, p[1] / 4, p[2]]);
          expect(dot(normal, diff([-20, 1.1, 0], p))).toBeCloseTo(
            type === "UMBRAL" ? -1 : 1,
            12,
          );
        }
      }
    } finally {
      raw.kclear();
      await client.dispose();
    }
  });
  for (const mode of ["toAsync", "toSync"] as const)
    test(`${backend} ${mode}: identical calls observe changes in kernel pool and ephemerides`, async () => {
      const client = await spiceClients
          .caching({ maxEntries: 64 })
          [mode]({ backend }),
        raw = client.spice.raw;
      try {
        for (const f of files) await raw.furnsh(load(f));
        const suppliers = [
          () => raw.illum("100101", 0, "NONE", "100102", [3, 0, 0]),
          () =>
            raw.srfxpt(
              "ELLIPSOID",
              "100101",
              0,
              "NONE",
              "100104",
              "J2000",
              [-1, 0, 0],
            ),
          () => raw.subpt("Intercept", "100101", 0, "NONE", "100102"),
          () => raw.subsol("Near point", "100101", 0, "NONE", "100102"),
          () =>
            raw.edterm(
              "UMBRAL",
              "100103",
              "100101",
              0,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              3,
            ),
        ];
        for (const run of suppliers) expect(await run()).toBeDefined();
        await raw.unload("audit-geometry.bsp");
        for (const run of suppliers)
          await expect(async () => run()).rejects.toThrow(/NOLOADEDFILES/);
        await raw.furnsh(load("audit-geometry.bsp"));
        for (const run of suppliers) expect(await run()).toBeDefined();
      } finally {
        await raw.kclear();
        await client.dispose();
      }
    });
}
