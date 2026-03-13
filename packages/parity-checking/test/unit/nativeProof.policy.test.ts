import { describe, expect, it } from "vitest";

import {
  isParityProofNativeEnabled,
  parityProofMarker,
  resolveReferenceExecutionPlan,
} from "../../src/proof/nativeProof.js";

import type { RunCaseInputV3 } from "../../src/runners/types.js";

function baseCallInput(): RunCaseInputV3 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/tkvrsn@v3",
      kind: "method",
    },
    contract: {
      contractMethod: "time.tkvrsn",
      canonicalMethod: "time.tkvrsn",
      errors: [],
    },
    args: ["TOOLKIT"],
    workflow: {
      steps: [
        {
          op: "call",
          fn: "time.tkvrsn",
          in: "$args",
        },
      ],
    },
  };
}

describe("native proof policy (generated dispatch boundary mode)", () => {
  it("is always enabled in canonical dispatch-boundary proof mode", () => {
    expect(isParityProofNativeEnabled({ PARITY_PROOF_NATIVE: "1" })).toBe(true);
    expect(isParityProofNativeEnabled({ PARITY_PROOF_NATIVE: "0" })).toBe(true);
    expect(isParityProofNativeEnabled({})).toBe(true);
  });

  it("emits stable proof marker for generated-dispatch-boundary mode", () => {
    expect(parityProofMarker()).toBe("proof=generated-dispatch-boundary");
  });

  it("returns machine-readable generated dispatch proof plan", () => {
    const plan = resolveReferenceExecutionPlan(baseCallInput(), { proofMode: true });

    expect(plan).toEqual({
      transport: "generated-dispatch-seam",
      ops: ["call"],
      dispatchHandoffAttempted: true,
      fallbackUsed: false,
      stopPoint: "generated-dispatch-unavailable",
    });
  });
});
