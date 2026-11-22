import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { beforeAll, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
import type { SpiceWindow } from "@rybosome/tspice-backend-contract";

const sidecar = fileURLToPath(new URL("../sidecars/spiceypy", import.meta.url));
// The stock UDDF copies a private output after an error. The locked reference
// calls QDERIV directly for the zero-step diagnostic and only uses UDDF/UDDC
// on finite sample values with a nonzero step.
const program = `import json, math, sys
import spiceypy as s
from ctypes import CDLL, POINTER, c_double, byref
from spiceypy.utils.callbacks import SpiceUDFUNC
from spiceypy.utils.libspicehelper import libspice
lib=CDLL(libspice._name)
lib.udf_c.argtypes=[c_double, POINTER(c_double)]
lib.udf_c.restype=None
def dummy(v):
 word=c_double(v);lib.udf_c(7.,byref(word));s.check_for_spice_error(lib.udf_c)
 return word.value.hex()
def tag(v):
 return 'nan' if math.isnan(v) else '+inf' if v==math.inf else '-inf' if v==-math.inf else '-0' if v==0 and math.copysign(1,v)<0 else '+0' if v==0 else v.hex()
def measurement(f,x,dx):
 a=SpiceUDFUNC(f)
 return [tag(s.uddf(a,x,dx)),bool(s.uddc(a,x,dx))]
tiny=math.ulp(0.)
observed=[measurement(lambda t:t,0.,tiny),measurement(lambda t: 0.,0.,tiny),measurement(lambda t: 1. if t<0 else -1.,0.,tiny),measurement(lambda t:t,-1.,.125)]
try: s.qderiv([2.],[2.],0.)
except Exception as e: zero=e.short
else: raise AssertionError("QDERIV should reject zero delta")
print(json.dumps(dict(accumulators=[dummy(v) for v in [-0.,tiny,-tiny,sys.float_info.max]],observed=observed,zero=zero,failed=s.failed())))`;

type Reference = {
  accumulators: string[];
  observed: [string, boolean][];
  zero: string;
  failed: boolean;
};
let reference: Reference;
beforeAll(() => {
  const result = spawnSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8" },
  );
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status, result.stderr).toBe(0);
  // The above test-owned program emits these four literal keys.
  reference = JSON.parse(result.stdout);
  expect(reference.accumulators).toEqual([
    "0x0.0p+0",
    "0x0.0000000000001p-1022",
    "-0x0.0000000000001p-1022",
    "0x1.fffffffffffffp+1023",
  ]);
  expect(reference.zero).toBe("SPICE(DIVIDEBYZERO)");
  expect(reference.failed).toBe(false);
});
function tag(v: number): string {
  if (Number.isNaN(v)) return "nan";
  if (v === Infinity) return "+inf";
  if (v === -Infinity) return "-inf";
  if (v === 0) return Object.is(v, -0) ? "-0" : "+0";
  if (v === 1) return "0x1.0000000000000p+0";
  throw new Error("Unexpected finite derivative " + v);
}
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(`${backend} UDF preserves a live in/out word and QDERIV retains the complete IEEE result of finite callback samples`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      expect(raw.udf(0)).toBe(0);
      for (const input of [
        -0,
        Number.MIN_VALUE,
        -Number.MIN_VALUE,
        Number.MAX_VALUE,
      ]) {
        expect(raw.udf(7, input)).toBe(input === 0 ? 0 : input);
      }
      const scalars = [
        (t: number) => t,
        () => 0,
        (t: number) => (t < 0 ? 1 : -1),
        (t: number) => t,
      ];
      for (const [i, f] of scalars.entries()) {
        const x = i === 3 ? -1 : 0,
          dx = i === 3 ? 0.125 : Number.MIN_VALUE;
        expect([tag(raw.uddf(f, x, dx)), raw.uddc(f, x, dx)]).toEqual(
          reference.observed[i],
        );
      }
    } finally {
      await client.dispose();
    }
  });
  test(`${backend} estimates the finite-step cubic derivative with exactly two callback epochs in their original order`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    try {
      for (const x of [-0.5, 0, 1])
        for (const dx of [0.25, -0.25]) {
          const samples: number[] = [];
          const cubic = (t: number) => {
            samples.push(t);
            return t * t * t - 3 * t;
          };
          const finiteDifference = 3 * x * x - 3 + dx * dx;
          expect(raw.uddf(cubic, x, dx)).toBe(finiteDifference);
          expect(samples).toEqual([x - dx, x + dx]);
          samples.length = 0;
          expect(raw.uddc(cubic, x, dx)).toBe(finiteDifference < 0);
          expect(samples).toEqual([x - dx, x + dx]);
        }
      for (const method of ["uddf", "uddc"] as const) {
        const samples: number[] = [];
        expect(() =>
          raw[method](
            (t) => {
              samples.push(t);
              return t;
            },
            3,
            0,
          ),
        ).toThrow(expect.objectContaining({ spiceShort: reference.zero }));
        expect(samples).toEqual([3, 3]);
        expect(raw.failed()).toBe(false);
        expect(raw[method]((t) => -2 * t, 3, 0.125)).toBe(
          method === "uddc" ? true : -2,
        );
      }
    } finally {
      await client.dispose();
    }
  });
  test(`${backend} user predicates find analytic intervals on disjoint confinement and retain result ownership on reuse`, async () => {
    const client = await spiceClients.toSync({ backend }),
      raw = client.spice.raw;
    const kit = client.spice.kit;
    const c = kit.newWindow(8),
      r = kit.newWindow(8);
    const intervals = (w: SpiceWindow) =>
      Array.from({ length: raw.wncard(w) }, (_, i) => raw.wnfetd(w, i));
    let oldStep: number | undefined;
    try {
      try {
        oldStep = raw.gfstep(0);
      } catch (e) {
        if (!(e instanceof Error && e.message.includes("NOTINITIALIZED")))
          throw e;
      }
      raw.gfstol(1e-8);
      raw.wninsd(-3, -0.5, c);
      raw.wninsd(0.5, 3, c);
      raw.wninsd(15, 16, r);
      const scalarCalls: number[] = [],
        predicateCalls: number[] = [];
      const square = (t: number) => {
        scalarCalls.push(t);
        return t * t;
      };
      raw.gfudb(
        square,
        (f, t) => {
          predicateCalls.push(t);
          return f(t) > 1;
        },
        0.25,
        c,
        r,
      );
      expect(scalarCalls).toEqual(predicateCalls);
      expect(predicateCalls.length).toBeGreaterThan(16);
      const above = intervals(r);
      expect(above).toHaveLength(2);
      for (const [i, expected] of [
        [-3, -1],
        [1, 3],
      ].entries())
        for (const [j, epoch] of expected.entries())
          expect(Math.abs(above[i]![j]! - epoch)).toBeLessThan(1e-8);
      for (const [relation, ref, expected] of [
        [
          "=",
          1,
          [
            [-1, -1],
            [1, 1],
          ],
        ],
        [
          "<",
          1,
          [
            [-1, -0.5],
            [0.5, 1],
          ],
        ],
        [">", 10, []],
      ] as const) {
        let decreases = 0;
        raw.gfuds(
          square,
          (f, t) => {
            decreases++;
            return raw.uddc(f, t, 1 / 64);
          },
          relation,
          ref,
          0,
          0.25,
          16,
          c,
          r,
        );
        expect(decreases).toBeGreaterThan(0);
        const got = intervals(r);
        expect(got).toHaveLength(expected.length);
        for (const [i, row] of expected.entries())
          for (const [j, epoch] of row.entries())
            expect(Math.abs(got[i]![j]! - epoch)).toBeLessThan(1e-8);
      }
      expect(intervals(c)).toEqual([
        [-3, -0.5],
        [0.5, 3],
      ]);
      expect(above[0]![0]).toBe(-3);
    } finally {
      raw.gfstol(1e-6);
      if (oldStep !== undefined) raw.gfsstp(oldStep);
      kit.freeWindow(r);
      kit.freeWindow(c);
      await client.dispose();
    }
  });
}
