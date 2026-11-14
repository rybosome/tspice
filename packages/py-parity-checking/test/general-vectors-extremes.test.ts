import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { ParityCase, WorkflowStep } from "../src/case-types.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const maximum = Number.MAX_VALUE;
const workflow: WorkflowStep[] = [
  {
    op: "coords-vectors.vaddg",
    a: [maximum, -maximum, 0, 1],
    b: [maximum, -maximum, 0, 2],
  },
  {
    op: "coords-vectors.vsubg",
    a: [maximum, -maximum, 0, 1],
    b: [-maximum, maximum, 0, 2],
  },
  { op: "coords-vectors.vsclg", s: 2, v: [maximum, -maximum, 0, 1] },
  {
    op: "coords-vectors.vlcomg",
    a: 2,
    v1: [maximum, -maximum, 1, 0],
    b: 3,
    v2: [maximum, -maximum, 2, 0],
  },
  // Same-sign products avoid compiler-sensitive cancellation of overflowing products.
  { op: "coords-vectors.vdotg", a: [maximum, maximum], b: [2, 2] },
  { op: "coords-vectors.vdistg", a: [maximum, 0], b: [-maximum, 0] },
  { op: "coords-vectors.vnormg", v: [maximum, -maximum, 0, 0] },
  { op: "coords-vectors.vhatg", v: [maximum, -maximum, 0, 0] },
  { op: "coords-vectors.unormg", v: [maximum, -maximum, 0, 0] },
  { op: "coords-vectors.vprojg", a: [maximum, maximum], b: [1, 1] },
  { op: "coords-vectors.vprojg", a: [maximum, maximum], b: [maximum, maximum] },
  { op: "coords-vectors.vrelg", a: [maximum, 0], b: [-maximum, 0] },
  // Infinite norms also affect finite outputs: retain the actual raw algorithm.
  {
    op: "coords-vectors.vsepg",
    a: [maximum, maximum],
    b: [-maximum, -maximum],
  },
  {
    op: "coords-vectors.vaddg",
    a: [maximum / 4, -maximum / 4],
    b: [maximum / 4, -maximum / 4],
  },
  { op: "coords-vectors.vnormg", v: [maximum / 4, -maximum / 4] },
  { op: "coords-vectors.vdistg", a: [maximum / 4, 0], b: [-maximum / 4, 0] },
  { op: "coords-vectors.vdotg", a: [maximum / 4, maximum / 4], b: [1, 1] },
  {
    op: "coords-vectors.vlcomg",
    a: 0.5,
    v1: [maximum / 4, -maximum / 4],
    b: 0.5,
    v2: [maximum / 4, -maximum / 4],
  },
  { op: "coords-vectors.vhatg", v: [maximum / 4, -maximum / 4] },
  { op: "coords-vectors.unormg", v: [maximum / 4, -maximum / 4] },
  { op: "coords-vectors.vequg", v: [-0, 0, 1, -1] },
  { op: "coords-vectors.vminug", v: [-0, 0, 1, -1] },
];
const parityCase: ParityCase = {
  caseId: "general-vectors-live-floating-extremes",
  description:
    "Every actual scalar/vector/unit/norm field, including defined floating nonfinite outputs, from the independent locked oracle and public raw backend.",
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
        assert not sp.failed(), "Unexpected SPICE error in general-vector probe"
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
    `${backend}: retains every independent live nonfinite general-vector component`,
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
        {
          encoding: "utf8",
          input: JSON.stringify(workflow, (_key, value: unknown) =>
            typeof value === "number" && Object.is(value, -0)
              ? { kind: "negative-zero" }
              : value,
          ),
          timeout: 15_000,
        },
      );
      const oracle = decode(JSON.parse(stdout));
      if (!Array.isArray(oracle) || oracle.length !== workflow.length)
        throw new Error("Missing oracle outputs");
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
        expect(actual.outputs[0]?.value).toEqual([Infinity, -Infinity, 0, 3]);
        expect(actual.outputs[4]?.value).toBe(Infinity);
        expect(actual.outputs[5]?.value).toBeNaN();
        expect(actual.outputs[8]?.value).toEqual({
          unit: [0, -0, 0, 0],
          norm: Infinity,
        });
        expect(actual.outputs[10]?.value).toEqual([NaN, NaN]);
        expect(actual.outputs[12]?.value).toBe(0);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.vaddg([1, -2, 4, 8], [2, 3, -5, 7])).toEqual([
          3, 1, -1, 15,
        ]);
        expect(spice.raw.unormg([])).toEqual({ unit: [], norm: 0 });
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

it("empty-only independent oracle bindings protect dummy storage and reject unsafe dimensions before C", () => {
  const program = `
import json
from py_parity_sidecar import general_vector_oracle as oracle
from py_parity_sidecar.decode import _decode_step
from py_parity_sidecar.handlers.coords_vectors import run_coords_vectors_step

names=["vaddg","vequg","vhatg","vlcomg","vminug","vprojg","vsclg","vsubg","unormg"]
for name in names:
    result=oracle.empty_result(name,a=2,b=-3,s=-2)
    assert result == ([],0.0) if name == "unormg" else result == []
class Oversize:
    def __init__(self,count): self.count=count
    def __len__(self): return self.count
    def __iter__(self): raise AssertionError("Unsafe dimension inspected entries")
blocked=0
for name in ["vprojg","unormg","vequg"]:
    try: oracle.validate_inputs(name,Oversize(2147483647 if name in ["vprojg","unormg"] else 2147483648))
    except ValueError: blocked+=1
    else: raise AssertionError("Unsafe count reached C")
for step in [
    {"op":"coords-vectors.vaddg","a":[1,2],"b":[3]},
    {"op":"coords-vectors.vlcomg","a":2,"v1":[1],"b":3,"v2":[]},
    {"op":"coords-vectors.unormg","v":[float("inf")]},
]:
    try: run_coords_vectors_step(_decode_step(step),None)
    except ValueError: blocked+=1
    else: raise AssertionError("Invalid input reached independent C")
print(json.dumps({"emptyCalls":len(names),"blocked":blocked}))
`;
  const stdout = execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8", timeout: 15_000 },
  );
  expect(JSON.parse(stdout)).toEqual({ emptyCalls: 9, blocked: 6 });
}, 20_000);
