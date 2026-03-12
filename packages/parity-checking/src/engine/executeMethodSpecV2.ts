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

import type { MethodCaseExpectation, MethodCaseSpecV2, MethodSpecV2, ScenarioCompareAst, ScenarioSetupAst } from "../dsl/types.js";
import type { CaseRunner, RunCaseInputV2 } from "../runners/types.js";
import type { MethodExecutionSummary } from "./executeMethodSpec.js";

type MethodRunCase = {
  caseId: string;
  workflow: Exclude<MethodSpecV2["workflow"], undefined>;
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

type BoundaryLane = "node" | "wasm" | "cspice";

type NormalizedBoundaryError = {
  code: string;
  lane: BoundaryLane;
  callId: string;
  reason: string;
  details?: Record<string, unknown>;
};

function resolveComparisonLane(runner: CaseRunner): Exclude<BoundaryLane, "cspice"> {
  const actualBackend = runner.backendMetadata?.actualBackend;
  if (actualBackend === "node" || actualBackend === "wasm") {
    return actualBackend;
  }

  if (runner.kind === "tspice(node)") {
    return "node";
  }

  if (runner.kind === "tspice(wasm)") {
    return "wasm";
  }

  // Unit-test stubs often use synthetic kinds; default to node lane for
  // comparison semantics that are lane-agnostic in those tests.
  return "node";
}

function resolveCallId(input: RunCaseInputV2): string {
  for (const step of input.workflow.steps) {
    if (step.op !== "call") {
      continue;
    }

    const fn = step.fn.trim();
    if (fn.length === 0 || fn === "self") {
      break;
    }

    return fn;
  }

  const contractMethod = input.contract.contractMethod.trim();
  return contractMethod.length > 0 ? contractMethod : "unknown.call";
}

function normalizeRunnerErrorForParity(
  error: unknown,
  lane: BoundaryLane,
  callId: string,
): NormalizedBoundaryError {
  if (!isRecord(error)) {
    return {
      code: "unknown_error",
      lane,
      callId,
      reason: String(error),
    };
  }

  const code = typeof error.code === "string" && error.code.trim().length > 0 ? error.code.trim() : "unknown_error";
  const reason = typeof error.message === "string" && error.message.trim().length > 0 ? error.message : String(error);
  const details =
    isRecord(error.details)
      ? { ...error.details }
      : undefined;

  return {
    code,
    lane,
    callId,
    reason,
    ...(details ? { details } : {}),
  };
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

function pushRuns(
  out: MethodRunCase[],
  workflow: Exclude<MethodSpecV2["workflow"], undefined>,
  cases: MethodCaseSpecV2[],
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

function buildMethodRuns(method: MethodSpecV2): MethodRunCase[] {
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
  method: MethodSpecV2,
  runners: {
    tspice: CaseRunner;
    cspice: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  const runs = buildMethodRuns(method);
  const proofEnabled = isParityProofNativeV2Enabled();
  const proofReferenceRecords: MethodExecutionSummary["proofReferenceRecords"] = [];
  const comparisonLane = resolveComparisonLane(runners.tspice);

  for (const run of runs) {
    const setup = mergeSetupChain(run.setupChain);
    const compare = mergeCompareChain(run.compareChain);

    const caseInput: RunCaseInputV2 = {
      schemaVersion: 3,
      manifest: method.manifest,
      contract: method.contract,
      args: run.args ?? {},
      workflow: run.workflow,
      ...(setup === undefined ? {} : { setup }),
    };

    if (proofEnabled) {
      const referencePlan = resolveReferenceExecutionPlan(caseInput);
      proofReferenceRecords.push({
        method: method.manifest.id,
        caseId: run.caseId,
        transport: referencePlan.transport,
        ops: referencePlan.ops,
      });
    }

    const cspiceOutcome = await runners.cspice.runCase(caseInput);
    const tspiceOutcome = await runners.tspice.runCase(caseInput);

    const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
    const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
    const angleWrapPi = compare?.angleWrapPi;
    const errorShort = compare?.errorShort ?? false;

    const callId = resolveCallId(caseInput);
    const label = `${method.manifest.id} case=${run.caseId} lane=${comparisonLane} callId=${callId}`;

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
      const comparisonError = normalizeRunnerErrorForParity(
        tspiceOutcome.ok ? undefined : tspiceOutcome.error,
        comparisonLane,
        callId,
      );
      const referenceError = normalizeRunnerErrorForParity(
        cspiceOutcome.ok ? undefined : cspiceOutcome.error,
        "cspice",
        callId,
      );

      if (errorShort) {
        const tspiceShort =
          !tspiceOutcome.ok && isRecord(tspiceOutcome.error.spice) && typeof tspiceOutcome.error.spice.short === "string"
            ? tspiceOutcome.error.spice.short
            : undefined;
        const cspiceShort =
          !cspiceOutcome.ok && isRecord(cspiceOutcome.error.spice) && typeof cspiceOutcome.error.spice.short === "string"
            ? cspiceOutcome.error.spice.short
            : undefined;

        const tspiceHasShort = tspiceShort !== undefined;
        const cspiceHasShort = cspiceShort !== undefined;

        if (tspiceHasShort && cspiceHasShort) {
          const tspiceSymbol = spiceShortSymbol(tspiceShort);
          const cspiceSymbol = spiceShortSymbol(cspiceShort);

          if (!tspiceSymbol || !cspiceSymbol) {
            throw new Error(
              `errorShort comparison failed to normalize symbol (${label}) tspice=${JSON.stringify(tspiceShort)} cspice=${JSON.stringify(cspiceShort)}`,
            );
          }

          if (tspiceSymbol !== cspiceSymbol) {
            throw new Error(`errorShort mismatch (${label}) tspice=${tspiceSymbol} cspice=${cspiceSymbol}`);
          }

          continue;
        }

        if (tspiceHasShort !== cspiceHasShort) {
          throw new Error(
            `errorShort mismatch (${label}) spice.short presence differs tspice=${tspiceHasShort} cspice=${cspiceHasShort}`,
          );
        }

        // compare.errorShort is satisfied if neither side has spice.short.
        continue;
      }

      const normalizedComparison = {
        code: comparisonError.code,
        lane: comparisonError.lane,
        callId: comparisonError.callId,
        reason: comparisonError.reason,
      };
      const normalizedReference = {
        code: referenceError.code,
        lane: referenceError.lane,
        callId: referenceError.callId,
        reason: referenceError.reason,
      };

      if (normalizedComparison.lane !== comparisonLane || normalizedReference.lane !== "cspice") {
        throw new Error(
          `Normalized boundary error lane mismatch (${label}): comparison=${normalizedComparison.lane} reference=${normalizedReference.lane}`,
        );
      }

      const cmp = compareValues(
        {
          code: normalizedComparison.code,
          callId: normalizedComparison.callId,
          reason: normalizedComparison.reason,
        },
        {
          code: normalizedReference.code,
          callId: normalizedReference.callId,
          reason: normalizedReference.reason,
        },
        buildCompareOptions(tolAbs, tolRel, angleWrapPi),
      );
      if (!cmp.ok) {
        throw new Error(
          `Error mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}\ncomparison=${JSON.stringify(normalizedComparison)}\nreference=${JSON.stringify(normalizedReference)}`,
        );
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
