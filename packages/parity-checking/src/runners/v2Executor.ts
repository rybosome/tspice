import crypto from "node:crypto";
import { rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { SpiceBackend } from "@rybosome/tspice";

import type {
  RunCaseInputV2,
  RunnerErrorReport,
  V2WorkflowAssertOperator,
  V2WorkflowStep,
} from "./types.js";
import { ASSERT_OPERATOR_NAMES_TEXT } from "../assertOperators.js";
import {
  V2_DSKB02_NAMED_OUTPUTS,
  invokeGeneratedV2SpiceCall,
  lookupGeneratedV2SpiceCallSpec,
} from "../generated/v2SpiceCallRegistry.js";
import type {
  V2GeneratedSpiceCallArgKind,
  V2GeneratedSpiceCallInvokeContext,
} from "../generated/v2SpiceCallRegistry.js";
import { validateV2ContractResultOrThrow } from "./v2ContractResultValidation.js";

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

const DSK_MINIMAL_NV = 3;
const DSK_MINIMAL_NP = 1;
const DSK_MINIMAL_WORKSZ = 4096;
const DSK_MINIMAL_VOXPSZ = 4096;
const DSK_MINIMAL_VOXLSZ = 1024;
// Keep this comfortably above CSPICE's runtime minimum for the synthetic
// 1-plate fixture used by parity tests (INTINDEXTOOSMALL otherwise).
const DSK_MINIMAL_SPXISZ = 131072;

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

type CellHandle =
  | ReturnType<SpiceBackend["kit"]["newIntCell"]>
  | ReturnType<SpiceBackend["kit"]["newDoubleCell"]>
  | ReturnType<SpiceBackend["kit"]["newCharCell"]>;
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

type CallContractExecutionContext = {
  args: unknown[];
  defaultCall: string;
};

type WasmVirtualOutputCleanupHooks = {
  __deleteVirtualFileForFileIo?: (path: string) => void;
};

type V2SpiceCallStep = Extract<V2WorkflowStep, { op: "spiceCall" }>;
type V2SpiceCallArgKind = V2GeneratedSpiceCallArgKind;

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

    return resolvePropertyPath(args[token.key], token.propertyPath, label);
  }

  const refValue = refs.get(token.key);
  if (!refValue) {
    invalidRequest(`${label} references missing ref ${JSON.stringify(token.key)}`);
  }

  return resolvePropertyPath(refValue.value, token.propertyPath, label);
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

function resolveStringExpression(
  expr: unknown,
  args: Record<string, unknown>,
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

  return validateCaseArgs(input);
}

function resolveCallContractMethodName(stepCall: unknown, defaultCall: string): string {
  const resolvedCall = stepCall === undefined ? defaultCall : stepCall;
  const call = asNonEmptyString(resolvedCall, "callContract.call").trim();
  if (call.length === 0) {
    invalidRequest("v3 callContract requires a non-empty call name");
  }

  const method = call.includes(".") ? call.slice(call.lastIndexOf(".") + 1) : call;
  if (method.length === 0) {
    invalidRequest("v3 callContract requires a non-empty backend method name");
  }

  return method;
}

async function executeCallContractStep(
  backend: SpiceBackend,
  step: Extract<V2WorkflowStep, { op: "callContract" }>,
  context: CallContractExecutionContext,
): Promise<unknown> {
  const raw = getRawBackend(backend);
  const method = resolveCallContractMethodName(step.call, context.defaultCall);
  const maybeInvoker = (raw as unknown as Record<string, unknown>)[method];

  if (typeof maybeInvoker !== "function") {
    unsupportedCall("Unsupported call", { call: step.call ?? context.defaultCall });
  }

  return await (maybeInvoker as (...callArgs: unknown[]) => unknown).apply(raw, context.args);
}

function hasCallContractStep(steps: V2WorkflowStep[]): boolean {
  return steps.some((step) => step.op === "callContract");
}

function validateProjectedResult(projectedResult: unknown, input: RunCaseInputV2): void {
  if (input.contract.result === undefined) {
    return;
  }

  validateV2ContractResultOrThrow(projectedResult, input.contract.result, "v3.projectedResult", invalidRequest);
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

function projectRefs(
  out: Record<string, unknown>,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
): void {
  for (const [key, value] of Object.entries(out)) {
    const projectedValue = resolveSpiceIntExpression(value, args, refs, `project.out.${key}`);
    defineRef(refs, key, { kind: "int", value: projectedValue }, `project.out.${key}`);
  }
}

function resolveSwitchCaseKey(
  expr: unknown,
  args: Record<string, unknown>,
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

function validateSpiceCallArity(step: V2SpiceCallStep, expectedArity: number): void {
  if (step.in.length !== expectedArity) {
    const plural = expectedArity === 1 ? "" : "s";
    invalidRequest(`spiceCall ${step.call} expects ${expectedArity} input${plural}`);
  }
}

function requireSpiceCallOutputRef(step: V2SpiceCallStep): string {
  const outputRef = (step as { as?: unknown }).as;
  if (outputRef === undefined) {
    invalidArgs(`spiceCall ${step.call} requires an "as" output ref`);
  }

  if (typeof outputRef !== "string" || outputRef.trim() === "") {
    invalidArgs(`spiceCall ${step.call} requires a non-empty string "as" output ref`);
  }

  return outputRef;
}

function forbidSpiceCallOutputRef(step: V2SpiceCallStep): void {
  if ((step as { as?: unknown }).as !== undefined) {
    invalidArgs(`spiceCall ${step.call} does not allow an "as" output ref`);
  }
}

function requireSpiceCallOutMap(step: V2SpiceCallStep): Record<string, string> {
  const rawOut = (step as { out?: unknown }).out;
  if (rawOut === undefined) {
    invalidArgs(`spiceCall ${step.call} requires an "out" map`);
  }

  if (typeof rawOut !== "object" || rawOut === null || Array.isArray(rawOut)) {
    invalidArgs(`spiceCall ${step.call} requires out to be an object map`);
  }

  const mapped: Record<string, string> = {};
  for (const [name, rawTarget] of Object.entries(rawOut)) {
    if (typeof rawTarget !== "string" || rawTarget.trim() === "") {
      invalidArgs(`spiceCall ${step.call}.out.${name} must be a non-empty string ref name`);
    }
    mapped[name] = rawTarget;
  }

  return mapped;
}

function forbidSpiceCallOutMap(step: V2SpiceCallStep): void {
  if ((step as { out?: unknown }).out !== undefined) {
    invalidArgs(`spiceCall ${step.call} does not allow an "out" map`);
  }
}

function resolveSpiceCallArg(
  step: V2SpiceCallStep,
  argIndex: number,
  argKind: V2SpiceCallArgKind,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
): unknown {
  const label = `spiceCall(${step.call}).in[${argIndex}]`;
  const expr = step.in[argIndex];

  switch (argKind) {
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

type Dskb02NamedSpiceIntOutputKey = (typeof V2_DSKB02_NAMED_OUTPUTS)[number];
type Dskb02NamedSpiceIntOutputs = {
  [key in Dskb02NamedSpiceIntOutputKey]: DskType2Bookkeeping[key];
};

type Dskb02OutputKeyValidation = Dskb02NamedSpiceIntOutputKey extends keyof DskType2Bookkeeping
  ? true
  : false;

const DSKB02_OUTPUT_KEY_VALIDATION: Dskb02OutputKeyValidation = true;

void DSKB02_OUTPUT_KEY_VALIDATION;

const DSKB02_NAMED_SPICE_INT_OUTPUT_SET: ReadonlySet<string> = new Set(V2_DSKB02_NAMED_OUTPUTS);

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

function requireDskb02NamedSpiceIntOutputKey(step: V2SpiceCallStep, outputName: string): Dskb02NamedSpiceIntOutputKey {
  if (!isDskb02NamedSpiceIntOutputKey(outputName)) {
    invalidArgs(
      `spiceCall ${step.call}.out has unsupported key ${JSON.stringify(outputName)} (supported: ${V2_DSKB02_NAMED_OUTPUTS.join(", ")})`,
    );
  }

  return outputName;
}

function applyNamedDskb02Outputs(
  step: V2SpiceCallStep,
  outMap: Record<string, string>,
  bookkeeping: DskType2Bookkeeping,
  refs: Map<string, RefValue>,
): void {
  const namedOutputs = toNamedDskb02SpiceIntOutputs(bookkeeping);

  for (const [outputName, refName] of Object.entries(outMap)) {
    const outputKey = requireDskb02NamedSpiceIntOutputKey(step, outputName);
    const outputLabel = `spiceCall(${step.call}).out.${outputKey}`;

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

function executeReadVirtualOutputCall(backend: SpiceBackend, outputPath: string): void {
  const kit = getKitBackend(backend);
  const output = {
    kind: "virtual-output" as const,
    path: outputPath,
  };

  const bytes = kit.readVirtualOutput(output);
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1) {
    invalidRequest("spiceCall(readVirtualOutput) expected non-empty output bytes");
  }
}

function executeDskopnLegacyCall(backend: SpiceBackend, raw: SpiceBackend["raw"]): void {
  const tempPath = buildTempPath(backend, "dskopn", ".bds");
  let handle: DskOpenHandle | undefined;
  let opError: unknown = undefined;

  try {
    handle = raw.dskopn(tempPath, "TSPICE", 0);
  } catch (error) {
    opError = error;
  }

  if (handle !== undefined) {
    closeDasHandlePreserveError(raw, handle, opError);
  }

  unlinkPathBestEffort(backend, tempPath);

  if (opError !== undefined) {
    throw opError;
  }
}

function executeDskmi2LegacyCall(raw: SpiceBackend["raw"], step: V2SpiceCallStep): void {
  const spatial = raw.dskmi2(
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

  if (spatial.spaixd.length < 1 || spatial.spaixi.length < 1) {
    invalidRequest(`spiceCall(${step.call}) expected non-empty spatial index outputs`);
  }
}

function executeDskw02LegacyCall(backend: SpiceBackend): void {
  const tempPath = buildTempPath(backend, "dskw02", ".bds");
  try {
    writeMinimalDskFile(backend, tempPath);
  } finally {
    unlinkPathBestEffort(backend, tempPath);
  }
}

function executeSpiceCallFromSpec(
  backend: SpiceBackend,
  step: V2SpiceCallStep,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
): void {
  const spec = lookupGeneratedV2SpiceCallSpec(step.call);
  if (!spec) {
    unsupportedCall(`Unsupported spiceCall op: ${step.call}`);
  }

  validateSpiceCallArity(step, spec.arity);
  const resolvedArgs = spec.argKinds.map((argKind, index) =>
    resolveSpiceCallArg(step, index, argKind, args, refs),
  );

  if (spec.nonNegativeIntArgMask !== 0) {
    for (let i = 0; i < spec.argKinds.length; i++) {
      const isNonNegativeArg = (spec.nonNegativeIntArgMask & (1 << i)) !== 0;
      if (!isNonNegativeArg || spec.argKinds[i] !== "intExpr") {
        continue;
      }

      const value = resolvedArgs[i];
      if (typeof value !== "number" || value < 0) {
        invalidArgs(`spiceCall(${step.call}).in[${i}] must be >= 0`);
      }
    }
  }

  const raw = getRawBackend(backend);
  const outputRef =
    spec.outputMode === "asSpiceInt" || spec.outputMode === "asDskDescriptor"
      ? requireSpiceCallOutputRef(step)
      : undefined;
  const outMap = spec.outputMode === "outNamedDskb02" ? requireSpiceCallOutMap(step) : undefined;

  if (spec.outputMode !== "asSpiceInt" && spec.outputMode !== "asDskDescriptor") {
    forbidSpiceCallOutputRef(step);
  }
  if (spec.outputMode !== "outNamedDskb02") {
    forbidSpiceCallOutMap(step);
  }

  const invokeContext: V2GeneratedSpiceCallInvokeContext = {
    backend,
    raw,
    resolvedArgs,
    defineSpiceIntResult: (rawValue): void => {
      if (!outputRef) {
        invalidArgs(`spiceCall ${step.call} requires an "as" output ref`);
      }

      const value = asSpiceInt(rawValue, `spiceCall(${step.call}).result`);
      defineRef(refs, outputRef, { kind: "int", value }, `spiceCall(${step.call}).as`);
    },
    defineDskDescriptorResult: (descriptor): void => {
      if (!outputRef) {
        invalidArgs(`spiceCall ${step.call} requires an "as" output ref`);
      }

      defineRef(refs, outputRef, { kind: "dskDescriptor", value: descriptor }, `spiceCall(${step.call}).as`);
    },
    applyNamedDskb02Outputs: (bookkeeping): void => {
      if (!outMap) {
        invalidArgs(`spiceCall ${step.call} requires an "out" map`);
      }

      applyNamedDskb02Outputs(step, outMap, bookkeeping, refs);
    },
    executeDskopnLegacy: (): void => {
      executeDskopnLegacyCall(backend, raw);
    },
    executeDskmi2Legacy: (): void => {
      executeDskmi2LegacyCall(raw, step);
    },
    executeDskw02Legacy: (): void => {
      executeDskw02LegacyCall(backend);
    },
    executeReadVirtualOutput: (outputPath: string): void => {
      executeReadVirtualOutputCall(backend, outputPath);
    },
  };

  invokeGeneratedV2SpiceCall(step.call, invokeContext);
}

function executeAssertStep(
  step: Extract<V2WorkflowStep, { op: "assert" }>,
  args: Record<string, unknown>,
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
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  freedHandles: FreedHandles,
  callContractContext?: CallContractExecutionContext,
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

    case "spiceCall": {
      executeSpiceCallFromSpec(backend, step, args, refs);
      return undefined;
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
          args,
          refs,
          freedHandles,
          callContractContext,
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

    case "callContract": {
      if (!callContractContext) {
        invalidRequest("callContract execution context is missing");
      }

      return await executeCallContractStep(backend, step, callContractContext);
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

  const hasWorkflowCallContract = hasCallContractStep(input.workflow.steps);
  const hasCleanupCallContract = hasCallContractStep(input.workflow.cleanup ?? []);

  if (hasCleanupCallContract) {
    invalidRequest("v3 callContract workflow must not define cleanup steps");
  }

  const isSingleCallContractWorkflow =
    input.workflow.steps.length === 1 && input.workflow.steps[0]?.op === "callContract";

  if (hasWorkflowCallContract && !isSingleCallContractWorkflow) {
    invalidRequest("v3 callContract is only supported as a single-step workflow");
  }

  let callContractContext: CallContractExecutionContext | undefined;
  let args: Record<string, unknown>;

  if (isSingleCallContractWorkflow) {
    if (!Array.isArray(input.args)) {
      invalidArgs(`v3 callContract expects case args to be an array (got ${formatValue(input.args)})`);
    }

    callContractContext = {
      args: input.args,
      defaultCall: asNonEmptyString(input.contract.contractMethod, "contract.contractMethod"),
    };
    args = {};
  } else {
    args = validateCaseArgs(input);
  }

  let projectedResult: unknown = undefined;
  let hasProjectedResult = false;
  let terminalError: unknown = undefined;

  try {
    for (const step of input.workflow.steps) {
      const maybeResult = await executeStep(
        backend,
        step,
        args,
        refs,
        freedHandles,
        callContractContext,
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
      await executeStep(backend, step, args, refs, freedHandles, callContractContext);
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
