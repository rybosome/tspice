import { describe, expect, it } from "vitest";

import { executeMethodSpecParity } from "../../src/engine/executeMethodSpec.js";

import type { MethodCaseExpectation, MethodSpecV3, ScenarioSetupAst } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";

class ErrorRunner implements CaseRunner {
  readonly kind = "stub-error";

  async runCase(_input: RunCaseInput): Promise<RunCaseResult> {
    return {
      ok: false,
      error: {
        message: "bad time",
        spice: {
          short: "SPICE(BADTIMESTRING)",
        },
      },
    };
  }
}

class SuccessRunner implements CaseRunner {
  readonly kind = "stub-success";

  readonly inputs: RunCaseInput[] = [];

  async runCase(input: RunCaseInput): Promise<RunCaseResult> {
    this.inputs.push(input);
    return {
      ok: true,
      result: 123,
    };
  }
}

function buildMethod(
  expectSpec: MethodCaseExpectation | undefined,
  setup?: ScenarioSetupAst,
): MethodSpecV3 {
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
    ...(setup !== undefined ? { setup } : {}),
    defaults: {
      compare: {
        errorShort: true,
      },
    },
    workflow: {
      steps: [{ op: "call", in: [] }],
    },
    cases: [
      {
        id: "invalid",
        args: ["NOT_A_TIME"],
        expect: expectSpec,
      },
    ],
    meta: {
      sourcePath: "/tmp/str2et.yml",
    },
  };
}

describe("method case expectation semantics", () => {
  it("enforces cases[].expect.ok and cases[].expect.errorShort", async () => {
    const method = buildMethod({
      ok: false,
      errorShort: "SPICE(BADTIMESTRING)",
    });

    const runner = new ErrorRunner();

    const summary = await executeMethodSpecParity(method, {
      tspice: runner,
      cspice: runner,
    });

    expect(summary.caseCount).toBe(1);
  });

  it("fails expect.errorShort when either runner succeeds", async () => {
    const method = buildMethod({
      errorShort: "SPICE(BADTIMESTRING)",
    });

    const runner = new SuccessRunner();

    await expect(
      executeMethodSpecParity(method, {
        tspice: runner,
        cspice: runner,
      }),
    ).rejects.toThrow(/expect\.errorShort requires both outcomes to fail/);
  });

  it("preserves setup kernel objects in runner input", async () => {
    const kernelEntry = {
      path: "/tmp/kernels/example.tm",
      restrictToDir: "/tmp/kernels",
    };
    const method = buildMethod(undefined, {
      kernels: [kernelEntry],
    });

    const tspice = new SuccessRunner();
    const cspice = new SuccessRunner();

    const summary = await executeMethodSpecParity(method, {
      tspice,
      cspice,
    });

    expect(summary.caseCount).toBe(1);
    expect(tspice.inputs).toHaveLength(1);
    expect(cspice.inputs).toHaveLength(1);
    expect(tspice.inputs[0]?.setup?.kernels).toEqual([kernelEntry]);
    expect(cspice.inputs[0]?.setup?.kernels).toEqual([kernelEntry]);
  });

  it("ignores error.details metadata differences during parity comparison", async () => {
    const method: MethodSpecV3 = {
      schemaVersion: 3,
      manifest: {
        id: "methods/file-io/unsupported@v3",
        kind: "method",
      },
      contract: {
        contractMethod: "file-io.unknown",
        canonicalMethod: "file-io.unknown",
      },
      workflow: {
        steps: [{ op: "call", in: [] }],
      },
      cases: [
        {
          id: "unsupported",
          args: [],
          expect: {
            ok: false,
            errorCode: "unsupported_call",
          },
        },
      ],
      meta: {
        sourcePath: "/tmp/file-io-unsupported.yml",
      },
    };

    const tspice: CaseRunner = {
      kind: "stub-tspice",
      async runCase(): Promise<RunCaseResult> {
        return {
          ok: false,
          error: {
            code: "unsupported_call",
            message: "Unsupported call",
            details: {
              call: "file-io.exists",
            },
            spice: { failed: false },
          },
        };
      },
    };

    const cspice: CaseRunner = {
      kind: "stub-cspice",
      async runCase(): Promise<RunCaseResult> {
        return {
          ok: false,
          error: {
            code: "unsupported_call",
            message: "Unsupported call",
            details: {
              call: "file-io.getfat",
            },
            spice: { failed: false },
          },
        };
      },
    };

    await expect(
      executeMethodSpecParity(method, {
        tspice,
        cspice,
      }),
    ).resolves.toMatchObject({ caseCount: 1 });
  });
});
