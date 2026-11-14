import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const lockedProject = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function oracle(source: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", lockedProject, "python", "-c", source],
      { encoding: "utf8", timeout: 20000 },
    ),
  );
}
const v = [0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4] as const,
  p = [1, 3, 2, 1, 2, 4, 1, 4, 3, 2, 3, 4] as const;
const u = [1, 2, 3] as const,
  z = [0, 0, 0] as const;
function tagged(n: number): string | number {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "+Inf";
  if (n === -Infinity) return "-Inf";
  return Object.is(n, -0) ? "-0" : n;
}
function errorFields(action: () => unknown) {
  try {
    action();
  } catch (error) {
    if (typeof error !== "object" || error === null) throw error;
    return [
      Reflect.get(error, "spiceShort"),
      Reflect.get(error, "spiceLong"),
      Reflect.get(error, "spiceTrace"),
    ];
  }
  throw new Error("Expected a SPICE error");
}
for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    backend +
      " checks oriented tetrahedral measures and scale-sensitive normals",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw,
          area = 13 + Math.sqrt(61);
        expect(raw.pltar(v, p)).toBeCloseTo(area, 13);
        expect(raw.pltvol(v, p)).toBe(4);
        for (const factor of [1e-25, 1e25]) {
          const points = v.map((x) => x * factor);
          expect(raw.pltar(points, p) / factor ** 2).toBeCloseTo(area, 12);
          expect(raw.pltvol(points, p) / factor ** 3).toBeCloseTo(4, 13);
          expect(
            raw.pltnrm(z, [2 * factor, 0, 0], [0, 3 * factor, 0])[2] /
              factor ** 2,
          ).toBeCloseTo(6, 13);
        }
        const normal = raw.pltnrm(z, [2, 0, 0], [0, 3, 0]);
        const original = normal.slice();
        normal[2] = 17;
        expect(raw.pltnrm(z, [2, 0, 0], [0, 3, 0])).toEqual(original);
      } finally {
        await dispose();
      }
    },
  );
  run(
    backend +
      " checks expansion center, exact area scaling, nearest edge and boundary orientation",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const original = [2, -1, 4, 5, 2, -3, -1, 2, 1];
        const axes = [0, 1, 2];
        for (const delta of [-2, -1, -0.5, 0, 2]) {
          const out = spice.raw.pltexp(original, delta);
          for (const j of axes)
            expect(out[j]! + out[3 + j]! + out[6 + j]!).toBeCloseTo(
              original[j]! + original[3 + j]! + original[6 + j]!,
              11,
            );
          expect(spice.raw.pltar(out, u)).toBeCloseTo(
            spice.raw.pltar(original, u) * (1 + delta) ** 2,
            11,
          );
          out[0] = 999;
          expect(original[0]).toBe(2);
        }
        for (const factor of [1e-6, 1, 1e6]) {
          const { pnear, dist } = spice.raw.pltnp(
            [3 * factor, 3 * factor, 4 * factor],
            z,
            [4 * factor, 0, 0],
            [0, 4 * factor, 0],
          );
          expect(pnear.map((t) => t / factor)).toEqual([2, 2, 0]);
          expect(dist / factor).toBeCloseTo(Math.sqrt(18), 12);
          pnear[0] = 91;
        }
      } finally {
        await dispose();
      }
    },
  );
  run(
    backend +
      " checks coordinate-specific mesh access, conservative altitude and actual error recovery",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw,
          face = [3, -0.25, 0, 3, 0.25, 0, 3, 0, 0.25];
        expect(
          raw.dskrb2([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 12], u, 1).mncor3,
        ).toBeCloseTo(2 / Math.sqrt(3), 13);
        expect(
          raw.dskrb2([2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 12], u, 1).mxcor3,
        ).toBe(12);
        const b = raw.dskrb2(face, u, 4, [2, 0]);
        expect(b.mncor3).toBeLessThan(1);
        expect(b.mxcor3).toBeCloseTo(Math.hypot(3, 0.25) - 2, 14);
        for (const code of [1, 4])
          expect(() => raw.dskrb2(face, [0, 2, 3], code, [2, 0])).toThrow(
            /one-based/,
          );
        expect(() => raw.dskrb2(face, u, 4, [2])).toThrow(/radius/);
        expect(() => raw.dskrb2(face, u, 4, [Number.MAX_VALUE, -2])).toThrow(
          /polar radius/,
        );
        expect(raw.dskrb2(face, [0, -1, 123], 3)).toEqual({
          mncor3: 0,
          mxcor3: 0.25,
        });
        const ref = oracle(`import json,spiceypy as sp
from py_parity_sidecar import plate_oracle as plate
sp.chkin("PLATE_TEST")
try:
    plate.dskrb2([1e308,0,0,3,1,0,3,0,1],[1,2,3],4,[1,0])
except sp.utils.exceptions.SpiceyError as error:
    print(json.dumps([error.short,error.long,error.traceback]))
finally:
    sp.chkout("PLATE_TEST")`);
        raw.chkin("PLATE_TEST");
        try {
          expect(
            errorFields(() =>
              raw.dskrb2([1e308, 0, 0, 3, 1, 0, 3, 0, 1], u, 4, [1, 0]),
            ),
          ).toEqual(ref);
        } finally {
          raw.chkout("PLATE_TEST");
        }
        expect(raw.failed()).toBe(false);
        expect(raw.pltvol(v, p)).toBe(4);
      } finally {
        await dispose();
      }
    },
  );
  run(
    backend +
      " preserves live nonfinite calculations and small finite controls without JSON coercion",
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const s = spice.raw,
          m = Number.MAX_VALUE;
        const expected =
          oracle(`import json, math, sys, numpy as np, spiceypy as sp
m=sys.float_info.max
def tag(x):
    x=float(x)
    return "NaN" if math.isnan(x) else "+Inf" if x==math.inf else "-Inf" if x==-math.inf else "-0" if x==0 and math.copysign(1,x)<0 else x
def norm(k): return sp.pltnrm([0,0,0],[k,0,0],[0,k,0])
def area(k): return sp.pltar(np.array([[0,0,0],[k,0,0],[0,k,0]],dtype=float),np.array([[1,2,3]],dtype=np.int32))
def volume(k):
    return sp.pltvol(np.array([[0,0,0],[k,0,0],[0,k,0],[0,0,k]],dtype=float),np.array([[1,3,2],[1,2,4],[1,4,3],[2,3,4]],dtype=np.int32))
def expand(k): return sp.pltexp([[k,0,0],[-k,0,0],[0,0,0]],1.).ravel()
print(json.dumps([[tag(x) for x in a] for a in [norm(1e200),norm(1e-145),[area(1e200),area(1e-145)],[volume(1e120),volume(1e-90)],expand(m),expand(1.)]]))`);
        function norm(k: number) {
          return s.pltnrm(z, [k, 0, 0], [0, k, 0]);
        }
        function area(k: number) {
          return s.pltar([0, 0, 0, k, 0, 0, 0, k, 0], u);
        }
        function volume(k: number) {
          return s.pltvol([0, 0, 0, k, 0, 0, 0, k, 0, 0, 0, k], p);
        }
        function expand(k: number) {
          return s.pltexp([k, 0, 0, -k, 0, 0, 0, 0, 0], 1);
        }
        expect(
          [
            norm(1e200),
            norm(1e-145),
            [area(1e200), area(1e-145)],
            [volume(1e120), volume(1e-90)],
            expand(m),
            expand(1),
          ].map((a) => a.map(tagged)),
        ).toEqual(expected);
      } finally {
        await dispose();
      }
    },
  );
}
