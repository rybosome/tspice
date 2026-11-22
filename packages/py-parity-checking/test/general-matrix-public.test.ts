import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

// JSON would convert infinite and NaN outputs to null and both signs of zero
// to the same value. Keep each component observable on this test-only wire.
const oracleProgram = `
import json, math, sys
import spiceypy as sp

maximum = sys.float_info.max
a = [[maximum, -maximum], [1., -0.]]
column = [[2.], [0.]]
def encode(x):
    x = float(x)
    if math.isnan(x): return "NaN"
    if math.isinf(x): return "+Infinity" if x > 0 else "-Infinity"
    if x == 0 and math.copysign(1., x) < 0: return "-0"
    return x
rows = [
    sp.mequg(a, 2, 2), sp.xposeg(a),
    sp.mxmg(a, column), sp.mtxmg(a, column),
    sp.mxmtg(a, [[2., 0.]]),
    sp.mxvg(a, [0., 2.]), sp.mtxvg(a, [2., 0.]),
    [sp.vtmvg([2.], [[maximum]], [0.])],
    [sp.vtmvg([2.], [[maximum / 4]], [0.])],
]
def flat(v):
    if hasattr(v, "flatten"): return v.flatten().tolist()
    return v
print(json.dumps([[encode(x) for x in flat(row)] for row in rows], allow_nan=False))
assert not sp.failed()
`;

function encode(value: number): number | string {
  if (Number.isNaN(value)) return "NaN";
  if (value === Infinity) return "+Infinity";
  if (value === -Infinity) return "-Infinity";
  if (Object.is(value, -0)) return "-0";
  return value;
}

for (const backend of ["wasm", "node"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend}: keeps signed zero and every component of finite-input CSPICE matrix results`, async () => {
    const sidecar = fileURLToPath(
      new URL("../sidecars/spiceypy/", import.meta.url),
    );
    const expected: unknown = JSON.parse(
      execFileSync(
        "uv",
        [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          "-c",
          oracleProgram,
        ],
        { encoding: "utf8", timeout: 30_000 },
      ),
    );
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const raw = spice.raw,
        maximum = Number.MAX_VALUE;
      const a = [maximum, -maximum, 1, -0];
      const observed = [
        raw.mequg(a, 2, 2),
        raw.xposeg(a, 2, 2),
        raw.mxmg(a, [2, 0], 2, 2, 1),
        raw.mtxmg(a, [2, 0], 2, 2, 1),
        raw.mxmtg(a, [2, 0], 2, 2, 1),
        raw.mxvg(a, [0, 2], 2, 2),
        raw.mtxvg(a, [2, 0], 2, 2),
        [raw.vtmvg([2], [maximum], [0], 1, 1)],
        [raw.vtmvg([2], [maximum / 4], [0], 1, 1)],
      ].map((row) => row.map(encode));
      expect(observed).toEqual(expected);
      expect(observed[0]).toEqual([maximum, -maximum, 1, "-0"]);
      expect(observed[6]).toEqual(["+Infinity", "-Infinity"]);
      expect(observed[7]).toEqual(["NaN"]);
      expect(observed[8]).toEqual([0]);
      expect(raw.failed()).toBe(false);
    } finally {
      await dispose();
    }
  });

  test(`${backend}: composes differently shaped matrices and returns independent row-major results`, async () => {
    const { spice, dispose } = await spiceClients.toSync({ backend });
    try {
      const raw = spice.raw;
      const a = [1, -2, 3, 5, 0, 7];
      const b = [-3, 1, 2, 4, -1, 3];
      const v = [3, -2],
        covector = [1, 4];
      const product = raw.mxmg(a, b, 2, 3, 2);
      expect(product).toEqual([-10, 2, -22, 26]);
      const transpose = raw.xposeg(a, 2, 3);
      expect(transpose).toEqual([1, 5, -2, 0, 3, 7]);
      expect(raw.mtxmg(transpose, b, 2, 3, 2)).toEqual(product);
      expect(raw.mxmtg(a, raw.xposeg(b, 3, 2), 2, 3, 2)).toEqual(product);
      const applied = raw.mxvg(product, v, 2, 2);
      expect(raw.mxvg(a, raw.mxvg(b, v, 3, 2), 2, 3)).toEqual(applied);
      const left = raw.mtxvg(product, covector, 2, 2);
      const bilinear = raw.vtmvg(covector, product, v, 2, 2);
      expect(bilinear).toBe(raw.vdotg(covector, applied));
      expect(bilinear).toBe(raw.vdotg(left, v));
      const copy = raw.mequg(a, 2, 3);
      a[0] = 100;
      expect(copy[0]).toBe(1);
      expect(transpose[0]).toBe(1);
      expect(raw.xposeg(transpose, 3, 2)).toEqual(copy);
    } finally {
      await dispose();
    }
  });
}
