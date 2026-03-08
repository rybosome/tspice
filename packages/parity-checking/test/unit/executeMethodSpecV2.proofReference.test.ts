import { afterEach, describe, expect, it } from "vitest";

import { executeMethodSpecParityV2 } from "../../src/engine/executeMethodSpecV2.js";

import type { MethodSpecV2 } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";

class StubRunner implements CaseRunner {
  readonly kind = "stub";

  constructor(private readonly outcome: RunCaseResult) {}

  async runCase(_input: RunCaseInput): Promise<RunCaseResult> {
    return this.outcome;
  }
}

function createMethod(): MethodSpecV2 {
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
    workflow: {
      steps: [{ op: "callContract" }],
    },
    cases: [
      {
        id: "toolkit",
        args: ["TOOLKIT"],
        expect: { ok: true },
      },
    ],
    meta: {
      sourcePath: "/tmp/time/tkvrsn@v3.yml",
    },
  };
}

describe("executeMethodSpecParityV2 proof reference semantics", () => {
  afterEach(() => {
    delete process.env.PARITY_PROOF_NATIVE_V2;
  });

  it("records CSPICE reference evidence when native proof mode is enabled", async () => {
    process.env.PARITY_PROOF_NATIVE_V2 = "1";

    const summary = await executeMethodSpecParityV2(createMethod(), {
      tspice: new StubRunner({ ok: true, result: "N0067" }),
      cspice: new StubRunner({ ok: true, result: "N0067" }),
    });

    expect(summary.proofReferenceRecords).toEqual([
      {
        method: "methods/time/tkvrsn@v3",
        caseId: "toolkit",
        referenceLane: "cspice",
        transport: "native-cspice-runner",
        ops: ["callContract"],
      },
    ]);
  });

  it("compares tspice output against cspice reference output", async () => {
    process.env.PARITY_PROOF_NATIVE_V2 = "1";

    await expect(
      executeMethodSpecParityV2(createMethod(), {
        tspice: new StubRunner({ ok: true, result: "N0066" }),
        cspice: new StubRunner({ ok: true, result: "N0067" }),
      }),
    ).rejects.toThrow(/result mismatch/i);
  });
});
