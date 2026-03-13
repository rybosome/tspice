import { describe, expect, it } from "vitest";

import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../../src/runners/generatedDispatchSeam.js";
import { executeMethodSpecParity } from "../../src/engine/executeMethodSpec.js";

import type { MethodSpecV3 } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseResult } from "../../src/runners/types.js";

type FailedRunCaseResult = Extract<RunCaseResult, { ok: false }>;

function methodSpec(): MethodSpecV3 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/str2et@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
    },
    workflow: {
      steps: [
        {
          op: "call",
          fn: "time.str2et",
          in: "$args",
        },
      ],
    },
    cases: [
      {
        id: "basic",
        args: ["2010-01-01T00:00:00"],
      },
    ],
    meta: { sourcePath: "specs/methods/time/str2et@v3.yml" },
  };
}

function boundaryOutcome(lane: "cspice" | "node" | "wasm"): FailedRunCaseResult {
  return {
    ok: false,
    error: {
      code: GENERATED_DISPATCH_UNAVAILABLE_CODE,
      lane,
      callId: "methods/time/str2et@v3::1",
      reason: GENERATED_DISPATCH_UNAVAILABLE_REASON,
      message: "Generated dispatch unavailable",
      details: {
        dispatchHandoffAttempted: true,
        fallbackUsed: false,
        stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
      },
      spice: { failed: false },
    },
  };
}

function runnerWith(outcome: RunCaseResult): CaseRunner {
  return {
    kind: "stub",
    async runCase(): Promise<RunCaseResult> {
      return outcome;
    },
  };
}

describe("executeMethodSpecParity (required lanes + normalized boundary compare)", () => {
  it("accepts normalized generated-dispatch boundary errors across cspice/node/wasm", async () => {
    const summary = await executeMethodSpecParity(methodSpec(), {
      cspice: runnerWith(boundaryOutcome("cspice")),
      node: runnerWith({
        ...boundaryOutcome("node"),
        error: {
          ...boundaryOutcome("node").error,
          message: "different text is ignored in normalized compare",
          details: {
            ...boundaryOutcome("node").error.details,
            extraNoise: "ignored",
          },
        },
      }),
      wasm: runnerWith(boundaryOutcome("wasm")),
    });

    expect(summary.caseCount).toBe(1);
    expect(summary.proofReferenceRecords).toHaveLength(1);
  });

  it("hard-fails when a required comparison lane diverges on normalized boundary fields", async () => {
    const badWasm = boundaryOutcome("wasm");
    if (!badWasm.ok) {
      badWasm.error.reason = "unexpected-boundary";
    }

    await expect(
      executeMethodSpecParity(methodSpec(), {
        cspice: runnerWith(boundaryOutcome("cspice")),
        node: runnerWith(boundaryOutcome("node")),
        wasm: runnerWith(badWasm),
      }),
    ).rejects.toThrow(/Boundary reason mismatch|Error mismatch|Required-lane hard-fail/);
  });

  it("hard-fails when a required lane cannot complete", async () => {
    const failingRunner: CaseRunner = {
      kind: "stub",
      async runCase(): Promise<RunCaseResult> {
        throw new Error("lane crashed");
      },
    };

    await expect(
      executeMethodSpecParity(methodSpec(), {
        cspice: runnerWith(boundaryOutcome("cspice")),
        node: failingRunner,
        wasm: runnerWith(boundaryOutcome("wasm")),
      }),
    ).rejects.toThrow(/lane crashed/);
  });
});
