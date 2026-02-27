import crypto from "node:crypto";
import { rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import type { SpiceBackend } from "@rybosome/tspice";

import type {
  RunCaseInputV2,
  RunnerErrorReport,
  V2WorkflowStep,
} from "./types.js";
import { validateV2ContractResultOrThrow } from "./v2ContractResultValidation.js";

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

const DSK_MINIMAL_NV = 3;
const DSK_MINIMAL_NP = 1;
const DSK_MINIMAL_WORKSZ = 2048;
const DSK_MINIMAL_VOXPSZ = 512;
const DSK_MINIMAL_VOXLSZ = 1024;
const DSK_MINIMAL_SPXISZ = 8192;

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

const EK_FAST_WRITE_NROWS = 3;
const EK_FAST_WRITE_TABLE = "PEOPLE";
const EK_FAST_WRITE_QUERY = "SELECT ID, COST, NAME FROM PEOPLE ORDER BY ID";
const EK_FAST_WRITE_COLUMN_NAMES = ["ID", "COST", "NAME"] as const;
const EK_FAST_WRITE_DECLS = [
  "DATATYPE = INTEGER, INDEXED = TRUE",
  "DATATYPE = DOUBLE PRECISION",
  "DATATYPE = CHARACTER*(*)",
] as const;
const EK_FAST_WRITE_IDS = [1, 2, 3] as const;
const EK_FAST_WRITE_COSTS = [10.5, 20.25, 30] as const;
const EK_FAST_WRITE_NAMES = ["Alice", "Bob", "Carol"] as const;
const EK_FAST_WRITE_ENTSZS = [1, 1, 1] as const;
const EK_FAST_WRITE_NLFLGS = [false, false, false] as const;
const EK_FAST_WRITE_DOUBLE_TOLERANCE = 1e-12;

type CellHandle =
  | ReturnType<SpiceBackend["kit"]["newIntCell"]>
  | ReturnType<SpiceBackend["kit"]["newDoubleCell"]>
  | ReturnType<SpiceBackend["kit"]["newCharCell"]>;
type WindowHandle = ReturnType<SpiceBackend["kit"]["newWindow"]>;
type DasHandle = ReturnType<SpiceBackend["raw"]["dasopr"]>;
type DskOpenHandle = ReturnType<SpiceBackend["raw"]["dskopn"]>;
type EkFastWriteHandle = ReturnType<SpiceBackend["raw"]["ekopn"]>;

type EkFastWriteState = {
  path: string;
  handle: EkFastWriteHandle | null;
  segno: number;
  rcptrs: number[];
  loaded: boolean;
  queryReady: boolean;
};

type V2RunnerState = {
  ekFastWrite: EkFastWriteState | undefined;
};

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
    };

type FreedHandles = {
  cell: Set<CellHandle>;
  window: Set<WindowHandle>;
};

type WasmVirtualOutputCleanupHooks = {
  __deleteVirtualFileForFileIo?: (path: string) => void;
};

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

function deletePathBestEffort(backend: SpiceBackend, filePath: string): void {
  if (backend.kind !== "wasm") {
    deleteTempPathBestEffort(backend, filePath);
    return;
  }

  const hooks = getRawBackend(backend) as unknown as WasmVirtualOutputCleanupHooks;
  const remove = hooks.__deleteVirtualFileForFileIo;

  if (!remove) {
    return;
  }

  try {
    remove(filePath);
  } catch {
    // best effort cleanup
  }
}

function deleteVirtualOutputPathBestEffort(backend: SpiceBackend, virtualOutputPath: string): void {
  deletePathBestEffort(backend, virtualOutputPath);
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

async function withMinimalDskFile<T>(
  backend: SpiceBackend,
  tag: string,
  fn: (filePath: string) => T | Promise<T>,
): Promise<T> {
  const tempPath = buildTempPath(backend, tag, ".bds");
  try {
    writeMinimalDskFile(backend, tempPath);
    return await fn(tempPath);
  } finally {
    deleteTempPathBestEffort(backend, tempPath);
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

function resolveFiniteNumberExpression(
  expr: unknown,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  label: string,
): number {
  const value = resolveExpression(expr, args, refs, label);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalidArgs(`${label} must be a finite number (got ${formatValue(value)})`);
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
  if (!token || token.source !== "refs") {
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

/**
 * Shared static validation for schema-v2 case payloads before runner dispatch.
 *
 * Returns normalized/validated args for reuse by callers that continue execution.
 */
export function validateV2CasePreflight(input: RunCaseInputV2): Record<string, unknown> {
  if (input.schemaVersion !== 2) {
    invalidRequest(`executeV2CaseWithBackend expected schemaVersion=2 (got ${formatValue(input.schemaVersion)})`);
  }

  if (input.manifest.kind !== "method") {
    invalidRequest(`v2.manifest.kind must be \"method\" (got ${formatValue(input.manifest.kind)})`);
  }

  return validateCaseArgs(input);
}

function validateProjectedResult(projectedResult: unknown, input: RunCaseInputV2): void {
  validateV2ContractResultOrThrow(projectedResult, input.contract.result, "v2.projectedResult", invalidRequest);
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

function cleanupEkFastWriteState(backend: SpiceBackend, state: EkFastWriteState | undefined): void {
  if (!state) {
    return;
  }

  const raw = getRawBackend(backend);

  if (state.handle !== null) {
    try {
      raw.ekcls(state.handle);
    } catch {
      // best effort cleanup
    }
    state.handle = null;
  }

  if (state.loaded) {
    try {
      raw.unload(state.path);
    } catch {
      // best effort cleanup
    }
  }

  deletePathBestEffort(backend, state.path);
}

async function executeStep(
  backend: SpiceBackend,
  step: V2WorkflowStep,
  args: Record<string, unknown>,
  refs: Map<string, RefValue>,
  freedHandles: FreedHandles,
  state: V2RunnerState,
): Promise<Record<string, unknown> | undefined> {
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

    case "spiceCall": {
      if (step.call === "card_c" || step.call === "size_c") {
        if (step.in.length !== 1) {
          invalidRequest(`spiceCall ${step.call} expects exactly one input ref`);
        }

        if ((step as { as?: unknown }).as === undefined) {
          // Schema validation should make this unreachable, but keep a defensive
          // runtime guard for direct inputs that bypass the schema parser.
          invalidArgs(`spiceCall ${step.call} requires an \"as\" output ref`);
        }

        const { value: handle } = resolveCellOrWindowReference(
          step.in[0],
          refs,
          `spiceCall(${step.call}).in[0]`,
        );
        const value =
          step.call === "card_c"
            ? asSpiceInt(raw.card(handle), `spiceCall(${step.call}).result`)
            : asSpiceInt(raw.size(handle), `spiceCall(${step.call}).result`);

        defineRef(refs, step.as, { kind: "int", value }, `spiceCall(${step.call}).as`);
        return undefined;
      }

      if (step.call === "scard_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          // Schema validation should make this unreachable, but keep a defensive
          // runtime guard for direct inputs that bypass the schema parser.
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 2) {
          invalidRequest(`spiceCall ${step.call} expects [card, cellOrWindow] inputs`);
        }

        const card = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        if (card < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const { value: handle } = resolveCellOrWindowReference(
          step.in[1],
          refs,
          `spiceCall(${step.call}).in[1]`,
        );
        raw.scard(card, handle);
        return undefined;
      }

      if (step.call === "ssize_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          // Schema validation should make this unreachable, but keep a defensive
          // runtime guard for direct inputs that bypass the schema parser.
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 2) {
          invalidRequest(`spiceCall ${step.call} expects [size, cellOrWindow] inputs`);
        }

        const size = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        if (size < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const { value: handle } = resolveCellOrWindowReference(
          step.in[1],
          refs,
          `spiceCall(${step.call}).in[1]`,
        );
        raw.ssize(size, handle);
        return undefined;
      }

      if (step.call === "valid_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          // Schema validation should make this unreachable, but keep a defensive
          // runtime guard for direct inputs that bypass the schema parser.
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 3) {
          invalidRequest(`spiceCall ${step.call} expects [size, n, cellOrWindow] inputs`);
        }

        const size = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        const n = resolveSpiceIntExpression(step.in[1], args, refs, `spiceCall(${step.call}).in[1]`);
        if (size < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }
        if (n < 0) {
          invalidArgs(`spiceCall(${step.call}).in[1] must be >= 0`);
        }

        const { value: handle } = resolveCellOrWindowReference(
          step.in[2],
          refs,
          `spiceCall(${step.call}).in[2]`,
        );
        raw.valid(size, n, handle);
        return undefined;
      }

      if (step.call === "ekifld_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        cleanupEkFastWriteState(backend, state.ekFastWrite);
        state.ekFastWrite = undefined;

        const tempPath = buildTempPath(backend, "ek-fast-write", ".bes");
        let handle: EkFastWriteHandle | null = null;

        try {
          handle = raw.ekopn(tempPath, "TSPICE", 0);
          const begin = raw.ekifld(
            handle,
            EK_FAST_WRITE_TABLE,
            EK_FAST_WRITE_NROWS,
            EK_FAST_WRITE_COLUMN_NAMES,
            EK_FAST_WRITE_DECLS,
          );

          const segno = asSpiceInt(begin.segno, `spiceCall(${step.call}).result.segno`);
          if (begin.rcptrs.length !== EK_FAST_WRITE_NROWS) {
            invalidRequest(
              `spiceCall(${step.call}) expected rcptrs length ${EK_FAST_WRITE_NROWS} (got ${begin.rcptrs.length})`,
            );
          }

          const rcptrs = begin.rcptrs.map((value: unknown, index: number) =>
            asSpiceInt(value, `spiceCall(${step.call}).result.rcptrs[${index}]`),
          );

          state.ekFastWrite = {
            path: tempPath,
            handle,
            segno,
            rcptrs,
            loaded: false,
            queryReady: false,
          };
          return undefined;
        } catch (error) {
          if (handle !== null) {
            try {
              raw.ekcls(handle);
            } catch {
              // best effort cleanup
            }
          }
          deletePathBestEffort(backend, tempPath);
          throw error;
        }
      }

      if (step.call === "ekacli_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        if (!state.ekFastWrite) {
          invalidRequest(`spiceCall ${step.call} requires a prior ekifld_c step`);
        }

        if (state.ekFastWrite.handle === null) {
          invalidRequest(`spiceCall ${step.call} requires an open EK handle`);
        }

        raw.ekacli(
          state.ekFastWrite.handle,
          state.ekFastWrite.segno,
          "ID",
          EK_FAST_WRITE_IDS,
          EK_FAST_WRITE_ENTSZS,
          EK_FAST_WRITE_NLFLGS,
          state.ekFastWrite.rcptrs,
        );

        state.ekFastWrite.queryReady = false;
        return undefined;
      }

      if (step.call === "ekacld_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        if (!state.ekFastWrite) {
          invalidRequest(`spiceCall ${step.call} requires a prior ekifld_c step`);
        }

        if (state.ekFastWrite.handle === null) {
          invalidRequest(`spiceCall ${step.call} requires an open EK handle`);
        }

        raw.ekacld(
          state.ekFastWrite.handle,
          state.ekFastWrite.segno,
          "COST",
          EK_FAST_WRITE_COSTS,
          EK_FAST_WRITE_ENTSZS,
          EK_FAST_WRITE_NLFLGS,
          state.ekFastWrite.rcptrs,
        );

        state.ekFastWrite.queryReady = false;
        return undefined;
      }

      if (step.call === "ekaclc_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        if (!state.ekFastWrite) {
          invalidRequest(`spiceCall ${step.call} requires a prior ekifld_c step`);
        }

        if (state.ekFastWrite.handle === null) {
          invalidRequest(`spiceCall ${step.call} requires an open EK handle`);
        }

        raw.ekaclc(
          state.ekFastWrite.handle,
          state.ekFastWrite.segno,
          "NAME",
          EK_FAST_WRITE_NAMES,
          EK_FAST_WRITE_ENTSZS,
          EK_FAST_WRITE_NLFLGS,
          state.ekFastWrite.rcptrs,
        );

        state.ekFastWrite.queryReady = false;
        return undefined;
      }

      if (step.call === "ekffld_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        if (!state.ekFastWrite) {
          invalidRequest(`spiceCall ${step.call} requires a prior ekifld_c step`);
        }

        if (state.ekFastWrite.handle === null) {
          invalidRequest(`spiceCall ${step.call} requires an open EK handle`);
        }

        raw.ekffld(state.ekFastWrite.handle, state.ekFastWrite.segno, state.ekFastWrite.rcptrs);
        raw.ekcls(state.ekFastWrite.handle);
        state.ekFastWrite.handle = null;

        raw.furnsh(state.ekFastWrite.path);
        state.ekFastWrite.loaded = true;
        state.ekFastWrite.queryReady = false;
        return undefined;
      }

      if (step.call === "ekfind_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 1) {
          invalidRequest(`spiceCall ${step.call} expects [expectedRowCount]`);
        }

        if (!state.ekFastWrite || !state.ekFastWrite.loaded) {
          invalidRequest(`spiceCall ${step.call} requires a finalized EK via ekffld_c`);
        }

        const expectedRows = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        if (expectedRows < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const find = raw.ekfind(EK_FAST_WRITE_QUERY);
        if (!find.ok) {
          invalidRequest(`spiceCall(${step.call}) query failed: ${find.errmsg}`);
        }

        const nmrows = asSpiceInt(find.nmrows, `spiceCall(${step.call}).result.nmrows`);
        if (nmrows !== expectedRows) {
          invalidRequest(
            `spiceCall(${step.call}) expected ${expectedRows} rows from ${JSON.stringify(EK_FAST_WRITE_QUERY)} (got ${nmrows})`,
          );
        }

        state.ekFastWrite.queryReady = true;
        return undefined;
      }

      if (step.call === "ekgi_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 2) {
          invalidRequest(`spiceCall ${step.call} expects [row, expectedValue]`);
        }

        if (!state.ekFastWrite || !state.ekFastWrite.queryReady) {
          invalidRequest(`spiceCall ${step.call} requires a successful prior ekfind_c step`);
        }

        const row = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        const expected = resolveSpiceIntExpression(step.in[1], args, refs, `spiceCall(${step.call}).in[1]`);
        if (row < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const got = raw.ekgi(0, row, 0);
        if (!got.found) {
          invalidRequest(`spiceCall(${step.call}) expected found=true at row ${row}`);
        }
        if (got.isNull) {
          invalidRequest(`spiceCall(${step.call}) expected non-null value at row ${row}`);
        }

        const actual = asSpiceInt(got.value, `spiceCall(${step.call}).result.value`);
        if (actual !== expected) {
          invalidRequest(`spiceCall(${step.call}) expected ${expected} at row ${row} (got ${actual})`);
        }

        return undefined;
      }

      if (step.call === "ekgd_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 2) {
          invalidRequest(`spiceCall ${step.call} expects [row, expectedValue]`);
        }

        if (!state.ekFastWrite || !state.ekFastWrite.queryReady) {
          invalidRequest(`spiceCall ${step.call} requires a successful prior ekfind_c step`);
        }

        const row = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        const expected = resolveFiniteNumberExpression(step.in[1], args, refs, `spiceCall(${step.call}).in[1]`);
        if (row < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const got = raw.ekgd(1, row, 0);
        if (!got.found) {
          invalidRequest(`spiceCall(${step.call}) expected found=true at row ${row}`);
        }
        if (got.isNull) {
          invalidRequest(`spiceCall(${step.call}) expected non-null value at row ${row}`);
        }

        const actual = got.value;
        if (!Number.isFinite(actual)) {
          invalidRequest(`spiceCall(${step.call}) returned non-finite value at row ${row}`);
        }
        if (Math.abs(actual - expected) > EK_FAST_WRITE_DOUBLE_TOLERANCE) {
          invalidRequest(`spiceCall(${step.call}) expected ${expected} at row ${row} (got ${actual})`);
        }

        return undefined;
      }

      if (step.call === "ekgc_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 2) {
          invalidRequest(`spiceCall ${step.call} expects [row, expectedValue]`);
        }

        if (!state.ekFastWrite || !state.ekFastWrite.queryReady) {
          invalidRequest(`spiceCall ${step.call} requires a successful prior ekfind_c step`);
        }

        const row = resolveSpiceIntExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        const expected = resolveStringExpression(step.in[1], args, refs, `spiceCall(${step.call}).in[1]`);
        if (row < 0) {
          invalidArgs(`spiceCall(${step.call}).in[0] must be >= 0`);
        }

        const got = raw.ekgc(2, row, 0);
        if (!got.found) {
          invalidRequest(`spiceCall(${step.call}) expected found=true at row ${row}`);
        }
        if (got.isNull) {
          invalidRequest(`spiceCall(${step.call}) expected non-null value at row ${row}`);
        }

        if (got.value !== expected) {
          invalidRequest(
            `spiceCall(${step.call}) expected ${JSON.stringify(expected)} at row ${row} (got ${JSON.stringify(got.value)})`,
          );
        }

        return undefined;
      }

      if (step.call === "dskopn_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

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

        deleteTempPathBestEffort(backend, tempPath);

        if (opError !== undefined) {
          throw opError;
        }

        return undefined;
      }

      if (step.call === "dskmi2_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

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

        return undefined;
      }

      if (step.call === "dskw02_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        const tempPath = buildTempPath(backend, "dskw02", ".bds");
        try {
          writeMinimalDskFile(backend, tempPath);
        } finally {
          deleteTempPathBestEffort(backend, tempPath);
        }

        return undefined;
      }

      if (step.call === "dskobj_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        await withMinimalDskFile(backend, "dskobj", (dskPath) => {
          const bodids = kit.newIntCell(100);
          try {
            raw.dskobj(dskPath, bodids);
            const count = asSpiceInt(raw.card(bodids), "spiceCall(dskobj_c).result.count");
            if (count < 1) {
              invalidRequest("spiceCall(dskobj_c) expected at least one body id");
            }
          } finally {
            kit.freeCell(bodids);
          }
        });

        return undefined;
      }

      if (step.call === "dsksrf_c") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        await withMinimalDskFile(backend, "dsksrf", (dskPath) => {
          const bodids = kit.newIntCell(100);
          const srfids = kit.newIntCell(100);
          try {
            raw.dskobj(dskPath, bodids);
            const bodyCount = asSpiceInt(raw.card(bodids), "spiceCall(dsksrf_c).bodyCount");
            if (bodyCount < 1) {
              invalidRequest("spiceCall(dsksrf_c) expected at least one body id");
            }

            const bodyId = asSpiceInt(kit.cellGeti(bodids, 0), "spiceCall(dsksrf_c).bodyId");
            raw.dsksrf(dskPath, bodyId, srfids);

            const surfaceCount = asSpiceInt(raw.card(srfids), "spiceCall(dsksrf_c).surfaceCount");
            if (surfaceCount < 1) {
              invalidRequest("spiceCall(dsksrf_c) expected at least one surface id");
            }
          } finally {
            kit.freeCell(srfids);
            kit.freeCell(bodids);
          }
        });

        return undefined;
      }

      if (step.call === "dskgd_c") {
        if (step.in.length !== 1) {
          invalidRequest(`spiceCall ${step.call} expects one selector input`);
        }

        if ((step as { as?: unknown }).as === undefined) {
          invalidArgs(`spiceCall ${step.call} requires an \"as\" output ref`);
        }

        const selector = resolveStringExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        if (selector !== "surfce" && selector !== "center") {
          invalidArgs(
            `spiceCall(${step.call}).in[0] must be \"surfce\" or \"center\" (got ${formatValue(selector)})`,
          );
        }

        const value = await withMinimalDskFile(backend, "dskgd", (dskPath) => {
          const handle = raw.dasopr(dskPath);
          let queryError: unknown = undefined;
          let selected = 0;

          try {
            const first = raw.dlabfs(handle);
            if (!first.found) {
              invalidRequest("spiceCall(dskgd_c) expected a DLA segment in minimal DSK");
            }

            const descriptor = raw.dskgd(handle, first.descr);
            selected = selector === "surfce" ? descriptor.surfce : descriptor.center;
          } catch (error) {
            queryError = error;
          }

          closeDasHandlePreserveError(raw, handle, queryError);
          if (queryError !== undefined) {
            throw queryError;
          }

          return asSpiceInt(selected, `spiceCall(${step.call}).result.${selector}`);
        });

        defineRef(refs, step.as, { kind: "int", value }, `spiceCall(${step.call}).as`);
        return undefined;
      }

      if (step.call === "dskb02_c") {
        if (step.in.length !== 1) {
          invalidRequest(`spiceCall ${step.call} expects one selector input`);
        }

        if ((step as { as?: unknown }).as === undefined) {
          invalidArgs(`spiceCall ${step.call} requires an \"as\" output ref`);
        }

        const selector = resolveStringExpression(step.in[0], args, refs, `spiceCall(${step.call}).in[0]`);
        if (selector !== "nv" && selector !== "np") {
          invalidArgs(
            `spiceCall(${step.call}).in[0] must be \"nv\" or \"np\" (got ${formatValue(selector)})`,
          );
        }

        const value = await withMinimalDskFile(backend, "dskb02", (dskPath) => {
          const handle = raw.dasopr(dskPath);
          let queryError: unknown = undefined;
          let selected = 0;

          try {
            const first = raw.dlabfs(handle);
            if (!first.found) {
              invalidRequest("spiceCall(dskb02_c) expected a DLA segment in minimal DSK");
            }

            const bookkeeping = raw.dskb02(handle, first.descr);
            selected = selector === "nv" ? bookkeeping.nv : bookkeeping.np;
          } catch (error) {
            queryError = error;
          }

          closeDasHandlePreserveError(raw, handle, queryError);
          if (queryError !== undefined) {
            throw queryError;
          }

          return asSpiceInt(selected, `spiceCall(${step.call}).result.${selector}`);
        });

        defineRef(refs, step.as, { kind: "int", value }, `spiceCall(${step.call}).as`);
        return undefined;
      }

      if (step.call === "readVirtualOutput") {
        if ((step as { as?: unknown }).as !== undefined) {
          invalidArgs(`spiceCall ${step.call} does not allow an \"as\" output ref`);
        }

        if (step.in.length !== 0) {
          invalidRequest(`spiceCall ${step.call} expects no inputs`);
        }

        const output = {
          kind: "virtual-output" as const,
          path: buildTempPath(backend, "read-virtual-output", ".bsp"),
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

        const bytes = (() => {
          try {
            return kit.readVirtualOutput(output);
          } finally {
            deleteVirtualOutputPathBestEffort(backend, output.path);
          }
        })();
        if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1) {
          invalidRequest("spiceCall(readVirtualOutput) expected non-empty output bytes");
        }

        return undefined;
      }

      unsupportedCall(`Unsupported spiceCall op: ${step.call}`);
    }

    case "projectResult": {
      return projectResult(step.out, args, refs);
    }

    case "freeCell": {
      freeCellRef(backend, refs, freedHandles, step.target);
      return undefined;
    }

    case "freeWindow": {
      freeWindowRef(backend, refs, freedHandles, step.target);
      return undefined;
    }

    case "invokeLegacyCall": {
      invalidRequest(
        "v2 workflow step invokeLegacyCall must be lowered before executeV2CaseWithBackend dispatch",
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
  const kit = getKitBackend(backend);

  const refs = new Map<string, RefValue>();
  const freedHandles: FreedHandles = {
    cell: new Set<CellHandle>(),
    window: new Set<WindowHandle>(),
  };
  const state: V2RunnerState = {
    ekFastWrite: undefined,
  };

  const args = validateV2CasePreflight(input);

  let projectedResult: unknown = undefined;
  let hasProjectedResult = false;
  let terminalError: unknown = undefined;

  try {
    for (const [index, step] of input.workflow.steps.entries()) {
      const maybeResult = await executeStep(backend, step, args, refs, freedHandles, state);
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
      await executeStep(backend, step, args, refs, freedHandles, state);
    } catch (cleanupError) {
      if (terminalError === undefined) {
        terminalError = cleanupError;
      }
      // Keep cleanup best-effort across all cleanup steps.
    }
  }

  for (const refValue of refs.values()) {
    if (refValue.kind === "int") {
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

  cleanupEkFastWriteState(backend, state.ekFastWrite);
  state.ekFastWrite = undefined;

  if (terminalError !== undefined) {
    throw terminalError;
  }

  return projectedResult;
}
