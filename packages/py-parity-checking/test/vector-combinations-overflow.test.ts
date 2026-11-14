import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
  StepCoordsVectorsVlcom,
  StepCoordsVectorsVlcom3,
  StepCoordsVectorsVperp,
  StepCoordsVectorsVproj,
  StepCoordsVectorsVrel,
  StepCoordsVectorsVrotv,
  StepCoordsVectorsRotvec,
  StepCoordsVectorsVtmv,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { flattenMatrix } from "../src/run-tspice/utils/matrix.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type ProbeStep =
  | StepCoordsVectorsVlcom
  | StepCoordsVectorsVlcom3
  | StepCoordsVectorsVperp
  | StepCoordsVectorsVproj
  | StepCoordsVectorsVrel
  | StepCoordsVectorsVrotv
  | StepCoordsVectorsRotvec
  | StepCoordsVectorsVtmv;
const maximum = Number.MAX_VALUE;
const minimum = Number.MIN_VALUE;
const workflow: ProbeStep[] = [
  {
    op: "coords-vectors.vlcom",
    a: 2,
    v1: [maximum, -maximum, 0],
    b: 1,
    v2: [maximum, -maximum, 1],
  },
  {
    op: "coords-vectors.vlcom3",
    a: 2,
    v1: [maximum, -maximum, 0],
    b: 1,
    v2: [maximum, -maximum, 1],
    c: 0.5,
    v3: [maximum, -maximum, 2],
  },
  { op: "coords-vectors.vproj", a: [minimum, 0, 0], b: [1, 0, 0] },
  { op: "coords-vectors.vperp", a: [minimum, 0, 0], b: [1, 0, 0] },
  { op: "coords-vectors.vproj", a: [maximum, maximum, 0], b: [1, 1, 0] },
  { op: "coords-vectors.vrel", a: [maximum, 0, 0], b: [-maximum, 0, 0] },
  {
    op: "coords-vectors.vrotv",
    v: [maximum, maximum, 0],
    axis: [0, 0, 1],
    theta: 0.25,
  },
  {
    op: "coords-vectors.rotvec",
    v: [maximum, maximum, 7],
    angle: 0.25,
    axis: 3,
  },
  {
    op: "coords-vectors.vtmv",
    v1: [maximum, maximum, maximum],
    matrix: [
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ],
    v2: [1, 1, 1],
  },
  { op: "coords-vectors.vproj", a: [1e-200, 0, 0], b: [1, 0, 0] },
  { op: "coords-vectors.vperp", a: [1e-200, 2e-200, 0], b: [1, 0, 0] },
  {
    op: "coords-vectors.vrel",
    a: [maximum / 4, 0, 0],
    b: [-maximum / 4, 0, 0],
  },
  {
    op: "coords-vectors.vrotv",
    v: [maximum / 4, maximum / 4, 0],
    axis: [0, 0, 1],
    theta: 0.25,
  },
  {
    op: "coords-vectors.rotvec",
    v: [maximum / 4, maximum / 4, 7],
    angle: 0.25,
    axis: 3,
  },
  {
    op: "coords-vectors.vtmv",
    v1: [maximum / 8, maximum / 8, maximum / 8],
    matrix: [
      [2, 0, 0],
      [0, 2, 0],
      [0, 0, 2],
    ],
    v2: [1, 1, 1],
  },
];
const parityCase: ParityCase = {
  caseId: "vector-combinations-finite-input-overflow-live",
  description:
    "Independent live observations of finite-input overflow, reciprocal-scale underflow boundaries and finite controls.",
  workflow,
  expectation: { kind: "success" },
};

// Ordinary workflow JSON cannot encode NaN/Infinity. This test-only transport
// classifies every actual oracle scalar and decodes it without rounding or loss.
const oracleProgram = `
import json, math, sys
import spiceypy as sp

def encode(value):
    value = float(value)
    if math.isnan(value): return {"kind": "nan"}
    if value == math.inf: return {"kind": "positive-infinity"}
    if value == -math.inf: return {"kind": "negative-infinity"}
    return {"kind": "finite", "value": value}

sp.reset()
sp.kclear()
try:
    outputs = []
    for step in json.load(sys.stdin):
        op = step["op"]
        if op == "coords-vectors.vlcom": values = sp.vlcom(step["a"], step["v1"], step["b"], step["v2"])
        elif op == "coords-vectors.vlcom3": values = sp.vlcom3(step["a"], step["v1"], step["b"], step["v2"], step["c"], step["v3"])
        elif op == "coords-vectors.vperp": values = sp.vperp(step["a"], step["b"])
        elif op == "coords-vectors.vproj": values = sp.vproj(step["a"], step["b"])
        elif op == "coords-vectors.vrel": values = [sp.vrel(step["a"], step["b"])]
        elif op == "coords-vectors.vrotv": values = sp.vrotv(step["v"], step["axis"], step["theta"])
        elif op == "coords-vectors.rotvec": values = sp.rotvec(step["v"], step["angle"], step["axis"])
        elif op == "coords-vectors.vtmv": values = [sp.vtmv(step["v1"], step["matrix"], step["v2"])]
        else: raise ValueError("Unexpected vector combinations probe operation")
        assert not sp.failed(), "Numerical overflow unexpectedly signaled a SPICE error"
        outputs.append([encode(value) for value in values])
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
  if (
    value.kind === "finite" &&
    "value" in value &&
    typeof value.value === "number" &&
    Number.isFinite(value.value)
  )
    return value.value;
  throw new Error("Malformed oracle scalar value");
}
function oracleOutputs(): StepOutput[] {
  const stdout = execFileSync(
    "uv",
    [
      "run",
      "--locked",
      "--project",
      path.resolve(import.meta.dirname, "../sidecars/spiceypy"),
      "python",
      "-c",
      oracleProgram,
    ],
    {
      encoding: "utf8",
      input: JSON.stringify(workflow),
      timeout: 15_000,
    },
  );
  const encoded: unknown = JSON.parse(stdout);
  if (!Array.isArray(encoded) || encoded.length !== workflow.length)
    throw new Error("Missing live vector combinations outputs");
  return workflow.map((step, index): StepOutput => {
    const row: unknown = encoded[index];
    const scalar =
      step.op === "coords-vectors.vrel" || step.op === "coords-vectors.vtmv";
    if (!Array.isArray(row) || row.length !== (scalar ? 1 : 3))
      throw new Error("Malformed live vector combinations components");
    if (step.op === "coords-vectors.vrel" || step.op === "coords-vectors.vtmv")
      return { op: step.op, value: decodeNumber(row[0]) };
    return {
      op: step.op,
      value: [decodeNumber(row[0]), decodeNumber(row[1]), decodeNumber(row[2])],
    };
  });
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: finite-input extremes follow every live oracle component without inventing errors`,
    async () => {
      const oracle = oracleOutputs();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = workflow.map((step): StepOutput => {
          switch (step.op) {
            case "coords-vectors.vlcom":
              return {
                op: step.op,
                value: spice.raw.vlcom(step.a, step.v1, step.b, step.v2),
              };
            case "coords-vectors.vlcom3":
              return {
                op: step.op,
                value: spice.raw.vlcom3(
                  step.a,
                  step.v1,
                  step.b,
                  step.v2,
                  step.c,
                  step.v3,
                ),
              };
            case "coords-vectors.vperp":
              return { op: step.op, value: spice.raw.vperp(step.a, step.b) };
            case "coords-vectors.vproj":
              return { op: step.op, value: spice.raw.vproj(step.a, step.b) };
            case "coords-vectors.vrel":
              return { op: step.op, value: spice.raw.vrel(step.a, step.b) };
            case "coords-vectors.vrotv":
              return {
                op: step.op,
                value: spice.raw.vrotv(step.v, step.axis, step.theta),
              };
            case "coords-vectors.rotvec":
              return {
                op: step.op,
                value: spice.raw.rotvec(step.v, step.angle, step.axis),
              };
            case "coords-vectors.vtmv":
              return {
                op: step.op,
                value: spice.raw.vtmv(
                  step.v1,
                  flattenMatrix(step.matrix),
                  step.v2,
                ),
              };
          }
        });
        const result = (outputs: StepOutput[]): CaseExecutionSuccess => ({
          caseId: parityCase.caseId,
          ok: true,
          outputs,
          error: null,
        });
        assertCaseParity(parityCase, result(oracle), result(actual));
        const combined = actual[0],
          projected = actual[2],
          perpendicular = actual[3],
          relative = actual[5],
          smallProjection = actual[9],
          smallPerpendicular = actual[10];
        if (
          combined?.op !== "coords-vectors.vlcom" ||
          projected?.op !== "coords-vectors.vproj" ||
          perpendicular?.op !== "coords-vectors.vperp" ||
          relative?.op !== "coords-vectors.vrel" ||
          smallProjection?.op !== "coords-vectors.vproj" ||
          smallPerpendicular?.op !== "coords-vectors.vperp"
        )
          throw new Error("Missing actual extreme observations");
        expect(combined.value).toEqual([Infinity, -Infinity, 1]);
        expect(projected.value.every(Number.isNaN)).toBe(true);
        expect(perpendicular.value.every(Number.isNaN)).toBe(true);
        expect(Number.isNaN(relative.value)).toBe(true);
        expect(smallProjection.value[0] / 1e-200).toBeCloseTo(1, 12);
        expect(smallPerpendicular.value[1] / 1e-200).toBeCloseTo(2, 12);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.vlcom(2, [1, 2, 3], -1, [1, 2, 3])).toEqual([1, 2, 3]);
        expect(spice.raw.vrel([1, 0, 0], [-1, 0, 0])).toBe(2);
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
