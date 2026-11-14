import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const kernel = (name: string) => ({
  path: name,
  bytes: fs.readFileSync(
    new URL("../fixtures/kernels/" + name, import.meta.url),
  ),
});
const sky = [
    "audit-ephemeris.bsp",
    "audit-ephemeris-observer.bsp",
    "relative-observers.tf",
  ],
  terrain = ["audit-geometry.bsp", "audit-geometry.tf"];
const pos = [321.5, -224.25, 111.375] as const,
  sta = [...pos, 0.375, -0.25, 0.1875] as const,
  site = [3.2, 1.7, -0.75] as const;
const t = 125.25;
function close(a: number, b: number, e: number) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(e);
}
function vector(a: readonly number[], b: readonly number[], e: number) {
  expect(a).toHaveLength(b.length);
  for (const [i, x] of b.entries()) close(a[i]!, x, e);
}
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    backend +
      " distinguishes three frame epochs and verifies six-component velocities by differentiating corrected positions",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        for (const f of sky) raw.furnsh(kernel(f));
        const fixed = (f: string, et: number) =>
          raw.spkcpo(
            "100001",
            et,
            "RELATIVE_SPIN",
            f,
            "CN+S",
            pos,
            "0",
            "J2000",
          );
        const states = ["OBSERVER", "TARGET", "CENTER"].map(
          (f) => fixed(f, t).state,
        );
        for (const [a, b] of [
          [0, 1],
          [1, 2],
          [0, 2],
        ] as const)
          expect(Math.abs(states[a]![0] - states[b]![0])).toBeGreaterThan(0.03);
        for (const f of ["OBSERVER", "TARGET", "CENTER"]) {
          for (const calc of [
            fixed,
            (l: string, et: number) =>
              raw.spkcpt(
                pos,
                "0",
                "J2000",
                et,
                "RELATIVE_SPIN",
                l,
                "CN+S",
                "100001",
              ),
            (l: string, et: number) =>
              raw.spkcvo(
                "100001",
                et,
                "RELATIVE_SPIN",
                l,
                "XCN+S",
                sta,
                -211.5,
                "0",
                "J2000",
              ),
            (l: string, et: number) =>
              raw.spkcvt(
                sta,
                -211.5,
                "0",
                "J2000",
                et,
                "RELATIVE_SPIN",
                l,
                "XCN+S",
                "100001",
              ),
          ]) {
            const h = 0.02,
              a = calc(f, t - h),
              b = calc(f, t + h),
              center = calc(f, t);
            for (let i = 0; i < 3; i++)
              close(
                center.state[i + 3]!,
                (b.state[i]! - a.state[i]!) / (2 * h),
                8e-8,
              );
          }
        }
        const inherited = (f: string) =>
          raw.spkezr("100001", t, "J2000", f, "100002");
        const point = (f: string) =>
          raw.spkcvo(
            "100001",
            t,
            "RELATIVE_SPIN",
            "TARGET",
            f,
            sta,
            -211.5,
            "0",
            "J2000",
          );
        const plain = point("LT"),
          stellar = point("LT+S");
        expect(Math.abs(stellar.state[0] - plain.state[0])).toBeGreaterThan(
          1e-7,
        );
        const mixed = inherited("LT   +S");
        expect(point("LT")).toEqual(plain);
        expect(point("l t   + s")).toEqual(stellar);
        expect(inherited("      LT+S")).toEqual(mixed);
        expect(() => inherited("     ")).toThrow(/INVALIDOPTION/);
        expect(point("LT")).toEqual(plain);
        for (const sign of ["CN+S", "XCN+S"]) {
          const origin = [...pos, 0, 0, 0] as const;
          expect(
            raw.spkcpo(
              "100001",
              t,
              "RELATIVE_SPIN",
              "CENTER",
              sign,
              pos,
              "0",
              "J2000",
            ),
          ).toEqual(
            raw.spkcvo(
              "100001",
              t,
              "RELATIVE_SPIN",
              "CENTER",
              sign,
              origin,
              55,
              "0",
              "J2000",
            ),
          );
          expect(
            raw.spkcpt(
              pos,
              "0",
              "J2000",
              t,
              "RELATIVE_SPIN",
              "CENTER",
              sign,
              "100001",
            ),
          ).toEqual(
            raw.spkcvt(
              origin,
              55,
              "0",
              "J2000",
              t,
              "RELATIVE_SPIN",
              "CENTER",
              sign,
              "100001",
            ),
          );
        }
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " extrapolates the supplied state about its own epoch before applying a rotating source-frame transform",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        for (const f of sky) raw.furnsh(kernel(f));
        const pointEpoch = -211.5,
          dt = t - pointEpoch,
          extrapolated = [
            sta[0] + dt * sta[3],
            sta[1] + dt * sta[4],
            sta[2] + dt * sta[5],
            ...sta.slice(3),
          ];
        const matrix = raw.sxform("RELATIVE_SPIN", "J2000", t),
          transformed = Array.from({ length: 6 }, (_, i) =>
            extrapolated.reduce((a, x, j) => a + matrix[6 * i + j]! * x, 0),
          );
        const bodies = raw.spkgeo(100001, t, "J2000", 100002).state,
          expected = bodies.map((x, i) => x - transformed[i]!);
        vector(
          raw.spkcvo(
            "100001",
            t,
            "J2000",
            "CENTER",
            "NONE",
            sta,
            pointEpoch,
            "100002",
            "RELATIVE_SPIN",
          ).state,
          expected,
          2e-11,
        );
        vector(
          raw.spkcvt(
            sta,
            pointEpoch,
            "100002",
            "RELATIVE_SPIN",
            t,
            "J2000",
            "CENTER",
            "NONE",
            "100001",
          ).state,
          expected.map((x) => -x),
          2e-11,
        );
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " verifies local ellipsoid range/angular rates, sign conventions, undefined zenith and caller trace recovery",
    async () => {
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      try {
        for (const f of terrain) raw.furnsh(kernel(f));
        for (const azccw of [true, false])
          for (const elplsz of [true, false]) {
            const calc = (et: number) =>
              raw.azlcpo(
                "ELLIPSOID",
                "100102",
                et,
                "CN+S",
                azccw,
                elplsz,
                site,
                "100101",
                "AUDIT_GEOMETRY_FIXED",
              );
            const h = 0.05,
              a = calc(21.5 - h),
              b = calc(21.5 + h),
              center = calc(21.5);
            for (let i = 0; i < 3; i++)
              close(
                center.state[i + 3]!,
                (b.state[i]! - a.state[i]!) / (2 * h),
                3e-10,
              );
          }
        raw.chkin("RELATIVE_CALLER");
        try {
          expect(() =>
            raw.azlcpo(
              "ELLIPSOID",
              "100104",
              0,
              "NONE",
              true,
              true,
              [3, 0, 0],
              "100101",
              "AUDIT_GEOMETRY_FIXED",
            ),
          ).toThrow(/POINTONZAXIS/);
          let err: unknown;
          try {
            raw.spkcvo(
              "0",
              0,
              "J2000",
              "OBSERVER",
              "CN+S",
              [-1, 0, 0, 0, 299792.458, 0],
              0,
              "0",
              "J2000",
            );
          } catch (error) {
            err = error;
          }
          expect(err).toMatchObject({
            spiceShort: "SPICE(DIVIDEBYZERO)",
            spiceTrace: expect.stringMatching(
              /RELATIVE_CALLER.*spkcvo_c.*SPKCVO.*ZZSPKFZO.*ZZSPKFAO.*SPKAPS.*ZZSTELAB/,
            ),
          });
          expect(raw.failed()).toBe(false);
        } finally {
          raw.chkout("RELATIVE_CALLER");
        }
        expect(
          raw.azlcpo(
            "ELLIPSOID",
            "100102",
            21.5,
            "NONE",
            true,
            true,
            site,
            "100101",
            "AUDIT_GEOMETRY_FIXED",
          ).state,
        ).toHaveLength(6);
      } finally {
        raw.kclear();
        await setup.dispose();
      }
    },
  );
  run(
    backend +
      " retains geometric range overflow and nonfinite extrapolated states from finite inputs",
    async () => {
      const project = fileURLToPath(
        new URL("../sidecars/spiceypy/", import.meta.url),
      );
      const program = `
import json, math, sys, spiceypy as sp
def tag(v):
    return "NaN" if math.isnan(v) else ("+Inf" if v>0 else "-Inf") if math.isinf(v) else v
rows=[]
for m in (sys.float_info.max,128.):
    pos=[m,m,0]
    state=[m,m,0,m,m,0]
    results=[sp.spkcpo("0",0.,"J2000","CENTER","NONE",pos,"0","J2000"),sp.spkcpt(pos,"0","J2000",0.,"J2000","CENTER","NONE","0"),sp.spkcvo("0",1.,"J2000","CENTER","NONE",state,-1.,"0","J2000"),sp.spkcvt(state,-1.,"0","J2000",1.,"J2000","CENTER","NONE","0")]
    rows.extend([[tag(x) for x in [*v,lt]] for v,lt in results])
assert not sp.failed()
print(json.dumps(rows,allow_nan=False))
`;
      const expected: unknown = JSON.parse(
        execFileSync(
          "uv",
          ["run", "--locked", "--project", project, "python", "-c", program],
          { encoding: "utf8", timeout: 30000 },
        ),
      );
      const setup = await spiceClients.toSync({ backend }),
        raw = setup.spice.raw;
      const tag = (x: number) =>
        Number.isNaN(x)
          ? "NaN"
          : Number.isFinite(x)
            ? x
            : x > 0
              ? "+Inf"
              : "-Inf";
      try {
        const actual = [];
        for (const m of [Number.MAX_VALUE, 128]) {
          const p = [m, m, 0] as const,
            s = [m, m, 0, m, m, 0] as const;
          for (const result of [
            raw.spkcpo("0", 0, "J2000", "CENTER", "NONE", p, "0", "J2000"),
            raw.spkcpt(p, "0", "J2000", 0, "J2000", "CENTER", "NONE", "0"),
            raw.spkcvo("0", 1, "J2000", "CENTER", "NONE", s, -1, "0", "J2000"),
            raw.spkcvt(s, -1, "0", "J2000", 1, "J2000", "CENTER", "NONE", "0"),
          ])
            actual.push([...result.state, result.lt].map(tag));
        }
        expect(actual).toEqual(expected);
      } finally {
        await setup.dispose();
      }
    },
  );
  for (const mode of ["sync", "async"] as const)
    run(
      backend +
        " " +
        mode +
        " cached calls respond to overlapping SPKs and radius replacement",
      async () => {
        const builder = spiceClients.caching({ maxEntries: 64, ttlMs: null }),
          setup =
            mode === "sync"
              ? await builder.toSync({ backend })
              : await builder.toAsync({ backend }),
          raw = setup.spice.raw;
        try {
          for (const f of [...sky, ...terrain]) await raw.furnsh(kernel(f));
          const calc = async () => [
            (
              await raw.spkcpo(
                "100001",
                t,
                "J2000",
                "CENTER",
                "LT",
                pos,
                "0",
                "J2000",
              )
            ).state[0],
            (
              await raw.spkcpt(
                pos,
                "0",
                "J2000",
                t,
                "J2000",
                "TARGET",
                "LT",
                "100001",
              )
            ).state[0],
            (
              await raw.spkcvo(
                "100001",
                t,
                "J2000",
                "OBSERVER",
                "CN+S",
                sta,
                0,
                "0",
                "J2000",
              )
            ).state[0],
            (
              await raw.spkcvt(
                sta,
                0,
                "0",
                "J2000",
                t,
                "J2000",
                "OBSERVER",
                "CN+S",
                "100001",
              )
            ).state[0],
            (
              await raw.azlcpo(
                "ELLIPSOID",
                "100102",
                21.5,
                "NONE",
                true,
                true,
                site,
                "100101",
                "AUDIT_GEOMETRY_FIXED",
              )
            ).state[2],
          ];
          const a = await calc();
          await raw.furnsh(kernel("audit-ephemeris-priority.bsp"));
          await raw.pdpool("BODY100101_RADII", [3, 3, 3]);
          const b = await calc();
          for (let i = 0; i < 5; i++)
            expect(Math.abs(a[i]! - b[i]!)).toBeGreaterThan(
              i === 4 ? 0.01 : 90000,
            );
          await raw.unload("audit-ephemeris-priority.bsp");
          await raw.pdpool("BODY100101_RADII", [3, 2, 1]);
          expect(await calc()).toEqual(a);
        } finally {
          await raw.kclear();
          await setup.dispose();
        }
      },
    );
}
