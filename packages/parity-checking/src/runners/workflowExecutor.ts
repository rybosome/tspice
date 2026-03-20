import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveMetaKernelKernelsToLoad } from "../kernels/metaKernel.js";
import {
  type DispatchLane,
  handoffToGeneratedDispatchSeam,
} from "./generatedDispatchSeam.js";
import type {
  CaseSetup,
  KernelEntry,
  RunCaseInputV3,
  RunnerErrorReport,
  V3WorkflowCallStep,
} from "./types.js";

type RunnerValidationCode = "invalid_request" | "invalid_args";

type RefValue = unknown;

type ReferenceToken = {
  source: "args" | "refs";
  key: string | null;
  propertyPath: string[];
};

type CodedError = Error & { code?: RunnerValidationCode };

const RESOLVE_INPUT_MAX_DEPTH = 50;
const RESOLVE_INPUT_MAX_NODES = 10_000;
const WORKSPACE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const FIXTURES_ROOT = path.join(WORKSPACE_ROOT, "packages", "tspice", "test", "fixtures", "kernels");

type ResolveInputBudget = {
  visitedNodes: number;
};

export type WorkflowExecutorContext = {
  rawBackend?: Record<string, unknown>;
};

function resolveKernelEntryPath(rawPath: string): string {
  if (rawPath.startsWith("$FIXTURES/")) {
    return path.resolve(FIXTURES_ROOT, rawPath.slice("$FIXTURES/".length));
  }

  if (path.isAbsolute(rawPath)) {
    return path.resolve(rawPath);
  }

  return path.resolve(WORKSPACE_ROOT, rawPath);
}

function resolveKernelEntryMetaRestriction(entry: Extract<KernelEntry, { path: string }>): string | undefined {
  if (entry.restrictToDir === undefined) {
    return undefined;
  }

  return resolveKernelEntryPath(entry.restrictToDir);
}

function resolveKernelLoadPaths(entry: KernelEntry): string[] {
  const kernelPath = resolveKernelEntryPath(typeof entry === "string" ? entry : entry.path);

  let stats: fs.Stats;
  try {
    stats = fs.statSync(kernelPath);
  } catch {
    invalidArgs(`setup.kernels references missing path ${JSON.stringify(kernelPath)}`);
  }

  if (stats.isDirectory()) {
    const metaKernelPath = path.join(kernelPath, `${path.basename(kernelPath)}.tm`);
    if (!fs.existsSync(metaKernelPath)) {
      invalidArgs(
        `setup.kernels fixture directory ${JSON.stringify(kernelPath)} is missing expected meta-kernel ${JSON.stringify(path.basename(metaKernelPath))}`,
      );
    }

    const metaKernelText = fs.readFileSync(metaKernelPath, "utf8");
    const restrictToDir =
      typeof entry === "string" ? undefined : resolveKernelEntryMetaRestriction(entry);

    return resolveMetaKernelKernelsToLoad(metaKernelText, metaKernelPath, {
      ...(restrictToDir === undefined ? {} : { restrictToDir }),
    });
  }

  if (path.extname(kernelPath).toLowerCase() === ".tm") {
    const metaKernelText = fs.readFileSync(kernelPath, "utf8");
    const restrictToDir =
      typeof entry === "string" ? undefined : resolveKernelEntryMetaRestriction(entry);

    return resolveMetaKernelKernelsToLoad(metaKernelText, kernelPath, {
      ...(restrictToDir === undefined ? {} : { restrictToDir }),
    });
  }

  if (!stats.isFile()) {
    invalidArgs(`setup.kernels path must resolve to a file or fixture-pack directory (got ${JSON.stringify(kernelPath)})`);
  }

  return [kernelPath];
}

function toVirtualKernelPath(kernelPath: string, index: number): string {
  const rel = path.relative(WORKSPACE_ROOT, kernelPath);
  const safeSegments = rel
    .split(path.sep)
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map((segment) => segment.replace(/[^A-Za-z0-9._-]/g, "_"));

  const safeRel = safeSegments.length > 0 ? safeSegments.join("/") : `kernel-${String(index + 1)}.bin`;
  return `parity-fixtures/${safeRel}`;
}

function applyCaseSetup(setup: CaseSetup | undefined, context: WorkflowExecutorContext): void {
  if (!setup?.kernels || setup.kernels.length === 0) {
    return;
  }

  const rawBackend = context.rawBackend;
  if (!rawBackend) {
    invalidRequest("setup.kernels requires raw backend context");
  }

  const kclear = rawBackend.kclear;
  const furnsh = rawBackend.furnsh;

  if (typeof kclear !== "function" || typeof furnsh !== "function") {
    invalidRequest("setup.kernels requires raw backend kclear() and furnsh() support");
  }

  kclear();

  const expandedKernelPaths = setup.kernels.flatMap((entry) => resolveKernelLoadPaths(entry));

  expandedKernelPaths.forEach((kernelPath, index) => {
    let kernelBytes: Buffer;
    try {
      kernelBytes = fs.readFileSync(kernelPath);
    } catch {
      invalidArgs(`setup.kernels failed to read ${JSON.stringify(kernelPath)}`);
    }

    furnsh({
      path: toVirtualKernelPath(kernelPath, index),
      bytes: kernelBytes,
    });
  });
}

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

function resolveReferenceToken(reference: string): ReferenceToken | null {
  if (!reference.startsWith("$")) {
    return null;
  }

  if (reference === "$args") {
    return { source: "args", key: null, propertyPath: [] };
  }

  if (reference.startsWith("$args.")) {
    const payload = reference.slice("$args.".length);
    const [key, ...propertyPath] = payload.split(".");
    if (!key || propertyPath.some((part) => part.trim() === "")) {
      return null;
    }
    return { source: "args", key, propertyPath };
  }

  if (reference.startsWith("$refs.")) {
    const payload = reference.slice("$refs.".length);
    const [key, ...propertyPath] = payload.split(".");
    if (!key || propertyPath.some((part) => part.trim() === "")) {
      return null;
    }
    return { source: "refs", key, propertyPath };
  }

  return null;
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

function resolveReferenceExpression(
  expr: string,
  args: unknown,
  refs: ReadonlyMap<string, RefValue>,
  label: string,
): unknown {
  const token = resolveReferenceToken(expr);
  if (!token) {
    return expr;
  }

  if (token.source === "args") {
    if (token.key === null) {
      return args;
    }

    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      invalidArgs(`${label} expected object args for reference ${JSON.stringify(expr)} (got ${formatValue(args)})`);
    }

    if (!Object.prototype.hasOwnProperty.call(args, token.key)) {
      invalidArgs(`${label} references missing argument ${JSON.stringify(token.key)}`);
    }

    return resolvePropertyPath((args as Record<string, unknown>)[token.key], token.propertyPath, label);
  }

  if (token.key === null) {
    invalidRequest(`${label} references malformed ref expression ${JSON.stringify(expr)}`);
  }

  if (!refs.has(token.key)) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  const refValue = refs.get(token.key);

  return resolvePropertyPath(refValue, token.propertyPath, label);
}

function enforceResolveInputBudget(label: string, depth: number, budget: ResolveInputBudget): void {
  if (depth > RESOLVE_INPUT_MAX_DEPTH) {
    invalidRequest(
      `${label} is too deeply nested (max depth ${String(RESOLVE_INPUT_MAX_DEPTH)})`,
    );
  }

  budget.visitedNodes += 1;
  if (budget.visitedNodes > RESOLVE_INPUT_MAX_NODES) {
    invalidRequest(
      `${label} is too large to resolve safely (max nodes ${String(RESOLVE_INPUT_MAX_NODES)})`,
    );
  }
}

function resolveInputValue(
  value: unknown,
  args: unknown,
  refs: ReadonlyMap<string, RefValue>,
  label: string,
  depth = 0,
  budget: ResolveInputBudget = { visitedNodes: 0 },
): unknown {
  enforceResolveInputBudget(label, depth, budget);

  if (typeof value === "string") {
    return resolveReferenceExpression(value, args, refs, label);
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      resolveInputValue(entry, args, refs, `${label}[${index}]`, depth + 1, budget),
    );
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
      out[key] = resolveInputValue(entry, args, refs, `${label}.${key}`, depth + 1, budget);
    }
    return out;
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
  if (record.op !== "call") {
    invalidRequest(`${label}.op must be \"call\" (got ${formatValue(record.op)})`);
  }

  const fn = asNonEmptyString(record.fn, `${label}.fn`);
  if (!Object.prototype.hasOwnProperty.call(record, "in")) {
    invalidRequest(`${label}.in is required for op=call`);
  }

  const asName =
    Object.prototype.hasOwnProperty.call(record, "as") && record.as !== undefined
      ? asNonEmptyString(record.as, `${label}.as`)
      : undefined;

  let out: Record<string, string> | undefined;
  if (Object.prototype.hasOwnProperty.call(record, "out") && record.out !== undefined) {
    const outObj = asRecord(record.out, `${label}.out`);
    out = {};
    for (const [key, value] of Object.entries(outObj)) {
      out[key] = asNonEmptyString(value, `${label}.out.${key}`);
    }
  }

  if (asName !== undefined && out !== undefined) {
    invalidRequest(`${label} is ambiguous: define only one of call.as or call.out`);
  }

  return {
    op: "call",
    fn,
    in: record.in,
    ...(asName === undefined ? {} : { as: asName }),
    ...(out === undefined ? {} : { out }),
  };
}

function applyCallOutputs(step: V3WorkflowCallStep, result: unknown, refs: Map<string, RefValue>, label: string): void {
  if (step.as !== undefined) {
    if (refs.has(step.as)) {
      invalidRequest(`${label}.as defines duplicate ref ${JSON.stringify(step.as)}`);
    }
    refs.set(step.as, result);
    return;
  }

  if (!step.out) {
    return;
  }

  const resultRecord = asRecord(result, `${label}.result`);
  for (const [outputKey, refName] of Object.entries(step.out)) {
    if (!Object.prototype.hasOwnProperty.call(resultRecord, outputKey)) {
      invalidRequest(`${label}.out references missing result key ${JSON.stringify(outputKey)}`);
    }

    if (refs.has(refName)) {
      invalidRequest(`${label}.out defines duplicate ref ${JSON.stringify(refName)}`);
    }

    refs.set(refName, resultRecord[outputKey]);
  }
}

function executeCallStep(
  lane: DispatchLane,
  input: RunCaseInputV3,
  step: V3WorkflowCallStep,
  stepIndex: number,
  args: unknown,
  refs: Map<string, RefValue>,
  context: WorkflowExecutorContext,
): unknown {
  const fnResolved = resolveInputValue(step.fn, args, refs, `workflow.steps[${stepIndex}].fn`);
  if (typeof fnResolved !== "string" || fnResolved.trim() === "") {
    invalidRequest(`workflow.steps[${stepIndex}].fn must resolve to a non-empty string`);
  }

  const callFn = fnResolved;

  const callInputResolved = resolveInputValue(step.in, args, refs, `workflow.steps[${stepIndex}].in`);

  const callId = buildCallId(input.manifest.id, stepIndex);
  const result = handoffToGeneratedDispatchSeam({
    lane,
    callId,
    fn: callFn,
    input: callInputResolved,
    ...(context.rawBackend === undefined ? {} : { rawBackend: context.rawBackend }),
  });

  applyCallOutputs(step, result, refs, `workflow.steps[${stepIndex}]`);
  return result;
}

function buildCallId(manifestId: string, stepIndex: number): string {
  return `${manifestId}::${stepIndex + 1}`;
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
export function executeCanonicalWorkflowCase(
  lane: DispatchLane,
  input: RunCaseInputV3,
  context: WorkflowExecutorContext = {},
): unknown {
  const steps = validateCasePreflight(input);
  applyCaseSetup(input.setup, context);

  const refs = new Map<string, RefValue>();
  const args = Object.prototype.hasOwnProperty.call(input, "args") ? input.args : undefined;

  let lastResult: unknown = undefined;
  for (const [index, step] of steps.entries()) {
    lastResult = executeCallStep(lane, input, step, index, args, refs, context);
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
