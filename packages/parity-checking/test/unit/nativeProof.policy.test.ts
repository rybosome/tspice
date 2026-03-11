import { describe, expect, it } from "vitest";

import {
  PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST,
  isParityProofNativeV2Enabled,
  resolveReferenceExecutionPlan,
} from "../../src/proof/nativeProof.js";

import type { RunCaseInputV2 } from "../../src/runners/types.js";

function baseInput(contractMethod = "time.tkvrsn"): RunCaseInputV2 {
  return {
    schemaVersion: 3,
    manifest: {
      id: "methods/time/tkvrsn@v3",
      kind: "method",
    },
    contract: {
      contractMethod,
      canonicalMethod: contractMethod,
      errors: [],
    },
    args: ["TOOLKIT"],
    workflow: {
      steps: [{ op: "call", call: "self", in: ["$args.0"] }],
    },
  };
}

describe("native proof policy", () => {
  it("treats PARITY_PROOF_NATIVE_V2 as a strict gate (exactly '1')", () => {
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "1" })).toBe(true);
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "0" })).toBe(false);
    expect(isParityProofNativeV2Enabled({ PARITY_PROOF_NATIVE_V2: "true" })).toBe(false);
    expect(isParityProofNativeV2Enabled({})).toBe(false);
  });

  it("always records native-cspice-runner transport", () => {
    const plan = resolveReferenceExecutionPlan(baseInput());

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["call"]);
  });

  it("keeps frozen exception allowlist constrained to dskb02_c + dskgd_c", () => {
    expect(PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST).toEqual(["dskb02_c", "dskgd_c"]);

    const dskgd = resolveReferenceExecutionPlan(baseInput("dsk.dskgd"));
    expect(dskgd.transport).toBe("native-cspice-runner");
    expect(dskgd.excepted).toBe(true);
    expect(dskgd.exceptionMethod).toBe("dskgd_c");

    const dskb02 = resolveReferenceExecutionPlan(baseInput("dsk.dskb02"));
    expect(dskb02.excepted).toBe(true);
    expect(dskb02.exceptionMethod).toBe("dskb02_c");
  });

  it("tracks workflow op inventory for non-call workflows", () => {
    const input = baseInput();
    input.workflow.steps = [
      {
        op: "projectResult",
        out: {
          ok: 1,
        },
      },
    ];

    const plan = resolveReferenceExecutionPlan(input);

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["projectResult"]);
  });
});
