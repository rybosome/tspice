import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
  StepCoordsVectorsVdist,
  StepCoordsVectorsUnorm,
  StepCoordsVectorsUcrss,
  StepCoordsVectorsVsep,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type ProbeStep =
  | StepCoordsVectorsVdist
  | StepCoordsVectorsUnorm
  | StepCoordsVectorsUcrss
  | StepCoordsVectorsVsep;
const maximum = Number.MAX_VALUE;
const workflow: ProbeStep[] = [
  { op: "coords-vectors.vdist", a: [maximum, 0, 0], b: [-maximum, 0, 0] },
  { op: "coords-vectors.vdist", a: [maximum, maximum, 0], b: [0, 0, 0] },
  {
    op: "coords-vectors.vdist",
    a: [maximum / 4, -maximum / 4, 0],
    b: [0, 0, 0],
  },
  { op: "coords-vectors.unorm", v: [maximum, -maximum, maximum] },
  { op: "coords-vectors.unorm", v: [maximum / 4, 0, 0] },
  {
    op: "coords-vectors.ucrss",
    a: [maximum, maximum, 0],
    b: [maximum, 0, maximum],
  },
  {
    op: "coords-vectors.vsep",
    a: [maximum, maximum, 0],
    b: [-maximum, -maximum, 0],
  },
  {
    op: "coords-vectors.vsep",
    a: [maximum / 4, maximum / 4, 0],
    b: [-maximum / 4, -maximum / 4, 0],
  },
  {
    op: "coords-vectors.ucrss",
    a: [Number.MIN_VALUE, 0, 0],
    b: [0, Number.MIN_VALUE, 0],
  },
];
const parityCase: ParityCase = {
  caseId: "vector-basics-finite-input-overflow-live",
  description:
    "Independent live observations of finite-input overflow and finite recovery.",
  workflow,
  expectation: { kind: "success" },
};

// The shared workflow JSON cannot encode NaN/Infinity. Classify each actual
// oracle scalar in this focused test, then decode without rounding or discards.
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
        if step["op"] == "coords-vectors.vdist": values = [sp.vdist(step["a"], step["b"])]
        elif step["op"] == "coords-vectors.vsep": values = [sp.vsep(step["a"], step["b"])]
        elif step["op"] == "coords-vectors.ucrss": values = sp.ucrss(step["a"], step["b"]).tolist()
        elif step["op"] == "coords-vectors.unorm":
            unit, norm = sp.unorm(step["v"])
            values = unit.tolist() + [norm]
        else: raise ValueError("Unexpected vector probe operation")
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
    throw new Error("Missing live vector probe outputs");
  return workflow.map((step, index): StepOutput => {
    const row: unknown = encoded[index];
    const count =
      step.op === "coords-vectors.unorm"
        ? 4
        : step.op === "coords-vectors.ucrss"
          ? 3
          : 1;
    if (!Array.isArray(row) || row.length !== count)
      throw new Error("Malformed live vector probe components");
    switch (step.op) {
      case "coords-vectors.vdist":
      case "coords-vectors.vsep":
        return { op: step.op, value: decodeNumber(row[0]) };
      case "coords-vectors.ucrss":
        return {
          op: step.op,
          value: [
            decodeNumber(row[0]),
            decodeNumber(row[1]),
            decodeNumber(row[2]),
          ],
        };
      case "coords-vectors.unorm":
        return {
          op: step.op,
          value: {
            unit: [
              decodeNumber(row[0]),
              decodeNumber(row[1]),
              decodeNumber(row[2]),
            ],
            norm: decodeNumber(row[3]),
          },
        };
    }
  });
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: finite-input overflow follows live CSPICE without inventing errors`,
    async () => {
      const oracle = oracleOutputs();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = workflow.map((step): StepOutput => {
          switch (step.op) {
            case "coords-vectors.vdist":
              return { op: step.op, value: spice.raw.vdist(step.a, step.b) };
            case "coords-vectors.vsep":
              return { op: step.op, value: spice.raw.vsep(step.a, step.b) };
            case "coords-vectors.ucrss":
              return { op: step.op, value: spice.raw.ucrss(step.a, step.b) };
            case "coords-vectors.unorm":
              return { op: step.op, value: spice.raw.unorm(step.v) };
          }
        });
        const result = (outputs: StepOutput[]): CaseExecutionSuccess => ({
          caseId: parityCase.caseId,
          ok: true,
          outputs,
          error: null,
        });
        assertCaseParity(parityCase, result(oracle), result(actual));
        const distanceNaN = actual[0],
          distanceInfinity = actual[1],
          normalized = actual[3];
        if (
          distanceNaN?.op !== "coords-vectors.vdist" ||
          distanceInfinity?.op !== "coords-vectors.vdist" ||
          normalized?.op !== "coords-vectors.unorm"
        )
          throw new Error("Missing actual overflow observations");
        expect(Number.isNaN(distanceNaN.value)).toBe(true);
        expect(distanceInfinity.value).toBe(Infinity);
        expect(normalized.value.norm).toBe(Infinity);
        expect(normalized.value.unit.every((value) => value === 0)).toBe(true);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.vdist([3, 4, 0], [0, 0, 0])).toBe(5);
        expect(spice.raw.unorm([3, 4, 0]).norm).toBe(5);
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
