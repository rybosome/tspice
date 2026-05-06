import { describe, expect, it } from "vitest";

import type { CaseExecutionResult, ParityCase, StepOutput } from "../src/case-types.js";
import { assertCaseParity } from "../src/parity-assert.js";

const parityCase: ParityCase = {
  caseId: "geometry.sincpt.tolerance",
  description: "parity output comparison tolerance",
  workflow: [],
  expectation: { kind: "success" },
};

function successResult(outputs: StepOutput[]): CaseExecutionResult {
  return {
    caseId: parityCase.caseId,
    ok: true,
    outputs,
    error: null,
  };
}

describe("assertCaseParity", () => {
  it("accepts tiny floating-point drift", () => {
    const sidecarResult = successResult([
      {
        op: "geometry.sincpt",
        value: {
          found: true,
          spoint: [1000, -2000, 3000],
          trgepc: 123.456,
          srfvec: [1, 2, 3],
        },
      },
    ]);

    const tspiceResult = successResult([
      {
        op: "geometry.sincpt",
        value: {
          found: true,
          spoint: [1000 + 1e-13, -2000 - 1e-13, 3000],
          trgepc: 123.456 + 1e-13,
          srfvec: [1, 2 + 1e-13, 3],
        },
      },
    ]);

    expect(() => assertCaseParity(parityCase, sidecarResult, tspiceResult)).not.toThrow();
  });

  it("rejects meaningful numeric drift", () => {
    const sidecarResult = successResult([
      {
        op: "geometry.sincpt",
        value: {
          found: true,
          spoint: [1000, -2000, 3000],
          trgepc: 123.456,
          srfvec: [1, 2, 3],
        },
      },
    ]);

    const tspiceResult = successResult([
      {
        op: "geometry.sincpt",
        value: {
          found: true,
          spoint: [1000, -2000, 3000],
          trgepc: 123.456 + 1e-6,
          srfvec: [1, 2, 3],
        },
      },
    ]);

    expect(() => assertCaseParity(parityCase, sidecarResult, tspiceResult)).toThrow(
      /Output mismatch for success case geometry\.sincpt\.tolerance\./,
    );
  });
});
