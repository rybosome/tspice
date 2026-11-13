import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
type V = [number, number, number];
const axes: V = [3, 2, 1];
const minus = (a: readonly number[], b: readonly number[]): V => [
  a[0]! - b[0]!,
  a[1]! - b[1]!,
  a[2]! - b[2]!,
];
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((s, v, i) => s + v * b[i]!, 0);
const angle = (a: readonly number[], b: readonly number[]) =>
  Math.acos(
    Math.max(
      -1,
      Math.min(1, dot(a, b) / (Math.hypot(...a) * Math.hypot(...b))),
    ),
  );
function vector(a: readonly number[], b: readonly number[]) {
  expect(a).toHaveLength(b.length);
  for (let i = 0; i < b.length; i++)
    expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(1e-11);
}
function nearest(p: V): V {
  let lo = 0,
    hi = Math.hypot(...p) * 3;
  for (let i = 0; i < 100; i++) {
    const m = (lo + hi) / 2;
    const f = p.reduce(
      (s, v, j) => s + ((axes[j]! * v) / (m + axes[j]! ** 2)) ** 2,
      0,
    );
    if (f > 1) lo = m;
    else hi = m;
  }
  const m = (lo + hi) / 2;
  return [0, 1, 2].map(
    (i) => (axes[i]! ** 2 * p[i]!) / (m + axes[i]! ** 2),
  ) as V;
}
function octahedron(origin: V, direction: V): V {
  const hits: { t: number; p: V }[] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const n: V = [x / 3, y / 2, z],
          den = dot(n, direction);
        if (den === 0) continue;
        const t = (1 - dot(n, origin)) / den,
          p: V = [
            origin[0] + t * direction[0],
            origin[1] + t * direction[1],
            origin[2] + t * direction[2],
          ];
        if (
          t >= 0 &&
          Math.abs(p[0]) / 3 + Math.abs(p[1]) / 2 + Math.abs(p[2]) <= 1 + 1e-12
        )
          hits.push({ t, p });
      }
  hits.sort((a, b) => a.t - b.t);
  if (!hits[0]) throw Error("No analytic octahedron intercept");
  return hits[0].p;
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  async function create() {
    const setup = await spiceClients.toSync({ backend });
    for (const name of [
      "audit-geometry.tf",
      "audit-geometry.bsp",
      "audit-geometry.bds",
    ])
      setup.spice.raw.furnsh({
        path: name,
        bytes: fs.readFileSync(
          new URL(`../fixtures/kernels/${name}`, import.meta.url),
        ),
      });
    return setup;
  }
  run(
    `${backend}: full ellipsoid and plate surface points against independent formulas`,
    async () => {
      const setup = await create(),
        { raw } = setup.spice;
      try {
        for (const t of [0, 17.25]) {
          const observer: V = [10 + 0.01 * t, 4 - 0.002 * t, 3 + 0.003 * t],
            sun: V = [100 + 0.001 * t, 50 + 0.002 * t, 20 - 0.001 * t];
          for (const [name, source] of [
            ["subpnt", observer],
            ["subslr", sun],
          ] as const) {
            const near = nearest([...source]),
              scale =
                1 /
                Math.sqrt(
                  source.reduce((s, v, i) => s + (v / axes[i]!) ** 2, 0),
                ),
              intercept: V = [
                source[0] * scale,
                source[1] * scale,
                source[2] * scale,
              ];
            for (const [method, p] of [
              ["NEAR POINT/ELLIPSOID", near],
              ["INTERCEPT/ELLIPSOID", intercept],
              [
                "INTERCEPT/DSK/UNPRIORITIZED",
                octahedron([...source], source.map((v) => -v) as V),
              ],
              [
                "NADIR/DSK/UNPRIORITIZED",
                octahedron([...source], minus(near, source)),
              ],
            ] as const) {
              const result = raw[name](
                method,
                "100101",
                t,
                "AUDIT_GEOMETRY_FIXED",
                "NONE",
                "100102",
              );
              vector(result.spoint, p);
              expect(result.trgepc).toBe(t);
              vector(result.srfvec, minus(p, observer));
            }
          }
          for (const method of ["ELLIPSOID", "DSK/UNPRIORITIZED"]) {
            const result = raw.sincpt(
              method,
              "100101",
              t,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              "J2000",
              observer.map((v) => -v) as V,
            );
            if (!result.found) throw Error("Missing actual intercept");
            const k =
              1 /
              Math.sqrt(
                observer.reduce((s, v, i) => s + (v / axes[i]!) ** 2, 0),
              );
            const expected: V =
              method === "ELLIPSOID"
                ? [observer[0] * k, observer[1] * k, observer[2] * k]
                : octahedron(observer, observer.map((v) => -v) as V);
            vector(result.spoint, expected);
            expect(result.trgepc).toBe(t);
            vector(result.srfvec, minus(expected, observer));
            expect(
              raw.sincpt(
                method,
                "100101",
                t,
                "AUDIT_GEOMETRY_FIXED",
                "NONE",
                "100102",
                "J2000",
                observer,
              ),
            ).toEqual({ found: false });
          }
        }
      } finally {
        await setup.dispose();
      }
    },
  );
  run(
    `${backend}: angles, every flag combination, canonical planes and seven occultation codes`,
    async () => {
      const setup = await create(),
        { raw } = setup.spice;
      try {
        const t = 17.25,
          observer: V = [10 + 0.01 * t, 4 - 0.002 * t, 3 + 0.003 * t],
          sun: V = [100 + 0.001 * t, 50 + 0.002 * t, 20 - 0.001 * t];
        for (const [method, p, n] of [
          ["ELLIPSOID", [3, 0, 0], [1, 0, 0]],
          ["DSK/UNPRIORITIZED", [1, 2 / 3, 1 / 3], [1 / 3, 1 / 2, 1]],
        ] as const) {
          const obs = minus(observer, p),
            light = minus(sun, p);
          for (const result of [
            raw.ilumin(
              method,
              "100101",
              t,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              [...p],
            ),
            raw.illumg(
              method,
              "100101",
              "SUN",
              t,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              [...p],
            ),
            raw.illumf(
              method,
              "100101",
              "SUN",
              t,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              [...p],
            ),
          ]) {
            expect(result.trgepc).toBe(t);
            vector(result.srfvec, minus(p, observer));
            expect(Math.abs(result.phase - angle(obs, light))).toBeLessThan(
              1e-12,
            );
            expect(Math.abs(result.incdnc - angle(n, light))).toBeLessThan(
              1e-12,
            );
            expect(Math.abs(result.emissn - angle(n, obs))).toBeLessThan(1e-12);
          }
        }
        for (const x of [3, -3])
          for (const source of ["SUN", "100106"]) {
            const result = raw.illumf(
              "ELLIPSOID",
              "100101",
              source,
              t,
              "AUDIT_GEOMETRY_FIXED",
              "NONE",
              "100102",
              [x, 0, 0],
            );
            expect(result.visibl).toBe(x > 0);
            expect(result.lit).toBe(x > 0 === (source === "SUN"));
          }
        const plane = raw.nvc2pl([-3, -4, 0], -10);
        vector(plane, [0.6, 0.8, 0, 2]);
        const decoded = raw.pl2nvc(plane);
        vector(decoded.normal, [0.6, 0.8, 0]);
        expect(decoded.konst).toBe(2);
        for (const [epoch, large, swap, code] of [
          [0, false, false, 3],
          [40, false, false, 1],
          [80, false, false, 0],
          [0, true, false, 2],
          [0, false, true, -3],
          [40, false, true, -1],
          [0, true, true, -2],
        ] as const) {
          const other = large ? "100105" : "100103",
            frame = large ? "AUDIT_OCCULT_LARGE" : "AUDIT_OCCULT_SMALL";
          expect(
            raw.occult(
              swap ? other : "100101",
              "ELLIPSOID",
              swap ? frame : "AUDIT_GEOMETRY_FIXED",
              swap ? "100101" : other,
              "ELLIPSOID",
              swap ? "AUDIT_GEOMETRY_FIXED" : frame,
              "NONE",
              "100104",
              epoch,
            ),
          ).toBe(code);
        }
        const contact = 800 / Math.sqrt(391);
        for (const [delta, mode, code] of [
          [-0.00005, "NONE", 3],
          [-0.00005, "XLT", 0],
          [-0.00005, "XCN", 0],
          [0.00005, "NONE", 0],
          [0.00005, "LT", 3],
          [0.00005, "CN", 3],
        ] as const)
          expect(
            raw.occult(
              "100101",
              "ELLIPSOID",
              "AUDIT_GEOMETRY_FIXED",
              "100103",
              "POINT",
              "IGNORED",
              mode,
              "100104",
              contact + delta,
            ),
          ).toBe(code);
      } finally {
        await setup.dispose();
      }
    },
  );
}
