import { isDeepStrictEqual } from "node:util";

import type { CaseExecutionResult, ParityCase } from "./case-types.js";

function formatResult(result: CaseExecutionResult): string {
  return JSON.stringify(result, null, 2);
}

function normalizeLower(value: string): string {
  return value.toLowerCase();
}

/** Assert parity outputs under v1 policies (strict success equality, minimal error matching). */
export function assertCaseParity(
  parityCase: ParityCase,
  sidecarResult: CaseExecutionResult,
  tspiceResult: CaseExecutionResult,
): void {
  if (parityCase.expectation.kind === "success") {
    if (!sidecarResult.ok) {
      throw new Error(
        `Sidecar failed for success case ${parityCase.caseId}:\n${formatResult(sidecarResult)}`,
      );
    }

    if (!tspiceResult.ok) {
      throw new Error(
        `tspice failed for success case ${parityCase.caseId}:\n${formatResult(tspiceResult)}`,
      );
    }

    if (!isDeepStrictEqual(tspiceResult.outputs, sidecarResult.outputs)) {
      throw new Error(
        [
          `Output mismatch for success case ${parityCase.caseId}.`,
          `sidecar outputs: ${JSON.stringify(sidecarResult.outputs, null, 2)}`,
          `tspice outputs: ${JSON.stringify(tspiceResult.outputs, null, 2)}`,
        ].join("\n"),
      );
    }

    return;
  }

  if (sidecarResult.ok || tspiceResult.ok) {
    throw new Error(
      [
        `Expected both runs to fail for case ${parityCase.caseId}.`,
        `sidecar: ${formatResult(sidecarResult)}`,
        `tspice: ${formatResult(tspiceResult)}`,
      ].join("\n"),
    );
  }

  if (parityCase.expectation.errorTypeIncludes) {
    const needle = normalizeLower(parityCase.expectation.errorTypeIncludes);
    if (!normalizeLower(sidecarResult.error.type).includes(needle)) {
      throw new Error(
        `Sidecar error type does not include "${parityCase.expectation.errorTypeIncludes}" for ${parityCase.caseId}. Got: ${sidecarResult.error.type}`,
      );
    }
    if (!normalizeLower(tspiceResult.error.type).includes(needle)) {
      throw new Error(
        `tspice error type does not include "${parityCase.expectation.errorTypeIncludes}" for ${parityCase.caseId}. Got: ${tspiceResult.error.type}`,
      );
    }
  }

  for (const fragment of parityCase.expectation.errorMessageIncludes ?? []) {
    const needle = normalizeLower(fragment);
    if (!normalizeLower(sidecarResult.error.message).includes(needle)) {
      throw new Error(
        `Sidecar error message does not include "${fragment}" for ${parityCase.caseId}.`,
      );
    }
    if (!normalizeLower(tspiceResult.error.message).includes(needle)) {
      throw new Error(
        `tspice error message does not include "${fragment}" for ${parityCase.caseId}.`,
      );
    }
  }
}
