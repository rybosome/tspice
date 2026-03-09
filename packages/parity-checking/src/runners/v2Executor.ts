import crypto from "node:crypto";
import { rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { SpiceBackend } from "@rybosome/tspice";

import type {
  FunctionArgKind,
  FunctionRegistryEntry,
} from "../generated/functionRegistry.js";
import {
  lookupFunctionRegistryEntry,
} from "../generated/functionRegistry.js";
import {
  lookupNativeCallDispatchEntry,
} from "../generated/nativeCallDispatch.js";
import type {
  NativeAsSpiceIntBindingEntry,
} from "../generated/nativeAsSpiceIntBindings.js";
import {
  lookupNativeAsSpiceIntBindingEntry,
} from "../generated/nativeAsSpiceIntBindings.js";
import type {
  RunCaseInputV2,
  RunnerErrorReport,
  V2WorkflowAssertOperator,
  V2WorkflowStep,
} from "./types.js";
import { ASSERT_OPERATOR_NAMES_TEXT } from "../assertOperators.js";
import { validateV2ContractResultOrThrow } from "./v2ContractResultValidation.js";

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

const DSK_MINIMAL_NV = 3;
const DSK_MINIMAL_NP = 1;
const DSK_MINIMAL_WORKSZ = 100_000;
const DSK_MINIMAL_VOXPSZ = 5_000;
const DSK_MINIMAL_VOXLSZ = 5_000;
const DSK_MINIMAL_SPXISZ = 200_000;

const DSK_MINIMAL_VERTICES = [
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
];

const DSK_MINIMAL_PLATES = [1, 2, 3];

const DSK_MINIMAL_CORPAR = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

const READ_VIRTUAL_OUTPUT_STATES = [
  0, 0, 0, 1, 0, 0,
  60, 0, 0, 1, 0, 0,
];

const SHARED_RETURN_NATIVE_INVOKER = "v2_invoke_contract_return";
const SHARED_AS_SPICE_INT_NATIVE_INVOKER = "v2_invoke_contract_as_spice_int";

type CellHandle =
  | ReturnType<SpiceBackend["kit"]["newIntCell"]>
  | ReturnType<SpiceBackend["kit"]["newDoubleCell"]>
  | ReturnType<SpiceBackend["kit"]["newCharCell"]>;
type IntCellHandle = ReturnType<SpiceBackend["kit"]["newIntCell"]>;
type WindowHandle = ReturnType<SpiceBackend["kit"]["newWindow"]>;
type DasHandle = ReturnType<SpiceBackend["raw"]["dasopr"]>;
type DskOpenHandle = ReturnType<SpiceBackend["raw"]["dskopn"]>;
type DlaDescriptor = Extract<
  ReturnType<SpiceBackend["raw"]["dlabfs"]>,
  { found: true }
>["descr"];
type DskDescriptor = ReturnType<SpiceBackend["raw"]["dskgd"]>;
type DskType2Bookkeeping = ReturnType<SpiceBackend["raw"]["dskb02"]>;

type RefValue =
  | {
      kind: "cell";
      value: CellHandle;
    }
  | {
      kind: "window";
      value: WindowHandle;
    }
  | {
      kind: "int";
      value: number;
    }
  | {
      kind: "path";
      value: string;
    }
  | {
      kind: "dasHandle";
      value: DasHandle;
    }
  | {
      kind: "dlaDescriptor";
      value: DlaDescriptor;
    }
  | {
      kind: "dskDescriptor";
      value: DskDescriptor;
    };

type FreedHandles = {
  cell: Set<CellHandle>;
  window: Set<WindowHandle>;
  das: Set<DasHandle>;
};

type WasmVirtualOutputCleanupHooks = {
  __deleteVirtualFileForFileIo?: (path: string) => void;
};

type V2CallStep = Extract<V2WorkflowStep, { op: "call" }>;
type V2CallArgKind = FunctionArgKind;

function sanitizeTempTag(tag: string): string {
  const cleaned = tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.length > 0 ? cleaned : "v2";
}

function buildTempPath(backend: SpiceBackend, tag: string, extension: string): string {
  const safeTag = sanitizeTempTag(tag);
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const suffix = crypto.randomBytes(6).toString("hex");

  if (backend.kind === "wasm") {
    return `tspice-parity-${safeTag}-${suffix}${ext}`;
  }

  return path.join(os.tmpdir(), `tspice-parity-${safeTag}-${suffix}${ext}`);
}

function deleteTempPathBestEffort(backend: SpiceBackend, filePath: string): void {
  if (backend.kind === "wasm") {
    return;
  }

  try {
    rmSync(filePath, { force: true });
  } catch {
    // best effort cleanup
  }
}

function deleteWasmFileIoPathBestEffort(backend: SpiceBackend, virtualPath: string): void {
  const hooks = getRawBackend(backend) as unknown as WasmVirtualOutputCleanupHooks;
  const remove = hooks.__deleteVirtualFileForFileIo;

  if (!remove) {
    return;
  }

  try {
    remove(virtualPath);
  } catch {
    // best effort cleanup
  }
}

function unlinkPathBestEffort(backend: SpiceBackend, filePath: string): void {
  if (backend.kind === "wasm") {
    deleteWasmFileIoPathBestEffort(backend, filePath);
    return;
  }

  deleteTempPathBestEffort(backend, filePath);
}

function closeDasHandlePreserveError(raw: SpiceBackend["raw"], handle: DasHandle, priorError: unknown): void {
  try {
    raw.dascls(handle);
  } catch (closeError) {
    if (priorError === undefined) {
      throw closeError;
    }
  }
}

function writeMinimalDskFile(backend: SpiceBackend, filePath: string): void {
  const raw = getRawBackend(backend);
  const handle = raw.dskopn(filePath, "TSPICE", 0);

  let writeError: unknown = undefined;
  try {
    const { spaixd, spaixi } = raw.dskmi2(
      DSK_MINIMAL_NV,
      DSK_MINIMAL_VERTICES,
      DSK_MINIMAL_NP,
      DSK_MINIMAL_PLATES,
      0.2,
      5,
      DSK_MINIMAL_WORKSZ,
      DSK_MINIMAL_VOXPSZ,
      DSK_MINIMAL_VOXLSZ,
      true,
      DSK_MINIMAL_SPXISZ,
    );

    raw.dskw02(
      handle,
      399,
      1,
      2,
      "J2000",
      3,
      DSK_MINIMAL_CORPAR,
      0,
      1,
      0,
      1,
      -0.1,
      0.1,
      0,
      1,
      DSK_MINIMAL_NV,
      DSK_MINIMAL_VERTICES,
      DSK_MINIMAL_NP,
      DSK_MINIMAL_PLATES,
      spaixd,
      spaixi,
    );
  } catch (error) {
    writeError = error;
  }

  closeDasHandlePreserveError(raw, handle, writeError);

  if (writeError !== undefined) {
    throw writeError;
  }
}

function getRawBackend(backend: SpiceBackend): SpiceBackend["raw"] {
  const nested = (backend as unknown as { raw?: SpiceBackend["raw"] }).raw;
  return nested ?? (backend as unknown as SpiceBackend["raw"]);
}

function getKitBackend(backend: SpiceBackend): SpiceBackend["kit"] {
  const nested = (backend as unknown as { kit?: SpiceBackend["kit"] }).kit;
  return nested ?? (backend as unknown as SpiceBackend["kit"]);
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
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_request";
  throw err;
}

function invalidArgs(message: string): never {
  const err = new TypeError(message) as TypeError & { code?: RunnerValidationCode };
  err.code = "invalid_args";
  throw err;
}

function unsupportedCall(message: string, details?: RunnerErrorReport["details"]): never {
  const err = new Error(message) as Error & {
    code?: RunnerValidationCode;
    details?: RunnerErrorReport["details"];
  };
  err.code = "unsupported_call";
  if (details !== undefined) {
    err.details = details;
  }
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

function asNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    invalidRequest(`${label} must be a non-empty string (got ${formatValue(value)})`);
  }

  return value;
}

function normalizeAssertOperands(operandsRaw: unknown, operator: V2WorkflowAssertOperator): [unknown, unknown] {
  if (!Array.isArray(operandsRaw) || operandsRaw.length !== 2) {
    invalidRequest(`assert.test.${operator} must be a 2-item array`);
  }

  return [operandsRaw[0], operandsRaw[1]];
}

function extractAssertOperatorAndOperands(
  test: Extract<V2WorkflowStep, { op: "assert" }>["test"],
): { operator: V2WorkflowAssertOperator; operands: [unknown, unknown] } {
  if (Object.keys(test).length !== 1) {
    invalidRequest("assert.test must define exactly one operator");
  }

  if ("eq" in test) {
    return { operator: "eq", operands: normalizeAssertOperands(test.eq, "eq") };
  }

  if ("ne" in test) {
    return { operator: "ne", operands: normalizeAssertOperands(test.ne, "ne") };
  }

  if ("gt" in test) {
    return { operator: "gt", operands: normalizeAssertOperands(test.gt, "gt") };
  }

  if ("gte" in test) {
    return { operator: "gte", operands: normalizeAssertOperands(test.gte, "gte") };
  }

  if ("lt" in test) {
    return { operator: "lt", operands: normalizeAssertOperands(test.lt, "lt") };
  }

  if ("lte" in test) {
    return { operator: "lte", operands: normalizeAssertOperands(test.lte, "lte") };
  }

  invalidRequest(`assert.test operator must be one of ${ASSERT_OPERATOR_NAMES_TEXT}`);
}

type ReferenceToken = {
  source: "args" | "refs";
  key: string;
  propertyPath: string[];
};

function resolveReferenceToken(reference: string): ReferenceToken | null {
  if (!reference.startsWith("$")) return null;

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

function resolveExpression(
  expr: unknown,
  args: unknown,
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
    if (typeof args !== "object" || args === null) {
      invalidArgs(`${label} requires args object/array for ${formatValue(expr)}`);
    }

    const argsRecord = args as Record<string, unknown>;
    if (!Object.prototype.hasOwnProperty.call(argsRecord, token.key)) {
      invalidArgs(`${label} references missing argument ${JSON.stringify(token.key)}`);
    }

    return resolvePropertyPath(argsRecord[token.key], token.propertyPath, label);
  }

  const refValue = refs.get(token.key);
  if (!refValue) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  return resolvePropertyPath(refValue.value, token.propertyPath, label);
}

function resolveSpiceIntExpression(
  expr: unknown,
  args: unknown,
  refs: Map<string, RefValue>,
  label: string,
): number {
  const value = resolveExpression(expr, args, refs, label);
  return asSpiceInt(value, label);
}

function resolveStringExpression(
  expr: unknown,
  args: unknown,
  refs: Map<string, RefValue>,
  label: string,
): string {
  const value = resolveExpression(expr, args, refs, label);
  if (typeof value !== "string") {
    invalidArgs(`${label} must be a string (got ${formatValue(value)})`);
  }
  return value;
}

function resolveRefReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; ref: RefValue } {
  if (typeof expr !== "string") {
    invalidArgs(`${label} must be a string $refs.<name> (got ${formatValue(expr)})`);
  }

  const token = resolveReferenceToken(expr);
  if (!token || token.source !== "refs" || token.propertyPath.length > 0) {
    invalidArgs(`${label} must reference $refs.<name> (got ${formatValue(expr)})`);
  }

  const refValue = refs.get(token.key);
  if (!refValue) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  return {
    name: token.key,
    ref: refValue,
  };
}

function resolveCellReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: CellHandle } {
  const { name, ref } = resolveRefReference(expr, refs, label);

  if (ref.kind !== "cell") {
    invalidArgs(`${label} must reference a cell (got ${ref.kind})`);
  }

  return { name, value: ref.value };
}

function resolveWindowReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: WindowHandle } {
  const { name, ref } = resolveRefReference(expr, refs, label);

  if (ref.kind !== "window") {
    invalidArgs(`${label} must reference a window (got ${ref.kind})`);
  }

  return { name, value: ref.value };
}

function resolveCellOrWindowReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: CellHandle | WindowHandle } {
  const { name, ref } = resolveRefReference(expr, refs, label);

  if (ref.kind !== "cell" && ref.kind !== "window") {
    invalidArgs(`${label} must reference a cell/window (got ${ref.kind})`);
  }

  return { name, value: ref.value };
}

function resolvePathReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: string } {
  const { name, ref } = resolveRefReference(expr, refs, label);
  if (ref.kind !== "path") {
    invalidArgs(`${label} must reference a path (got ${ref.kind})`);
  }

  return { name, value: ref.value };
}

function resolveDasHandleReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: DasHandle } {
  const { name, ref } = resolveRefReference(expr, refs, label);
  if (ref.kind !== "dasHandle") {
    invalidArgs(`${label} must reference a DAS handle (got ${ref.kind})`);
  }

  return { name, value: ref.value };
}

function resolveDlaDescriptorReference(
  expr: unknown,
  refs: Map<string, RefValue>,
  label: string,
): { name: string; value: DlaDescriptor } {
  const { name, ref } = resolveRefReference(expr, refs, label);
  if (ref.kind !== "dlaDescriptor") {
    invalidArgs(`${label} must reference a DLA descriptor (got ${ref.kind})`);
  }

  return { name, value: ref.value };
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

function validateV2Envelope(input: RunCaseInputV2): void {
  if (input.schemaVersion !== 3) {
    invalidRequest(`executeV2CaseWithBackend expected schemaVersion=3 (got ${formatValue(input.schemaVersion)})`);
  }

  if (input.manifest.kind !== "method") {
    invalidRequest(`v3.manifest.kind must be \"method\" (got ${formatValue(input.manifest.kind)})`);
  }
}

/**
 * Shared static validation for schema-v2 case payloads before runner dispatch.
 *
 * Returns normalized/validated args for reuse by callers that continue execution.
 */
export function validateV2CasePreflight(input: RunCaseInputV2): Record<string, unknown> {
  validateV2Envelope(input);
  if (input.args === undefined) {
    return {};
  }

  if (Array.isArray(input.args)) {
    return {};
  }

  return validateCaseArgs(input);
}

function resolveBackendMethodName(contractMethod: string): string {
  const trimmed = asNonEmptyString(contractMethod, "functionRegistry.impl.contractMethod").trim();
  const method = trimmed.includes(".") ? trimmed.slice(trimmed.lastIndexOf(".") + 1) : trimmed;
  if (method.length === 0) {
    invalidRequest(`Invalid function registry contract method ${JSON.stringify(contractMethod)}`);
  }
  return method;
}

async function executeBackendMethodCall(
  backend: SpiceBackend,
  spec: FunctionRegistryEntry,
  fn: string,
  callArgs: readonly unknown[],
): Promise<unknown> {
  const raw = getRawBackend(backend);
  const method = resolveBackendMethodName(spec.impl.contractMethod);
  const maybeInvoker = (raw as unknown as Record<string, unknown>)[method];

  if (typeof maybeInvoker !== "function") {
    unsupportedCall("Unsupported call", { call: fn });
  }

  return await (maybeInvoker as (...args: unknown[]) => unknown).apply(raw, [...callArgs]);
}

function validateProjectedResult(projectedResult: unknown, input: RunCaseInputV2): void {
  if (input.contract.result === undefined) {
    return;
  }

  validateV2ContractResultOrThrow(projectedResult, input.contract.result, "v3.projectedResult", invalidRequest);
}

function projectResult(
  out: Record<string, unknown>,
  args: unknown,
  refs: Map<string, RefValue>,
): Record<string, unknown> {
  const projected: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(out)) {
    projected[key] = resolveExpression(value, args, refs, `projectResult.out.${key}`);
  }

  return projected;
}

function projectRefs(
  out: Record<string, unknown>,
  args: unknown,
  refs: Map<string, RefValue>,
): void {
  for (const [key, value] of Object.entries(out)) {
    const projectedValue = resolveSpiceIntExpression(value, args, refs, `project.out.${key}`);
    defineRef(refs, key, { kind: "int", value: projectedValue }, `project.out.${key}`);
  }
}

function resolveSwitchCaseKey(
  expr: unknown,
  args: unknown,
  refs: Map<string, RefValue>,
  label: string,
): string {
  const value = resolveExpression(expr, args, refs, label);

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      invalidArgs(`${label} must resolve to a finite integer/string (got ${formatValue(value)})`);
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (value === null) {
    return "null";
  }

  invalidArgs(`${label} must resolve to string|integer|boolean|null (got ${formatValue(value)})`);
}

function getRawCallTarget(step: V2CallStep): string {
  const candidate = (step.call ?? step.fn);
  if (typeof candidate !== "string" || candidate.trim() === "") {
    invalidRequest("call step requires non-empty string \"call\"");
  }

  return candidate.trim();
}

function resolveCallTarget(step: V2CallStep, contractMethod: string): string {
  const callTarget = getRawCallTarget(step);
  if (callTarget === "self") {
    const resolvedContractMethod = asNonEmptyString(contractMethod, "contract.contractMethod").trim();
    return resolvedContractMethod;
  }

  return callTarget;
}

function validateCallArity(step: V2CallStep, callTarget: string, expectedArity: number): void {
  if (step.in.length !== expectedArity) {
    const plural = expectedArity === 1 ? "" : "s";
    invalidRequest(`call ${callTarget} expects ${expectedArity} input${plural}`);
  }
}

function requireCallOutputRef(step: V2CallStep, callTarget: string): string {
  const outputRef = (step as { as?: unknown }).as;
  if (outputRef === undefined) {
    invalidArgs(`call ${callTarget} requires an "as" output ref`);
  }

  if (typeof outputRef !== "string" || outputRef.trim() === "") {
    invalidArgs(`call ${callTarget} requires a non-empty string "as" output ref`);
  }

  return outputRef;
}

function forbidCallOutputRef(step: V2CallStep, callTarget: string): void {
  if ((step as { as?: unknown }).as !== undefined) {
    invalidArgs(`call ${callTarget} does not allow an "as" output ref`);
  }
}

function requireCallOutMap(step: V2CallStep, callTarget: string): Record<string, string> {
  const rawOut = (step as { out?: unknown }).out;
  if (rawOut === undefined) {
    invalidArgs(`call ${callTarget} requires an "out" map`);
  }

  if (typeof rawOut !== "object" || rawOut === null || Array.isArray(rawOut)) {
    invalidArgs(`call ${callTarget} requires out to be an object map`);
  }

  const mapped: Record<string, string> = {};
  for (const [name, rawTarget] of Object.entries(rawOut)) {
    if (typeof rawTarget !== "string" || rawTarget.trim() === "") {
      invalidArgs(`call ${callTarget}.out.${name} must be a non-empty string ref name`);
    }
    mapped[name] = rawTarget;
  }

  return mapped;
}

function forbidCallOutMap(step: V2CallStep, callTarget: string): void {
  if ((step as { out?: unknown }).out !== undefined) {
    invalidArgs(`call ${callTarget} does not allow an "out" map`);
  }
}

function hasForbiddenOutputBindingPolicy(spec: FunctionRegistryEntry): boolean {
  return spec.result.outputBindingPolicy === "forbidden";
}

function resolveCallArg(
  step: V2CallStep,
  callTarget: string,
  argIndex: number,
  argKind: V2CallArgKind,
  args: unknown,
  refs: Map<string, RefValue>,
): unknown {
  const label = `call(${callTarget}).in[${argIndex}]`;
  const expr = step.in[argIndex];

  switch (argKind) {
    case "expr":
      return resolveExpression(expr, args, refs, label);

    case "intExpr":
      return resolveSpiceIntExpression(expr, args, refs, label);

    case "cellRef":
      return resolveCellReference(expr, refs, label).value;

    case "cellOrWindowRef":
      return resolveCellOrWindowReference(expr, refs, label).value;

    case "pathExpr":
      return resolveStringExpression(expr, args, refs, label);

    case "dasHandleRef":
      return resolveDasHandleReference(expr, refs, label).value;

    case "dlaDescriptorRef":
      return resolveDlaDescriptorReference(expr, refs, label).value;
  }
}

// DSK-specific bespoke named-out lane kept intentionally isolated for PR #582.
// TODO(parity-struct-capture): replace this whitelist path with generated generic
// struct capture/output projection metadata in a follow-up issue.
const DSKB02_NAMED_SPICE_INT_OUTPUTS = [
  "nv",
  "np",
  "nvxtot",
  "cgscal",
  "vtxnpl",
  "voxnpt",
  "voxnpl",
] as const satisfies readonly (keyof DskType2Bookkeeping)[];

type Dskb02NamedSpiceIntOutputKey = (typeof DSKB02_NAMED_SPICE_INT_OUTPUTS)[number];
type Dskb02NamedSpiceIntOutputs = {
  [key in Dskb02NamedSpiceIntOutputKey]: DskType2Bookkeeping[key];
};

const DSKB02_NAMED_SPICE_INT_OUTPUT_SET: ReadonlySet<string> = new Set(DSKB02_NAMED_SPICE_INT_OUTPUTS);

function isDskb02NamedSpiceIntOutputKey(outputName: string): outputName is Dskb02NamedSpiceIntOutputKey {
  return DSKB02_NAMED_SPICE_INT_OUTPUT_SET.has(outputName);
}

function toNamedDskb02SpiceIntOutputs(bookkeeping: DskType2Bookkeeping): Dskb02NamedSpiceIntOutputs {
  return {
    nv: bookkeeping.nv,
    np: bookkeeping.np,
    nvxtot: bookkeeping.nvxtot,
    cgscal: bookkeeping.cgscal,
    vtxnpl: bookkeeping.vtxnpl,
    voxnpt: bookkeeping.voxnpt,
    voxnpl: bookkeeping.voxnpl,
  };
}

function requireDskb02NamedSpiceIntOutputKey(
  callTarget: string,
  outputName: string,
): Dskb02NamedSpiceIntOutputKey {
  if (!isDskb02NamedSpiceIntOutputKey(outputName)) {
    invalidArgs(
      `call ${callTarget}.out has unsupported key ${JSON.stringify(outputName)} (supported: ${DSKB02_NAMED_SPICE_INT_OUTPUTS.join(", ")})`,
    );
  }

  return outputName;
}

function applyNamedDskb02Outputs(
  callTarget: string,
  outMap: Record<string, string>,
  bookkeeping: DskType2Bookkeeping,
  refs: Map<string, RefValue>,
): void {
  const namedOutputs = toNamedDskb02SpiceIntOutputs(bookkeeping);

  for (const [outputName, refName] of Object.entries(outMap)) {
    const outputKey = requireDskb02NamedSpiceIntOutputKey(callTarget, outputName);
    const outputLabel = `call(${callTarget}).out.${outputKey}`;

    const value = asSpiceInt(namedOutputs[outputKey], outputLabel);
    defineRef(refs, refName, { kind: "int", value }, outputLabel);
  }
}

function writeVirtualOutputSpkFixture(backend: SpiceBackend, outputPath: string): void {
  const raw = getRawBackend(backend);
  const output = {
    kind: "virtual-output" as const,
    path: outputPath,
  };

  const handle = raw.spkopn(output, "TSPICE", 0);
  let writeError: unknown = undefined;
  try {
    raw.spkw08(
      handle,
      1000,
      0,
      "J2000",
      0,
      60,
      "TSPICE_V2_READ_VO",
      1,
      READ_VIRTUAL_OUTPUT_STATES,
      0,
      60,
    );
  } catch (error) {
    writeError = error;
  }

  try {
    raw.spkcls(handle);
  } catch (closeError) {
    if (writeError === undefined) {
      throw closeError;
    }
  }

  if (writeError !== undefined) {
    throw writeError;
  }
}

type V2NativeCallInvokerContext = {
  backend: SpiceBackend;
  raw: SpiceBackend["raw"];
  step: V2CallStep;
  callTarget: string;
  spec: FunctionRegistryEntry;
  resolvedArgs: readonly unknown[];
  outputRef: string | undefined;
  outMap: Record<string, string> | undefined;
  refs: Map<string, RefValue>;
};

type V2NativeCallInvoker = (context: V2NativeCallInvokerContext) => void;

function resolveNativeAsSpiceIntBinding(
  callTarget: string,
  spec: FunctionRegistryEntry,
): NativeAsSpiceIntBindingEntry {
  const binding = lookupNativeAsSpiceIntBindingEntry(spec.id);
  if (!binding || binding.cSymbol !== spec.impl.cSymbol) {
    unsupportedCall("Unsupported call", {
      call: callTarget,
      invoker: spec.impl.nativeInvoker,
      cSymbol: spec.impl.cSymbol,
    });
  }

  return binding;
}

function resolveNativeAsSpiceIntRawInvoker(
  raw: SpiceBackend["raw"],
  binding: NativeAsSpiceIntBindingEntry,
): ((handle: CellHandle | WindowHandle) => unknown) {
  const candidate = Reflect.get(raw as object, binding.backendMethod);
  if (typeof candidate !== "function") {
    unsupportedCall("Unsupported call", {
      id: binding.id,
      cSymbol: binding.cSymbol,
      backendMethod: binding.backendMethod,
    });
  }

  return candidate as (handle: CellHandle | WindowHandle) => unknown;
}

function invokeAsSpiceIntFromGeneratedBinding(
  raw: SpiceBackend["raw"],
  callTarget: string,
  spec: FunctionRegistryEntry,
  handle: CellHandle | WindowHandle,
): number {
  const binding = resolveNativeAsSpiceIntBinding(callTarget, spec);

  if (binding.kind !== "cellOrWindowRefToSpiceInt") {
    unsupportedCall("Unsupported call", {
      call: callTarget,
      invoker: spec.impl.nativeInvoker,
      cSymbol: spec.impl.cSymbol,
      bindingKind: binding.kind,
    });
  }

  const invoke = resolveNativeAsSpiceIntRawInvoker(raw, binding);
  const value = invoke(handle);
  return asSpiceInt(value, `call(${callTarget}).result`);
}

const V2_NATIVE_CALL_INVOKERS: Record<string, V2NativeCallInvoker> = {
  v2_invoke_contract_as_spice_int: ({
    raw,
    callTarget,
    spec,
    resolvedArgs,
    outputRef,
    refs,
  }: V2NativeCallInvokerContext): void => {
    const handle = resolvedArgs[0] as CellHandle | WindowHandle;

    const value = invokeAsSpiceIntFromGeneratedBinding(raw, callTarget, spec, handle);

    defineRef(refs, outputRef!, { kind: "int", value }, `call(${callTarget}).as`);
  },

  v2_invoke_contract_forbidden: ({
    raw,
    callTarget,
    spec,
    resolvedArgs,
  }: V2NativeCallInvokerContext): void => {
    switch (spec.impl.cSymbol) {
      case "scard_c":
        raw.scard(resolvedArgs[0] as number, resolvedArgs[1] as CellHandle | WindowHandle);
        return;
      case "ssize_c":
        raw.ssize(resolvedArgs[0] as number, resolvedArgs[1] as CellHandle | WindowHandle);
        return;
      case "valid_c":
        raw.valid(
          resolvedArgs[0] as number,
          resolvedArgs[1] as number,
          resolvedArgs[2] as CellHandle | WindowHandle,
        );
        return;
      case "dskobj_c":
        raw.dskobj(resolvedArgs[0] as string, resolvedArgs[1] as IntCellHandle);
        return;
      case "dsksrf_c":
        raw.dsksrf(resolvedArgs[0] as string, resolvedArgs[1] as number, resolvedArgs[2] as IntCellHandle);
        return;
      default:
        unsupportedCall("Unsupported call", {
          call: callTarget,
          invoker: spec.impl.nativeInvoker,
          cSymbol: spec.impl.cSymbol,
        });
    }
  },

  v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_as_dsk_descriptor: ({
    raw,
    callTarget,
    spec,
    resolvedArgs,
    outputRef,
    refs,
  }: V2NativeCallInvokerContext): void => {
    // DSK descriptor projection is intentionally isolated in this bespoke lane.
    // TODO(parity-struct-capture): migrate to generated struct output binding.
    if (spec.impl.cSymbol !== "dskgd_c") {
      unsupportedCall("Unsupported call", {
        call: callTarget,
        invoker: spec.impl.nativeInvoker,
        cSymbol: spec.impl.cSymbol,
      });
    }
    const descriptor = raw.dskgd(resolvedArgs[0] as DasHandle, resolvedArgs[1] as DlaDescriptor);
    defineRef(refs, outputRef!, { kind: "dskDescriptor", value: descriptor }, `call(${callTarget}).as`);
  },

  v2_invoke_sig_das_handle_ref_dla_descriptor_ref_to_out_named_dskb02: ({
    raw,
    callTarget,
    spec,
    resolvedArgs,
    outMap,
    refs,
  }: V2NativeCallInvokerContext): void => {
    // DSK named multi-out remains intentionally isolated/deferred for now.
    // TODO(parity-struct-capture): replace with generic generated multi-output wiring.
    if (spec.impl.cSymbol !== "dskb02_c") {
      unsupportedCall("Unsupported call", {
        call: callTarget,
        invoker: spec.impl.nativeInvoker,
        cSymbol: spec.impl.cSymbol,
      });
    }
    const bookkeeping = raw.dskb02(resolvedArgs[0] as DasHandle, resolvedArgs[1] as DlaDescriptor);
    applyNamedDskb02Outputs(callTarget, outMap ?? {}, bookkeeping, refs);
  },
};

function lookupNativeCallInvoker(invoker: string): V2NativeCallInvoker | undefined {
  return V2_NATIVE_CALL_INVOKERS[invoker];
}

async function executeCallFromSpec(
  backend: SpiceBackend,
  step: V2CallStep,
  contractMethod: string,
  args: unknown,
  refs: Map<string, RefValue>,
): Promise<unknown | undefined> {
  const callTarget = resolveCallTarget(step, contractMethod);
  const spec = lookupFunctionRegistryEntry(callTarget);
  if (!spec) {
    unsupportedCall("Unsupported call", { call: callTarget });
  }

  const dispatchEntry = lookupNativeCallDispatchEntry(spec.id);
  if (!dispatchEntry) {
    unsupportedCall("Unsupported call", { call: callTarget, id: spec.id });
  }

  if (dispatchEntry.cSymbol !== spec.impl.cSymbol || dispatchEntry.invoker !== spec.impl.nativeInvoker) {
    invalidRequest(`Generated native dispatch mismatch for call ${callTarget}`);
  }

  if (spec.result.mode === "asSpiceInt" && dispatchEntry.invoker !== SHARED_AS_SPICE_INT_NATIVE_INVOKER) {
    invalidRequest(`Generated asSpiceInt dispatch mismatch for call ${callTarget}`);
  }

  validateCallArity(step, callTarget, spec.arity);
  const resolvedArgs = spec.argKinds.map((argKind, index) =>
    resolveCallArg(step, callTarget, index, argKind, args, refs),
  );

  if (spec.nonNegativeIntArgMask !== undefined) {
    for (let i = 0; i < spec.argKinds.length; i++) {
      const isNonNegativeArg = (spec.nonNegativeIntArgMask & (1 << i)) !== 0;
      if (!isNonNegativeArg || spec.argKinds[i] !== "intExpr") {
        continue;
      }

      const value = resolvedArgs[i];
      if (typeof value !== "number" || value < 0) {
        invalidArgs(`call(${callTarget}).in[${i}] must be >= 0`);
      }
    }
  }

  if (spec.result.delivery === "returnValue") {
    if (spec.result.mode !== "return") {
      invalidRequest(`Generated delivery mismatch for call ${callTarget}`);
    }

    forbidCallOutputRef(step, callTarget);
    forbidCallOutMap(step, callTarget);

    if (
      dispatchEntry.invoker !== SHARED_RETURN_NATIVE_INVOKER
    ) {
      unsupportedCall("Unsupported call", { call: callTarget, invoker: dispatchEntry.invoker });
    }

    return await executeBackendMethodCall(backend, spec, callTarget, resolvedArgs);
  }

  if (spec.result.delivery === "none" && !hasForbiddenOutputBindingPolicy(spec)) {
    invalidRequest(`Generated output binding policy mismatch for call ${callTarget}`);
  }

  const invokeSpiceCall = lookupNativeCallInvoker(dispatchEntry.invoker);
  if (!invokeSpiceCall) {
    unsupportedCall("Unsupported call", { call: callTarget, invoker: dispatchEntry.invoker });
  }

  if (spec.result.delivery !== "outArg" && spec.result.delivery !== "none") {
    invalidRequest(`Unsupported generated delivery for call ${callTarget}: ${spec.result.delivery}`);
  }

  const raw = getRawBackend(backend);
  const outputRef =
    spec.result.delivery === "outArg" && (spec.result.mode === "asSpiceInt" || spec.result.mode === "asDskDescriptor")
      ? requireCallOutputRef(step, callTarget)
      : undefined;
  const outMap =
    spec.result.delivery === "outArg" && spec.result.mode === "outNamedDskb02"
      ? requireCallOutMap(step, callTarget)
      : undefined;

  if (spec.result.delivery === "none") {
    forbidCallOutputRef(step, callTarget);
    forbidCallOutMap(step, callTarget);
  } else {
    if (spec.result.mode !== "asSpiceInt" && spec.result.mode !== "asDskDescriptor") {
      forbidCallOutputRef(step, callTarget);
    }
    if (spec.result.mode !== "outNamedDskb02") {
      forbidCallOutMap(step, callTarget);
    }
  }

  invokeSpiceCall({
    backend,
    raw,
    step,
    callTarget,
    spec,
    resolvedArgs,
    outputRef,
    outMap,
    refs,
  });

  return undefined;
}

function executeAssertStep(
  step: Extract<V2WorkflowStep, { op: "assert" }>,
  args: unknown,
  refs: Map<string, RefValue>,
): void {
  const { operator, operands } = extractAssertOperatorAndOperands(step.test);

  const left = resolveSpiceIntExpression(operands[0], args, refs, `assert.test.${operator}[0]`);
  const right = resolveSpiceIntExpression(operands[1], args, refs, `assert.test.${operator}[1]`);

  const errorSpec = asRecord(step.error, "assert.error");
  const code = asNonEmptyString(errorSpec.code, "assert.error.code");
  const message = asNonEmptyString(errorSpec.message, "assert.error.message");

  const passed = (() => {
    switch (operator) {
      case "eq":
        return left === right;
      case "ne":
        return left !== right;
      case "gt":
        return left > right;
      case "gte":
        return left >= right;
      case "lt":
        return left < right;
      case "lte":
        return left <= right;
    }
  })();

  if (passed) {
    return;
  }

  const assertionError = new Error(message) as Error & { code?: string };
  assertionError.code = code;
  throw assertionError;
}

function freeCellRef(
  backend: SpiceBackend,
  refs: Map<string, RefValue>,
  freedHandles: FreedHandles,
  target: unknown,
): void {
  const kit = getKitBackend(backend);
  const { name, value: cell } = resolveCellReference(target, refs, "freeCell.target");
  if (freedHandles.cell.has(cell)) {
    refs.delete(name);
    return;
  }

  kit.freeCell(cell);
  freedHandles.cell.add(cell);
  refs.delete(name);
}

function freeWindowRef(
  backend: SpiceBackend,
  refs: Map<string, RefValue>,
  freedHandles: FreedHandles,
  target: unknown,
): void {
  const kit = getKitBackend(backend);
  const { name, value: window } = resolveWindowReference(target, refs, "freeWindow.target");
  if (freedHandles.window.has(window)) {
    refs.delete(name);
    return;
  }

  kit.freeWindow(window);
  freedHandles.window.add(window);
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
  contractMethod: string,
  args: unknown,
  refs: Map<string, RefValue>,
  freedHandles: FreedHandles,
): Promise<unknown | undefined> {
  const raw = getRawBackend(backend);
  const kit = getKitBackend(backend);

  switch (step.op) {
    case "allocCell": {
      const size = resolveSpiceIntExpression(step.params.size, args, refs, "allocCell.params.size");
      if (size < 0) {
        invalidArgs("allocCell.params.size must be >= 0");
      }

      let cell: CellHandle;
      if (step.params.kind === "int") {
        cell = kit.newIntCell(size);
      } else if (step.params.kind === "double") {
        cell = kit.newDoubleCell(size);
      } else if (step.params.kind === "char") {
        const length = resolveSpiceIntExpression(
          step.params.length,
          args,
          refs,
          "allocCell.params.length",
        );
        if (length < 1) {
          invalidArgs("allocCell.params.length must be >= 1");
        }

        cell = kit.newCharCell(size, length);
      } else {
        unsupportedCall(`Unsupported allocCell kind: ${(step.params as { kind: unknown }).kind}`);
      }

      // A backend can reuse a numeric handle value after free; treat this
      // allocation as a fresh live handle so end-of-case cleanup still frees it.
      freedHandles.cell.delete(cell);
      defineRef(refs, step.as, { kind: "cell", value: cell }, "allocCell.as");
      return undefined;
    }

    case "allocWindow": {
      const maxIntervals = resolveSpiceIntExpression(
        step.params.maxIntervals,
        args,
        refs,
        "allocWindow.params.maxIntervals",
      );
      if (maxIntervals < 0) {
        invalidArgs("allocWindow.params.maxIntervals must be >= 0");
      }

      const window = kit.newWindow(maxIntervals);
      // A backend can reuse a numeric handle value after free; clear stale
      // dedupe state so this new live window is not skipped during teardown.
      freedHandles.window.delete(window);
      defineRef(refs, step.as, { kind: "window", value: window }, "allocWindow.as");
      return undefined;
    }

    case "materialize": {
      if (step.fixture === "minimalDsk") {
        const filePath = buildTempPath(backend, "v2-materialize-minimal-dsk", ".bds");
        writeMinimalDskFile(backend, filePath);
        defineRef(refs, step.as, { kind: "path", value: filePath }, "materialize.as");
        return undefined;
      }

      if (step.fixture === "virtualOutputSpk") {
        const outputPath = buildTempPath(backend, "v2-materialize-virtual-output", ".bsp");
        writeVirtualOutputSpkFixture(backend, outputPath);
        defineRef(refs, step.as, { kind: "path", value: outputPath }, "materialize.as");
        return undefined;
      }

      unsupportedCall(`Unsupported materialize fixture: ${(step as { fixture?: unknown }).fixture}`);
    }

    case "dasOpen": {
      const pathValue = resolveStringExpression(step.path, args, refs, "dasOpen.path");
      const handle = raw.dasopr(pathValue);
      freedHandles.das.delete(handle);
      defineRef(refs, step.as, { kind: "dasHandle", value: handle }, "dasOpen.as");
      return undefined;
    }

    case "dlaBeginForwardSearch": {
      const { value: handle } = resolveDasHandleReference(step.handle, refs, "dlaBeginForwardSearch.handle");
      const first = raw.dlabfs(handle);
      if (!first.found) {
        invalidRequest("dlaBeginForwardSearch expected a DLA segment");
      }

      defineRef(refs, step.as, { kind: "dlaDescriptor", value: first.descr }, "dlaBeginForwardSearch.as");
      return undefined;
    }

    case "dasClose": {
      const { name, value: handle } = resolveDasHandleReference(step.target, refs, "dasClose.target");
      if (!freedHandles.das.has(handle)) {
        raw.dascls(handle);
        freedHandles.das.add(handle);
      }
      refs.delete(name);
      return undefined;
    }

    case "unlink": {
      const { name, value: filePath } = resolvePathReference(step.target, refs, "unlink.target");
      unlinkPathBestEffort(backend, filePath);
      refs.delete(name);
      return undefined;
    }

    case "call": {
      return await executeCallFromSpec(backend, step, contractMethod, args, refs);
    }

    case "project": {
      projectRefs(step.out, args, refs);
      return undefined;
    }

    case "switch": {
      const switchKey = resolveSwitchCaseKey(step.on, args, refs, "switch.on");
      const selectedBranch =
        Object.prototype.hasOwnProperty.call(step.cases, switchKey)
          ? step.cases[switchKey]
          : step.default;

      if (!selectedBranch) {
        invalidRequest(
          `switch.on resolved to ${formatValue(switchKey)} with no matching case and no default branch`,
        );
      }

      let projectedResult: unknown | undefined;
      for (const branchStep of selectedBranch) {
        const maybeResult = await executeStep(
          backend,
          branchStep,
          contractMethod,
          args,
          refs,
          freedHandles,
        );
        if (maybeResult !== undefined) {
          projectedResult = maybeResult;
        }
      }

      return projectedResult;
    }

    case "projectResult": {
      return projectResult(step.out, args, refs);
    }

    case "assert": {
      executeAssertStep(step, args, refs);
      return undefined;
    }

    case "freeCell": {
      freeCellRef(backend, refs, freedHandles, step.target);
      return undefined;
    }

    case "freeWindow": {
      freeWindowRef(backend, refs, freedHandles, step.target);
      return undefined;
    }

    case "script": {
      invalidRequest(
        "v3 workflow step script is parsed explicitly and must be executed by a script-capable runtime",
      );
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

    const withCode = error as Error & { code?: string; details?: unknown };
    if (typeof withCode.code === "string") {
      report.code = withCode.code;
    }
    if (
      typeof withCode.details === "object" &&
      withCode.details !== null &&
      !Array.isArray(withCode.details)
    ) {
      report.details = { ...(withCode.details as Record<string, unknown>) };
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
  validateV2Envelope(input);

  const kit = getKitBackend(backend);
  const raw = getRawBackend(backend);

  const refs = new Map<string, RefValue>();
  const freedHandles: FreedHandles = {
    cell: new Set<CellHandle>(),
    window: new Set<WindowHandle>(),
    das: new Set<DasHandle>(),
  };

  const args: unknown =
    input.args === undefined
      ? {}
      : Array.isArray(input.args)
        ? input.args
        : validateCaseArgs(input);

  let projectedResult: unknown = undefined;
  let hasProjectedResult = false;
  let terminalError: unknown = undefined;

  try {
    for (const step of input.workflow.steps) {
      const maybeResult = await executeStep(
        backend,
        step,
        input.contract.contractMethod,
        args,
        refs,
        freedHandles,
      );
      if (maybeResult !== undefined) {
        projectedResult = maybeResult;
        hasProjectedResult = true;
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
      await executeStep(backend, step, input.contract.contractMethod, args, refs, freedHandles);
    } catch (cleanupError) {
      if (terminalError === undefined) {
        terminalError = cleanupError;
      }
      // Keep cleanup best-effort across all cleanup steps.
    }
  }

  for (const refValue of refs.values()) {
    if (
      refValue.kind === "int" ||
      refValue.kind === "dlaDescriptor" ||
      refValue.kind === "dskDescriptor"
    ) {
      continue;
    }

    if (refValue.kind === "path") {
      unlinkPathBestEffort(backend, refValue.value);
      continue;
    }

    if (refValue.kind === "dasHandle") {
      if (freedHandles.das.has(refValue.value)) {
        continue;
      }

      try {
        raw.dascls(refValue.value);
        freedHandles.das.add(refValue.value);
      } catch {
        // best effort cleanup
      }

      continue;
    }

    if (refValue.kind === "cell") {
      if (freedHandles.cell.has(refValue.value)) {
        continue;
      }

      try {
        kit.freeCell(refValue.value);
        freedHandles.cell.add(refValue.value);
      } catch {
        // best effort cleanup
      }

      continue;
    }

    if (freedHandles.window.has(refValue.value)) {
      continue;
    }

    try {
      kit.freeWindow(refValue.value);
      freedHandles.window.add(refValue.value);
    } catch {
      // best effort cleanup
    }
  }

  if (terminalError !== undefined) {
    throw terminalError;
  }

  return projectedResult;
}
