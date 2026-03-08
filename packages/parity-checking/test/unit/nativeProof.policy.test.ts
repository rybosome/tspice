import { describe, expect, it } from "vitest";

import {
  PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST,
  isParityProofNativeV2Enabled,
  resolveReferenceExecutionPlan,
} from "../../src/proof/nativeProof.js";

import type { RunCaseInputV2 } from "../../src/runners/types.js";

function baseCallContractInput(): RunCaseInputV2 {
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

function baseCallContractObjectArgsInput(): RunCaseInputV2 {
  const base = baseCallContractInput();

  return {
    ...base,
    args: {
      token: 1,
    },
    contract: {
      ...base.contract,
      args: [
        {
          name: "token",
          type: "spiceInt",
        },
      ],
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

  it("keeps callContract fast-path in non-proof mode", () => {
    const plan = resolveReferenceExecutionPlan(baseCallContractInput(), {
      proofMode: false,
    });

    expect(plan.transport).toBe("callContract-fast-path");
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("keeps positional callContract workflows on fast-path in proof mode", () => {
    const plan = resolveReferenceExecutionPlan(baseCallContractInput(), {
      proofMode: true,
    });

    expect(plan.transport).toBe("callContract-fast-path");
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("uses native transport for object-arg callContract workflows in proof mode", () => {
    const plan = resolveReferenceExecutionPlan(baseCallContractObjectArgsInput(), {
      proofMode: true,
    });

    expect(plan.transport).toBe("native-cspice-runner");
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["callContract"]);
  });

  it("allows only frozen exception methods to keep callContract fast-path in proof mode", () => {
    const input = baseCallContractInput();
    input.workflow.steps = [{ op: "callContract", call: "dskgd_c" }];

    const plan = resolveReferenceExecutionPlan(input, {
      proofMode: true,
    });

    expect(PARITY_PROOF_NATIVE_V2_EXCEPTION_ALLOWLIST).toEqual(["dskb02_c", "dskgd_c"]);
    expect(plan.transport).toBe("callContract-fast-path");
    expect(plan.excepted).toBe(true);
    expect(plan.exceptionMethod).toBe("dskgd_c");
  });

  it("keeps non-callContract workflows on native reference transport in proof mode", () => {
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
    expect(plan.excepted).toBe(false);
    expect(plan.ops).toEqual(["projectResult"]);
  });
});
