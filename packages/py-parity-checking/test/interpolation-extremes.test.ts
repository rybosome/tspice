import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase, WorkflowStep } from "../src/case-types.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const maximum = Number.MAX_VALUE,
  minimum = Number.MIN_VALUE;
const workflow: WorkflowStep[] = [];
for (const magnitude of [maximum, maximum / 8]) {
  workflow.push(
    {
      op: "coords-vectors.hrmesp",
      first: 0,
      step: 1,
      yvals: [magnitude, magnitude],
      x: 1,
    },
    {
      op: "coords-vectors.hrmint",
      xvals: [0],
      yvals: [magnitude, magnitude],
      x: 1,
    },
    {
      op: "coords-vectors.lgresp",
      first: 0,
      step: 1,
      yvals: [0, magnitude],
      x: 2,
    },
    { op: "coords-vectors.lgrind", xvals: [0, 1], yvals: [0, magnitude], x: 2 },
    { op: "coords-vectors.lgrint", xvals: [0, 1], yvals: [0, magnitude], x: 2 },
  );
}
workflow.push(
  { op: "coords-vectors.qderiv", f0: [0, 1], f2: [1, 2], delta: minimum },
  {
    op: "coords-vectors.qderiv",
    f0: [-maximum, maximum, 1],
    f2: [maximum, -maximum, -1],
    delta: maximum,
  },
  {
    op: "coords-vectors.qderiv",
    f0: [-2, 3, -5, 7],
    f2: [11, -13, 17, -19],
    delta: 2,
  },
);
const parityCase: ParityCase = {
  caseId: "interpolation-live-floating-extremes",
  description:
    "All actual floating results and finite controls using explicitly dimensioned, nonempty tables and nonzero spacing.",
  workflow,
  expectation: { kind: "success" },
};
// Normal workflow JSON cannot represent NaN/Infinity or preserve negative zero.
// This test-only transport keeps all fields without changing global comparison.
const oracleProgram = `
import json, math, sys
import spiceypy as sp
from py_parity_sidecar.decode import _decode_step
from py_parity_sidecar.handlers.coords_vectors import run_coords_vectors_step

def decode_input(value):
    if value == {"kind":"negative-zero"}: return -0.0
    return value

def encode(value):
    if isinstance(value,list): return [encode(item) for item in value]
    if isinstance(value,dict): return {key:encode(item) for key,item in value.items()}
    value=float(value)
    if math.isnan(value): return {"kind":"nan"}
    if value==math.inf: return {"kind":"positive-infinity"}
    if value==-math.inf: return {"kind":"negative-infinity"}
    if value==0.0 and math.copysign(1.0,value)<0: return {"kind":"negative-zero"}
    return {"kind":"finite","value":value}

sp.reset()
sp.kclear()
try:
    outputs=[]
    for step in json.load(sys.stdin,object_hook=decode_input):
        result=run_coords_vectors_step(_decode_step(step),None)
        assert result is not None
        assert not sp.failed(), "Unexpected SPICE error in interpolation probe"
        outputs.append(encode(result.value))
    print(json.dumps(outputs,allow_nan=False))
finally:
    sp.reset()
    sp.kclear()
`;
function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (typeof value !== "object" || value === null)
    throw new Error("Malformed oracle classification");
  if (!("kind" in value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, decode(item)]),
    );
  if (value.kind === "nan") return NaN;
  if (value.kind === "positive-infinity") return Infinity;
  if (value.kind === "negative-infinity") return -Infinity;
  if (value.kind === "negative-zero") return -0;
  if (
    value.kind === "finite" &&
    "value" in value &&
    typeof value.value === "number" &&
    Number.isFinite(value.value)
  )
    return value.value;
  throw new Error("Malformed oracle scalar");
}
function expectObserved(actual: unknown, oracle: unknown): void {
  if (typeof oracle === "number") {
    expect(typeof actual).toBe("number");
    if (typeof actual !== "number") throw new Error("Missing raw scalar");
    if (!Number.isFinite(oracle) || oracle === 0)
      expect(Object.is(actual, oracle)).toBe(true);
    else
      expect(Math.abs(actual - oracle)).toBeLessThanOrEqual(
        1e-12 * Math.abs(oracle),
      );
  } else if (Array.isArray(oracle)) {
    if (!Array.isArray(actual)) throw new Error("Missing raw vector");
    expect(actual).toHaveLength(oracle.length);
    for (let i = 0; i < oracle.length; i++)
      expectObserved(actual[i], oracle[i]);
  } else if (typeof oracle === "object" && oracle !== null) {
    if (typeof actual !== "object" || actual === null)
      throw new Error("Missing raw interpolation result");
    expect(Object.keys(actual).sort()).toEqual(Object.keys(oracle).sort());
    for (const [key, value] of Object.entries(oracle))
      expectObserved(Reflect.get(actual, key), value);
  } else throw new Error("Unexpected oracle result");
}
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: retains every independent interpolation result when finite inputs overflow`,
    async () => {
      const stdout = execFileSync(
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
        { encoding: "utf8", input: JSON.stringify(workflow), timeout: 15_000 },
      );
      const oracle = decode(JSON.parse(stdout));
      if (!Array.isArray(oracle) || oracle.length !== workflow.length)
        throw new Error("Missing interpolation oracle outputs");
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = runCaseInTspice(
          spice,
          parityCase,
          path.resolve(import.meta.dirname, "../fixtures"),
        );
        if (!actual.ok) throw new Error(actual.error.message);
        expect(actual.outputs).toHaveLength(workflow.length);
        for (let i = 0; i < oracle.length; i++)
          expectObserved(actual.outputs[i]?.value, oracle[i]);
        expect(actual.outputs[0]?.value).toEqual({ f: Infinity, df: maximum });
        expect(actual.outputs[3]?.value).toEqual({ p: Infinity, dp: maximum });
        expect(actual.outputs[10]?.value).toEqual([NaN, NaN]);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.qderiv([1], [9], 1)).toEqual([4]);
      } finally {
        try {
          spice.raw.reset();
          spice.raw.kclear();
        } finally {
          await dispose();
        }
      }
    },
    20_000,
  );
}

it("guards independent wrapper count and layout bounds and exercises actual CSPICE empty-table errors", () => {
  const program = `
import ctypes, json
import spiceypy as sp
from spiceypy.utils import support_types as st
from spiceypy.utils.exceptions import SpiceINVALIDSIZE
from py_parity_sidecar import interpolation_oracle as limits

class Unread:
    def __init__(self,n): self.n=n
    def __len__(self): return self.n
    def __iter__(self): raise AssertionError("Oversize input traversed")
guards = [
    lambda: limits.equally_spaced("hrmesp",0,1,Unread(2*67108864),0),
    lambda: limits.arbitrary("hrmint",Unread(357913942),Unread(2*357913942),0),
    lambda: limits.equally_spaced("lgresp",0,1,Unread(268435456),0),
    lambda: limits.arbitrary("lgrind",Unread(715827883),Unread(715827883),0),
    lambda: limits.arbitrary("lgrint",Unread(268435456),Unread(268435456),0),
    lambda: limits.quadratic(Unread(2147483647),Unread(2147483647),1),
    lambda: limits.quadratic([],[],1),
    lambda: limits.quadratic([1],[2,3],1),
    lambda: limits.equally_spaced("hrmesp",0,1,[1,2,3],0),
    lambda: limits.arbitrary("hrmint",[1],[2],0),
    lambda: limits.arbitrary("lgrind",[1,2],[2],0),
    lambda: limits.arbitrary("lgrint",[1],[2,float("nan")],0),
    lambda: limits.equally_spaced("lgresp",1,0,[2,float("inf")],0),
]
sp.reset();sp.kclear()
try:
    blocked=0
    for call in guards:
        try: call()
        except ValueError: blocked+=1
        else: raise AssertionError("Unsafe shape reached CSPICE")
    # These are the actual locked wrapper's array conversion/allocation functions.
    assert ctypes.cast(st.to_double_vector([]),ctypes.c_void_p).value
    assert ctypes.cast(st.empty_double_vector(0),ctypes.c_void_p).value
    invalid=0
    for call in [lambda:sp.hrmesp(0,1,[],0),lambda:sp.hrmint([],[],0),lambda:sp.lgresp(0,1,[],0),lambda:sp.lgrind([],[],0),lambda:sp.lgrint([],[],0)]:
        try: call()
        except SpiceINVALIDSIZE: invalid+=1
        else: raise AssertionError("Missing actual zero-node SPICE error")
        assert not sp.failed()
    print(json.dumps({"blocked":blocked,"invalid":invalid,"recovered":sp.qderiv([1],[9],1).tolist()}))
finally:
    sp.reset();sp.kclear()
`;
  const stdout = execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8", timeout: 15_000 },
  );
  expect(JSON.parse(stdout)).toEqual({
    blocked: 13,
    invalid: 5,
    recovered: [4],
  });
}, 20_000);
