import { execFileSync } from "node:child_process";
import path from "node:path";
import { spiceClients } from "@rybosome/tspice";
import { expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function locked(program: string): unknown {
  const project = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", project, "python", "-c", program],
      {
        encoding: "utf8",
        timeout: 20_000,
      },
    ),
  );
}

const extremeOracle = `
import json, math, sys
from py_parity_sidecar import general_matrix_oracle as g

def tag(value):
    if isinstance(value,list):
        return [tag(x) for x in value]
    if math.isnan(value):
        return "NaN"
    if math.isinf(value):
        return "+Inf" if value > 0 else "-Inf"
    if value == 0 and math.copysign(1,value)<0:
        return "-0"
    return value
m=sys.float_info.max
t=2.0**-600
outputs=[
    g.mequg([-0.0,m,t,-m],2,2),
    g.xposeg([-0.0,m,t,-m],2,2),
    g.mtxmg([m,-m,0,0],[2,-2,3,4],2,2,2),
    g.mxmg([m,0,-m,0],[2,-2,3,4],2,2,2),
    g.mxmtg([m,0,-m,0],[2,3,-2,4],2,2,2),
    g.mtxvg([m,-m,0,0],[2,3],2,2),
    g.mxvg([m,0,-m,0],[2,3],2,2),
    g.vtmvg([-2],[m],[1],1,1),
    g.mtxmg([t,3*t,-2*t,t],[3,-1,5,2],2,2,2),
    g.mxmg([t,-2*t,3*t,t],[3,-1,5,2],2,2,2),
    g.mxmtg([t,-2*t,3*t,t],[3,5,-1,2],2,2,2),
    g.mtxvg([t,3*t,-2*t,t],[3,5],2,2),
    g.mxvg([t,-2*t,3*t,t],[3,5],2,2),
    g.vtmvg([2,-1],[t,-2*t,3*t,t],[3,5],2,2),
]
print(json.dumps([tag(x) for x in outputs],allow_nan=False))
`;

function tag(x: number): number | string {
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "+Inf";
  if (x === -Infinity) return "-Inf";
  if (Object.is(x, -0)) return "-0";
  return x;
}

it("checks the canonical MEQUG dimensions against ordinary SpiceyPy and rejects invalid extents before invoking the oracle", () => {
  const result = locked(`
import json, math
import numpy as np
import spiceypy as sp
from py_parity_sidecar import general_matrix_oracle as g
a=[-0.0,1.5,-7,3,8,5]
canonical=np.asarray(g.mequg(a,2,3),dtype=np.float64)
wrapped=sp.mequg(np.asarray(a,dtype=np.float64).reshape(2,3),2,3)
assert wrapped.shape==(2,3) and wrapped.tobytes()==canonical.tobytes()
blocked=0
for call in (
    lambda:g.mequg([], -1, 4), lambda:g.mequg([], 0, 2**31),
    lambda:g.mequg([], 65536,65536), lambda:g.mequg([1,2,3],1,2),
    lambda:g.xposeg([1],-1,1), lambda:g.mxmg([],[],33554433,0,0),
    lambda:g.mxmtg([],[],1,-1,2), lambda:g.mtxvg([],[],-1,1),
    lambda:g.mxvg([1],[math.inf],1,1), lambda:g.vtmvg([],[],[],1,2),
    lambda:g.mtxmg([],[],1.5,0,1),
):
    try: call()
    except ValueError: blocked+=1
    else: raise AssertionError("Invalid shape or value reached the locked toolkit")
print(json.dumps([canonical.size,blocked]))
`);
  expect(result).toEqual([6, 11]);
}, 30_000);

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} preserves each independent tiny or IEEE-special matrix result`,
    async () => {
      const expected = locked(extremeOracle);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const { raw } = spice,
          m = Number.MAX_VALUE,
          t = 2 ** -600;
        const outputs = [
          raw.mequg([-0, m, t, -m], 2, 2),
          raw.xposeg([-0, m, t, -m], 2, 2),
          raw.mtxmg([m, -m, 0, 0], [2, -2, 3, 4], 2, 2, 2),
          raw.mxmg([m, 0, -m, 0], [2, -2, 3, 4], 2, 2, 2),
          raw.mxmtg([m, 0, -m, 0], [2, 3, -2, 4], 2, 2, 2),
          raw.mtxvg([m, -m, 0, 0], [2, 3], 2, 2),
          raw.mxvg([m, 0, -m, 0], [2, 3], 2, 2),
          raw.vtmvg([-2], [m], [1], 1, 1),
          raw.mtxmg([t, 3 * t, -2 * t, t], [3, -1, 5, 2], 2, 2, 2),
          raw.mxmg([t, -2 * t, 3 * t, t], [3, -1, 5, 2], 2, 2, 2),
          raw.mxmtg([t, -2 * t, 3 * t, t], [3, 5, -1, 2], 2, 2, 2),
          raw.mtxvg([t, 3 * t, -2 * t, t], [3, 5], 2, 2),
          raw.mxvg([t, -2 * t, 3 * t, t], [3, 5], 2, 2),
          raw.vtmvg([2, -1], [t, -2 * t, 3 * t, t], [3, 5], 2, 2),
        ];
        expect(
          outputs.map((result) =>
            typeof result === "number" ? tag(result) : result.map(tag),
          ),
        ).toEqual(expected);
        expect(outputs[2]).toEqual([Infinity, -Infinity, -Infinity, Infinity]);
        expect(outputs[9]).toEqual([-7 * t, -5 * t, 14 * t, -t]);
        expect(outputs[13]).toBe(-28 * t);
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
    30_000,
  );

  run(
    `${backend} preserves row-major ownership and rectangular transpose/product identities`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const { raw } = spice;
        const a = [3, -5, 11, 7, 2, -17],
          b = [2, -1, 4, 3, 5, 6];
        const copied = raw.mequg(a, 2, 3),
          at = raw.xposeg(a, 2, 3),
          bt = raw.xposeg(b, 3, 2);
        expect(at).toEqual([3, 7, -5, 2, 11, -17]);
        expect(raw.xposeg(at, 3, 2)).toEqual(a);
        const ab = raw.mxmg(a, b, 2, 3, 2);
        expect(ab).toEqual([41, 48, -63, -103]);
        expect(raw.mtxmg(at, b, 2, 3, 2)).toEqual(ab);
        expect(raw.mxmtg(a, bt, 2, 3, 2)).toEqual(ab);
        expect(raw.xposeg(ab, 2, 2)).toEqual(raw.mxmg(bt, at, 2, 3, 2));
        const x = [-2, 3, 5],
          y = [7, -3],
          ax = raw.mxvg(a, x, 2, 3);
        expect(ax).toEqual([34, -93]);
        expect(raw.mtxvg(at, x, 2, 3)).toEqual(ax);
        expect(raw.vtmvg(y, a, x, 2, 3)).toBe(517);
        a.fill(99);
        expect(copied).toEqual([3, -5, 11, 7, 2, -17]);
        copied[0] = 83;
        expect(at[0]).toBe(3);
        expect(ab).toEqual([41, 48, -63, -103]);
      } finally {
        await dispose();
      }
    },
  );

  run(
    `${backend} rejects invalid shapes and nonfinite operands without poisoning a later multiplication`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const { raw } = spice;
        for (const call of [
          () => raw.mequg([], -1, 4),
          () => raw.mequg([], 0, 2 ** 31),
          () => raw.mequg([], 65536, 65536),
          () => raw.mequg([1, 2, 3], 1, 2),
          () => raw.xposeg([1], -1, 1),
          () => raw.mxmg([], [], 33554433, 0, 0),
          () => raw.mxmtg([], [], 1, -1, 2),
          () => raw.mtxvg([], [], -1, 1),
          () => raw.mxvg([1], [Infinity], 1, 1),
          () => raw.vtmvg([], [], [], 1, 2),
          () => raw.mtxmg([], [], 1.5, 0, 1),
        ])
          expect(call).toThrow();
        expect(raw.failed()).toBe(false);
        expect(raw.mxmg([2, -3], [11, 7], 1, 2, 1)).toEqual([1]);
      } finally {
        await dispose();
      }
    },
  );
}
