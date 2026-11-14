import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function locked(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", sidecar, "python", "-c", program],
      { encoding: "utf8", timeout: 20000 },
    ),
  );
}
function tag(x: number) {
  return Number.isNaN(x)
    ? "NaN"
    : x === Infinity
      ? "+Inf"
      : x === -Infinity
        ? "-Inf"
        : Object.is(x, -0)
          ? "-0"
          : x;
}
const level = (p: readonly number[], axes: readonly number[]) =>
  p.reduce((total, x, i) => total + (x / axes[i]!) ** 2, 0);
const dot = (a: readonly number[], b: readonly number[]) =>
  a.reduce((s, x, i) => s + x * b[i]!, 0);
for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    backend +
      " checks nearest altitude and radial versus normal projections on a triaxial body",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const axes = [3, 2, 1] as const,
          pos = [4, -3, 2] as const;
        const { npoint, alt } = spice.raw.nearpt(pos, ...axes);
        const radial = spice.raw.edpnt(pos, ...axes),
          normal = spice.raw.surfnm(...axes, npoint),
          recovered = spice.raw.ednmpt(...axes, normal);
        expect(level(npoint, axes)).toBeCloseTo(1, 13);
        expect(level(radial, axes)).toBeCloseTo(1, 13);
        expect(Math.abs(radial[0] - npoint[0])).toBeGreaterThan(0.1);
        for (let i = 0; i < 3; i++) {
          expect(recovered[i]).toBeCloseTo(npoint[i]!, 13);
          expect(npoint[i]! + alt * normal[i]!).toBeCloseTo(pos[i]!, 13);
        }
        for (const factor of [1e-12, 1e12]) {
          const probe = spice.raw.nearpt(
            [4 * factor, -3 * factor, 2 * factor],
            3 * factor,
            2 * factor,
            factor,
          );
          expect(probe.alt / factor).toBeCloseTo(alt, 12);
          probe.npoint.forEach((x, i) =>
            expect(x / factor).toBeCloseTo(npoint[i]!, 12),
          );
        }
        const inside = spice.raw.nearpt([0, 0, -0.25], ...axes);
        expect(inside).toEqual({ npoint: [0, 0, -1], alt: -0.75 });
      } finally {
        await dispose();
      }
    },
  );
  run(
    backend +
      " checks limb visibility, tangency, line orientation and ray hit ownership",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const axes = [3, 2, 1] as const,
          view = [6, -3, 4] as const;
        const ell = spice.raw.edlimb(...axes, view);
        for (const angle of [0, 0.3, 1.2, Math.PI, -1.4]) {
          const p: [number, number, number] = [0, 0, 0];
          for (let i = 0; i < 3; i++)
            p[i] =
              ell.center[i]! +
              Math.cos(angle) * ell.semiMajor[i]! +
              Math.sin(angle) * ell.semiMinor[i]!;
          expect(level(p, axes)).toBeCloseTo(1, 12);
          const normal = spice.raw.surfnm(...axes, p);
          expect(
            dot(
              normal,
              p.map((v, i) => view[i]! - v),
            ),
          ).toBeCloseTo(0, 12);
        }
        const linePoint = [5, 4, 3] as const,
          direction = [1, -2, 3] as const;
        const { pnear, dist } = spice.raw.npedln(...axes, linePoint, direction);
        const t =
          dot(
            pnear.map((x, i) => x - linePoint[i]!),
            direction,
          ) / dot(direction, direction);
        const difference = pnear.map(
          (x, i) => linePoint[i]! + t * direction[i]! - x,
        );
        expect(level(pnear, axes)).toBeCloseTo(1, 12);
        expect(Math.hypot(...difference)).toBeCloseTo(dist, 12);
        const normal = spice.raw.surfnm(...axes, pnear);
        difference.forEach((v, i) =>
          expect(v).toBeCloseTo(dist * normal[i]!, 12),
        );
        expect(spice.raw.surfpt([5, 2, 0], [-1, 0, 0], ...axes)).toEqual({
          found: true,
          point: [0, 2, 0],
        });
        expect(spice.raw.surfpt([5, 2.000001, 0], [-1, 0, 0], ...axes)).toEqual(
          { found: false },
        );
        const first = spice.raw.edlimb(...axes, view);
        ell.center.fill(0);
        ell.semiMajor.fill(0);
        ell.semiMinor.fill(0);
        expect(spice.raw.edlimb(...axes, view)).toEqual(first);
      } finally {
        await dispose();
      }
    },
  );
  run(
    backend + " preserves measured extreme IEEE outputs and signed zeros",
    async () => {
      const reference = locked(`
import json,math,sys,spiceypy as sp
def tag(x):
    if math.isnan(x): return "NaN"
    if math.isinf(x): return "-Inf" if x<0 else "+Inf"
    if x==0 and math.copysign(1,x)<0: return "-0"
    return float(x)
m=sys.float_info.max
r=[sp.ednmpt(m,m,m,[1e-100,-2e-100,3e-100]),sp.edpnt([m,-m,1],3,2,1),sp.surfnm(1,1,1,[m,-m,1]),sp.edpnt([6.,-0.,0.],3,2,1),sp.ednmpt(3,2,1,[-1.,0.,0.]),sp.surfnm(3,2,1,[0.,-2.,0.])]
print(json.dumps([[tag(x) for x in row] for row in r]))
`);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const m = Number.MAX_VALUE,
          raw = spice.raw;
        const actual = [
          raw.ednmpt(m, m, m, [1e-100, -2e-100, 3e-100]),
          raw.edpnt([m, -m, 1], 3, 2, 1),
          raw.surfnm(1, 1, 1, [m, -m, 1]),
          raw.edpnt([6, -0, 0], 3, 2, 1),
          raw.ednmpt(3, 2, 1, [-1, 0, 0]),
          raw.surfnm(3, 2, 1, [0, -2, 0]),
        ];
        expect(actual.map((row) => row.map(tag))).toEqual(reference);
      } finally {
        await dispose();
      }
    },
    25000,
  );
  run(
    backend +
      " retains the actual guarded ray diagnostic and caller frame through recovery",
    async () => {
      const reference = locked(`
import json,spiceypy as sp
from py_parity_sidecar.ellipsoid_oracle import surfpt,npedln
sp.chkin("ELLIPSOID_CALLER")
try:
    records=[]
    for f,args in [(surfpt,([5,0,0],[0,0,0],0,0,0)),(npedln,(3,2,1,[0,4,0],[1.7976931348623157e308]*2+[0]))]:
        try: f(*args)
        except sp.utils.exceptions.SpiceyError as e: records.append([e.short,e.long,e.traceback])
    print(json.dumps(records))
finally: sp.chkout("ELLIPSOID_CALLER")
`);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        raw.chkin("ELLIPSOID_CALLER");
        try {
          const records = [];
          for (const call of [
            () => raw.surfpt([5, 0, 0], [0, 0, 0], 0, 0, 0),
            () =>
              raw.npedln(
                3,
                2,
                1,
                [0, 4, 0],
                [Number.MAX_VALUE, Number.MAX_VALUE, 0],
              ),
          ]) {
            let thrown: unknown;
            try {
              call();
            } catch (e) {
              thrown = e;
            }
            if (!(thrown instanceof Error))
              throw new Error("Expected structured CSPICE failure");
            records.push(
              ["spiceShort", "spiceLong", "spiceTrace"].map((k) =>
                Reflect.get(thrown, k),
              ),
            );
            expect(raw.failed()).toBe(false);
          }
          expect(records).toEqual(reference);
          try {
            raw.sigerr("SPICE(E12TEST)");
            throw new Error("Missing trace probe");
          } catch (e) {
            expect(e).toHaveProperty("spiceTrace", "ELLIPSOID_CALLER");
          }
        } finally {
          raw.chkout("ELLIPSOID_CALLER");
        }
        expect(raw.surfpt([5, 0, 0], [-1, 0, 0], 3, 2, 1)).toEqual({
          found: true,
          point: [3, 0, 0],
        });
      } finally {
        await dispose();
      }
    },
    25000,
  );
}
