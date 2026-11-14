import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type {
  CaseExecutionSuccess,
  ParityCase,
  StepCoordsVectorsCyllat,
  StepCoordsVectorsCylsph,
  StepCoordsVectorsReccyl,
  StepOutput,
} from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

type OverflowStep =
  StepCoordsVectorsCyllat | StepCoordsVectorsCylsph | StepCoordsVectorsReccyl;
const maximum = Number.MAX_VALUE;
const workflow: OverflowStep[] = [
  { op: "coords-vectors.cyllat", radius: maximum, lon: -19.25, z: maximum },
  { op: "coords-vectors.cyllat", radius: -maximum, lon: 19.25, z: -maximum },
  { op: "coords-vectors.cylsph", radius: maximum, lon: -19.25, z: -maximum },
  { op: "coords-vectors.cylsph", radius: -maximum, lon: 19.25, z: maximum },
  { op: "coords-vectors.reccyl", rectan: [maximum, -maximum, -maximum] },
  { op: "coords-vectors.reccyl", rectan: [-maximum, maximum, maximum] },
  {
    op: "coords-vectors.cyllat",
    radius: maximum / 4,
    lon: -0.7,
    z: -maximum / 4,
  },
  {
    op: "coords-vectors.cylsph",
    radius: maximum / 4,
    lon: 0.7,
    z: maximum / 4,
  },
  { op: "coords-vectors.reccyl", rectan: [maximum / 4, -maximum / 4, 7] },
];
const parityCase: ParityCase = {
  caseId: "cylindrical-finite-input-overflow-live",
  description:
    "Finite input overflow and nearby finite controls, preserving every scalar.",
  workflow,
  expectation: { kind: "success" },
};

// Ordinary workflow JSON cannot encode nonfinite numbers. This scoped probe
// classifies actual independent SpiceyPy outputs before JSON serialization;
// no scientific value is substituted, rounded or omitted.
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
        if step["op"] == "coords-vectors.cyllat":
            radius, lon, lat = sp.cyllat(step["radius"], step["lon"], step["z"])
            value = {"radius": encode(radius), "lon": encode(lon), "lat": encode(lat)}
        elif step["op"] == "coords-vectors.cylsph":
            radius, colat, lon = sp.cylsph(step["radius"], step["lon"], step["z"])
            value = {"radius": encode(radius), "colat": encode(colat), "lon": encode(lon)}
        elif step["op"] == "coords-vectors.reccyl":
            radius, lon, z = sp.reccyl(step["rectan"])
            value = {"radius": encode(radius), "lon": encode(lon), "z": encode(z)}
        else:
            raise ValueError("Unexpected overflow probe operation")
        assert not sp.failed(), "Overflow unexpectedly changed the SPICE error state"
        outputs.append(value)
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
    throw new Error("Missing live overflow oracle outputs");
  return workflow.map((step, index): StepOutput => {
    const value: unknown = encoded[index];
    if (
      typeof value !== "object" ||
      value === null ||
      !("radius" in value) ||
      !("lon" in value)
    )
      throw new Error("Malformed live overflow oracle coordinates");
    const radius = decodeNumber(value.radius);
    const lon = decodeNumber(value.lon);
    switch (step.op) {
      case "coords-vectors.cyllat":
        if (!("lat" in value)) throw new Error("Missing oracle latitude");
        return {
          op: step.op,
          value: { radius, lon, lat: decodeNumber(value.lat) },
        };
      case "coords-vectors.cylsph":
        if (!("colat" in value)) throw new Error("Missing oracle colatitude");
        return {
          op: step.op,
          value: { radius, colat: decodeNumber(value.colat), lon },
        };
      case "coords-vectors.reccyl":
        if (!("z" in value)) throw new Error("Missing oracle height");
        return {
          op: step.op,
          value: { radius, lon, z: decodeNumber(value.z) },
        };
    }
  });
}

for (const backend of ["wasm", "node"] as const) {
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: finite-input overflow preserves the live oracle result without a SPICE error`,
    async () => {
      const oracle = oracleOutputs();
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const actual = workflow.map((step): StepOutput => {
          switch (step.op) {
            case "coords-vectors.cyllat":
              return {
                op: step.op,
                value: spice.raw.cyllat(step.radius, step.lon, step.z),
              };
            case "coords-vectors.cylsph":
              return {
                op: step.op,
                value: spice.raw.cylsph(step.radius, step.lon, step.z),
              };
            case "coords-vectors.reccyl":
              return { op: step.op, value: spice.raw.reccyl(step.rectan) };
          }
        });
        const result = (outputs: StepOutput[]): CaseExecutionSuccess => ({
          caseId: parityCase.caseId,
          ok: true,
          outputs,
          error: null,
        });
        assertCaseParity(parityCase, result(oracle), result(actual));
        // Literal assertions establish that this exercises overflow, followed
        // by genuine finite recovery, rather than comparing only finite cases.
        for (const output of actual.slice(0, 6)) {
          if (
            output.op === "coords-vectors.cyllat" ||
            output.op === "coords-vectors.cylsph" ||
            output.op === "coords-vectors.reccyl"
          )
            expect(output.value.radius).toBe(Infinity);
        }
        for (const output of actual.slice(6)) {
          if (
            output.op === "coords-vectors.cyllat" ||
            output.op === "coords-vectors.cylsph" ||
            output.op === "coords-vectors.reccyl"
          )
            expect(Number.isFinite(output.value.radius)).toBe(true);
        }
        expect(spice.raw.failed()).toBe(false);
        expect(spice.raw.reccyl([3, 4, -2]).radius).toBe(5);
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
