import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { assertCaseParity } from "../src/parity-assert.js";
import type { CaseExecutionSuccess, ParityCase } from "../src/case-types.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const probe = fileURLToPath(
  new URL("./fixtures/gf-knobs-probe.mjs", import.meta.url),
);
const root = fileURLToPath(new URL("../", import.meta.url));
const sidecar = fileURLToPath(new URL("../sidecars/spiceypy", import.meta.url));
const python = `import sys,json
from pathlib import Path
import spiceypy as s
from spiceypy.utils.support_types import SPICEDOUBLE_CELL
def code(fn):
 try:fn()
 except Exception as e:return str(e.short)
 raise RuntimeError('Expected actual toolkit error')
def intervals(w):return [list(map(float,s.wnfetd(w,i))) for i in range(s.wncard(w))]
m={'initial':code(lambda:s.gfstep(0)),'steps':[],'refinements':[]}
s.gfsstp(7.25);m['steps'] += [s.gfstep(-100),s.gfstep(1e12)];s.kclear();m['steps'].append(s.gfstep(0))
m['invalidStep']=code(lambda:s.gfsstp(0));m['steps'].append(s.gfstep(0));s.gfsstp(123.5);m['steps'].append(s.gfstep(9))
for a in [False,True]:
 for b in [False,True]:m['refinements'].append(s.gfrefn(-10.25,17.75,a,b))
m['refinements'] += [s.gfrefn(17.75,-10.25,True,True),s.gfrefn(.125,.125,False,False)]
def load():
 for n in ['audit-geometry.tf','audit-geometry.bsp']:s.furnsh(str(Path(sys.argv[1])/'fixtures/kernels'/n))
load();c=SPICEDOUBLE_CELL(8);r=SPICEDOUBLE_CELL(16);s.wninsd(-2000,0,c)
def search():
 s.gfdist('100101','NONE','100102','<',10,0,25,100,c,r)
 return intervals(r)
s.gfstol(.5);m['coarse']=search();m['stepAfterSearch']=s.gfstep(0);m['invalidTolerance']=code(lambda:s.gfstol(0));m['afterInvalid']=search()
s.kclear();load();m['afterClear']=search();s.gfstol(1e-12);m['fine']=search();m['confinement']=intervals(c)
s.gfstol(1e-6);s.kclear();s.reset();print(json.dumps(m))
`;
type Metrics = {
  initial: string;
  steps: number[];
  invalidStep: string;
  invalidTolerance: string;
  refinements: number[];
  coarse: [number, number][];
  afterInvalid: [number, number][];
  afterClear: [number, number][];
  fine: [number, number][];
  confinement: [number, number][];
  stepAfterSearch: number;
};
function metrics(command: string, args: string[]): Metrics {
  const r = spawnSync(command, args, { encoding: "utf8" });
  expect(r.error).toBeUndefined();
  expect(r.signal).toBeNull();
  expect(r.status, r.stderr).toBe(0);
  // Both JSON payloads come from the controlled test fixtures in this file.
  const value: Metrics = JSON.parse(r.stdout);
  expect(Object.keys(value).sort()).toEqual(
    [
      "initial",
      "steps",
      "invalidStep",
      "invalidTolerance",
      "refinements",
      "coarse",
      "afterInvalid",
      "afterClear",
      "fine",
      "confinement",
      "stepAfterSearch",
    ].sort(),
  );
  return value;
}
const parityCase: ParityCase = {
  caseId: "gf-knobs-independent-live",
  description: "Actual full windows after each tolerance transition",
  workflow: [],
  expectation: { kind: "success" },
};
function execution(m: Metrics): CaseExecutionSuccess {
  return {
    caseId: parityCase.caseId,
    ok: true,
    error: null,
    outputs: [m.coarse, m.afterInvalid, m.afterClear, m.fine].map(
      (intervals) => ({
        op: "geometry-gf.gfdist",
        value: { intervals, confinementIntervals: m.confinement },
      }),
    ),
  };
}
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: actual global GF step/tolerance transitions and independent distance roots`,
    () => {
      const actual = metrics(process.execPath, [probe, backend]),
        oracle = metrics("uv", [
          "run",
          "--locked",
          "--project",
          sidecar,
          "python",
          "-c",
          python,
          root,
        ]);
      expect(actual.initial).toBe("SPICE(NOTINITIALIZED)");
      expect(actual.initial).toBe(oracle.initial);
      expect(actual.steps).toEqual([7.25, 7.25, 7.25, 7.25, 123.5]);
      expect(actual.steps).toEqual(oracle.steps);
      expect(actual.invalidStep).toBe("SPICE(INVALIDSTEP)");
      expect(actual.invalidTolerance).toBe("SPICE(INVALIDTOLERANCE)");
      expect(actual.invalidStep).toBe(oracle.invalidStep);
      expect(actual.invalidTolerance).toBe(oracle.invalidTolerance);
      expect(actual.refinements).toEqual([3.75, 3.75, 3.75, 3.75, 3.75, 0.125]);
      expect(actual.refinements).toEqual(oracle.refinements);
      expect(actual.stepAfterSearch).toBe(oracle.stepAfterSearch);
      assertCaseParity(parityCase, execution(oracle), execution(actual));
      expect(actual.afterInvalid).toEqual(actual.coarse);
      expect(actual.afterClear).toEqual(actual.coarse);
      expect(actual.confinement).toEqual([[-2000, 0]]);
      const a = 0.01 ** 2 + (-0.002) ** 2 + 0.003 ** 2,
        b = 10 * 0.01 + 4 * -0.002 + 3 * 0.003,
        c = 10 ** 2 + 4 ** 2 + 3 ** 2 - 10 ** 2;
      const roots = [
        (-b - Math.sqrt(b * b - a * c)) / a,
        (-b + Math.sqrt(b * b - a * c)) / a,
      ];
      expect(actual.fine).toHaveLength(1);
      for (let i = 0; i < 2; i++)
        expect(Math.abs(actual.fine[0]![i]! - roots[i]!)).toBeLessThan(1e-9);
      expect(
        Math.max(...roots.map((v, i) => Math.abs(v - actual.coarse[0]![i]!))),
      ).toBeGreaterThan(0.001);
    },
  );
