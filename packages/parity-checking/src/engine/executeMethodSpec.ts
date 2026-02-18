import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { parseScenario } from "../dsl/parse.js";
import { executeScenario } from "../dsl/execute.js";
import { mergeCompareChain } from "../dsl/mergeResolvedSpec.js";
import { spiceShortSymbol } from "../errors/spiceShort.js";

import type { CaseRunner } from "../runners/types.js";
import type { ResolvedMethodSpec } from "../dsl/types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeVolatileResultFields(call: string, result: unknown): unknown {
  if (call !== "ephemeris.spksfs" || !isRecord(result) || result.found !== true) {
    return result;
  }

  if (!("handle" in result)) {
    return result;
  }

  const rest = { ...result };
  delete rest.handle;
  return rest;
}


function buildCompareOptions(tolAbs: number, tolRel: number, angleWrapPi: boolean | undefined): {
  tolAbs: number;
  tolRel: number;
  angleWrapPi?: boolean;
} {
  const out: { tolAbs: number; tolRel: number; angleWrapPi?: boolean } = { tolAbs, tolRel };
  if (angleWrapPi !== undefined) {
    out.angleWrapPi = angleWrapPi;
  }
  return out;
}

function assertExpectedOutcome(
  methodId: string,
  caseId: string,
  expectedOk: boolean | undefined,
  tspiceOk: boolean,
  cspiceOk: boolean,
): void {
  if (expectedOk === undefined) return;

  if (tspiceOk !== expectedOk || cspiceOk !== expectedOk) {
    throw new Error(
      `Expectation mismatch (${methodId} case=${caseId}): expect.ok=${expectedOk} but got tspice.ok=${tspiceOk}, cspice.ok=${cspiceOk}`,
    );
  }
}

function assertExpectedErrorShort(
  methodId: string,
  caseId: string,
  expectedErrorShort: string | undefined,
  tspiceShort: string | undefined,
  cspiceShort: string | undefined,
): void {
  if (expectedErrorShort === undefined) return;

  const expectedSymbol = spiceShortSymbol(expectedErrorShort);
  if (!expectedSymbol) {
    throw new Error(
      `Invalid expect.errorShort for ${methodId} case=${caseId}: ${JSON.stringify(expectedErrorShort)}`,
    );
  }

  if (!tspiceShort || !cspiceShort) {
    throw new Error(
      `Missing spice.short while validating expect.errorShort for ${methodId} case=${caseId}`,
    );
  }

  const tspiceSymbol = spiceShortSymbol(tspiceShort);
  const cspiceSymbol = spiceShortSymbol(cspiceShort);

  if (tspiceSymbol !== expectedSymbol || cspiceSymbol !== expectedSymbol) {
    throw new Error(
      `expect.errorShort mismatch (${methodId} case=${caseId}): expected=${expectedSymbol}, tspice=${tspiceSymbol}, cspice=${cspiceSymbol}`,
    );
  }
}

export type MethodExecutionSummary = {
  methodId: string;
  caseCount: number;
};

export async function executeMethodSpecParity(
  resolvedMethod: ResolvedMethodSpec,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  const method = resolvedMethod.method;

  const scenario = parseScenario({
    sourcePath: method.meta.sourcePath,
    data: {
      name: method.id,
      setup: resolvedMethod.mergedSetup,
      compare: resolvedMethod.mergedCompareDefaults,
      cases: method.cases.map((scenarioCase) => ({
        id: scenarioCase.id,
        call: method.contractMethod,
        args: scenarioCase.args ?? [],
        setup: scenarioCase.setup,
        compare: scenarioCase.compare,
        expect: scenarioCase.expect,
      })),
    },
  });

  const tspiceOut = await executeScenario(scenario, runners.tspice);
  const cspiceOut = await executeScenario(scenario, runners.cspice);

  if (tspiceOut.cases.length !== cspiceOut.cases.length) {
    throw new Error(
      `Runner output length mismatch for ${method.id}: tspice=${tspiceOut.cases.length}, cspice=${cspiceOut.cases.length}`,
    );
  }

  for (let index = 0; index < tspiceOut.cases.length; index++) {
    const tspiceCase = tspiceOut.cases[index]!;
    const cspiceCase = cspiceOut.cases[index]!;

    const compare = mergeCompareChain([
      scenario.compare,
      tspiceCase.case.compare,
    ]);

    const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
    const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
    const angleWrapPi = compare?.angleWrapPi;
    const errorShort = compare?.errorShort ?? false;

    const label = `${method.id} case=${tspiceCase.case.id} call=${tspiceCase.case.call}`;

    const caseExpect = method.cases[index]?.expect;
    assertExpectedOutcome(
      method.id,
      tspiceCase.case.id,
      caseExpect?.ok,
      tspiceCase.outcome.ok,
      cspiceCase.outcome.ok,
    );

    if (!tspiceCase.outcome.ok || !cspiceCase.outcome.ok) {
      assertExpectedErrorShort(
        method.id,
        tspiceCase.case.id,
        caseExpect?.errorShort,
        tspiceCase.outcome.ok ? undefined : tspiceCase.outcome.error.spice?.short,
        cspiceCase.outcome.ok ? undefined : cspiceCase.outcome.error.spice?.short,
      );
    }

    if (tspiceCase.outcome.ok !== cspiceCase.outcome.ok) {
      throw new Error(
        [
          `Outcome mismatch (${label}):`,
          `  tspice ok=${tspiceCase.outcome.ok} ${tspiceCase.outcome.ok ? "" : `error=${JSON.stringify(tspiceCase.outcome.error)}`}`,
          `  cspice ok=${cspiceCase.outcome.ok} ${cspiceCase.outcome.ok ? "" : `error=${JSON.stringify(cspiceCase.outcome.error)}`}`,
        ].join("\n"),
      );
    }

    if (!tspiceCase.outcome.ok || !cspiceCase.outcome.ok) {
      if (errorShort) {
        const tspiceShort = tspiceCase.outcome.ok ? undefined : tspiceCase.outcome.error.spice?.short;
        const cspiceShort = cspiceCase.outcome.ok ? undefined : cspiceCase.outcome.error.spice?.short;

        if (!tspiceShort || !cspiceShort) {
          throw new Error(`Missing spice.short while comparing errors (${label})`);
        }

        const tspiceSymbol = spiceShortSymbol(tspiceShort);
        const cspiceSymbol = spiceShortSymbol(cspiceShort);

        if (!tspiceSymbol || !cspiceSymbol) {
          throw new Error(
            `errorShort comparison failed to normalize symbol (${label}) tspice=${JSON.stringify(tspiceShort)} cspice=${JSON.stringify(cspiceShort)}`,
          );
        }

        if (tspiceSymbol !== cspiceSymbol) {
          throw new Error(
            `errorShort mismatch (${label}) tspice=${tspiceSymbol} cspice=${cspiceSymbol}`,
          );
        }

        continue;
      }

      const cmp = compareValues(
        tspiceCase.outcome.ok ? undefined : tspiceCase.outcome.error,
        cspiceCase.outcome.ok ? undefined : cspiceCase.outcome.error,
        buildCompareOptions(tolAbs, tolRel, angleWrapPi),
      );

      if (!cmp.ok) {
        throw new Error(`Error mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
      }

      continue;
    }

    const tspiceResult = normalizeVolatileResultFields(tspiceCase.case.call, tspiceCase.outcome.result);
    const cspiceResult = normalizeVolatileResultFields(cspiceCase.case.call, cspiceCase.outcome.result);

    const cmp = compareValues(tspiceResult, cspiceResult, buildCompareOptions(tolAbs, tolRel, angleWrapPi));
    if (!cmp.ok) {
      throw new Error(`Result mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
    }
  }

  return {
    methodId: method.id,
    caseCount: method.cases.length,
  };
}
