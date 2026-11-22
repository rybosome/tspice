import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase, WorkflowStep } from "../src/case-types.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const maximum = Number.MAX_VALUE,
  minimum = Number.MIN_VALUE;
const workflow: WorkflowStep[] = [
  {
    op: "coords-vectors.chbder",
    cp: [maximum, maximum],
    x2s: [0, 1],
    x: 1,
    nderiv: 3,
  },
  { op: "coords-vectors.chbigr", cp: [maximum, maximum], x2s: [0, 1], x: 1 },
  { op: "coords-vectors.chbint", cp: [maximum, maximum], x2s: [0, 1], x: 1 },
  { op: "coords-vectors.chbval", cp: [maximum, maximum], x2s: [0, 1], x: 1 },
  { op: "coords-vectors.polyds", coeffs: [maximum, maximum], nderiv: 3, t: 1 },
  {
    op: "coords-vectors.chbder",
    cp: [0, 1],
    x2s: [0, minimum],
    x: 0,
    nderiv: 3,
  },
  { op: "coords-vectors.chbint", cp: [0, 1], x2s: [0, minimum], x: 0 },
  { op: "coords-vectors.rquad", a: minimum, b: 1, c: maximum },
  { op: "coords-vectors.rquad", a: 0, b: minimum, c: 1 },
  {
    op: "coords-vectors.chbder",
    cp: [maximum / 8, maximum / 8],
    x2s: [0, 1],
    x: 1,
    nderiv: 3,
  },
  {
    op: "coords-vectors.chbigr",
    cp: [maximum / 8, maximum / 8],
    x2s: [0, 1],
    x: 1,
  },
  {
    op: "coords-vectors.chbint",
    cp: [maximum / 8, maximum / 8],
    x2s: [0, 1],
    x: 1,
  },
  {
    op: "coords-vectors.chbval",
    cp: [maximum / 8, maximum / 8],
    x2s: [0, 1],
    x: 1,
  },
  {
    op: "coords-vectors.polyds",
    coeffs: [maximum / 8, maximum / 8],
    nderiv: 3,
    t: 1,
  },
  { op: "coords-vectors.rquad", a: maximum, b: -maximum, c: maximum },
  { op: "coords-vectors.rquad", a: 1, b: 0, c: 1 },
];
const parityCase: ParityCase = {
  caseId: "polynomial-expansions-live-floating-extremes",
  description:
    "Actual full floating outputs and finite controls; Chebyshev evaluation points remain within their normalized domain and all C workspaces are bounded.",
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
        assert not sp.failed(), "Unexpected SPICE error in polynomial probe"
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
      throw new Error("Missing raw unit/norm object");
    expect(Object.keys(actual).sort()).toEqual(Object.keys(oracle).sort());
    for (const [key, value] of Object.entries(oracle))
      expectObserved(Reflect.get(actual, key), value);
  } else throw new Error("Unexpected oracle result");
}
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: retains every independent floating polynomial and root field`,
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
        throw new Error("Missing polynomial oracle outputs");
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
        expect(actual.outputs[0]?.value).toEqual([Infinity, maximum, 0, 0]);
        expect(actual.outputs[1]?.value).toEqual({
          p: Infinity,
          itgrlp: Infinity,
        });
        expect(actual.outputs[5]?.value).toEqual([0, Infinity, NaN, NaN]);
        expect(actual.outputs[7]?.value).toEqual({
          root1: [NaN, 0],
          root2: [-Infinity, 0],
        });
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.polyds([1, 2], 1, 3)).toEqual([7, 2]);
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

it("independent polynomial oracle preserves negative-order no-write and guards unsafe workspaces", () => {
  const program = `
import json
import spiceypy as sp
from py_parity_sidecar import polynomial_oracle as oracle
from spiceypy.utils.exceptions import SpiceINVALIDDEGREE,SpiceINVALIDRADIUS,SpiceDEGENERATECASE
sp.reset()
sp.kclear()
try:
    negative_calls=0
    for coefficients in [[],[2,-3,5]]:
        for order in [-1,-2,-2147483648]:
            assert oracle.polyds(coefficients,order,.5)==[]
            negative_calls+=1
    blocked=0
    for order,chebyshev in [(-1,True),(715827882,True),(2147483647,False),(-2147483649,False)]:
        try: oracle.derivative_order(order,chebyshev=chebyshev)
        except ValueError: blocked+=1
        else: raise AssertionError("Unsafe order reached C")
    class Oversize:
        def __len__(self): return 2147483648
        def __iter__(self): raise AssertionError("Oversized coefficients inspected")
    try: oracle.coefficients(Oversize(),allow_empty=True)
    except ValueError: blocked+=1
    else: raise AssertionError("Unsafe coefficient count reached C")
    try: sp.chbigr(-1,[0],[0,1],0)
    except SpiceINVALIDDEGREE: pass
    else: raise AssertionError("Missing degree error")
    for radius in [0,-2]:
        try: sp.chbigr(0,[1],[0,radius],0)
        except SpiceINVALIDRADIUS: pass
        else: raise AssertionError("Missing radius error")
    try: sp.rquad(0,0,1)
    except SpiceDEGENERATECASE: pass
    else: raise AssertionError("Missing degenerate equation error")
    assert not sp.failed()
    print(json.dumps({"negativeCalls":negative_calls,"blocked":blocked,"recovery":list(sp.chbigr(0,[1],[0,1],.5)),"emptyDegree":oracle.polyds([],3,2)}))
finally:
    sp.reset()
    sp.kclear()
`;
  const stdout = execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8", timeout: 15_000 },
  );
  expect(JSON.parse(stdout)).toEqual({
    negativeCalls: 6,
    blocked: 5,
    recovery: [1, 0.5],
    emptyDegree: [0, 0, 0, 0],
  });
}, 20_000);
