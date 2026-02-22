import type { SpiceBackend } from "@rybosome/tspice";

import type {
  RunCaseInputV2,
  RunnerErrorReport,
  V2ContractResultProperty,
  V2WorkflowStep,
} from "./types.js";

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

type RefValue =
  | {
      kind: "cell";
      value: ReturnType<SpiceBackend["newIntCell"]>;
    }
  | {
      kind: "int";
      value: number;
    };

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
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_request";
  throw err;
}

function invalidArgs(message: string): never {
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_args";
  throw err;
}

function unsupportedCall(message: string): never {
  const err = new Error(message) as Error & { code?: RunnerValidationCode };
  err.code = "unsupported_call";
  throw err;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidRequest(`${label} must be an object (got ${formatValue(value)})`);
  }
  return value as Record<string, unknown>;
}

function asSpiceInt(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    invalidArgs(`${label} must be a finite integer (got ${formatValue(value)})`);
  }

  if (value < SPICE_INT32_MIN || value > SPICE_INT32_MAX) {
    invalidArgs(`${label} must be within SpiceInt32 range [${SPICE_INT32_MIN}, ${SPICE_INT32_MAX}]`);
  }

  return value;
}

function resolveReferenceToken(reference: string): { source: "args" | "refs"; key: string } | null {
  if (!reference.startsWith("$")) return null;

  if (reference.startsWith("$args.")) {
    return { source: "args", key: reference.slice("$args.".length) };
  }

  if (reference.startsWith("$refs.")) {
    return { source: "refs", key: reference.slice("$refs.".length) };
  }

  return null;
}

function resolveExpression(
  expr: unknown,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  label: string,
): unknown {
  if (typeof expr !== "string") {
    return expr;
  }

  const token = resolveReferenceToken(expr);
  if (!token) {
    return expr;
  }

  if (token.source === "args") {
    if (!Object.prototype.hasOwnProperty.call(args, token.key)) {
      invalidArgs(`${label} references missing argument ${JSON.stringify(token.key)}`);
    }
    return args[token.key];
  }

  const refValue = refs.get(token.key);
  if (!refValue) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  return refValue.value;
}

function resolveSpiceIntExpression(
  expr: unknown,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  label: string,
): number {
  const value = resolveExpression(expr, args, refs, label);
  return asSpiceInt(value, label);
}

function resolveCellReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: ReturnType<SpiceBackend["newIntCell"]> } {
  if (typeof expr !== "string") {
    invalidArgs(`${label} must be a string $refs.<name> (got ${formatValue(expr)})`);
  }

  const token = resolveReferenceToken(expr);
  if (!token || token.source !== "refs") {
    invalidArgs(`${label} must reference $refs.<name> (got ${formatValue(expr)})`);
  }

  const refValue = refs.get(token.key);
  if (!refValue) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  if (refValue.kind !== "cell") {
    invalidArgs(`${label} must reference a cell (got ${refValue.kind})`);
  }

  return { name: token.key, value: refValue.value };
}

function validateCaseArgs(input: RunCaseInputV2): Record<string, unknown> {
  const caseArgs = asRecord(input.args, "v2.args");
  const contractArgs = input.contract.args ?? [];

  const contractArgNames = new Set<string>();
  for (const argSpec of contractArgs) {
    if (contractArgNames.has(argSpec.name)) {
      invalidRequest(`Duplicate contract arg name ${JSON.stringify(argSpec.name)}`);
    }
    contractArgNames.add(argSpec.name);
  }

  for (const key of Object.keys(caseArgs)) {
    if (!contractArgNames.has(key)) {
      invalidArgs(`v2.args has unknown key ${JSON.stringify(key)} for ${input.contract.contractMethod}`);
    }
  }

  const validated: Record<string, unknown> = {};
  for (const argSpec of contractArgs) {
    if (!Object.prototype.hasOwnProperty.call(caseArgs, argSpec.name)) {
      invalidArgs(`Missing required argument ${JSON.stringify(argSpec.name)}`);
    }

    if (argSpec.type !== "spiceInt") {
      unsupportedCall(`Unsupported contract arg type: ${argSpec.type}`);
    }

    const value = asSpiceInt(caseArgs[argSpec.name], `args.${argSpec.name}`);
    const min = argSpec.constraints?.min;
    const max = argSpec.constraints?.max;

    if (min !== undefined && value < min) {
      invalidArgs(`args.${argSpec.name} must be >= ${min} (got ${value})`);
    }

    if (max !== undefined && value > max) {
      invalidArgs(`args.${argSpec.name} must be <= ${max} (got ${value})`);
    }

    validated[argSpec.name] = value;
  }

  return validated;
}

function validateResultProperty(
  propertyLabel: string,
  descriptor: V2ContractResultProperty,
  value: unknown,
): void {
  if (descriptor.const !== undefined && value !== descriptor.const) {
    invalidRequest(`${propertyLabel} must equal const ${formatValue(descriptor.const)} (got ${formatValue(value)})`);
  }

  if (descriptor.type === "spiceInt") {
    asSpiceInt(value, propertyLabel);
  }
}

function validateProjectedResult(projectedResult: unknown, input: RunCaseInputV2): void {
  if (input.contract.result.type !== "object") {
    unsupportedCall(`Unsupported v2 contract.result.type: ${input.contract.result.type}`);
  }

  const resultObj = asRecord(projectedResult, "v2.projectedResult");

  for (const requiredKey of input.contract.result.required ?? []) {
    if (!Object.prototype.hasOwnProperty.call(resultObj, requiredKey)) {
      invalidRequest(`v2.projectedResult missing required key ${JSON.stringify(requiredKey)}`);
    }
  }

  for (const [key, descriptor] of Object.entries(input.contract.result.properties)) {
    if (!Object.prototype.hasOwnProperty.call(resultObj, key)) {
      continue;
    }

    validateResultProperty(`v2.projectedResult.${key}`, descriptor, resultObj[key]);
  }
}

function projectResult(
  out: Record<string, unknown>,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(out)) {
    projected[key] = resolveExpression(value, args, refs, `projectResult.out.${key}`);
  }

  return projected;
}

function freeCellRef(
  backend: SpiceBackend,
  refs: Map<string, RefValue>,
  freedCells: Set<unknown>,
  target: unknown,
): void {
  const { name, value: cell } = resolveCellReference(target, refs, "freeCell.target");
  if (freedCells.has(cell)) {
    refs.delete(name);
    return;
  }

  backend.freeCell(cell);
  freedCells.add(cell);
  refs.delete(name);
}

function defineRef(refs: Map<string, RefValue>, name: string, value: RefValue, label: string): void {
  if (refs.has(name)) {
    invalidRequest(`${label} defines duplicate ref name ${JSON.stringify(name)}`);
  }
  refs.set(name, value);
}

async function executeStep(
  backend: SpiceBackend,
  step: V2WorkflowStep,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  freedCells: Set<unknown>,
): Promise<Record<string, unknown> | undefined> {
  switch (step.op) {
    case "allocCell": {
      if (step.params.kind !== "int") {
        unsupportedCall(`Unsupported allocCell kind: ${step.params.kind}`);
      }

      const size = resolveSpiceIntExpression(step.params.size, args, refs, "allocCell.params.size");
      if (size < 0) {
        invalidArgs("allocCell.params.size must be >= 0");
      }

      const cell = backend.newIntCell(size);
      defineRef(refs, step.as, { kind: "cell", value: cell }, "allocCell.as");
      return undefined;
    }

    case "spiceCall": {
      if (step.in.length !== 1) {
        invalidRequest(`spiceCall ${step.call} expects exactly one input ref`);
      }

      const { value: cell } = resolveCellReference(step.in[0], refs, `spiceCall(${step.call}).in[0]`);
      let value: number;
      if (step.call === "card_c") {
        value = asSpiceInt(backend.card(cell), `spiceCall(${step.call}).result`);
      } else if (step.call === "size_c") {
        value = asSpiceInt(backend.size(cell), `spiceCall(${step.call}).result`);
      } else {
        unsupportedCall(`Unsupported spiceCall op: ${step.call}`);
      }

      defineRef(refs, step.as, { kind: "int", value }, `spiceCall(${step.call}).as`);
      return undefined;
    }

    case "projectResult": {
      return projectResult(step.out, args, refs);
    }

    case "freeCell": {
      freeCellRef(backend, refs, freedCells, step.target);
      return undefined;
    }

    default: {
      const exhaustive: never = step;
      unsupportedCall(`Unsupported workflow op ${(exhaustive as { op?: string }).op ?? "<unknown>"}`);
    }
  }
}

/** Convert any thrown value into a structured v2 runner error report. */
export function asV2RunnerError(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = {
      message: error.message,
    };

    const withCode = error as Error & { code?: string };
    if (typeof withCode.code === "string") {
      report.code = withCode.code;
    }
    return report;
  }

  return {
    message: String(error),
  };
}

/** Execute a single v2 parity case against a concrete backend implementation. */
export async function executeV2CaseWithBackend(
  backend: SpiceBackend,
  input: RunCaseInputV2,
): Promise<unknown> {
  if (input.schemaVersion !== 2) {
    invalidRequest(`executeV2CaseWithBackend expected schemaVersion=2 (got ${formatValue(input.schemaVersion)})`);
  }

  if (input.manifest.kind !== "method") {
    invalidRequest(`v2.manifest.kind must be \"method\" (got ${formatValue(input.manifest.kind)})`);
  }

  const refs = new Map<string, RefValue>();
  const freedCells = new Set<unknown>();

  const args = validateCaseArgs(input);

  let projectedResult: unknown = undefined;
  let hasProjectedResult = false;
  let terminalError: unknown = undefined;

  try {
    for (const [index, step] of input.workflow.steps.entries()) {
      const maybeResult = await executeStep(backend, step, args, refs, freedCells);
      if (step.op === "projectResult") {
        projectedResult = maybeResult;
        hasProjectedResult = true;
      }

      if (step.op !== "projectResult" && maybeResult !== undefined) {
        invalidRequest(`workflow.steps[${index}] returned unexpected projected result payload`);
      }
    }

    if (!hasProjectedResult) {
      invalidRequest("workflow.steps must include a projectResult op");
    }

    validateProjectedResult(projectedResult, input);
  } catch (error) {
    terminalError = error;
  }

  for (const step of input.workflow.cleanup ?? []) {
    try {
      await executeStep(backend, step, args, refs, freedCells);
    } catch (cleanupError) {
      if (terminalError === undefined) {
        terminalError = cleanupError;
      }
      // Keep cleanup best-effort across all cleanup steps.
    }
  }

  for (const refValue of refs.values()) {
    if (refValue.kind !== "cell") {
      continue;
    }

    if (freedCells.has(refValue.value)) {
      continue;
    }

    try {
      backend.freeCell(refValue.value);
      freedCells.add(refValue.value);
    } catch {
      // best effort cleanup
    }
  }

  if (terminalError !== undefined) {
    throw terminalError;
  }

  return projectedResult;
}
