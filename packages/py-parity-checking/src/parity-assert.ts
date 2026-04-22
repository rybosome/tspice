import type { CaseExecutionResult, ParityCase } from "./case-types.js";

const ABSOLUTE_NUMERIC_TOLERANCE = 1e-12;
const RELATIVE_NUMERIC_TOLERANCE = 1e-12;

function formatResult(result: CaseExecutionResult): string {
  return JSON.stringify(result, null, 2);
}

function normalizeLower(value: string): string {
  return value.toLowerCase();
}

function areNumbersEquivalent(left: number, right: number): boolean {
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return Number.isNaN(left) && Number.isNaN(right);
  }

  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return Object.is(left, right);
  }

  const absoluteDelta = Math.abs(left - right);
  if (absoluteDelta <= ABSOLUTE_NUMERIC_TOLERANCE) {
    return true;
  }

  const scale = Math.max(Math.abs(left), Math.abs(right));
  return absoluteDelta <= scale * RELATIVE_NUMERIC_TOLERANCE;
}

function areOutputsEquivalent(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") {
    return areNumbersEquivalent(left, right);
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      return false;
    }

    if (left.length !== right.length) {
      return false;
    }

    for (let index = 0; index < left.length; index += 1) {
      if (!areOutputsEquivalent(left[index], right[index])) {
        return false;
      }
    }

    return true;
  }

  if (left && right && typeof left === "object" && typeof right === "object") {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord);
    const rightKeys = Object.keys(rightRecord);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    for (const key of leftKeys) {
      if (!Object.prototype.hasOwnProperty.call(rightRecord, key)) {
        return false;
      }

      if (!areOutputsEquivalent(leftRecord[key], rightRecord[key])) {
        return false;
      }
    }

    return true;
  }

  return Object.is(left, right);
}

/** Assert parity outputs under v1 policies (numeric-tolerant success equality, minimal error matching). */
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

    if (!areOutputsEquivalent(tspiceResult.outputs, sidecarResult.outputs)) {
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
