import { compareValues } from "../compare/compare.js";
import { formatMismatchReport } from "../compare/report.js";
import { DEFAULT_TOL_ABS, DEFAULT_TOL_REL } from "../config/constants.js";
import { mergeCompareChain, mergeSetupChain } from "../dsl/mergeResolvedSpec.js";
import {
  GENERATED_DISPATCH_UNAVAILABLE_CODE,
  GENERATED_DISPATCH_UNAVAILABLE_REASON,
} from "../runners/generatedDispatchSeam.js";
import { resolveReferenceExecutionPlan } from "../proof/nativeProof.js";

import type {
  MethodCaseExpectation,
  MethodCaseSpecV3,
  MethodSpecV3,
  ScenarioCompareAst,
  ScenarioSetupAst,
} from "../dsl/types.js";
import type { ReferenceTransport } from "../proof/nativeProof.js";
import type { CaseRunner, RunCaseInputV3, RunCaseResult } from "../runners/types.js";

type ParityLane = "cspice" | "node" | "wasm";

type MethodRunCase = {
  caseId: string;
  workflow: Exclude<MethodSpecV3["workflow"], undefined>;
  args: unknown;
  expect?: MethodCaseExpectation;
  setupChain: Array<ScenarioSetupAst | undefined>;
  compareChain: Array<ScenarioCompareAst | undefined>;
};

export type MethodProofReferenceRecord = {
  method: string;
  caseId: string;
  transport: ReferenceTransport;
  ops: string[];
};

export type MethodExecutionSummary = {
  methodId: string;
  caseCount: number;
  proofReferenceRecords?: MethodProofReferenceRecord[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function assertRequiredLaneOutcomes(
  methodId: string,
  caseId: string,
  outcomes: Record<ParityLane, RunCaseResult>,
): void {
  for (const lane of ["cspice", "node", "wasm"] as const) {
    const outcome = outcomes[lane];
    if (!outcome) {
      throw new Error(`Missing required lane outcome (${methodId} case=${caseId} lane=${lane})`);
    }
  }
}

function normalizeBoundaryDetails(details: unknown): Record<string, unknown> | undefined {
  if (!isRecord(details)) {
    return undefined;
  }

  const normalized: Record<string, unknown> = {};

  for (const key of ["dispatchHandoffAttempted", "fallbackUsed", "stopPoint"] as const) {
    if (Object.prototype.hasOwnProperty.call(details, key)) {
      normalized[key] = details[key];
    }
  }

  if (Object.keys(normalized).length === 0) {
    return undefined;
  }

  return normalized;
}

function normalizeRunnerErrorForParity(error: unknown): unknown {
  if (!isRecord(error)) {
    return error;
  }

  const normalized: Record<string, unknown> = {};

  if (typeof error.code === "string") {
    normalized.code = error.code;
  }

  if (typeof error.callId === "string") {
    normalized.callId = error.callId;
  }

  if (typeof error.reason === "string") {
    normalized.reason = error.reason;
  }

  const details = normalizeBoundaryDetails(error.details);
  if (details) {
    normalized.details = details;
  }

  return normalized;
}

function isGeneratedDispatchBoundaryFailure(outcome: RunCaseResult): boolean {
  if (outcome.ok) {
    return false;
  }

  return (
    outcome.error.code === GENERATED_DISPATCH_UNAVAILABLE_CODE &&
    outcome.error.reason === GENERATED_DISPATCH_UNAVAILABLE_REASON
  );
}

function assertNormalizedLaneBoundary(
  methodId: string,
  caseId: string,
  lane: ParityLane,
  outcome: RunCaseResult,
): void {
  if (outcome.ok) {
    throw new Error(`Expected lane boundary failure (${methodId} case=${caseId} lane=${lane}) but lane succeeded`);
  }

  if (outcome.error.lane !== lane) {
    throw new Error(
      `Lane mismatch (${methodId} case=${caseId}): expected lane=${lane}, got lane=${JSON.stringify(outcome.error.lane)}`,
    );
  }

  if (typeof outcome.error.callId !== "string" || outcome.error.callId.length === 0) {
    throw new Error(`Missing callId on boundary error (${methodId} case=${caseId} lane=${lane})`);
  }

  if (outcome.error.code !== GENERATED_DISPATCH_UNAVAILABLE_CODE) {
    throw new Error(
      `Boundary code mismatch (${methodId} case=${caseId} lane=${lane}): expected=${GENERATED_DISPATCH_UNAVAILABLE_CODE}, got=${JSON.stringify(outcome.error.code)}`,
    );
  }

  if (outcome.error.reason !== GENERATED_DISPATCH_UNAVAILABLE_REASON) {
    throw new Error(
      `Boundary reason mismatch (${methodId} case=${caseId} lane=${lane}): expected=${GENERATED_DISPATCH_UNAVAILABLE_REASON}, got=${JSON.stringify(outcome.error.reason)}`,
    );
  }
}

function assertExpectedOutcome(
  methodId: string,
  caseId: string,
  expectedOk: boolean | undefined,
  outcomes: Record<ParityLane, RunCaseResult>,
): void {
  if (expectedOk === undefined) return;

  if (
    outcomes.cspice.ok !== expectedOk ||
    outcomes.node.ok !== expectedOk ||
    outcomes.wasm.ok !== expectedOk
  ) {
    throw new Error(
      `Expectation mismatch (${methodId} case=${caseId}): expect.ok=${expectedOk} but got cspice.ok=${outcomes.cspice.ok}, node.ok=${outcomes.node.ok}, wasm.ok=${outcomes.wasm.ok}`,
    );
  }
}

function assertExpectedErrorCode(
  methodId: string,
  caseId: string,
  expectedErrorCode: string | undefined,
  outcomes: Record<ParityLane, RunCaseResult>,
): void {
  if (expectedErrorCode === undefined) return;

  const cspiceCode = outcomes.cspice.ok ? undefined : outcomes.cspice.error.code;
  const nodeCode = outcomes.node.ok ? undefined : outcomes.node.error.code;
  const wasmCode = outcomes.wasm.ok ? undefined : outcomes.wasm.error.code;

  if (cspiceCode !== expectedErrorCode || nodeCode !== expectedErrorCode || wasmCode !== expectedErrorCode) {
    throw new Error(
      `Expectation mismatch (${methodId} case=${caseId}): expect.errorCode=${expectedErrorCode} but got cspice=${cspiceCode}, node=${nodeCode}, wasm=${wasmCode}`,
    );
  }
}

function compareOutcomeAgainstReference(
  methodId: string,
  caseId: string,
  lane: "node" | "wasm",
  reference: RunCaseResult,
  candidate: RunCaseResult,
  compare: ScenarioCompareAst | undefined,
): void {
  const tolAbs = compare?.tolAbs ?? DEFAULT_TOL_ABS;
  const tolRel = compare?.tolRel ?? DEFAULT_TOL_REL;
  const angleWrapPi = compare?.angleWrapPi;

  const label = `${methodId} case=${caseId} lane=${lane} refLane=cspice`;

  if (reference.ok !== candidate.ok) {
    throw new Error(
      `Required-lane hard-fail (${label}): outcome mismatch cspice.ok=${reference.ok} vs ${lane}.ok=${candidate.ok}`,
    );
  }

  if (!reference.ok || !candidate.ok) {
    const refError = normalizeRunnerErrorForParity(reference.ok ? undefined : reference.error);
    const candidateError = normalizeRunnerErrorForParity(candidate.ok ? undefined : candidate.error);
    const cmp = compareValues(refError, candidateError, buildCompareOptions(tolAbs, tolRel, angleWrapPi));
    if (!cmp.ok) {
      throw new Error(`Error mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
    }
    return;
  }

  const cmp = compareValues(reference.result, candidate.result, buildCompareOptions(tolAbs, tolRel, angleWrapPi));
  if (!cmp.ok) {
    throw new Error(`Result mismatch (${label}):\n${formatMismatchReport(cmp.mismatches)}`);
  }
}

/**
 * Canonical parity executor entrypoint.
 *
 * Topology:
 * - reference lane: cspice
 * - comparison lanes: node + wasm
 *
 * Hard-fails when any required lane cannot complete.
 */
export async function executeMethodSpecParity(
  method: MethodSpecV3,
  runners: {
    cspice: CaseRunner;
    node: CaseRunner;
    wasm: CaseRunner;
  },
): Promise<MethodExecutionSummary> {
  const runs = buildMethodRuns(method);
  const proofReferenceRecords: MethodProofReferenceRecord[] = [];

  for (const run of runs) {
    const setup = mergeSetupChain(run.setupChain);
    const compare = mergeCompareChain(run.compareChain);

    const caseInput: RunCaseInputV3 = {
      schemaVersion: 3,
      manifest: method.manifest,
      contract: method.contract,
      args: run.args,
      workflow: run.workflow,
      ...(setup === undefined ? {} : { setup }),
    };

    const referencePlan = resolveReferenceExecutionPlan(caseInput, { proofMode: true });
    proofReferenceRecords.push({
      method: method.manifest.id,
      caseId: run.caseId,
      transport: referencePlan.transport,
      ops: referencePlan.ops,
    });

    const [cspiceOutcome, nodeOutcome, wasmOutcome] = await Promise.all([
      runners.cspice.runCase(caseInput),
      runners.node.runCase(caseInput),
      runners.wasm.runCase(caseInput),
    ]);

    const outcomes: Record<ParityLane, RunCaseResult> = {
      cspice: cspiceOutcome,
      node: nodeOutcome,
      wasm: wasmOutcome,
    };

    assertRequiredLaneOutcomes(method.manifest.id, run.caseId, outcomes);

    const allBoundary =
      isGeneratedDispatchBoundaryFailure(cspiceOutcome) &&
      isGeneratedDispatchBoundaryFailure(nodeOutcome) &&
      isGeneratedDispatchBoundaryFailure(wasmOutcome);

    if (allBoundary) {
      assertNormalizedLaneBoundary(method.manifest.id, run.caseId, "cspice", cspiceOutcome);
      assertNormalizedLaneBoundary(method.manifest.id, run.caseId, "node", nodeOutcome);
      assertNormalizedLaneBoundary(method.manifest.id, run.caseId, "wasm", wasmOutcome);

      compareOutcomeAgainstReference(method.manifest.id, run.caseId, "node", cspiceOutcome, nodeOutcome, compare);
      compareOutcomeAgainstReference(method.manifest.id, run.caseId, "wasm", cspiceOutcome, wasmOutcome, compare);
      continue;
    }

    assertExpectedOutcome(method.manifest.id, run.caseId, run.expect?.ok, outcomes);
    assertExpectedErrorCode(method.manifest.id, run.caseId, run.expect?.errorCode, outcomes);

    compareOutcomeAgainstReference(method.manifest.id, run.caseId, "node", cspiceOutcome, nodeOutcome, compare);
    compareOutcomeAgainstReference(method.manifest.id, run.caseId, "wasm", cspiceOutcome, wasmOutcome, compare);
  }

  return {
    methodId: method.manifest.id,
    caseCount: runs.length,
    proofReferenceRecords,
  };
}
