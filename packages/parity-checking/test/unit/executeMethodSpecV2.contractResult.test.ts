import { describe, expect, it } from "vitest";

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

function buildMethod(resultSchema: MethodSpecV2["contract"]["result"]): MethodSpecV2 {
  return {
    schemaVersion: 2,
    manifest: {
      id: "methods/cells-windows/cellGeti@v2",
      kind: "method",
    },
    contract: {
      contractMethod: "cells-windows.cellGeti",
      canonicalMethod: "cells-windows.cellGeti",
      aliases: [],
      result: resultSchema,
      errors: [],
    },
    workflow: {
      steps: [{ op: "invokeLegacyCall" }],
    },
    cases: [
      {
        id: "basic",
        args: [["int", 8], 1],
        expect: { ok: true },
      },
    ],
    meta: {
      sourcePath: "/tmp/cellGeti@v2.yml",
    },
  };
}

describe("executeMethodSpecParityV2 contract.result validation", () => {
  it("validates invokeLegacyCall success results against v2 contract.result const", async () => {
    const method = buildMethod({ const: 2 });
    const runner = new StubRunner({ ok: true, result: 999 });

    await expect(
      executeMethodSpecParityV2(method, {
        tspice: runner,
        cspice: runner,
      }),
    ).rejects.toThrow(/Contract result validation failed/);
  });
});
