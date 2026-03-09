import { describe, expect, it } from "vitest";

import { executeMethodSpecParity } from "../../src/engine/executeMethodSpec.js";

import type { MethodCaseExpectation, ScenarioSetupAst } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";

type LegacyResolvedInput = {
  method: {
    id: string;
    kind: "method";
    contractMethod: string;
    canonicalMethod: string;
    defaults?: {
      compare?: {
        errorShort?: boolean;
      };
    };
    cases: Array<{
      id: string;
      args: unknown;
      expect?: MethodCaseExpectation;
    }>;
    meta: {
      sourcePath: string;
    };
  };
  mergedSetup?: ScenarioSetupAst;
  mergedCompareDefaults?: {
    errorShort?: boolean;
  };
};

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

function buildResolved(
  expect: MethodCaseExpectation | undefined,
  mergedSetup?: ScenarioSetupAst,
): LegacyResolvedInput {
  const resolved: LegacyResolvedInput = {
    method: {
      id: "methods/time/str2et@v1",
      kind: "method",
      contractMethod: "time.str2et",
      canonicalMethod: "time.str2et",
      defaults: {
        compare: {
          errorShort: true,
        },
      },
      cases: [
        {
          id: "invalid",
          args: ["NOT_A_TIME"],
          expect,
        },
      ],
      meta: {
        sourcePath: "/tmp/str2et.yml",
      },
    },
    mergedCompareDefaults: {
      errorShort: true,
    },
  };

  if (mergedSetup !== undefined) {
    resolved.mergedSetup = mergedSetup;
  }

  return resolved;
}

describe("method case expectation semantics", () => {
  it("enforces cases[].expect.ok and cases[].expect.errorShort", async () => {
    const resolved = buildResolved({
      ok: false,
      errorShort: "SPICE(BADTIMESTRING)",
    });

    const runner = new ErrorRunner();

    const summary = await executeMethodSpecParity(resolved, {
      tspice: runner,
      cspice: runner,
    });

    expect(summary.caseCount).toBe(1);
  });

  it("fails expect.errorShort when either runner succeeds", async () => {
    const resolved = buildResolved({
      errorShort: "SPICE(BADTIMESTRING)",
    });

    const runner = new SuccessRunner();

    await expect(
      executeMethodSpecParity(resolved, {
        tspice: runner,
        cspice: runner,
      }),
    ).rejects.toThrow(/expect\.errorShort requires both outcomes to fail/);
  });

  it("accepts merged setup kernel objects when reparsing runtime scenarios", async () => {
    const kernelEntry = {
      path: "/tmp/kernels/example.tm",
      restrictToDir: "/tmp/kernels",
    };
    const resolved = buildResolved(undefined, {
      kernels: [kernelEntry],
    });

    const tspice = new SuccessRunner();
    const cspice = new SuccessRunner();

    const summary = await executeMethodSpecParity(resolved, {
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
    const resolved: LegacyResolvedInput = {
      method: {
        id: "methods/file-io/unsupported@v1",
        kind: "method",
        contractMethod: "file-io.unknown",
        canonicalMethod: "file-io.unknown",
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
      executeMethodSpecParity(resolved, {
        tspice,
        cspice,
      }),
    ).resolves.toMatchObject({ caseCount: 1 });
  });
});
