import { describe, expect, it } from "vitest";

import { executeMethodSpecParity } from "../../src/engine/executeMethodSpec.js";

import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";
import type { ResolvedMethodSpec } from "../../src/dsl/types.js";

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
  expect: ResolvedMethodSpec["method"]["cases"][number]["expect"],
  mergedSetup?: ResolvedMethodSpec["mergedSetup"],
): ResolvedMethodSpec {
  const resolved: ResolvedMethodSpec = {
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
    includeOrder: [],
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
});
