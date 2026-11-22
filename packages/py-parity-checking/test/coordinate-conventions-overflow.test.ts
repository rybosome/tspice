import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepOutput,
  StepCoordsVectorsRecazl,
  StepCoordsVectorsRecrad,
  StepCoordsVectorsPgrrec,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type ProbeStep =
  StepCoordsVectorsRecazl | StepCoordsVectorsRecrad | StepCoordsVectorsPgrrec;
const maximum = Number.MAX_VALUE;
const workflow: ProbeStep[] = [
  {
    op: "coords-vectors.recazl",
    rect: [maximum, maximum, maximum],
    azccw: true,
    elplsz: true,
  },
  {
    op: "coords-vectors.recazl",
    rect: [maximum, maximum, maximum],
    azccw: true,
    elplsz: false,
  },
  {
    op: "coords-vectors.recazl",
    rect: [maximum, maximum, maximum],
    azccw: false,
    elplsz: true,
  },
  {
    op: "coords-vectors.recazl",
    rect: [maximum, maximum, maximum],
    azccw: false,
    elplsz: false,
  },
  { op: "coords-vectors.recrad", rect: [maximum, maximum, maximum] },
  {
    op: "coords-vectors.pgrrec",
    body: "EARTH",
    lon: 0,
    lat: 0,
    alt: maximum,
    re: maximum,
    f: 0,
  },
  {
    op: "coords-vectors.pgrrec",
    body: "EARTH",
    lon: 0.7,
    lat: -0.4,
    alt: maximum,
    re: maximum,
    f: 0,
  },
  {
    op: "coords-vectors.recazl",
    rect: [maximum / 4, maximum / 4, maximum / 4],
    azccw: false,
    elplsz: false,
  },
  {
    op: "coords-vectors.recrad",
    rect: [maximum / 4, maximum / 4, maximum / 4],
  },
  {
    op: "coords-vectors.pgrrec",
    body: "EARTH",
    lon: 0.7,
    lat: -0.4,
    alt: maximum / 4,
    re: maximum / 4,
    f: 0,
  },
];
const parityCase: ParityCase = {
  caseId: "coordinate-conventions-finite-input-overflow-live",
  description:
    "Actual finite-input overflow observations with every component retained, all azimuth/elevation flags and finite controls.",
  workflow,
  expectation: { kind: "success" },
};

// The ordinary workflow JSON cannot encode non-finite values. Classify every
// independently observed scalar here and reconstruct it without substitutes.
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
        if op == "coords-vectors.recazl": values = sp.recazl(step["rect"], step["azccw"], step["elplsz"])
        elif op == "coords-vectors.recrad": values = sp.recrad(step["rect"])
        elif op == "coords-vectors.pgrrec": values = sp.pgrrec(step["body"], step["lon"], step["lat"], step["alt"], step["re"], step["f"])
        else: raise ValueError("Unexpected coordinate probe operation")
        assert not sp.failed(), "Unexpected SPICE error in finite-input overflow probe"
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
    throw new Error("Missing live coordinate outputs");
  return workflow.map((step, index): StepOutput => {
    const row: unknown = encoded[index];
    if (!Array.isArray(row) || row.length !== 3)
      throw new Error("Malformed live coordinate components");
    const first = decodeNumber(row[0]),
      second = decodeNumber(row[1]),
      third = decodeNumber(row[2]);
    switch (step.op) {
      case "coords-vectors.recazl":
        return { op: step.op, value: { range: first, az: second, el: third } };
      case "coords-vectors.recrad":
        return { op: step.op, value: { range: first, ra: second, dec: third } };
      case "coords-vectors.pgrrec":
        return { op: step.op, value: [first, second, third] };
    }
  });
}
for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: preserves live overflow components and defined finite recovery`,
    async () => {
      const oracle = oracleOutputs();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        spice.raw.kclear();
        const actual = workflow.map((step): StepOutput => {
          switch (step.op) {
            case "coords-vectors.recazl":
              return {
                op: step.op,
                value: spice.raw.recazl(step.rect, step.azccw, step.elplsz),
              };
            case "coords-vectors.recrad":
              return { op: step.op, value: spice.raw.recrad(step.rect) };
            case "coords-vectors.pgrrec":
              return {
                op: step.op,
                value: spice.raw.pgrrec(
                  step.body,
                  step.lon,
                  step.lat,
                  step.alt,
                  step.re,
                  step.f,
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
        const range = actual[0],
          rectangular = actual[5],
          finite = actual[8];
        if (
          range?.op !== "coords-vectors.recazl" ||
          rectangular?.op !== "coords-vectors.pgrrec" ||
          finite?.op !== "coords-vectors.recrad"
        )
          throw new Error("Missing actual coordinate observations");
        expect(range.value.range).toBe(Infinity);
        expect(Number.isFinite(range.value.az)).toBe(true);
        expect(Number.isFinite(range.value.el)).toBe(true);
        expect(rectangular.value).toEqual([Infinity, 0, 0]);
        expect(Number.isFinite(finite.value.range)).toBe(true);
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.recrad([3, 4, 0]).range).toBe(5);
        expect(spice.raw.pgrrec("EARTH", 0, 0, 1, 3, 0)).toEqual([4, 0, 0]);
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
