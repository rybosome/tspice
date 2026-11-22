import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients, type SpiceSync } from "@rybosome/tspice";
import type { SpiceWindow } from "@rybosome/tspice-backend-contract";
import { allCases } from "../src/cases/index.js";
import { runCaseInSidecar } from "../src/run-sidecar.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
const fixtures = path.resolve(import.meta.dirname, "../fixtures");
const first = [
  [1, 3],
  [7, 11],
  [23, 27],
] as const;
const second = [
  [2, 4],
  [6, 8],
  [20, 24],
  [28, 30],
] as const;
type Interval = readonly [number, number];
type CreateWindow = (
  intervals?: readonly Interval[],
  capacity?: number,
) => SpiceWindow;
type Backend = "node" | "wasm";

async function withWindows(
  backend: Backend,
  run: (spice: SpiceSync, create: CreateWindow) => Promise<void> | void,
) {
  const { spice, dispose } = await spiceClients.toSync({ backend });
  const windows: SpiceWindow[] = [];
  const create: CreateWindow = (intervals = [], capacity = 8) => {
    const window = spice.kit.newWindow(capacity);
    windows.push(window);
    for (const [left, right] of intervals)
      spice.raw.wninsd(left, right, window);
    return window;
  };
  try {
    await run(spice, create);
  } finally {
    try {
      spice.raw.reset();
      for (const window of windows.reverse()) spice.kit.freeWindow(window);
    } finally {
      await dispose();
    }
  }
}
function intervals(spice: SpiceSync, w: SpiceWindow) {
  return Array.from({ length: spice.raw.wncard(w) }, (_, i) =>
    spice.raw.wnfetd(w, i),
  );
}
function independent(program: string): unknown {
  return JSON.parse(
    execFileSync(
      "uv",
      ["run", "--locked", "--project", sidecar, "python", "-c", program],
      { encoding: "utf8", timeout: 15_000 },
    ),
  );
}
const capacityProbe = `
import json
import spiceypy as sp
from spiceypy.utils.exceptions import SpiceyError
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
from py_parity_sidecar import window_algebra_oracle as oracle

def window(rows,capacity=8):
    w=SPICEDOUBLE_CELL(2*capacity)
    for left,right in rows:
        sp.wninsd(left,right,w)
    return w

def intervals(w):
    return [sp.wnfetd(w,i) for i in range(sp.wncard(w))]

sp.reset()
try:
    a=window([(1,3),(7,11),(23,27)])
    b=window([(2,4),(6,8),(20,24),(28,30)])
    observations=[]
    for name in ("wncomd","wndifd","wnintd","wnunid"):
        for seeded in (False,True):
            result=window([(101,102)] if seeded else [],1)
            try:
                args=(0,30,a) if name=="wncomd" else (a,b)
                getattr(oracle,name)(*args,result)
            except SpiceyError as error:
                short=error.short
            else:
                raise AssertionError("Expected WINDOWEXCESS")
            assert short=="SPICE(WINDOWEXCESS)"
            # The C descriptor is only synchronized on success, while the
            # underlying toolkit window can hold a bounded partial interval.
            observations.append([name,seeded,sp.card(result),intervals(result)])
            sp.scard(0,result)
            sp.wninsd(-9,-7,result)
            assert intervals(result)==[(-9.0,-7.0)]
    print(json.dumps(observations))
finally:
    sp.reset()
`;

const finiteExtremeProbe = `
import json,math,sys
import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
def tag(x):
    if math.isnan(x): return "NaN"
    if math.isinf(x): return "+Inf" if x>0 else "-Inf"
    return x

sp.reset()
try:
    m=sys.float_info.max
    w=SPICEDOUBLE_CELL(4)
    sp.wninsd(-m,m,w)
    summary=[tag(x) for x in sp.wnsumd(w)]
    endpoints=[]
    for fn,margin in [(sp.wnexpd,m),(sp.wncond,-m)]:
        sp.scard(0,w)
        sp.wninsd(-m,m,w)
        fn(margin,margin,w)
        endpoints.append([tag(x) for x in sp.wnfetd(w,0)])
    print(json.dumps([summary,*endpoints],allow_nan=False))
finally:
    sp.reset()
`;
function tag(n: number): number | string {
  return Number.isNaN(n)
    ? "NaN"
    : n === Infinity
      ? "+Inf"
      : n === -Infinity
        ? "-Inf"
        : n;
}

it("observes the independent caller-sized result cell and the locked selector wrapper's restriction", () => {
  const data = independent(capacityProbe);
  const retained = [
    ["wncomd", [0, 1]],
    ["wndifd", [1, 2]],
    ["wnintd", [2, 3]],
    ["wnunid", [1, 3]],
  ] as const;
  expect(data).toEqual(
    retained.flatMap(([name, pair]) =>
      [false, true].map((seeded) => [name, seeded, seeded ? 2 : 0, [pair]]),
    ),
  );
  expect(
    independent(`
import json
import spiceypy as sp
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
from py_parity_sidecar import window_algebra_oracle as oracle
sp.reset()
try:
    w=SPICEDOUBLE_CELL(4);sp.wninsd(-3,5,w)
    try: sp.wnextd("r",w)
    except AssertionError: pass
    else: raise AssertionError("Expected the locked wrapper's uppercase assertion")
    oracle.wnextd("r",w)
    alias_guards=0
    for fn in [lambda:oracle.wncomd(0,9,w,w),lambda:oracle.wndifd(w,w,w),lambda:oracle.wnintd(w,w,w),lambda:oracle.wnunid(w,w,w)]:
        try: fn()
        except ValueError: alias_guards+=1
        else: raise AssertionError("Aliased output reached CSPICE")
    # Shrinking and restoring logical size is permitted on the original
    # owner. Check oversized growth at the sidecar boundary before SSIZE.
    resized=oracle.allocate_window(2)
    for size in (0,2,4):
        oracle.check_resize(resized,size)
        sp.ssize(size,resized)
    try: oracle.check_resize(resized,6)
    except ValueError: pass
    else: raise AssertionError("Growing past physical storage was accepted")
    zero=oracle.allocate_window(0)
    oracle.wnunid(zero,zero,resized)
    print(json.dumps([list(w),alias_guards,sp.size(zero),sp.size(resized),sp.wncard(resized)]))
finally:
    sp.reset()
`),
  ).toEqual([[5, 5], 4, 0, 4, 0]);
}, 30_000);

for (const backend of ["node", "wasm"] as const) {
  const run = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
  run(
    `${backend} preserves independently observed partial intervals and reuses caller-owned output after each capacity error`,
    async () => {
      const expected = independent(capacityProbe);
      await withWindows(backend, (spice, create) => {
        const a = create(first),
          b = create(second),
          raw = spice.raw,
          observations = [];
        for (const name of ["wncomd", "wndifd", "wnintd", "wnunid"] as const) {
          for (const seeded of [false, true]) {
            const result = create(seeded ? [[101, 102]] : [], 1);
            const invoke = () =>
              name === "wncomd"
                ? raw.wncomd(0, 30, a, result)
                : raw[name](a, b, result);
            expect(invoke).toThrow(/WINDOWEXCESS/);
            expect(raw.failed()).toBe(false);
            observations.push([
              name,
              seeded,
              raw.card(result),
              intervals(spice, result),
            ]);
            expect(intervals(spice, a)).toEqual(first);
            expect(intervals(spice, b)).toEqual(second);
            raw.scard(0, result);
            raw.wninsd(-9, -7, result);
            expect(raw.card(result)).toBe(2);
            expect(intervals(spice, result)).toEqual([[-9, -7]]);
          }
        }
        expect(observations).toEqual(expected);
      });
    },
    25_000,
  );
  run(
    `${backend} overwrites caller-owned results without aliasing either input, including logical zero-capacity inputs`,
    async () => {
      await withWindows(backend, (spice, create) => {
        const raw = spice.raw,
          a = create([
            [0, 4],
            [7, 10],
          ]),
          b = create([
            [2, 5],
            [8, 9],
          ]),
          r = create([[99, 100]]),
          empty = create([], 0);
        raw.wnintd(a, b, r);
        const retained = intervals(spice, r);
        expect(retained).toEqual([
          [2, 4],
          [8, 9],
        ]);
        raw.wndifd(a, b, r);
        expect(intervals(spice, r)).toEqual([
          [0, 2],
          [7, 8],
          [9, 10],
        ]);
        raw.wnunid(r, empty, b);
        expect(intervals(spice, b)).toEqual(intervals(spice, r));
        raw.wncomd(-1, 12, a, r);
        expect(intervals(spice, r)).toEqual([
          [-1, 0],
          [4, 7],
          [10, 12],
        ]);
        expect(retained).toEqual([
          [2, 4],
          [8, 9],
        ]);
        expect(intervals(spice, a)).toEqual([
          [0, 4],
          [7, 10],
        ]);
        raw.wnunid(empty, empty, r);
        expect(intervals(spice, r)).toEqual([]);
        for (const call of [
          () => raw.wncomd(0, 5, a, a),
          () => raw.wndifd(a, b, a),
          () => raw.wnintd(a, b, b),
          () => raw.wnunid(a, b, a),
        ])
          expect(call).toThrow();
        expect(intervals(spice, a)).toEqual([
          [0, 4],
          [7, 10],
        ]);
        expect(intervals(spice, b)).toEqual([
          [0, 2],
          [7, 8],
          [9, 10],
        ]);
      });
    },
  );
  run(
    `${backend} reports flattened endpoint indices, population statistics, and independent small-scale values`,
    async () => {
      const c = allCases.find(
        (c) => c.caseId === "cells-windows-wnsumd-small-scale",
      );
      if (!c) throw new Error("Missing tiny summary fixture");
      const expected = await runCaseInSidecar(c, fixtures);
      if (!expected.ok) throw new Error(expected.error.message);
      const ref = expected.outputs.at(-1);
      if (ref?.op !== "cells-windows.wnsumd")
        throw new Error("Missing oracle summary");
      await withWindows(backend, (spice, create) => {
        const raw = spice.raw;
        const w = create([
          [0, 3],
          [5, 6],
          [10, 16],
          [20, 21],
          [30, 36],
        ]);
        const s = raw.wnsumd(w);
        expect([s.meas, s.avg, s.shortest, s.longest]).toEqual([17, 3.4, 2, 4]);
        expect(s.stddev).toBeCloseTo(Math.sqrt(5.04), 12);
        raw.scard(0, w);
        expect(raw.wnsumd(w)).toEqual({
          meas: 0,
          avg: 0,
          stddev: 0,
          shortest: -1,
          longest: -1,
        });
        raw.wninsd(0, 1e-100, w);
        raw.wninsd(2e-100, 5e-100, w);
        const small = raw.wnsumd(w);
        for (const field of ["meas", "avg", "stddev"] as const)
          expect(small[field] * 1e100).toBeCloseTo(
            ref.value[field] * 1e100,
            12,
          );
        expect([small.shortest, small.longest]).toEqual([0, 2]);
        expect(s.shortest).toBe(2);
      });
    },
    25_000,
  );
  run(
    `${backend} forwards finite inputs whose summary and adjusted endpoints overflow`,
    async () => {
      const reference = independent(finiteExtremeProbe);
      expect(reference).toEqual([
        ["+Inf", "+Inf", "NaN", 0, 0],
        ["-Inf", "+Inf"],
        ["-Inf", "+Inf"],
      ]);
      await withWindows(backend, (spice, create) => {
        const { raw } = spice,
          m = Number.MAX_VALUE,
          w = create([[-m, m]]);
        const s = raw.wnsumd(w);
        const result: (number | string)[][] = [
          [s.meas, s.avg, s.stddev, s.shortest, s.longest].map(tag),
        ];
        for (const name of ["wnexpd", "wncond"] as const) {
          raw.scard(0, w);
          raw.wninsd(-m, m, w);
          const margin = name === "wnexpd" ? m : -m;
          raw[name](margin, margin, w);
          result.push(raw.wnfetd(w, 0).map(tag));
        }
        expect(result).toEqual(reference);
        raw.scard(0, w);
        raw.wninsd(1, 3, w);
        expect(intervals(spice, w)).toEqual([[1, 3]]);
      });
    },
    25_000,
  );
  run(
    `${backend} rejects stale, wrong-kind and malformed handles and recovers from canonical selector, relation and cardinality errors`,
    async () => {
      await withWindows(backend, (spice, create) => {
        const raw = spice.raw,
          w = create([[1, 3]]),
          r = create();
        const stale = spice.kit.newWindow(1);
        spice.kit.freeWindow(stale);
        const cell = spice.kit.newDoubleCell(8);
        try {
          expect(() => Reflect.apply(raw.wnelmd, raw, [1, cell])).toThrow();
          for (const call of [
            () => raw.wnsumd(stale),
            () => raw.wncomd(0, 9, w, stale),
            () => raw.wnreld(w, "=", stale),
          ])
            expect(call).toThrow();
        } finally {
          spice.kit.freeCell(cell);
        }
        for (const side of ["?", "\0"])
          expect(() => raw.wnextd(side, w)).toThrow(/INVALIDENDPNTSPEC/);
        expect(() => raw.wnreld(w, "", w)).toThrow(/EMPTYSTRING/);
        expect(() => raw.wnreld(w, " =", w)).toThrow(/INVALIDOPERATION/);
        expect(() => raw.wncomd(5, 1, w, r)).toThrow(/BADENDPOINTS/);
        raw.scard(1, w);
        expect(() => raw.wnsumd(w)).toThrow(/INVALIDCARDINALITY/);
        // All remaining scientific operations require a complete input pair.
        expect(() => raw.wnunid(w, w, r)).toThrow();
        raw.scard(0, w);
        raw.wninsd(-3, 5, w);
        expect(raw.wnincd(-3, 5, w)).toBe(true);
        expect(raw.wnreld(w, "= ", w)).toBe(true);
        raw.wnextd("r", w);
        expect(intervals(spice, w)).toEqual([[5, 5]]);
      });
    },
  );
}
