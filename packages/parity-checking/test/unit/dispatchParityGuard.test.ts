import { describe, expect, it } from "vitest";

import { runDispatchAliasParityGuard } from "../../src/engine/dispatchParityGuard.js";
import { readAliasMap } from "../../src/generated/readAliasMap.js";

import type { ResolvedMethodSpec } from "../../src/dsl/types.js";
import type { CaseRunner, RunCaseInput, RunCaseResult } from "../../src/runners/types.js";

class StubRunner implements CaseRunner {
  readonly kind = "stub";
  readonly calls: RunCaseInput[] = [];

  constructor(private readonly aliasMap: Record<string, string>) {}

  async runCase(input: RunCaseInput): Promise<RunCaseResult> {
    this.calls.push(input);
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

function makeResolvedMethod(canonicalMethod: string, cases: Array<{ id: string; args?: unknown[] }>): ResolvedMethodSpec {
  return {
    method: {
      id: `methods/${canonicalMethod.replace(".", "/")}@v1`,
      kind: "method",
      contractMethod: canonicalMethod,
      canonicalMethod,
      cases,
      meta: { sourcePath: `/tmp/${canonicalMethod}.yml` },
    },
    includeOrder: [],
    mergedSetup: undefined,
    mergedCompareDefaults: undefined,
  };
}

function makeResolvedMethods(aliasMap: Record<string, string>): ResolvedMethodSpec[] {
  const canonicalMethods = Array.from(new Set(Object.values(aliasMap))).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return canonicalMethods.map((canonicalMethod) =>
    makeResolvedMethod(canonicalMethod, [{ id: "alias-guard-seed", args: [] }]),
  );
}

describe("runDispatchAliasParityGuard", () => {
  it("validates alias dispatch parity centrally", async () => {
    const aliasMap = readAliasMap();
    const runner = new StubRunner(aliasMap);

    const summary = await runDispatchAliasParityGuard(makeResolvedMethods(aliasMap), runner);
    expect(summary.validatedAliasCount).toBe(Object.keys(aliasMap).length);
  });

  it("runs all method cases per canonical alias target", async () => {
    const aliasMap = readAliasMap();
    const runner = new StubRunner(aliasMap);
    const resolvedMethods = makeResolvedMethods(aliasMap).map((method) =>
      method.method.canonicalMethod === "time.str2et"
        ? makeResolvedMethod("time.str2et", [
            { id: "case-a", args: ["2000 JAN 01 12:00:00 TDB"] },
            { id: "case-b", args: ["2000 JAN 02 12:00:00 TDB"] },
          ])
        : method,
    );

    await runDispatchAliasParityGuard(resolvedMethods, runner);

    const aliasCalls = runner.calls.filter((call) => call.call === "str2et").map((call) => call.args[0]);
    expect(aliasCalls).toEqual(["2000 JAN 01 12:00:00 TDB", "2000 JAN 02 12:00:00 TDB"]);
  });
});
