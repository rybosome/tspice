import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
  Matrix3x3,
  StepCoordsVectorsDet,
  StepCoordsVectorsDiags2,
  StepCoordsVectorsInvert,
  StepCoordsVectorsInvort,
  StepCoordsVectorsMtxm,
  StepCoordsVectorsMxmt,
  StepCoordsVectorsTrace,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import {
  flattenMatrix,
  unflattenMatrix,
} from "../src/run-tspice/utils/matrix.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type ProbeStep =
  | StepCoordsVectorsDet
  | StepCoordsVectorsDiags2
  | StepCoordsVectorsInvert
  | StepCoordsVectorsInvort
  | StepCoordsVectorsMtxm
  | StepCoordsVectorsMxmt
  | StepCoordsVectorsTrace;
const maximum = Number.MAX_VALUE;
const diagonal = (value: number): Matrix3x3 => [
  [value, 0, 0],
  [0, value, 0],
  [0, 0, value],
];
const filled = (value: number): Matrix3x3 => [
  [value, value, value],
  [value, value, value],
  [value, value, value],
];
const workflow: ProbeStep[] = [
  { op: "coords-vectors.det", m: diagonal(1e200) },
  { op: "coords-vectors.trace", m: diagonal(maximum) },
  { op: "coords-vectors.diags2", symmat: [maximum, maximum, maximum, maximum] },
  { op: "coords-vectors.invert", m: diagonal(1e200) },
  {
    op: "coords-vectors.invert",
    m: [
      [maximum, 0, 0],
      [0, maximum, 0],
      [0, 0, 1],
    ],
  },
  { op: "coords-vectors.mtxm", a: filled(maximum), b: filled(2) },
  { op: "coords-vectors.mxmt", a: filled(maximum), b: filled(2) },
  {
    op: "coords-vectors.invort",
    m: [
      [maximum, 0, 0],
      [maximum, 1, 0],
      [0, 0, 1],
    ],
  },
  { op: "coords-vectors.det", m: diagonal(1e100) },
  { op: "coords-vectors.trace", m: diagonal(maximum / 4) },
  {
    op: "coords-vectors.diags2",
    symmat: [maximum / 4, maximum / 4, maximum / 4, maximum / 4],
  },
  { op: "coords-vectors.invert", m: diagonal(1e100) },
  { op: "coords-vectors.mtxm", a: filled(maximum / 8), b: filled(2) },
  { op: "coords-vectors.mxmt", a: filled(maximum / 8), b: filled(2) },
];
const parityCase: ParityCase = {
  caseId: "fixed-matrices-finite-input-overflow-live",
  description:
    "Independent actual matrix results at finite-input overflow boundaries, with every output component retained and finite controls.",
  workflow,
  expectation: { kind: "success" },
};

// The ordinary workflow transport cannot encode NaN/Infinity. This scoped test
// encodes all actual oracle numbers explicitly; no result is recomputed or lost.
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
        if op == "coords-vectors.det": values = [sp.det(step["m"])]
        elif op == "coords-vectors.trace": values = [sp.trace(step["m"])]
        elif op == "coords-vectors.diags2":
            s = step["symmat"]
            diag, rotate = sp.diags2([[s[0], s[1]], [s[2], s[3]]])
            values = diag.flatten().tolist() + rotate.flatten().tolist()
        elif op == "coords-vectors.invert": values = sp.invert(step["m"]).flatten().tolist()
        elif op == "coords-vectors.invort": values = sp.invort(step["m"]).flatten().tolist()
        elif op == "coords-vectors.mtxm": values = sp.mtxm(step["a"], step["b"]).flatten().tolist()
        elif op == "coords-vectors.mxmt": values = sp.mxmt(step["a"], step["b"]).flatten().tolist()
        else: raise ValueError("Unexpected fixed matrix probe operation")
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
    { encoding: "utf8", input: JSON.stringify(workflow), timeout: 15_000 },
  );
  const encoded: unknown = JSON.parse(stdout);
  if (!Array.isArray(encoded) || encoded.length !== workflow.length)
    throw new Error("Missing live fixed matrix outputs");
  return workflow.map((step, index): StepOutput => {
    const row: unknown = encoded[index];
    const count =
      step.op === "coords-vectors.det" || step.op === "coords-vectors.trace"
        ? 1
        : step.op === "coords-vectors.diags2"
          ? 8
          : 9;
    if (!Array.isArray(row) || row.length !== count)
      throw new Error("Malformed live fixed matrix components");
    if (step.op === "coords-vectors.det" || step.op === "coords-vectors.trace")
      return { op: step.op, value: decodeNumber(row[0]) };
    if (step.op === "coords-vectors.diags2")
      return {
        op: step.op,
        value: {
          diag: [
            decodeNumber(row[0]),
            decodeNumber(row[1]),
            decodeNumber(row[2]),
            decodeNumber(row[3]),
          ],
          rotate: [
            decodeNumber(row[4]),
            decodeNumber(row[5]),
            decodeNumber(row[6]),
            decodeNumber(row[7]),
          ],
        },
      };
    return { op: step.op, value: unflattenMatrix(row.map(decodeNumber)) };
  });
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: retains every live non-finite matrix component and finite recovery`,
    async () => {
      const oracle = oracleOutputs();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = workflow.map((step): StepOutput => {
          switch (step.op) {
            case "coords-vectors.det":
              return {
                op: step.op,
                value: spice.raw.det(flattenMatrix(step.m)),
              };
            case "coords-vectors.trace":
              return {
                op: step.op,
                value: spice.raw.trace(flattenMatrix(step.m)),
              };
            case "coords-vectors.diags2":
              return { op: step.op, value: spice.raw.diags2(step.symmat) };
            case "coords-vectors.invert":
              return {
                op: step.op,
                value: unflattenMatrix(spice.raw.invert(flattenMatrix(step.m))),
              };
            case "coords-vectors.invort":
              return {
                op: step.op,
                value: unflattenMatrix(spice.raw.invort(flattenMatrix(step.m))),
              };
            case "coords-vectors.mtxm":
              return {
                op: step.op,
                value: unflattenMatrix(
                  spice.raw.mtxm(flattenMatrix(step.a), flattenMatrix(step.b)),
                ),
              };
            case "coords-vectors.mxmt":
              return {
                op: step.op,
                value: unflattenMatrix(
                  spice.raw.mxmt(flattenMatrix(step.a), flattenMatrix(step.b)),
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
        const determinant = actual[0],
          inverse = actual[3],
          product = actual[5],
          finiteInverse = actual[11];
        if (
          determinant?.op !== "coords-vectors.det" ||
          inverse?.op !== "coords-vectors.invert" ||
          product?.op !== "coords-vectors.mtxm" ||
          finiteInverse?.op !== "coords-vectors.invert"
        )
          throw new Error("Missing actual matrix observations");
        expect(determinant.value).toBe(Infinity);
        for (let i = 0; i < 3; i++)
          expect(Number.isNaN(inverse.value[i]![i])).toBe(true);
        expect(product.value.flat().every((value) => value === Infinity)).toBe(
          true,
        );
        for (let i = 0; i < 3; i++)
          expect(finiteInverse.value[i]![i]! * 1e100).toBeCloseTo(1, 12);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.det(spice.raw.ident())).toBe(1);
        const identity = spice.raw.ident();
        const recoveredInverse = spice.raw.invert(identity);
        // Cofactor signs retain -0 off the diagonal. Recovery requires exact
        // numeric identity, without rewriting those legitimate output signs.
        for (let i = 0; i < 9; i++)
          expect(recoveredInverse[i] === identity[i]).toBe(true);
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
