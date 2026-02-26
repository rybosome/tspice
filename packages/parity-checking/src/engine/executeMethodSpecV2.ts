import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import { spiceShortSymbol } from "../errors/spiceShort.js";
import { validateV2ContractResultOrThrow } from "../runners/v2ContractResultValidation.js";

import type { MethodSpecV2 } from "../dsl/types.js";
import type { CaseRunner, RunCaseInputV2 } from "../runners/types.js";
import type { MethodExecutionSummary } from "./executeMethodSpec.js";

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

function normalizeRunnerErrorForParity(error: unknown): unknown {
  if (!isRecord(error) || !("details" in error)) {
    return error;
  }

  const rest = { ...error };
  delete rest.details;
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

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function assertContractResultMatches(
  label: string,
  runnerName: "tspice" | "cspice",
  method: MethodSpecV2,
  caseId: string,
  result: unknown,
): void {
  try {
    validateV2ContractResultOrThrow(result, method.contract.result, `${runnerName}.result`, (message) => {
      throw new Error(message);
    });
  } catch (error) {
    throw new Error(
      `Contract result validation failed (${label} case=${caseId} runner=${runnerName}): ${formatErrorMessage(error)}`,
    );
  }
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

function assertExpectedErrorCode(
  methodId: string,
  caseId: string,
  expectedErrorCode: string | undefined,
  tspiceCode: string | undefined,
  cspiceCode: string | undefined,
): void {
  if (expectedErrorCode === undefined) return;

  if (tspiceCode !== expectedErrorCode || cspiceCode !== expectedErrorCode) {
    throw new Error(
      `Expectation mismatch (${methodId} case=${caseId}): expect.errorCode=${expectedErrorCode} but got tspice.errorCode=${tspiceCode}, cspice.errorCode=${cspiceCode}`,
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

/** Execute and compare one v2 method spec across tspice and cspice runners. */
export async function executeMethodSpecParityV2(
  method: MethodSpecV2,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  for (const scenarioCase of method.cases) {
    const setup = mergeSetupChain([method.setup, scenarioCase.setup]);
    const compare = mergeCompareChain([method.defaults?.compare, scenarioCase.compare]);

    const caseInput: RunCaseInputV2 = {
      schemaVersion: 2 as const,
      manifest: method.manifest,
      contract: method.contract,
      args: scenarioCase.args ?? {},
      workflow: method.workflow,
      ...(setup === undefined ? {} : { setup }),
    };

    const [tspiceOutcome, cspiceOutcome] = await Promise.all([
      runners.tspice.runCase(caseInput),
      runners.cspice.runCase(caseInput),
    ]);

    const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
    const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
    const angleWrapPi = compare?.angleWrapPi;
    const errorShort = compare?.errorShort ?? false;

    const label = `${method.manifest.id} case=${scenarioCase.id} call=${method.contract.contractMethod}`;

    assertExpectedOutcome(
      method.manifest.id,
      scenarioCase.id,
      scenarioCase.expect?.ok,
      tspiceOutcome.ok,
      cspiceOutcome.ok,
    );

    assertExpectedErrorCode(
      method.manifest.id,
      scenarioCase.id,
      scenarioCase.expect?.errorCode,
      tspiceOutcome.ok ? undefined : tspiceOutcome.error.code,
      cspiceOutcome.ok ? undefined : cspiceOutcome.error.code,
    );

    if (scenarioCase.expect?.errorShort !== undefined) {
      if (tspiceOutcome.ok || cspiceOutcome.ok) {
        throw new Error(
          `Invalid expect.errorShort contract (${method.manifest.id} case=${scenarioCase.id}): expect.errorShort requires both outcomes to fail, but got tspice.ok=${tspiceOutcome.ok}, cspice.ok=${cspiceOutcome.ok}`,
        );
      }

      assertExpectedErrorShort(
        method.manifest.id,
        scenarioCase.id,
        scenarioCase.expect.errorShort,
        tspiceOutcome.error.spice?.short,
        cspiceOutcome.error.spice?.short,
      );
    }

    if (tspiceOutcome.ok !== cspiceOutcome.ok) {
      throw new Error(
        [
          `Outcome mismatch (${label}):`,
          `  tspice ok=${tspiceOutcome.ok} ${tspiceOutcome.ok ? "" : `error=${JSON.stringify(tspiceOutcome.error)}`}`,
          `  cspice ok=${cspiceOutcome.ok} ${cspiceOutcome.ok ? "" : `error=${JSON.stringify(cspiceOutcome.error)}`}`,
        ].join("\n"),
      );
    }

    if (!tspiceOutcome.ok || !cspiceOutcome.ok) {
      if (tspiceOutcome.ok || cspiceOutcome.ok) {
        throw new Error(`Outcome mismatch (${label}): one runner succeeded while the other failed`);
      }

      const tspiceError = normalizeRunnerErrorForParity(tspiceOutcome.error);
      const cspiceError = normalizeRunnerErrorForParity(cspiceOutcome.error);

      if (
        errorShort &&
        isRecord(tspiceError) &&
        isRecord(cspiceError) &&
        isRecord(tspiceError.spice) &&
        isRecord(cspiceError.spice) &&
        typeof tspiceError.spice.short === "string" &&
        typeof cspiceError.spice.short === "string"
      ) {
        const tspiceSymbol = spiceShortSymbol(tspiceError.spice.short);
        const cspiceSymbol = spiceShortSymbol(cspiceError.spice.short);

        if (!tspiceSymbol || !cspiceSymbol) {
          throw new Error(
            `errorShort comparison failed to normalize symbol (${label}) tspice=${JSON.stringify(tspiceError.spice.short)} cspice=${JSON.stringify(cspiceError.spice.short)}`,
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
        tspiceError,
        cspiceError,
        buildCompareOptions(tolAbs, tolRel, angleWrapPi),
      );

      if (!cmp.ok) {
        throw new Error(`Error mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
      }

      continue;
    }

    assertContractResultMatches(method.manifest.id, "tspice", method, scenarioCase.id, tspiceOutcome.result);
    assertContractResultMatches(method.manifest.id, "cspice", method, scenarioCase.id, cspiceOutcome.result);

    const tspiceResult = normalizeVolatileResultFields(method.contract.contractMethod, tspiceOutcome.result);
    const cspiceResult = normalizeVolatileResultFields(method.contract.contractMethod, cspiceOutcome.result);

    const cmp = compareValues(
      tspiceResult,
      cspiceResult,
      buildCompareOptions(tolAbs, tolRel, angleWrapPi),
    );

    if (!cmp.ok) {
      throw new Error(`Result mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
    }
  }

  return {
    methodId: method.manifest.id,
    caseCount: method.cases.length,
  };
}
