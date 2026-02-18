import { describe, expect, it } from "vitest";

import { runDispatchAliasParityGuard } from "../../src/engine/dispatchParityGuard.js";
import { readAliasMap } from "../../src/generated/readAliasMap.js";

import type { ResolvedMethodSpec } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";

class StubRunner implements CaseRunner {
  readonly kind = "stub";

  constructor(private readonly aliasMap: Record<string, string>) {}

  async runCase(input: RunCaseInput): Promise<RunCaseResult> {
    const canonicalCall = this.aliasMap[input.call] ?? input.call;
    return {
      ok: true,
      result: {
        canonicalCall,
        args: input.args,
      },
    };
  }
}

function makeResolvedMethods(aliasMap: Record<string, string>): ResolvedMethodSpec[] {
  const canonicalMethods = Array.from(new Set(Object.values(aliasMap))).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return canonicalMethods.map((canonicalMethod) => ({
    method: {
      id: `methods/${canonicalMethod.replace(".", "/")}@v1`,
      kind: "method",
      contractMethod: canonicalMethod,
      canonicalMethod,
      cases: [{ id: "alias-guard-seed", args: [] }],
      meta: { sourcePath: `/tmp/${canonicalMethod}.yml` },
    },
    includeOrder: [],
    mergedSetup: undefined,
    mergedCompareDefaults: undefined,
  }));
}

describe("runDispatchAliasParityGuard", () => {
  it("validates alias dispatch parity centrally", async () => {
    const aliasMap = readAliasMap();
    const runner = new StubRunner(aliasMap);

    const summary = await runDispatchAliasParityGuard(makeResolvedMethods(aliasMap), runner);
    expect(summary.validatedAliasCount).toBe(Object.keys(aliasMap).length);
  });
});
