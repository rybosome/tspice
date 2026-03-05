import * as path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { readFile, realpath, rm, stat } from "node:fs/promises";

import { spiceClients, type Spice, type SpiceBackend } from "@rybosome/tspice";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
  sanitizeMetaKernelTextForWasm,
} from "../kernels/metaKernel.js";

import { spiceShortSymbol } from "../errors/spiceShort.js";
import { executeV2CaseWithBackend } from "./v2Executor.js";

import type {
  CaseRunner,
  KernelEntry,
  RunCaseInput,
  RunCaseInputV3,
  RunCaseResult,
  RunnerErrorReport,
  SpiceErrorState,
} from "./types.js";

type DispatchFn = (
  backend: SpiceBackend["raw"],
  args: unknown[],
  kit: SpiceBackend["kit"],
  backendKind: SpiceBackend["kind"],
) => unknown | Promise<unknown>;

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

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

function isRunCaseInputV3(input: RunCaseInput): input is RunCaseInputV3 {
  return typeof input === "object" && input !== null && "schemaVersion" in input;
}

/** Assert that a value is a finite integer (used for runner argument validation). */
function assertInteger(value: unknown, label: string): asserts value is number {
  if (typeof value !== "number") {
    invalidArgs(`${label} expects a number (got ${formatValue(value)})`);
  }
  if (!Number.isFinite(value)) {
    invalidArgs(`${label} expects a finite integer (got ${formatValue(value)})`);
  }
  if (!Number.isInteger(value)) {
    invalidArgs(`${label} expects an integer (got ${formatValue(value)})`);
  }
}

function assertStringArg(value: unknown, call: string, index: number): asserts value is string {
  if (typeof value !== "string") {
    invalidArgs(`${call} expects args[${index}] to be a string (got ${formatValue(value)})`);
  }
}

function assertNumberArg(value: unknown, call: string, index: number): asserts value is number {
  if (typeof value !== "number") {
    invalidArgs(`${call} expects args[${index}] to be a number (got ${formatValue(value)})`);
  }
}

const SPICE_INT32_MIN = -2147483648;
const SPICE_INT32_MAX = 2147483647;

function assertNonNegativeSpiceIntArg(value: unknown, call: string, index: number): asserts value is number {
  assertInteger(value, `${call} args[${index}]`);
  if (value < 0 || value > SPICE_INT32_MAX) {
    invalidArgs(`${call} expects args[${index}] to be an integer (SpiceInt range)`);
  }
}

function assertNonEmptyStringArg(value: unknown, call: string, index: number): asserts value is string {
  assertStringArg(value, call, index);
  if (value.trim() === "") {
    invalidArgs(`${call} expects args[${index}] to be a non-empty string`);
  }
}

function sanitizeFileIoTempTag(tag: string): string {
  const maxLen = 64;
  let out = "";
  let prevDash = false;

  for (const ch of tag) {
    if (out.length >= maxLen) break;

    const allowed =
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "." ||
      ch === "_" ||
      ch === "-";

    if (allowed) {
      out += ch;
      prevDash = ch === "-";
      continue;
    }

    if (!prevDash && out.length < maxLen) {
      out += "-";
      prevDash = true;
    }
  }

  out = out.replace(/-+$/g, "");
  return out.length > 0 ? out : "file-io";
}

function buildFileIoTempPath(tag: string, extension = ".tmp"): string {
  const safeTag = sanitizeFileIoTempTag(tag);
  const safeExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const suffix = crypto.randomBytes(6).toString("hex");
  return path.join(os.tmpdir(), `tspice-parity-${safeTag}-${suffix}${safeExtension}`);
}

async function resolveFileIoPathForBackend(
  backend: SpiceBackend["raw"],
  backendKind: SpiceBackend["kind"],
  pathOrVid: string,
): Promise<string> {
  if (backendKind !== "wasm") {
    return pathOrVid;
  }

  // Preserve explicit virtual ids.
  if (!path.isAbsolute(pathOrVid) && !pathOrVid.includes("/") && !pathOrVid.includes("\\")) {
    return pathOrVid;
  }

  const absPath = path.resolve(pathOrVid);
  const vid = await kernelVirtualIdFromOsPath(absPath);

  try {
    const bytes = await readFile(absPath);
    WASM_KERNEL_VID_TO_OS_PATH.set(vid, absPath);
    stageWasmFileIoVirtualPath(backend, vid, bytes);
  } catch (error) {
    if (!isFsNotFoundError(error)) {
      throw error;
    }
  }

  return vid;
}

type WasmFileIoVirtualFsHooks = {
  __stageVirtualFileForFileIo?: (path: string, bytes: Uint8Array) => void;
  __deleteVirtualFileForFileIo?: (path: string) => void;
};

function stageWasmFileIoVirtualPath(
  backend: SpiceBackend["raw"],
  virtualPath: string,
  bytes: Uint8Array,
): void {
  const hooks = backend as unknown as WasmFileIoVirtualFsHooks;
  const stage = hooks.__stageVirtualFileForFileIo;
  if (!stage) {
    throw new Error("WASM backend missing __stageVirtualFileForFileIo(path, bytes)");
  }
  stage(virtualPath, bytes);
}

function deleteWasmFileIoVirtualPathBestEffort(
  backend: SpiceBackend["raw"],
  virtualPath: string,
): void {
  const hooks = backend as unknown as WasmFileIoVirtualFsHooks;
  const remove = hooks.__deleteVirtualFileForFileIo;
  if (!remove) return;

  try {
    remove(virtualPath);
  } catch {
    // best-effort cleanup only
  }
}

async function deleteNodePathBestEffort(pathToDelete: string): Promise<void> {
  try {
    await rm(pathToDelete, { force: true });
  } catch {
    // best-effort cleanup only
  }
}

function assertCellsWindowsSpiceIntArg(value: unknown, method: string, index: number): asserts value is number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < SPICE_INT32_MIN ||
    value > SPICE_INT32_MAX
  ) {
    invalidArgs(`${method} expects args[${index}] to be an integer (SpiceInt range)`);
  }
}

function assertCellsWindowsStringArg(value: unknown, method: string, index: number): asserts value is string {
  if (typeof value !== "string") {
    invalidArgs(`${method} expects args[${index}] to be a string`);
  }
}

function assertCellsWindowsNumberArg(value: unknown, method: string, index: number): asserts value is number {
  if (typeof value !== "number") {
    invalidArgs(`${method} expects args[${index}] to be a number`);
  }
}

function assertCellsWindowsMinArgs(args: unknown[], minArgs: number, message: string): void {
  if (args.length < minArgs) {
    invalidArgs(message);
  }
}


type Vec3 = [number, number, number];
type Mat3RowMajor = Parameters<SpiceBackend["raw"]["mxm"]>[0];
type SpkPackedDescriptor = Parameters<SpiceBackend["raw"]["spkuds"]>[0];

function assertVec3(value: unknown, label: string): asserts value is Vec3 {
  if (!Array.isArray(value)) {
    invalidArgs(`${label} expects a length-3 array of numbers (got ${formatValue(value)})`);
  }
  if (value.length !== 3) {
    invalidArgs(`${label} expects a length-3 array of numbers (got length ${value.length})`);
  }
  for (let i = 0; i < 3; i++) {
    if (typeof value[i] !== "number") {
      invalidArgs(
        `${label} expects element ${i} to be a number (got ${formatValue(value[i])})`,
      );
    }
  }
}

function assertMat3RowMajor(value: unknown, label: string): asserts value is Mat3RowMajor {
  if (!Array.isArray(value)) {
    invalidArgs(`${label} expects a length-9 array of numbers (got ${formatValue(value)})`);
  }
  if (value.length !== 9) {
    invalidArgs(`${label} expects a length-9 array of numbers (got length ${value.length})`);
  }
  for (let i = 0; i < 9; i++) {
    if (typeof value[i] !== "number") {
      invalidArgs(
        `${label} expects element ${i} to be a number (got ${formatValue(value[i])})`,
      );
    }
  }
}


function assertSpkPackedDescriptor(value: unknown, label: string): asserts value is SpkPackedDescriptor {
  if (!Array.isArray(value)) {
    invalidArgs(`${label} expects a length-5 array of numbers (got ${formatValue(value)})`);
  }
  if (value.length !== 5) {
    invalidArgs(`${label} expects a length-5 array of numbers (got length ${value.length})`);
  }
  for (let i = 0; i < 5; i++) {
    if (typeof value[i] !== "number" || !Number.isFinite(value[i])) {
      invalidArgs(`${label} expects element ${i} to be a finite number (got ${formatValue(value[i])})`);
    }
  }
}

// When using the WASM backend, we furnish OS kernels as byte-backed virtual ids.
// To preserve parity with the CSPICE runner (which uses OS paths), we keep a
// best-effort mapping from virtual ids back to their originating OS paths and
// rewrite `kdata().file` accordingly.
const WASM_KERNEL_VID_TO_OS_PATH = new Map<string, string>();

function isFsNotFoundError(error: unknown): boolean {
  const anyErr = error as unknown as { code?: unknown };
  return anyErr.code === "ENOENT" || anyErr.code === "ENOTDIR";
}

async function wasmVirtualKernelIdFromMaybeOsPath(pathOrVid: string): Promise<string> {
  const abs = path.resolve(pathOrVid);
  try {
    await stat(abs);
  } catch (error) {
    if (isFsNotFoundError(error)) {
      // Treat as already-virtual.
      return pathOrVid;
    }
    throw error;
  }

  return await kernelVirtualIdFromOsPath(abs);
}

function kernelKindQueryFromArg(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      invalidArgs(`${label} expects a non-empty string[] (got [])`);
    }
    if (!value.every((v): v is string => typeof v === "string")) {
      invalidArgs(`${label} expects a string or string[] (got ${formatValue(value)})`);
    }
    return value.join(" ");
  }

  invalidArgs(`${label} expects a string or string[] (got ${formatValue(value)})`);
}

function rewriteKdataOsPathIfNeeded(backendKind: SpiceBackend["kind"], result: unknown): unknown {
  if (backendKind !== "wasm") return result;
  if (typeof result !== "object" || result === null) return result;

  const r = result as Record<string, unknown>;
  if (r.found !== true) return result;
  if (typeof r.file !== "string") return result;

  const prefix = "/kernels/";
  if (!r.file.startsWith(prefix)) return result;

  const vid = r.file.slice(prefix.length);
  const osPath = WASM_KERNEL_VID_TO_OS_PATH.get(vid);
  if (!osPath) return result;

  return { ...r, file: osPath };
}

type CellsWindowsRecipe =
  | { kind: "int"; size: number }
  | { kind: "double"; size: number }
  | { kind: "char"; size: number; length: number }
  | { kind: "window"; maxIntervals: number };

type CellsWindowsRecipeKind = CellsWindowsRecipe["kind"];

type PreparedCellsWindowsHandle = {
  kind: "cell" | "window";
  handle: unknown;
  release: () => void;
};

function parseCellsWindowsRecipe(value: unknown, label: string): CellsWindowsRecipe {
  if (!Array.isArray(value)) {
    invalidArgs(
      `${label} expects a tuple recipe: [\"int\", size] | [\"double\", size] | [\"char\", size, length] | [\"window\", maxIntervals] (got ${formatValue(value)})`,
    );
  }

  if (typeof value[0] !== "string") {
    invalidArgs(`${label}[0] expects a recipe kind string (got ${formatValue(value[0])})`);
  }

  const kind = value[0];

  if (kind === "int" || kind === "double") {
    if (value.length !== 2) {
      invalidArgs(`${label} ${kind} recipe expects exactly 2 elements [${JSON.stringify(kind)}, size]`);
    }

    assertInteger(value[1], `${label}[1]`);
    if (value[1] < 0) {
      invalidArgs(`${label}[1] expects size >= 0 (got ${formatValue(value[1])})`);
    }

    return { kind, size: value[1] };
  }

  if (kind === "char") {
    if (value.length !== 3) {
      invalidArgs(`${label} char recipe expects exactly 3 elements [\"char\", size, length]`);
    }

    assertInteger(value[1], `${label}[1]`);
    assertInteger(value[2], `${label}[2]`);

    if (value[1] < 0) {
      invalidArgs(`${label}[1] expects size >= 0 (got ${formatValue(value[1])})`);
    }
    if (value[2] <= 0) {
      invalidArgs(`${label}[2] expects length > 0 (got ${formatValue(value[2])})`);
    }

    return {
      kind,
      size: value[1],
      length: value[2],
    };
  }

  if (kind === "window") {
    if (value.length !== 2) {
      invalidArgs(`${label} window recipe expects exactly 2 elements [\"window\", maxIntervals]`);
    }

    assertInteger(value[1], `${label}[1]`);
    if (value[1] < 0) {
      invalidArgs(`${label}[1] expects maxIntervals >= 0 (got ${formatValue(value[1])})`);
    }

    return { kind, maxIntervals: value[1] };
  }

  invalidArgs(
    `${label}[0] expects one of "int", "double", "char", "window" (got ${formatValue(kind)})`,
  );
}

const CELLS_WINDOWS_RECIPE_TUPLE_MESSAGES: Record<CellsWindowsRecipeKind, string> = {
  int: "an int recipe tuple",
  double: "a double recipe tuple",
  char: "a char recipe tuple",
  window: "a window recipe tuple",
};

const CELLS_WINDOWS_RECIPE_SHAPES: Record<CellsWindowsRecipeKind, string> = {
  int: '["int",size]',
  double: '["double",size]',
  char: '["char",size,length]',
  window: '["window",maxIntervals]',
};

function parseCellsWindowsRecipeAsKind<K extends CellsWindowsRecipeKind>(
  value: unknown,
  method: string,
  argIndex: number,
  expectedKind: K,
): Extract<CellsWindowsRecipe, { kind: K }> {
  const label = `${method} args[${argIndex}]`;

  let recipe: CellsWindowsRecipe;
  try {
    recipe = parseCellsWindowsRecipe(value, label);
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code === "invalid_args") {
      invalidArgs(
        `${method} expects args[${argIndex}] to be ${CELLS_WINDOWS_RECIPE_TUPLE_MESSAGES[expectedKind]}`,
      );
    }
    throw error;
  }

  if (recipe.kind !== expectedKind) {
    invalidArgs(`${method} expects args[${argIndex}] to be ${CELLS_WINDOWS_RECIPE_SHAPES[expectedKind]}`);
  }

  return recipe as Extract<CellsWindowsRecipe, { kind: K }>;
}

function prepareCellsWindowsHandle(
  kit: SpiceBackend["kit"],
  recipe: CellsWindowsRecipe,
): PreparedCellsWindowsHandle {
  let released = false;

  if (recipe.kind === "int") {
    const cell = kit.newIntCell(recipe.size);
    return {
      kind: "cell",
      handle: cell,
      release: () => {
        if (released) return;
        released = true;
        kit.freeCell(cell);
      },
    };
  }

  if (recipe.kind === "double") {
    const cell = kit.newDoubleCell(recipe.size);
    return {
      kind: "cell",
      handle: cell,
      release: () => {
        if (released) return;
        released = true;
        kit.freeCell(cell);
      },
    };
  }

  if (recipe.kind === "char") {
    const cell = kit.newCharCell(recipe.size, recipe.length);
    return {
      kind: "cell",
      handle: cell,
      release: () => {
        if (released) return;
        released = true;
        kit.freeCell(cell);
      },
    };
  }

  const window = kit.newWindow(recipe.maxIntervals);
  return {
    kind: "window",
    handle: window,
    release: () => {
      if (released) return;
      released = true;
      kit.freeWindow(window);
    },
  };
}

function asCellsWindowsCellArg(
  handle: PreparedCellsWindowsHandle,
): Parameters<SpiceBackend["raw"]["card"]>[0] {
  return handle.handle as Parameters<SpiceBackend["raw"]["card"]>[0];
}

function asCellsWindowsWindowArg(
  handle: PreparedCellsWindowsHandle,
): Parameters<SpiceBackend["raw"]["wncard"]>[0] {
  return handle.handle as Parameters<SpiceBackend["raw"]["wncard"]>[0];
}

// Legacy bespoke per-function dispatch map removed; v3 workflows are the supported runCase path.

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };

    const anyErr = error as unknown as { code?: unknown; details?: unknown };
    if (typeof anyErr.code === "string") report.code = anyErr.code;
    if (typeof anyErr.details === "object" && anyErr.details !== null && !Array.isArray(anyErr.details)) {
      report.details = { ...(anyErr.details as Record<string, unknown>) };
    }

    return report;
  }

  return { message: String(error) };
}

function inferSpiceFromError(error: unknown): SpiceErrorState | null {
  if (!(error instanceof Error)) return null;

  // Some backends (notably WASM) attach best-effort SPICE fields directly to
  // the Error instance, rather than exposing them via `failed()/getmsg()`.
  const anyErr = error as unknown as {
    spiceShort?: unknown;
    spiceLong?: unknown;
    spiceTrace?: unknown;
  };

  // Prefer explicitly attached fields, but fall back to best-effort inference
  // from the thrown message.
  const m = /SPICE\s*\(\s*([A-Z0-9_]+)\s*\)/i.exec(error.message);

  const shortRaw = typeof anyErr.spiceShort === "string" ? anyErr.spiceShort : m?.[1];
  const short = typeof shortRaw === "string" ? (spiceShortSymbol(shortRaw) ?? undefined) : undefined;

  const long = typeof anyErr.spiceLong === "string" ? anyErr.spiceLong : undefined;
  const trace = typeof anyErr.spiceTrace === "string" ? anyErr.spiceTrace : undefined;

  if (short === undefined && long === undefined && trace === undefined) return null;

  return {
    failed: true,
    ...(short !== undefined ? { short } : {}),
    ...(long !== undefined ? { long } : {}),
    ...(trace !== undefined ? { trace } : {}),
  };
}

function tryConfigureErrorPolicy(backend: SpiceBackend["raw"]): void {
  // Not part of the backend contract, but may exist on some implementations.
  const b = backend as unknown as {
    erract?: (op: string, action: string) => void;
    errprt?: (op: string, list: string) => void;
  };

  try {
    b.erract?.("SET", "RETURN");
  } catch {
    // ignore
  }

  try {
    b.errprt?.("SET", "NONE");
  } catch {
    // ignore
  }
}

function isolateCase(backend: SpiceBackend["raw"]): void {
  // Clear any kernel pool / loaded kernels and reset the SPICE error state.
  backend.kclear();
  backend.reset();
  tryConfigureErrorPolicy(backend);
}

function captureSpiceErrorState(backend: SpiceBackend["raw"]): SpiceErrorState {
  let failed = false;
  try {
    failed = backend.failed();
  } catch {
    failed = false;
  }

  if (!failed) return { failed: false };

  const spice: SpiceErrorState = { failed: true };

  try {
    spice.short = backend.getmsg("SHORT");
  } catch {
    // ignore
  }

  try {
    spice.long = backend.getmsg("LONG");
  } catch {
    // ignore
  }

  try {
    spice.explain = backend.getmsg("EXPLAIN");
  } catch {
    // ignore
  }

  return spice;
}

export type TspiceRunnerBackend = "auto" | "node" | "wasm";

export type CreateTspiceRunnerOptions = {
  backend?: TspiceRunnerBackend;
};

function parseBackendEnv(value: unknown): TspiceRunnerBackend | undefined {
  if (value === "node" || value === "wasm" || value === "auto") return value;
  return undefined;
}

function isMissingNativeAddon(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (/tspice_backend_node\.node/.test(msg)) return true;
  if (/Cannot find module/.test(msg) && /tspice-native-/.test(msg)) return true;
  if (
    /tspice-backend-node/.test(msg) &&
    (/Cannot find module/.test(msg) || /ERR_MODULE_NOT_FOUND/.test(msg) || /Failed to resolve entry/.test(msg))
  ) {
    return true;
  }
  return false;
}

async function createBackendForRunner(
  backend: TspiceRunnerBackend,
): Promise<{ backend: SpiceBackend; kind: string }> {
  const toBackendContract = (spice: Spice): SpiceBackend => ({
    raw: spice.raw as unknown as SpiceBackend["raw"],
    kit: spice.kit,
    kind: spice.raw.kind,
  });

  const createNodeBackend = async (): Promise<SpiceBackend> => {
    const { spice } = await spiceClients.toSync({ backend: "node" });
    return toBackendContract(spice);
  };

  const createWasmBackend = async (): Promise<SpiceBackend> => {
    const { spice } = await spiceClients.toSync({ backend: "wasm" });
    return toBackendContract(spice);
  };

  if (backend === "node") {
    return { backend: await createNodeBackend(), kind: "tspice(node)" };
  }
  if (backend === "wasm") {
    return { backend: await createWasmBackend(), kind: "tspice(wasm)" };
  }

  // auto: prefer node, but fall back to wasm when the native addon isn't staged.
  try {
    return { backend: await createNodeBackend(), kind: "tspice(node)" };
  } catch (error) {
    if (isMissingNativeAddon(error)) {
      return { backend: await createWasmBackend(), kind: "tspice(wasm)" };
    }
    throw error;
  }
}

async function kernelVirtualIdFromOsPath(osPath: string): Promise<string> {
  // WASM kernel paths must be *virtual* ids (not OS paths). We also need to
  // avoid collisions when two kernels share a basename.
  const resolved = path.resolve(osPath);
  const canonical = await realpath(resolved).catch(() => resolved);
  const base = path.basename(canonical);
  const hash = crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
  return `ospath/${hash}/${base}`;
}

function normalizeKernelEntry(entry: KernelEntry): { path: string; restrictToDir?: string } {
  return typeof entry === "string" ? { path: entry } : entry;
}

async function furnshOsKernelForWasm(
  backend: SpiceBackend["raw"],
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<void> {
  const absPath = path.resolve(osPath);
  const loadedKey = `bytes:${absPath}`;
  if (loaded.has(loadedKey)) return;
  loaded.add(loadedKey);

  if (path.extname(absPath).toLowerCase() === ".tm") {
    // The WASM backend can't directly load nested kernels referenced by a meta-kernel
    // from the host filesystem, so we expand `KERNELS_TO_LOAD` ourselves.
    const metaKernelText = await readFile(absPath, "utf8");

    const kernelsToLoad = resolveMetaKernelKernelsToLoad(
      metaKernelText,
      absPath,
      restrictToDir ? { restrictToDir } : {},
    );

    // Load a sanitized copy of the meta-kernel itself so any pool assignments apply,
    // but without allowing it to try to load OS-path kernels in WASM.
    const sanitized = sanitizeMetaKernelTextForWasm(metaKernelText);
    const vid = await kernelVirtualIdFromOsPath(absPath);
    WASM_KERNEL_VID_TO_OS_PATH.set(vid, absPath);
    backend.furnsh({ path: vid, bytes: Buffer.from(sanitized, "utf8") });

    for (const k of kernelsToLoad) {
      await furnshOsKernelForWasm(backend, k, loaded, restrictToDir);
    }
    return;
  }

  const bytes = await readFile(absPath);
  const vid = await kernelVirtualIdFromOsPath(absPath);
  WASM_KERNEL_VID_TO_OS_PATH.set(vid, absPath);
  backend.furnsh({ path: vid, bytes });
}

async function furnshOsKernelForNative(
  backend: SpiceBackend["raw"],
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): Promise<void> {
  const absPath = path.resolve(osPath);

  // Native can load via OS-path or via bytes (sanitized meta-kernel). Keep those
  // distinct so we don't incorrectly dedupe across modes.
  const mode = restrictToDir && path.extname(absPath).toLowerCase() === ".tm" ? "bytes" : "ospath";
  const loadedKey = `${mode}:${absPath}`;
  if (loaded.has(loadedKey)) return;
  loaded.add(loadedKey);

  if (restrictToDir && path.extname(absPath).toLowerCase() === ".tm") {
    // Mirror the WASM behavior:
    // 1) Expand/validate `KERNELS_TO_LOAD` ourselves (so restrictions apply).
    // 2) Furnish a sanitized copy of the meta-kernel (so pool assignments apply)
    //    but without letting CSPICE load nested kernels implicitly.
    const metaKernelText = await readFile(absPath, "utf8");

    const kernelsToLoad = resolveMetaKernelKernelsToLoad(metaKernelText, absPath, { restrictToDir });

    const sanitized = sanitizeMetaKernelTextForNativeNoKernels(metaKernelText);
    backend.furnsh({ path: absPath, bytes: Buffer.from(sanitized, "utf8") });

    for (const k of kernelsToLoad) {
      await furnshOsKernelForNative(backend, k, loaded, restrictToDir);
    }
    return;
  }

  backend.furnsh(absPath);
}

/** Create a CaseRunner that executes calls using an in-process tspice backend (node/wasm/auto). */
export async function createTspiceRunner(options: CreateTspiceRunnerOptions = {}): Promise<CaseRunner> {
  const requested =
    options.backend ?? parseBackendEnv(process.env.TSPICE_PARITY_BACKEND) ?? "auto";

  const { backend, kind } = await createBackendForRunner(requested);

  return {
    kind,

    async dispose(): Promise<void> {
      // Best-effort cleanup so the runner can be reused across tests or
      // torn down without leaking state/resources.
      try {
        backend.raw.kclear();
      } catch {
        // ignore
      }
      try {
        backend.raw.reset();
      } catch {
        // ignore
      }

      // Not part of the backend contract, but may exist on some implementations.
      const b = backend.raw as unknown as {
        dispose?: () => void | Promise<void>;
        close?: () => void | Promise<void>;
      };

      try {
        await b.dispose?.();
      } catch {
        // ignore
      }
      try {
        await b.close?.();
      } catch {
        // ignore
      }
    },

    async runCase(input: RunCaseInput): Promise<RunCaseResult> {
      isolateCase(backend.raw);

      try {
        const loadedKernels = new Set<string>();
        for (const kernelEntry of input.setup?.kernels ?? []) {
          const kernel = normalizeKernelEntry(kernelEntry);
          if (backend.kind === "wasm") {
            await furnshOsKernelForWasm(backend.raw, kernel.path, loadedKernels, kernel.restrictToDir);
          } else {
            await furnshOsKernelForNative(backend.raw, kernel.path, loadedKernels, kernel.restrictToDir);
          }
        }

        if (isRunCaseInputV3(input) && input.schemaVersion === 3) {
          const result = await executeV2CaseWithBackend(backend, input);
          return { ok: true, result };
        }

        invalidRequest("Legacy runCase payloads are no longer supported; use schemaVersion: 3 workflows");
      } catch (error) {
        const report = safeErrorReport(error);

        const captured = captureSpiceErrorState(backend.raw);
        const inferredState = inferSpiceFromError(error);

        // Prefer the backend-reported SPICE state, but fall back to inference
        // when the backend doesn't surface anything useful.
        if (captured.failed) {
          report.spice = inferredState ? { ...inferredState, ...captured } : captured;
        } else {
          report.spice = inferredState ?? captured;
        }

        // Ensure subsequent cases start clean.
        try {
          backend.raw.reset();
        } catch {
          // ignore
        }

        return { ok: false, error: report };
      } finally {
        // Per-case isolation: don't allow kernels or error state to leak.
        try {
          backend.raw.kclear();
        } catch {
          // ignore
        }
        try {
          backend.raw.reset();
        } catch {
          // ignore
        }
      }
    },
  };
}
