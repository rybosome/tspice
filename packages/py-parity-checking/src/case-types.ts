import type { CanonicalRawMethod } from "./generated/canonical-raw-methods.js";

/** JSON scalar type supported in serialized parity request/response payloads. */
export type JsonScalar = string | number | boolean | null;

/** Recursive JSON value type supported in parity payloads. */
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

/** One canonical raw-method workflow step. */
export type WorkflowStep = {
  op: CanonicalRawMethod;
  args?: JsonValue[];
};

/** One normalized step output from either lane. */
export type StepOutput = {
  op: CanonicalRawMethod;
  value: JsonValue;
};

export type CaseExpectationSuccess = {
  kind: "success";
};

export type CaseExpectationError = {
  kind: "error";
  /** Optional substring check on normalized error type (case-insensitive). */
  errorTypeIncludes?: string;
  /** Optional substring checks on normalized error message (case-insensitive). */
  errorMessageIncludes?: string[];
};

export type CaseExpectation = CaseExpectationSuccess | CaseExpectationError;

/** Fixed deterministic parity corpus case. */
export type ParityCase = {
  caseId: string;
  description: string;
  workflow: WorkflowStep[];
  expectation: CaseExpectation;
};

export type CaseError = {
  type: string;
  message: string;
};

export type CaseExecutionSuccess = {
  caseId: string;
  ok: true;
  outputs: StepOutput[];
  error: null;
};

export type CaseExecutionFailure = {
  caseId: string;
  ok: false;
  outputs: StepOutput[];
  error: CaseError;
};

export type CaseExecutionResult = CaseExecutionSuccess | CaseExecutionFailure;
