import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import { spiceShortSymbol } from "../errors/spiceShort.js";
import {
  isParityProofNativeV2Enabled,
  resolveReferenceExecutionPlan,
} from "../proof/nativeProof.js";
import { validateV2ContractResultOrThrow } from "../runners/v2ContractResultValidation.js";

import type { MethodCaseExpectation, MethodCaseSpecV3, MethodSpecV3, ScenarioCompareAst, ScenarioSetupAst } from "../dsl/types.js";
import type { CaseRunner, RunCaseInputV3 } from "../runners/types.js";
import type { MethodExecutionSummary } from "./executeMethodSpec.js";

type MethodRunCase = {
  caseId: string;
  workflow: Exclude<MethodSpecV3["workflow"], undefined>;
  args: unknown;
  expect?: MethodCaseExpectation;
  setupChain: Array<ScenarioSetupAst | undefined>;
  compareChain: Array<ScenarioCompareAst | undefined>;
};

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
  method: MethodSpecV3,
  caseId: string,
  result: unknown,
): void {
  if (method.contract.result === undefined) {
    return;
  }

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
    throw new Error(`Invalid expect.errorShort for ${methodId} case=${caseId}: ${JSON.stringify(expectedErrorShort)}`);
  }

  if (!tspiceShort || !cspiceShort) {
    throw new Error(`Missing spice.short while validating expect.errorShort for ${methodId} case=${caseId}`);
  }

  const tspiceSymbol = spiceShortSymbol(tspiceShort);
  const cspiceSymbol = spiceShortSymbol(cspiceShort);

  if (tspiceSymbol !== expectedSymbol || cspiceSymbol !== expectedSymbol) {
    throw new Error(
      `expect.errorShort mismatch (${methodId} case=${caseId}): expected=${expectedSymbol}, tspice=${tspiceSymbol}, cspice=${cspiceSymbol}`,
    );
  }
}

function isCallContractOnlyWorkflow(workflow: Exclude<MethodSpecV3["workflow"], undefined>): boolean {
  return workflow.steps.length === 1 && workflow.steps[0]?.op === "callContract";
}

function pushRuns(
  out: MethodRunCase[],
  workflow: Exclude<MethodSpecV3["workflow"], undefined>,
  cases: MethodCaseSpecV3[],
  labelPrefix: string,
  setupChainHead: Array<ScenarioSetupAst | undefined>,
  compareChainHead: Array<ScenarioCompareAst | undefined>,
): void {
  for (const scenarioCase of cases) {
    out.push({
      caseId: labelPrefix ? `${labelPrefix}:${scenarioCase.id}` : scenarioCase.id,
      workflow,
      args: scenarioCase.args,
      setupChain: [...setupChainHead, scenarioCase.setup],
      compareChain: [...compareChainHead, scenarioCase.compare],
      ...(scenarioCase.expect !== undefined ? { expect: scenarioCase.expect } : {}),
    });
  }
}

function buildMethodRuns(method: MethodSpecV3): MethodRunCase[] {
  const runs: MethodRunCase[] = [];

  if (method.workflow && method.cases) {
    pushRuns(runs, method.workflow, method.cases, "", [method.setup], [method.defaults?.compare]);
    return runs;
  }

  for (const suite of method.suites ?? []) {
    pushRuns(
      runs,
      suite.workflow,
      suite.cases,
      suite.id,
      [method.setup, suite.setup],
      [method.defaults?.compare, suite.defaults?.compare],
    );
  }

  return runs;
}

/** Execute and compare one v3 method spec across tspice and cspice runners. */
export async function executeMethodSpecParityV2(
  method: MethodSpecV3,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  const runs = buildMethodRuns(method);
  const proofEnabled = isParityProofNativeV2Enabled();
  const proofReferenceRecords: MethodExecutionSummary["proofReferenceRecords"] = [];

  for (const run of runs) {
    const setup = mergeSetupChain(run.setupChain);
    const compare = mergeCompareChain(run.compareChain);

    const argsDefault = isCallContractOnlyWorkflow(run.workflow) ? [] : {};

    const caseInput: RunCaseInputV3 = {
      schemaVersion: 3,
      manifest: method.manifest,
      contract: method.contract,
      args: run.args ?? argsDefault,
      workflow: run.workflow,
      ...(setup === undefined ? {} : { setup }),
    };

    if (proofEnabled) {
      const referencePlan = resolveReferenceExecutionPlan(caseInput, { proofMode: true });
      proofReferenceRecords.push({
        method: method.manifest.id,
        caseId: run.caseId,
        transport: referencePlan.transport,
        ops: referencePlan.ops,
      });
    }

    const [tspiceOutcome, cspiceOutcome] = await Promise.all([
      runners.tspice.runCase(caseInput),
      runners.cspice.runCase(caseInput),
    ]);

    const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
    const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
    const angleWrapPi = compare?.angleWrapPi;
    const errorShort = compare?.errorShort ?? false;

    const label = `${method.manifest.id} case=${run.caseId} call=${method.contract.contractMethod}`;

    assertExpectedOutcome(method.manifest.id, run.caseId, run.expect?.ok, tspiceOutcome.ok, cspiceOutcome.ok);

    assertExpectedErrorCode(
      method.manifest.id,
      run.caseId,
      run.expect?.errorCode,
      tspiceOutcome.ok ? undefined : tspiceOutcome.error.code,
      cspiceOutcome.ok ? undefined : cspiceOutcome.error.code,
    );

    if (run.expect?.errorShort !== undefined) {
      if (tspiceOutcome.ok || cspiceOutcome.ok) {
        throw new Error(
          `Invalid expect.errorShort contract (${method.manifest.id} case=${run.caseId}): expect.errorShort requires both outcomes to fail, but got tspice.ok=${tspiceOutcome.ok}, cspice.ok=${cspiceOutcome.ok}`,
        );
      }

      assertExpectedErrorShort(
        method.manifest.id,
        run.caseId,
        run.expect.errorShort,
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
      const tspiceError = normalizeRunnerErrorForParity(tspiceOutcome.ok ? undefined : tspiceOutcome.error);
      const cspiceError = normalizeRunnerErrorForParity(cspiceOutcome.ok ? undefined : cspiceOutcome.error);

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
          throw new Error(`errorShort mismatch (${label}) tspice=${tspiceSymbol} cspice=${cspiceSymbol}`);
        }

        continue;
      }

      const cmp = compareValues(tspiceError, cspiceError, buildCompareOptions(tolAbs, tolRel, angleWrapPi));
      if (!cmp.ok) {
        throw new Error(`Error mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
      }

      continue;
    }

    assertContractResultMatches(method.manifest.id, "tspice", method, run.caseId, tspiceOutcome.result);
    assertContractResultMatches(method.manifest.id, "cspice", method, run.caseId, cspiceOutcome.result);

    const tspiceResult = normalizeVolatileResultFields(method.contract.contractMethod, tspiceOutcome.result);
    const cspiceResult = normalizeVolatileResultFields(method.contract.contractMethod, cspiceOutcome.result);

    const cmp = compareValues(tspiceResult, cspiceResult, buildCompareOptions(tolAbs, tolRel, angleWrapPi));
    if (!cmp.ok) {
      throw new Error(`Result mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
    }
  }

  return {
    methodId: method.manifest.id,
    caseCount: runs.length,
    ...(proofEnabled ? { proofReferenceRecords } : {}),
  };
}
