import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { isBrandedMat3RowMajor } from "@rybosome/tspice-core";
import type { Spice } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

// Use the coordinate transformations themselves as an independent derivative
// check. Sample away from branch cuts, poles, and singular surfaces. The
// straight comparison against actual Jacobians is covered by the registry.
const program = `
import json, math, sys
import numpy as np
import spiceypy as sp
s=[.62,-.38,1.7]
f=.125
re=3.
charts=[
 ('azimuth',[5.,.62,-.38],lambda t:sp.azlrec(*t,False,True),lambda t:sp.recazl(t,False,True)),
 ('cylindrical',[5.,.62,-.38],lambda t:sp.cylrec(*t),lambda t:sp.reccyl(t)),
 ('geodetic',s,lambda t:sp.georec(*t,re,f),lambda t:sp.recgeo(t,re,f)),
 ('latitudinal',[5.,.62,-.38],lambda t:sp.latrec(*t),lambda t:sp.reclat(t)),
 ('planetographic',s,lambda t:sp.pgrrec('Earth',*t,re,f),lambda t:sp.recpgr('Earth',t,re,f)),
 ('spherical',[5.,.92,.62],lambda t:sp.sphrec(*t),lambda t:sp.recsph(t))]
def diff(fun,point,h):
    cols=[]
    for axis in range(3):
        lo=np.array(point,dtype=float);hi=lo.copy()
        lo[axis]-=h;hi[axis]+=h
        cols.append((np.array(fun(hi))-np.array(fun(lo)))/(2*h))
    return np.array(cols).T
observed=[]
for name,p,forward,reverse in charts:
    xyz=list(forward(p)); mats=[]
    for fun,base in [(forward,p),(reverse,xyz)]:
        coarse=diff(fun,base,4e-5);fine=diff(fun,base,2e-5)
        if not np.allclose(coarse,fine,atol=2e-8,rtol=2e-8):
            raise AssertionError(name+' derivative failed step-size stability')
        mats.append(fine.flatten().tolist())
    observed.append(dict(name=name,p=p,xyz=xyz,forward=mats[0],reverse=mats[1]))
def tag(x):return 'nan' if math.isnan(x) else '+inf' if x==math.inf else '-inf' if x==-math.inf else x
M=sys.float_info.max
extreme=[sp.drdgeo(.62,-.38,M,M,0.),sp.drdpgr('Earth',.62,-.38,M,M,0.),sp.drdgeo(.62,-.38,1.,3.,-M)]
print(json.dumps(dict(charts=observed,extreme=[[tag(x) for x in a.flat] for a in extreme]),allow_nan=False))
`;
const env = {
  cwd: path.resolve(import.meta.dirname, ".."),
  encoding: "utf8",
} as const;
function reference(): {
  charts: {
    name: string;
    p: [number, number, number];
    xyz: [number, number, number];
    forward: number[];
    reverse: number[];
  }[];
  extreme: (number | string)[][];
} {
  return JSON.parse(
    execFileSync(
      "uv",
      [
        "run",
        "--locked",
        "--project",
        "sidecars/spiceypy",
        "python",
        "-c",
        program,
      ],
      env,
    ),
  );
}
function matrices(
  raw: Spice["raw"],
  name: string,
  p: [number, number, number],
  xyz: [number, number, number],
) {
  switch (name) {
    case "azimuth":
      return [
        raw.drdazl(...p, false, true),
        raw.dazldr(...xyz, false, true),
      ] as const;
    case "cylindrical":
      return [raw.drdcyl(...p), raw.dcyldr(...xyz)] as const;
    case "geodetic":
      return [
        raw.drdgeo(...p, 3, 0.125),
        raw.dgeodr(...xyz, 3, 0.125),
      ] as const;
    case "latitudinal":
      return [raw.drdlat(...p), raw.dlatdr(...xyz)] as const;
    case "planetographic":
      return [
        raw.drdpgr("Earth", ...p, 3, 0.125),
        raw.dpgrdr("Earth", ...xyz, 3, 0.125),
      ] as const;
    case "spherical":
      return [raw.drdsph(...p), raw.dsphdr(...xyz)] as const;
    default:
      throw new Error(`Unknown coordinate chart ${name}`);
  }
}
function approx(
  actual: readonly number[],
  expected: readonly number[],
  tol: number,
) {
  expect(actual).toHaveLength(9);
  expect(expected).toHaveLength(9);
  for (let i = 0; i < 9; i++)
    expect(Math.abs(actual[i]! - expected[i]!)).toBeLessThanOrEqual(
      tol * Math.max(1, Math.abs(expected[i]!)),
    );
}
const tag = (x: number) =>
  Number.isNaN(x)
    ? "nan"
    : x === Infinity
      ? "+inf"
      : x === -Infinity
        ? "-inf"
        : x;
for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);
  run(
    `${backend}: all twelve matrices differentiate independent coordinate conversions and compose to identity`,
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        for (const c of reference().charts) {
          const [fwd, rev] = matrices(raw, c.name, c.p, c.xyz);
          expect(isBrandedMat3RowMajor(fwd)).toBe(true);
          expect(isBrandedMat3RowMajor(rev)).toBe(true);
          approx(fwd, c.forward, 2e-8);
          approx(rev, c.reverse, 2e-8);
          for (const product of [raw.mxm(fwd, rev), raw.mxm(rev, fwd)])
            approx(product, [1, 0, 0, 0, 1, 0, 0, 0, 1], 1e-12);
        }
      } finally {
        await dispose();
      }
    },
  );
  run(
    `${backend}: owned Jacobians preserve finite-input IEEE outcomes and reject malformed scalar representations`,
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        const m = Number.MAX_VALUE;
        const results = [
          raw.drdgeo(0.62, -0.38, m, m, 0),
          raw.drdpgr("Earth", 0.62, -0.38, m, m, 0),
          raw.drdgeo(0.62, -0.38, 1, 3, -m),
        ];
        const expected = reference().extreme;
        for (const [i, result] of results.entries()) {
          expect(isBrandedMat3RowMajor(result)).toBe(true);
          const ref = expected[i]!;
          expect(ref).toHaveLength(9);
          expect(ref.some((x) => typeof x === "string")).toBe(true);
          result.forEach((v, j) => {
            const e = ref[j]!;
            if (typeof e === "string") expect(tag(v)).toBe(e);
            else expect(v).toBeCloseTo(e, 12);
          });
        }
        expect(() =>
          Reflect.apply(raw.dazldr, raw, [3, 4, 12, 0, true]),
        ).toThrow(/boolean/);
        expect(() => raw.dlatdr(Infinity, 4, 12)).toThrow(/finite/);
        expect(() => raw.drdpgr("E\0ARTH", 0, 0, 0, 3, 0)).toThrow(/body/);
        expect(() => raw.dgeodr(1, 0, 0, Number.MIN_VALUE, 0)).toThrow(
          /scaling range/,
        );
        expect(() => raw.dpgrdr("Earth", 0, 0, 1, 3, 0)).toThrow(
          /POINTONZAXIS/,
        );
        const good = raw.drdcyl(5, 0.5, -2);
        expect(good[8]).toBe(1);
        expect(raw.drdcyl(5, 0.5, -2)).not.toBe(good);
      } finally {
        await dispose();
      }
    },
  );
  run(
    `${backend}: guarded body mappings and subsequent policy changes preserve the live Jacobian route`,
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        raw.pcpool("NAIF_BODY_NAME", ["JACOBIAN TEST"]);
        raw.pipool("NAIF_BODY_CODE", [-2147483648]);
        expect(() => raw.dpgrdr("JACOBIAN TEST", 3, 4, -2, 3, 0.125)).toThrow(
          /body hash range/,
        );
        expect(() =>
          raw.drdpgr("JACOBIAN TEST", 0.62, -0.38, 1.7, 3, 0.125),
        ).toThrow(/body hash range/);
        raw.pipool("NAIF_BODY_CODE", [9901001]);
        raw.pcpool("BODY9901001_PGR_POSITIVE_LON", ["EAST"]);
        const east = raw.dpgrdr("JACOBIAN TEST", 3, 4, -2, 3, 0.125);
        raw.pcpool("BODY9901001_PGR_POSITIVE_LON", ["WEST"]);
        const west = raw.dpgrdr("JACOBIAN TEST", 3, 4, -2, 3, 0.125);
        approx(
          west,
          east.map((v, i) => (i < 3 ? -v : v)),
          1e-12,
        );
      } finally {
        raw.kclear();
        await dispose();
      }
    },
  );
}
