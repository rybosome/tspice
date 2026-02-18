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

describe("method case expectation semantics", () => {
  it("enforces cases[].expect.ok and cases[].expect.errorShort", async () => {
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
            expect: {
              ok: false,
              errorShort: "SPICE(BADTIMESTRING)",
            },
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

    const runner = new ErrorRunner();

    const summary = await executeMethodSpecParity(resolved, {
      tspice: runner,
      cspice: runner,
    });

    expect(summary.caseCount).toBe(1);
  });
});
