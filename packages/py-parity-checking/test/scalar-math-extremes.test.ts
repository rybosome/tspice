import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
  StepCoordsVectorsBrcktd,
  StepCoordsVectorsSumad,
  StepCoordsVectorsMaxd,
  StepCoordsVectorsMind,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type ProbeStep =
  | StepCoordsVectorsBrcktd
  | StepCoordsVectorsSumad
  | StepCoordsVectorsMaxd
  | StepCoordsVectorsMind;
const maximum = Number.MAX_VALUE;
const workflow: ProbeStep[] = [
  { op: "coords-vectors.sumad", values: [maximum, maximum] },
  { op: "coords-vectors.sumad", values: [-maximum, -maximum] },
  { op: "coords-vectors.sumad", values: [maximum, maximum, -maximum] },
  { op: "coords-vectors.sumad", values: [maximum / 4, maximum / 4] },
  { op: "coords-vectors.sumad", values: [-0] },
  { op: "coords-vectors.brcktd", value: -0, end1: -1, end2: 1 },
  { op: "coords-vectors.maxd", values: [-0] },
  { op: "coords-vectors.maxd", values: [0, -0] },
  { op: "coords-vectors.maxd", values: [-0, 0] },
  { op: "coords-vectors.mind", values: [-0] },
  { op: "coords-vectors.mind", values: [0, -0] },
  { op: "coords-vectors.mind", values: [-0, 0] },
];
const parityCase: ParityCase = {
  caseId: "scalar-math-live-floating-extremes",
  description:
    "Actual sumad floating overflow and min/max/bracket signed-zero observations with every scalar retained.",
  workflow,
  expectation: { kind: "success" },
};

// Ordinary JSON loses negative zero inputs and cannot encode infinity outputs.
// These explicit test-only tags preserve both without changing shared parity.
const oracleProgram = `
import json, math, sys
import spiceypy as sp
from py_parity_sidecar import scalar_math_oracle as scalar

def decode_input(value):
    if value == {"kind": "negative-zero"}: return -0.0
    return value

def encode(value):
    value = float(value)
    if math.isnan(value): return {"kind": "nan"}
    if value == math.inf: return {"kind": "positive-infinity"}
    if value == -math.inf: return {"kind": "negative-infinity"}
    if value == 0.0 and math.copysign(1.0, value) < 0: return {"kind": "negative-zero"}
    return {"kind": "finite", "value": value}

sp.reset()
sp.kclear()
try:
    outputs = []
    for step in json.load(sys.stdin, object_hook=decode_input):
        op = step["op"]
        if op == "coords-vectors.sumad": result = sp.sumad(step["values"])
        elif op == "coords-vectors.brcktd": result = sp.brcktd(step["value"], step["end1"], step["end2"])
        elif op == "coords-vectors.maxd": result = scalar.maxd(step["values"])
        elif op == "coords-vectors.mind": result = scalar.mind(step["values"])
        else: raise ValueError("Unexpected scalar probe operation")
        assert not sp.failed(), "Unexpected SPICE error in floating scalar probe"
        outputs.append(encode(result))
    print(json.dumps(outputs, allow_nan=False))
finally:
    sp.reset()
    sp.kclear()
`;
function decodeNumber(value: unknown): number {
  if (typeof value !== "object" || value === null || !("kind" in value))
    throw new Error("Malformed oracle scalar classification");
  if (value.kind === "positive-infinity") return Infinity;
  if (value.kind === "negative-infinity") return -Infinity;
  if (value.kind === "nan") return NaN;
  if (value.kind === "negative-zero") return -0;
  if (
    value.kind === "finite" &&
    "value" in value &&
    typeof value.value === "number" &&
    Number.isFinite(value.value)
  )
    return value.value;
  throw new Error("Malformed oracle scalar value");
}
const sidecar = path.resolve(import.meta.dirname, "../sidecars/spiceypy");
function oracleValues(): number[] {
  const stdout = execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", oracleProgram],
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
  const encoded: unknown = JSON.parse(stdout);
  if (!Array.isArray(encoded) || encoded.length !== workflow.length)
    throw new Error("Missing live scalar outputs");
  return encoded.map(decodeNumber);
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: retains actual floating overflow and signed-zero selection`,
    async () => {
      const oracle = oracleValues();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = workflow.map((step): number => {
          switch (step.op) {
            case "coords-vectors.sumad":
              return spice.raw.sumad(step.values);
            case "coords-vectors.brcktd":
              return spice.raw.brcktd(step.value, step.end1, step.end2);
            case "coords-vectors.maxd":
              return spice.raw.maxd(step.values);
            case "coords-vectors.mind":
              return spice.raw.mind(step.values);
          }
        });
        const result = (values: number[]): CaseExecutionSuccess => ({
          caseId: parityCase.caseId,
          ok: true,
          outputs: workflow.map((step, i): StepOutput => ({
            op: step.op,
            value: values[i]!,
          })),
          error: null,
        });
        assertCaseParity(parityCase, result(oracle), result(actual));
        for (let i = 0; i < oracle.length; i++)
          if (oracle[i] === 0)
            expect(Object.is(actual[i], oracle[i])).toBe(true);
        expect(actual.slice(0, 3)).toEqual([Infinity, -Infinity, Infinity]);
        expect(Number.isFinite(actual[3])).toBe(true);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.sumad([1.25, -2.5, 7.75])).toBe(6.5);
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

it("independent oracle guards reject undefined variadic and integer inputs before their C calls", () => {
  const program = `
import json
from py_parity_sidecar import scalar_math_oracle as scalar
blocked = 0
for name in ["maxd", "mind", "maxi", "mini"]:
    try: getattr(scalar, name)([1] * 31)
    except ValueError: blocked += 1
    else: raise AssertionError("Unsupported variadic count reached C")
for values in [[2147483647, 1], [-2147483648, -1], [2147483647, 1, -1], [-2147483648, -1, 1]]:
    try: scalar.sumai(values)
    except ValueError: blocked += 1
    else: raise AssertionError("Unsafe signed prefix reached C")
print(json.dumps({"blocked": blocked, "safeSum": scalar.sumai([2147483647, -2147483647, 1]), "safeMaximum": scalar.maxd([1.25, -3, 7.5])}))
`;
  const stdout = execFileSync(
    "uv",
    ["run", "--locked", "--project", sidecar, "python", "-c", program],
    { encoding: "utf8", timeout: 15_000 },
  );
  expect(JSON.parse(stdout)).toEqual({
    blocked: 8,
    safeSum: 1,
    safeMaximum: 7.5,
  });
}, 20_000);
