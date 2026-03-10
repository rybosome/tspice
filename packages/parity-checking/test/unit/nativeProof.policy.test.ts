import { describe, expect, it } from "vitest";

import {
  isParityProofNativeV2Enabled,
  parityProofMarker,
  resolveReferenceExecutionPlan,
} from "../../src/proof/nativeProof.js";

import type { RunCaseInputV3 } from "../../src/runners/types.js";

function baseCallContractInput(): RunCaseInputV3 {
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
      steps: [{ op: "callContract" }],
    },
  };
}

describe("native proof policy", () => {
  it("always enables native proof orchestration", () => {
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "1" })).toBe(true);
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "0" })).toBe(true);
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "true" })).toBe(true);
    expect(isParityProofNativeV2Enabled({})).toBe(true);

    expect(parityProofMarker({ PARITY_PROOF_NATIVE_V2: "1" })).toBe("proof=native-v2");
    expect(parityProofMarker({ PARITY_PROOF_NATIVE_V2: "0" })).toBe("proof=native-v2");
  });

  it("keeps callContract workflows on native reference transport", () => {
    const plan = resolveReferenceExecutionPlan(baseCallContractInput(), {
      proofMode: false,
    });

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("keeps callContract workflows on native reference transport when proofMode flag is passed", () => {
    const plan = resolveReferenceExecutionPlan(baseCallContractInput(), {
      proofMode: true,
    });

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("does not allow legacy exception methods to re-enable fast-path transport", () => {
    const input = baseCallContractInput();
    input.workflow.steps = [{ op: "callContract", call: "dskgd_c" }];

    const plan = resolveReferenceExecutionPlan(input, {
      proofMode: true,
    });

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("keeps non-callContract workflows on native reference transport", () => {
    const input = baseCallContractInput();
    input.workflow.steps = [
      {
        op: "projectResult",
        out: {
          ok: 1,
        },
      },
    ];

    const plan = resolveReferenceExecutionPlan(input, {
      proofMode: true,
    });

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.ops).toEqual(["projectResult"]);
  });
});
