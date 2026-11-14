import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { Spice } from "@rybosome/tspice";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(import.meta.dirname, "../fixtures");
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
type Name = "clearc" | "cleard" | "cleari" | "filld" | "filli" | "moved";
function oracle(program: string) {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", sidecar, "python", "-c", program],
      { encoding: "utf8", timeout: 15_000 },
    ),
  );
}
function caseFor(suffix: string) {
  const c = allCases.find((c) => c.caseId === "coords-vectors-" + suffix);
  if (!c) throw new Error("Missing storage case " + suffix);
  return c;
}
const floatingProgram = `
import json,math
from py_parity_sidecar import array_storage_oracle as o
import spiceypy as sp

def encode(v):
    if math.isnan(v): return "NaN"
    if v==math.inf: return "+Infinity"
    if v==-math.inf: return "-Infinity"
    if v==0 and math.copysign(1,v)<0: return "-0"
    return v

sp.reset();sp.kclear()
try:
    tiny=float.fromhex("0x0.0000000000001p-1022")
    v=[-0.0,math.nan,math.inf,-math.inf,tiny,-tiny]
    dest=[91,83,79,73,71,67,-0.0]
    results=[o.cleard(2,v),o.cleard(0,v),o.cleard(-2147483648,v)]
    results.extend(o.filld(fill,3,v) for fill in [-0.0,math.nan,math.inf,-math.inf,tiny,-tiny])
    results.extend([o.filld(math.inf,-1,v),o.moved(v,6,dest),o.moved(v,0,dest)])
    print(json.dumps([[encode(x) for x in row] for row in results],allow_nan=False))
finally:
    sp.reset();sp.kclear()
`;
function encode(n: number): number | string {
  if (Number.isNaN(n)) return "NaN";
  if (n === Infinity) return "+Infinity";
  if (n === -Infinity) return "-Infinity";
  if (Object.is(n, -0)) return "-0";
  return n;
}
const typed: {
  name: Name;
  args: unknown[];
  arrays: number[];
  integers: number[];
  fill?: number;
}[] = [
  {
    name: "clearc",
    args: [1, 3, [88, 77, 66, 55]],
    arrays: [2],
    integers: [0, 1],
  },
  { name: "cleard", args: [2, [1, 2, 3, 4]], arrays: [1], integers: [0] },
  { name: "cleari", args: [2, [1, 2, 3, 4]], arrays: [1], integers: [0] },
  {
    name: "filld",
    args: [7, 2, [1, 2, 3, 4]],
    arrays: [2],
    integers: [1],
    fill: 0,
  },
  { name: "filli", args: [7, 2, [1, 2, 3, 4]], arrays: [2], integers: [0, 1] },
  {
    name: "moved",
    args: [[1, 2, 3, 4], 2, [5, 6, 7, 8]],
    arrays: [0, 2],
    integers: [1],
  },
];
function invoke(raw: Spice["raw"], name: Name, args: unknown[]) {
  return Reflect.apply(raw[name], raw, args);
}
function unread(length: number) {
  return new Proxy<number[]>([], {
    get(t, k, r) {
      if (k === "length") return length;
      if (typeof k === "string" && /^\d+$/.test(k))
        throw new Error("Unexpected entry read");
      return Reflect.get(t, k, r);
    },
  });
}
it("checks valid canonical MOVED overlap and independent count guards on owned memory", () => {
  const result = oracle(`
import ctypes as c,json
import spiceypy as sp
from py_parity_sidecar import array_storage_oracle as o

sp.reset();sp.kclear()
try:
    overlap=[]
    for source,dest,n in [(1,2,3),(2,1,3),(1,1,3),(1,2,0)]:
        storage=(c.c_double*6)(11,22,33,44,55,66)
        def ptr(offset): return c.cast(c.byref(storage,offset*c.sizeof(c.c_double)),c.POINTER(c.c_double))
        o._moved(ptr(source),n,ptr(dest))
        sp.check_for_spice_error(None)
        overlap.append(list(storage))
    rejected=0
    for call in [lambda:o.moved([1],-1,[2]),lambda:o.moved([1],2,[3,4]),lambda:o.moved([1,2],2,[3]),lambda:o.clearc(2147483647,2147483647,[1]),lambda:o.clearc(2,3,[1,2,3]),lambda:o.cleari(2,[3]),lambda:o.filli(2147483648,1,[1]),lambda:o.cleard(2,[])]:
        try: call()
        except ValueError: rejected+=1
        else: raise AssertionError("Out-of-bounds call was accepted")
    print(json.dumps({"overlap":overlap,"rejected":rejected,"recovery":o.moved([7],1,[3,5])}))
finally:
    sp.reset();sp.kclear()
`);
  expect(result).toEqual({
    overlap: [
      [11, 22, 22, 33, 44, 66],
      [11, 33, 44, 55, 55, 66],
      [11, 22, 33, 44, 55, 66],
      [11, 22, 33, 44, 55, 66],
    ],
    rejected: 8,
    recovery: [7, 5],
  });
}, 20_000);

for (const backend of ["wasm", "node"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} observes every initialized prefix and untouched storage element exactly`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        for (const suffix of [
          "clearc-nonzero-rows-and-unchanged-tail",
          "clearc-zero-negative-counts",
          "cleard-extreme-finite-storage",
          "cleari-signed-int32-limits",
          "filld-extreme-finite-storage",
          "filli-signed-int32-limits",
          "moved-extreme-finite-storage",
        ]) {
          const c = caseFor(suffix),
            reference = await runCaseInSidecar(c, fixtures),
            actual = runCaseInTspice(spice, c, fixtures);
          if (!reference.ok) throw new Error(reference.error.message);
          if (!actual.ok) throw new Error(actual.error.message);
          expect(actual.outputs).toEqual(reference.outputs);
        }
        const raw = spice.raw;
        expect(
          raw.clearc(2, 4, [255, 7, 19, 17, 83, 0, 31, 63, 88, 91]),
        ).toEqual([32, 32, 32, 0, 32, 32, 32, 0, 88, 91]);
        expect(raw.cleard(2, [9, -11.25, 71, -18])).toEqual([0, 0, 71, -18]);
        expect(raw.cleari(2, [2147483647, -17, -2147483648])).toEqual([
          0, 0, -2147483648,
        ]);
        expect(raw.filli(-2147483648, 2, [23, 27, 2147483647])).toEqual([
          -2147483648, -2147483648, 2147483647,
        ]);
      } finally {
        await dispose();
      }
    },
    30_000,
  );
  run(
    `${backend} compares signed zeros, nonfinite doubles and subnormals to the locked storage routines`,
    async () => {
      const reference: unknown = oracle(floatingProgram);
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw,
          t = Number.MIN_VALUE,
          v = [-0, NaN, Infinity, -Infinity, t, -t],
          dest = [91, 83, 79, 73, 71, 67, -0];
        const results = [
          raw.cleard(2, v),
          raw.cleard(0, v),
          raw.cleard(-2147483648, v),
          ...[-0, NaN, Infinity, -Infinity, t, -t].map((fill) =>
            raw.filld(fill, 3, v),
          ),
          raw.filld(Infinity, -1, v),
          raw.moved(v, 6, dest),
          raw.moved(v, 0, dest),
        ];
        expect(results.map((row) => row.map(encode))).toEqual(reference);
        expect(results[0]?.map(encode)).toEqual([
          0,
          0,
          "+Infinity",
          "-Infinity",
          t,
          -t,
        ]);
        expect(results[10]?.map(encode)).toEqual([
          "-0",
          "NaN",
          "+Infinity",
          "-Infinity",
          t,
          -t,
          "-0",
        ]);
        expect(raw.failed()).toBe(false);
      } finally {
        await dispose();
      }
    },
    20_000,
  );
  run(
    `${backend} returns owned destinations without mutating caller storage`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw,
          src = [111, 222, 33, 44],
          before = [...src],
          dest = Object.freeze([83, 71, 67, 61, 59]);
        const first = raw.clearc(1, 2, src),
          second = raw.cleard(2, src),
          third = raw.cleari(2, src),
          fourth = raw.filld(0.125, 2, src),
          fifth = raw.filli(-9, 2, src),
          sixth = raw.moved(src, 3, dest),
          same = raw.moved(src, 3, src);
        const outputs = [first, second, third, fourth, fifth, sixth, same];
        expect(new Set(outputs).size).toBe(outputs.length);
        const expected = [
          [32, 0, 33, 44],
          [0, 0, 33, 44],
          [0, 0, 33, 44],
          [0.125, 0.125, 33, 44],
          [-9, -9, 33, 44],
          [111, 222, 33, 61, 59],
          before,
        ];
        expect(src).toEqual(before);
        src.fill(9);
        for (let i = 0; i < 8; i++) {
          raw.clearc(2, 2, src);
          raw.filld(-21, 3, src);
          raw.moved(src, 4, dest);
        }
        expect(outputs).toEqual(expected);
        for (const result of outputs) result.fill(99);
        expect(src).toEqual([9, 9, 9, 9]);
        expect(dest).toEqual([83, 71, 67, 61, 59]);
        expect(raw.moved(src, 3, dest)).toEqual([9, 9, 9, 61, 59]);
      } finally {
        await dispose();
      }
    },
  );
  run(
    `${backend} executes the CLEARC zero-row return before width validation and recovers after invalid positive-row widths`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw,
          b = [97, 0, 255];
        expect(raw.clearc(0, -2147483648, b)).toEqual(b);
        expect(raw.clearc(-1, 1, b)).toEqual(b);
        for (const width of [-2147483648, 0, 1]) {
          expect(() => raw.clearc(1, width, b)).toThrow("STRINGTOOSHORT");
          expect(raw.failed()).toBe(false);
          expect(raw.clearc(1, 2, b)).toEqual([32, 0, 255]);
          expect(b).toEqual([97, 0, 255]);
        }
      } finally {
        try {
          spice.raw.reset();
          spice.raw.kclear();
        } finally {
          await dispose();
        }
      }
    },
  );
  run(
    `${backend} rejects unsupported storage, counts and integer entries before touching CSPICE`,
    async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const raw = spice.raw;
      try {
        for (const s of typed) {
          function reject(slot: number, bad: unknown) {
            const args = [...s.args];
            args[slot] = bad;
            expect(() => invoke(raw, s.name, args)).toThrow();
          }
          for (const slot of s.integers)
            for (const bad of [
              -2147483649,
              2147483648,
              1.5,
              NaN,
              Infinity,
              null,
              "1",
            ])
              reject(slot, bad);
          if (s.fill !== undefined)
            for (const bad of ["1", null, true, {}]) reject(s.fill, bad);
          for (const slot of s.arrays) {
            for (const bad of [null, "", {}, new Float64Array(4)])
              reject(slot, bad);
            for (let i = 0; i < 4; i++) {
              const invalid: unknown[] =
                s.name === "clearc"
                  ? [-1, 256, 1.5, NaN, null]
                  : s.name === "cleari" || s.name === "filli"
                    ? [-2147483649, 2147483648, 1.5, Infinity, "1"]
                    : [null, "1", undefined, true];
              for (const bad of invalid) {
                const vector: unknown[] = [1, 2, 3, 4];
                vector[i] = bad;
                reject(slot, vector);
              }
            }
            const args = [...s.args];
            args[slot] = unread(2147483648);
            expect(() => invoke(raw, s.name, args)).toThrow(RangeError);
          }
        }
        expect(() => raw.clearc(1, 4, [1, 2, 3])).toThrow(RangeError);
        expect(() => raw.clearc(2147483647, 2147483647, [])).toThrow(
          RangeError,
        );
        for (const n of ["cleard", "cleari"] as const)
          expect(() => raw[n](3, [1, 2])).toThrow(RangeError);
        for (const n of ["filld", "filli"] as const)
          expect(() => raw[n](9, 3, [1, 2])).toThrow(RangeError);
        expect(() => raw.moved([1], -1, [2])).toThrow(RangeError);
        expect(() => raw.moved([1], 2, [2, 3])).toThrow(RangeError);
        expect(() => raw.moved([1, 2], 2, [3])).toThrow(RangeError);
        expect(raw.failed()).toBe(false);
        expect(raw.moved([7], 1, [1, 2])).toEqual([7, 2]);
      } finally {
        await dispose();
      }
    },
  );
}
