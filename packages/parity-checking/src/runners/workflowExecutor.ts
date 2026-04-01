import {
  type DispatchLane,
  handoffToGeneratedDispatchSeam,
} from "./generatedDispatchSeam.js";
import type {
  RunCaseInputV3,
  RunnerErrorReport,
  V3WorkflowCallStep,
} from "./types.js";

type RunnerValidationCode = "invalid_request" | "invalid_args";

type CodedError = Error & { code?: RunnerValidationCode };

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "NaN";
    if (value === Infinity) return "Infinity";
    if (value === -Infinity) return "-Infinity";
    return String(value);
  }

  try {
    const s = JSON.stringify(value);
    return s === undefined ? String(value) : s;
  } catch {
    return String(value);
  }
}

function invalidRequest(message: string): never {
  const error = new TypeError(message) as CodedError;
  error.code = "invalid_request";
  throw error;
}

function invalidArgs(message: string): never {
  const error = new TypeError(message) as CodedError;
  error.code = "invalid_args";
  throw error;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidRequest(`${label} must be an object (got ${formatValue(value)})`);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    invalidRequest(`${label} must be a non-empty string (got ${formatValue(value)})`);
  }
  return value;
}

function ensureKnownKeys(record: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      const sortedAllowed = [...allowed].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      invalidRequest(
        `${label} has unknown key: ${JSON.stringify(key)} (allowed keys: ${sortedAllowed.map((k) => JSON.stringify(k)).join(", ")})`,
      );
    }
  }
}

function parseReferencePathSegments(reference: string, prefix: string): [string, ...string[]] {
  const payload = reference.slice(prefix.length);
  const segments = payload.split(".");

  if (segments.length === 0 || segments.some((segment) => segment.trim() === "")) {
    invalidRequest("Invalid reference expression");
  }

  return segments as [string, ...string[]];
}

function refsUnsupportedMessage(label: string): string {
  if (label.endsWith(".fn")) {
    return "workflow call step fn does not support $refs in native canonical execution";
  }

  if (label.endsWith(".in")) {
    return "workflow call step in does not support $refs in native canonical execution";
  }

  return `${label} does not support $refs in canonical execution`;
}

function resolvePropertyPath(value: unknown, propertyPath: readonly string[], label: string): unknown {
  let current = value;

  if (propertyPath.length === 0) {
    return current;
  }

  for (const segment of propertyPath) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) {
      invalidArgs(`${label} cannot read property ${JSON.stringify(segment)} from ${formatValue(current)}`);
    }

    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      invalidArgs(`${label} references missing property ${JSON.stringify(segment)}`);
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function resolveInputValue(
  value: unknown,
  args: unknown,
  label: string,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  if (value === "$args") {
    return args;
  }

  if (value.startsWith("$args.")) {
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      invalidArgs(`${label} expected object args for reference ${JSON.stringify(value)} (got ${formatValue(args)})`);
    }

    const [key, ...propertyPath] = parseReferencePathSegments(value, "$args.");
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      invalidArgs(`${label} references missing argument ${JSON.stringify(key)}`);
    }

    return resolvePropertyPath((args as Record<string, unknown>)[key], propertyPath, label);
  }

  if (value === "$refs" || value.startsWith("$refs.")) {
    invalidRequest(refsUnsupportedMessage(label));
  }

  return value;
}

function validateEnvelope(input: RunCaseInputV3): void {
  if (input.schemaVersion !== 3) {
    invalidRequest(`executeCanonicalWorkflowCase expected schemaVersion=3 (got ${formatValue(input.schemaVersion)})`);
  }

  if (input.manifest.kind !== "method") {
    invalidRequest(`manifest.kind must be \"method\" (got ${formatValue(input.manifest.kind)})`);
  }

  if (input.workflow.steps.length === 0) {
    invalidRequest("workflow.steps must contain at least one call step");
  }
}

function validateCallStep(step: unknown, label: string): V3WorkflowCallStep {
  const record = asRecord(step, label);
  ensureKnownKeys(record, ["op", "fn", "in"], label);

  if (record.op !== "call") {
    invalidRequest(`${label}.op must be \"call\" (got ${formatValue(record.op)})`);
  }

  const fn = asNonEmptyString(record.fn, `${label}.fn`);
  if (!Object.prototype.hasOwnProperty.call(record, "in")) {
    invalidRequest(`${label}.in is required for op=call`);
  }

  return {
    op: "call",
    fn,
    in: record.in,
  };
}

function executeCallStep(
  lane: DispatchLane,
  input: RunCaseInputV3,
  step: V3WorkflowCallStep,
  stepIndex: number,
  args: unknown,
): unknown {
  const fnResolved = resolveInputValue(step.fn, args, `workflow.steps[${stepIndex}].fn`);
  if (typeof fnResolved !== "string" || fnResolved.trim() === "") {
    invalidRequest(`workflow.steps[${stepIndex}].fn must resolve to a non-empty string`);
  }

  const callInputResolved = resolveInputValue(step.in, args, `workflow.steps[${stepIndex}].in`);

  const callId = `${input.manifest.id}::${stepIndex + 1}`;
  const result = handoffToGeneratedDispatchSeam({
    lane,
    callId,
    fn: fnResolved,
    input: callInputResolved,
  });
  return result;
}

/**
 * Shared static validation for canonical case payloads before runner execution.
 */
export function validateCasePreflight(input: RunCaseInputV3): V3WorkflowCallStep[] {
  validateEnvelope(input);

  return input.workflow.steps.map((step, index) =>
    validateCallStep(step, `workflow.steps[${index}]`),
  );
}

/**
 * Execute one canonical call-workflow case against a selected dispatch lane.
 */
export function executeCanonicalWorkflowCase(lane: DispatchLane, input: RunCaseInputV3): unknown {
  const steps = validateCasePreflight(input);

  const args = Object.prototype.hasOwnProperty.call(input, "args") ? input.args : undefined;

  let lastResult: unknown = undefined;
  for (const [index, step] of steps.entries()) {
    lastResult = executeCallStep(lane, input, step, index, args);
  }

  return lastResult;
}

/** Convert any thrown value into a structured runner error report. */
export function asRunnerError(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const withFields = error as Error & {
      code?: string;
      lane?: string;
      callId?: string;
      reason?: string;
      details?: unknown;
    };

    const report: RunnerErrorReport = {
      message: error.message,
      ...(typeof withFields.code === "string" ? { code: withFields.code } : {}),
      ...(typeof withFields.lane === "string" ? { lane: withFields.lane } : {}),
      ...(typeof withFields.callId === "string" ? { callId: withFields.callId } : {}),
      ...(typeof withFields.reason === "string" ? { reason: withFields.reason } : {}),
    };

    if (typeof withFields.details === "object" && withFields.details !== null && !Array.isArray(withFields.details)) {
      report.details = { ...(withFields.details as Record<string, unknown>) };
    }

    return report;
  }

  return {
    message: String(error),
  };
}
