import * as path from "node:path";
import crypto from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";

import { spiceClients, type Spice, type SpiceBackend } from "@rybosome/tspice";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
  sanitizeMetaKernelTextForWasm,
} from "../kernels/metaKernel.js";

import { spiceShortSymbol } from "../errors/spiceShort.js";
import { lowerV2InvokeLegacyCall } from "./legacyInvoke.js";
import { executeV2CaseWithBackend } from "./v2Executor.js";

import type { CaseRunner, KernelEntry, RunCaseInput, RunCaseResult, RunnerErrorReport, SpiceErrorState } from "./types.js";

type DispatchFn = (
  backend: SpiceBackend["raw"],
  args: unknown[],
  kit: SpiceBackend["kit"],
  backendKind: SpiceBackend["kind"],
) => unknown | Promise<unknown>;

type RunnerValidationCode = "invalid_request" | "invalid_args" | "unsupported_call";

function isRunnerValidationCode(value: unknown): value is RunnerValidationCode {
  return value === "invalid_request" || value === "invalid_args" || value === "unsupported_call";
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

function unsupportedCall(message: string): never {
  const err = new Error(message) as Error & { code?: RunnerValidationCode };
  err.code = "unsupported_call";
  throw err;
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

const DISPATCH: Record<string, DispatchFn> = {
  // time
  "time.str2et": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.str2et expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  // Convenience alias.
  str2et: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`str2et expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.str2et(args[0]);
  },

  "time.et2utc": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.et2utc expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.et2utc expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`time.et2utc expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "time.et2utc args[2]");
    return backend.et2utc(args[0], args[1], args[2]);
  },

  // Convenience alias.
  et2utc: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`et2utc expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`et2utc expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`et2utc expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "et2utc args[2]");
    return backend.et2utc(args[0], args[1], args[2]);
  },

  // ids-names
  "ids-names.bodn2c": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`ids-names.bodn2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bodn2c(args[0]);
  },

  bodn2c: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`bodn2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bodn2c(args[0]);
  },

  "ids-names.bodc2n": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ids-names.bodc2n expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "ids-names.bodc2n args[0]");
    return backend.bodc2n(args[0]);
  },

  bodc2n: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`bodc2n expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "bodc2n args[0]");
    return backend.bodc2n(args[0]);
  },

  "ids-names.bodc2s": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ids-names.bodc2s expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "ids-names.bodc2s args[0]");
    return backend.bodc2s(args[0]);
  },

  bodc2s: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`bodc2s expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "bodc2s args[0]");
    return backend.bodc2s(args[0]);
  },

  "ids-names.bods2c": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`ids-names.bods2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bods2c(args[0]);
  },

  bods2c: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`bods2c expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.bods2c(args[0]);
  },

  "ids-names.boddef": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`ids-names.boddef expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`ids-names.boddef expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[1], "ids-names.boddef args[1]");
    backend.boddef(args[0], args[1]);
    // `boddef()` returns void; represent it as JSON-friendly null.
    return null;
  },

  boddef: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`boddef expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`boddef expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[1], "boddef args[1]");
    backend.boddef(args[0], args[1]);
    // `boddef()` returns void; represent it as JSON-friendly null.
    return null;
  },

  "ids-names.bodfnd": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ids-names.bodfnd expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`ids-names.bodfnd expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "ids-names.bodfnd args[0]");
    return backend.bodfnd(args[0], args[1]);
  },

  bodfnd: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`bodfnd expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`bodfnd expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "bodfnd args[0]");
    return backend.bodfnd(args[0], args[1]);
  },

  "ids-names.bodvar": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ids-names.bodvar expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`ids-names.bodvar expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "ids-names.bodvar args[0]");
    return backend.bodvar(args[0], args[1]);
  },

  bodvar: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`bodvar expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`bodvar expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "bodvar args[0]");
    return backend.bodvar(args[0], args[1]);
  },

  // frames
  /** Dispatch wrapper for `frames.namfrm`. */
  "frames.namfrm": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.namfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.namfrm(args[0]);
  },

  namfrm: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`namfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.namfrm(args[0]);
  },

  "frames.frmnam": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frames.frmnam expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frames.frmnam args[0]");
    return backend.frmnam(args[0]);
  },

  frmnam: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frmnam expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frmnam args[0]");
    return backend.frmnam(args[0]);
  },

  "frames.cidfrm": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frames.cidfrm expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frames.cidfrm args[0]");
    return backend.cidfrm(args[0]);
  },

  cidfrm: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`cidfrm expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "cidfrm args[0]");
    return backend.cidfrm(args[0]);
  },

  "frames.cnmfrm": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.cnmfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.cnmfrm(args[0]);
  },

  cnmfrm: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`cnmfrm expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.cnmfrm(args[0]);
  },

  "frames.frinfo": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frames.frinfo expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frames.frinfo args[0]");
    return backend.frinfo(args[0]);
  },

  frinfo: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frinfo expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertInteger(args[0], "frinfo args[0]");
    return backend.frinfo(args[0]);
  },

  "frames.ccifrm": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`frames.ccifrm expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`frames.ccifrm expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "frames.ccifrm args[0]");
    assertInteger(args[1], "frames.ccifrm args[1]");
    return backend.ccifrm(args[0], args[1]);
  },

  ccifrm: (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`ccifrm expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`ccifrm expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[0], "ccifrm args[0]");
    assertInteger(args[1], "ccifrm args[1]");
    return backend.ccifrm(args[0], args[1]);
  },

  "frames.sxform": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.sxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`frames.sxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`frames.sxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.sxform(args[0], args[1], args[2]);
  },

  sxform: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`sxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`sxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`sxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.sxform(args[0], args[1], args[2]);
  },

  "frames.pxform": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`frames.pxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`frames.pxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`frames.pxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.pxform(args[0], args[1], args[2]);
  },

  pxform: (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`pxform expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`pxform expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`pxform expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.pxform(args[0], args[1], args[2]);
  },

  // time (misc)
  "time.spiceVersion": (backend) => {
    return backend.tkvrsn("TOOLKIT");
  },

  "time.tkvrsn": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tkvrsn expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (args[0] !== "TOOLKIT") {
      invalidArgs(`time.tkvrsn expects args[0] to be "TOOLKIT" (got ${formatValue(args[0])})`);
    }
    return backend.tkvrsn("TOOLKIT");
  },

  "time.timout": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.timout expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.timout expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    return backend.timout(args[0], args[1]);
  },

  "time.deltet": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.deltet expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.deltet expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (args[1] !== "ET" && args[1] !== "UTC") {
      invalidArgs(`time.deltet expects args[1] to be "ET" or "UTC" (got ${formatValue(args[1])})`);
    }
    return backend.deltet(args[0], args[1]);
  },

  "time.unitim": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`time.unitim expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.unitim expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "string") {
      invalidArgs(`time.unitim expects args[2] to be a string (got ${formatValue(args[2])})`);
    }

    if (args[1] !== "TAI" && args[1] !== "UTC" && args[1] !== "TDB" && args[1] !== "TDT" && args[1] !== "ET") {
      invalidArgs(`time.unitim expects args[1] to be a valid time system (got ${formatValue(args[1])})`);
    }
    if (args[2] !== "TAI" && args[2] !== "UTC" && args[2] !== "TDB" && args[2] !== "TDT" && args[2] !== "ET") {
      invalidArgs(`time.unitim expects args[2] to be a valid time system (got ${formatValue(args[2])})`);
    }

    return backend.unitim(args[0], args[1], args[2]);
  },

  "time.tparse": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tparse expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.tparse(args[0]);
  },

  "time.tpictr": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.tpictr expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.tpictr expects args[1] to be a string (got ${formatValue(args[1])})`);
    }
    return backend.tpictr(args[0], args[1]);
  },

  "time.timdef": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`time.timdef expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "string") {
      invalidArgs(`time.timdef expects args[1] to be a string (got ${formatValue(args[1])})`);
    }

    if (args[0] === "GET") {
      return backend.timdef("GET", args[1]);
    }

    if (args[0] === "SET") {
      if (typeof args[2] !== "string") {
        invalidArgs(`time.timdef expects args[2] to be a string for SET (got ${formatValue(args[2])})`);
      }
      backend.timdef("SET", args[1], args[2]);
      // `timdef(SET)` returns void; represent it as JSON-friendly null.
      return null;
    }

    invalidArgs(`time.timdef expects args[0] to be "GET" or "SET" (got ${formatValue(args[0])})`);
  },


  // kernels
  "kernels.furnsh": async (backend, args, _kit, backendKind) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernels.furnsh expects args[0] to be a string (got ${formatValue(args[0])})`);
    }

    if (backendKind === "wasm") {
      // WASM kernel paths must be virtual ids; when scenarios pass an OS path,
      // furnish it as bytes under a deterministic virtual id.
      try {
        await furnshOsKernelForWasm(backend, args[0], new Set<string>());
      } catch (error) {
        // If the input doesn't exist on the host filesystem, treat it as an
        // already-virtual kernel id.
        if (isFsNotFoundError(error)) {
          backend.furnsh(args[0]);
        } else {
          throw error;
        }
      }
      return null;
    }

    backend.furnsh(args[0]);
    return null;
  },

  "kernels.unload": async (backend, args, _kit, backendKind) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernels.unload expects args[0] to be a string (got ${formatValue(args[0])})`);
    }

    if (backendKind === "wasm") {
      backend.unload(await wasmVirtualKernelIdFromMaybeOsPath(args[0]));
      return null;
    }

    backend.unload(args[0]);
    return null;
  },

  "kernels.kclear": (backend) => {
    backend.kclear();
    return null;
  },

  "kernels.ktotal": (backend, args) => {
    // `ktotal` kind is optional.
    if (args.length === 0 || args[0] === undefined) {
      return backend.ktotal();
    }

    const kindQuery = kernelKindQueryFromArg(args[0], "kernels.ktotal args[0]");
    return backend.ktotal(kindQuery);
  },

  "kernels.kdata": (backend, args, _kit, backendKind) => {
    assertInteger(args[0], "kernels.kdata args[0]");

    // `kdata` kind is optional.
    if (args.length < 2 || args[1] === undefined) {
      return rewriteKdataOsPathIfNeeded(backendKind, backend.kdata(args[0]));
    }

    const kindQuery = kernelKindQueryFromArg(args[1], "kernels.kdata args[1]");
    return rewriteKdataOsPathIfNeeded(backendKind, backend.kdata(args[0], kindQuery));
  },

  "kernels.kinfo": async (backend, args, _kit, backendKind) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernels.kinfo expects args[0] to be a string (got ${formatValue(args[0])})`);
    }

    if (backendKind === "wasm") {
      return backend.kinfo(await wasmVirtualKernelIdFromMaybeOsPath(args[0]));
    }

    return backend.kinfo(args[0]);
  },

  "kernels.kxtrct": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernels.kxtrct expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (!Array.isArray(args[1]) || args[1].some((x) => typeof x !== "string")) {
      invalidArgs(`kernels.kxtrct expects args[1] to be a string[] (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "string") {
      invalidArgs(`kernels.kxtrct expects args[2] to be a string (got ${formatValue(args[2])})`);
    }
    return backend.kxtrct(args[0], args[1] as string[], args[2]);
  },

  "kernels.kplfrm": (backend, args, kit, backendKind) => {
    // Contract signature mutates a SpiceIntCell; for parity scenarios we return
    // the resulting ID set as an integer array so it can be compared.
    assertInteger(args[0], "kernels.kplfrm args[0]");

    const frmcls = args[0];

    if (backendKind === "wasm") {
      // The WASM backend doesn't currently export `kplfrm`; emulate it by
      // scanning the kernel pool for `FRAME_<id>_CLASS` assignments.
      const ids = new Set<number>();
      const template = "FRAME_*_CLASS";
      const room = 512;

      for (let start = 0; ; ) {
        const res = backend.gnpool(template, start, room);
        if (!res.found) break;
        if (res.values.length === 0) break;

        for (const name of res.values) {
          const m = /^FRAME_(\d+)_CLASS$/.exec(name.trim());
          if (!m) continue;

          const id = Number(m[1]);
          if (!Number.isSafeInteger(id)) continue;

          const cls = backend.gipool(name, 0, 1);
          if (!cls.found || cls.values.length < 1) continue;
          if (cls.values[0] !== frmcls) continue;

          ids.add(id);
        }

        if (res.values.length < room) break;
        start += res.values.length;
      }

      return Array.from(ids).sort((a, b) => a - b);
    }

    // Native: call through to the backend, retrying with a larger cell on
    // `CELLTOOSMALL`.
    let size = 1024;
    for (let attempt = 0; attempt < 5; attempt++) {
      const cell = kit.newIntCell(size);
      try {
        backend.kplfrm(frmcls, cell);

        const n = backend.card(cell);
        const out: number[] = [];
        for (let i = 0; i < n; i++) {
          out.push(kit.cellGeti(cell, i));
        }
        return out;
      } catch (error) {
        const spice = inferSpiceFromError(error);
        if (spice?.short === "CELLTOOSMALL" && attempt < 4) {
          size = Math.min(size * 8, 1_048_576);
          continue;
        }
        throw error;
      } finally {
        kit.freeCell(cell);
      }
    }

    // Should be unreachable: the loop either returns or throws.
    return [];
  },

  // kernel-pool
  "kernel-pool.gdpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.gdpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`kernel-pool.gdpool expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`kernel-pool.gdpool expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[1], "kernel-pool.gdpool args[1]");
    assertInteger(args[2], "kernel-pool.gdpool args[2]");
    if (args[1] < 0) {
      invalidArgs(`kernel-pool.gdpool expects args[1] to be >= 0 (got ${formatValue(args[1])})`);
    }
    if (args[2] <= 0) {
      invalidArgs(`kernel-pool.gdpool expects args[2] to be > 0 (got ${formatValue(args[2])})`);
    }
    return backend.gdpool(args[0], args[1], args[2]);
  },

  "kernel-pool.gipool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.gipool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`kernel-pool.gipool expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`kernel-pool.gipool expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[1], "kernel-pool.gipool args[1]");
    assertInteger(args[2], "kernel-pool.gipool args[2]");
    if (args[1] < 0) {
      invalidArgs(`kernel-pool.gipool expects args[1] to be >= 0 (got ${formatValue(args[1])})`);
    }
    if (args[2] <= 0) {
      invalidArgs(`kernel-pool.gipool expects args[2] to be > 0 (got ${formatValue(args[2])})`);
    }
    return backend.gipool(args[0], args[1], args[2]);
  },

  "kernel-pool.gcpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.gcpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`kernel-pool.gcpool expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`kernel-pool.gcpool expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[1], "kernel-pool.gcpool args[1]");
    assertInteger(args[2], "kernel-pool.gcpool args[2]");
    if (args[1] < 0) {
      invalidArgs(`kernel-pool.gcpool expects args[1] to be >= 0 (got ${formatValue(args[1])})`);
    }
    if (args[2] <= 0) {
      invalidArgs(`kernel-pool.gcpool expects args[2] to be > 0 (got ${formatValue(args[2])})`);
    }
    return backend.gcpool(args[0], args[1], args[2]);
  },

  "kernel-pool.gnpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.gnpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`kernel-pool.gnpool expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`kernel-pool.gnpool expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[1], "kernel-pool.gnpool args[1]");
    assertInteger(args[2], "kernel-pool.gnpool args[2]");
    if (args[1] < 0) {
      invalidArgs(`kernel-pool.gnpool expects args[1] to be >= 0 (got ${formatValue(args[1])})`);
    }
    if (args[2] <= 0) {
      invalidArgs(`kernel-pool.gnpool expects args[2] to be > 0 (got ${formatValue(args[2])})`);
    }
    return backend.gnpool(args[0], args[1], args[2]);
  },

  "kernel-pool.dtpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.dtpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.dtpool(args[0]);
  },

  "kernel-pool.pdpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.pdpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (!Array.isArray(args[1])) {
      invalidArgs(`kernel-pool.pdpool expects args[1] to be an array (got ${formatValue(args[1])})`);
    }
    for (let i = 0; i < args[1].length; i++) {
      if (typeof args[1][i] !== "number" || !Number.isFinite(args[1][i])) {
        invalidArgs(`kernel-pool.pdpool expects args[1][${i}] to be a finite number (got ${formatValue(args[1][i])})`);
      }
    }

    backend.pdpool(args[0], args[1]);
    return null;
  },

  "kernel-pool.pipool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.pipool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (!Array.isArray(args[1])) {
      invalidArgs(`kernel-pool.pipool expects args[1] to be an array (got ${formatValue(args[1])})`);
    }
    for (let i = 0; i < args[1].length; i++) {
      const v = args[1][i];
      if (typeof v !== "number" || !Number.isFinite(v)) {
        invalidArgs(`kernel-pool.pipool expects args[1][${i}] to be a finite number (got ${formatValue(v)})`);
      }
      if (!Number.isInteger(v)) {
        invalidArgs(`kernel-pool.pipool expects args[1][${i}] to be an integer (got ${formatValue(v)})`);
      }
      if (v < -2147483648 || v > 2147483647) {
        invalidArgs(`kernel-pool.pipool expects args[1][${i}] to be a 32-bit signed integer (got ${formatValue(v)})`);
      }
    }

    backend.pipool(args[0], args[1]);
    return null;
  },

  "kernel-pool.pcpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.pcpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (!Array.isArray(args[1])) {
      invalidArgs(`kernel-pool.pcpool expects args[1] to be an array (got ${formatValue(args[1])})`);
    }
    for (let i = 0; i < args[1].length; i++) {
      if (typeof args[1][i] !== "string") {
        invalidArgs(`kernel-pool.pcpool expects args[1][${i}] to be a string (got ${formatValue(args[1][i])})`);
      }
    }

    backend.pcpool(args[0], args[1]);
    return null;
  },

  "kernel-pool.swpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.swpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    if (!Array.isArray(args[1])) {
      invalidArgs(`kernel-pool.swpool expects args[1] to be an array (got ${formatValue(args[1])})`);
    }
    for (let i = 0; i < args[1].length; i++) {
      if (typeof args[1][i] !== "string") {
        invalidArgs(`kernel-pool.swpool expects args[1][${i}] to be a string (got ${formatValue(args[1][i])})`);
      }
    }

    backend.swpool(args[0], args[1]);
    return null;
  },

  "kernel-pool.cvpool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.cvpool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }

    // NOTE: cvpool() is typically used after swpool(). Since the parity runner
    // isolates each case, prime the agent with an empty watch list so the call
    // exercises the documented behavior (next cvpool(agent) returns true).
    backend.swpool(args[0], []);

    return backend.cvpool(args[0]);
  },

  "kernel-pool.expool": (backend, args) => {
    if (typeof args[0] !== "string") {
      invalidArgs(`kernel-pool.expool expects args[0] to be a string (got ${formatValue(args[0])})`);
    }
    return backend.expool(args[0]);
  },


  "cells-windows.insrti": (backend, args, kit) => {
    assertInteger(args[0], "cells-windows.insrti args[0]");
    const recipe = parseCellsWindowsRecipeAsKind(args[1], "cells-windows.insrti", 1, "int");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["raw"]["insrti"]>[1];

    try {
      backend.insrti(args[0], cell);
      return {
        card: backend.card(cell),
        size: backend.size(cell),
      };
    } finally {
      prepared.release();
    }
  },

  "cells-windows.insrtd": (backend, args, kit) => {
    assertNumberArg(args[0], "cells-windows.insrtd", 0);
    const recipe = parseCellsWindowsRecipeAsKind(args[1], "cells-windows.insrtd", 1, "double");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["raw"]["insrtd"]>[1];

    try {
      backend.insrtd(args[0], cell);
      return {
        card: backend.card(cell),
        size: backend.size(cell),
      };
    } finally {
      prepared.release();
    }
  },

  "cells-windows.insrtc": (backend, args, kit) => {
    assertStringArg(args[0], "cells-windows.insrtc", 0);
    const recipe = parseCellsWindowsRecipeAsKind(args[1], "cells-windows.insrtc", 1, "char");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["raw"]["insrtc"]>[1];

    try {
      backend.insrtc(args[0], cell);
      return {
        card: backend.card(cell),
        size: backend.size(cell),
      };
    } finally {
      prepared.release();
    }
  },

  "cells-windows.cellGeti": (backend, args, kit) => {
    const recipe = parseCellsWindowsRecipeAsKind(args[0], "cells-windows.cellGeti", 0, "int");
    assertInteger(args[1], "cells-windows.cellGeti args[1]");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["kit"]["cellGeti"]>[0];

    try {
      backend.insrti(3, cell);
      backend.insrti(1, cell);
      backend.insrti(2, cell);
      return kit.cellGeti(cell, args[1]);
    } finally {
      prepared.release();
    }
  },

  "cells-windows.cellGetd": (backend, args, kit) => {
    const recipe = parseCellsWindowsRecipeAsKind(args[0], "cells-windows.cellGetd", 0, "double");
    assertInteger(args[1], "cells-windows.cellGetd args[1]");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["kit"]["cellGetd"]>[0];

    try {
      backend.insrtd(3.25, cell);
      backend.insrtd(-1.0, cell);
      return kit.cellGetd(cell, args[1]);
    } finally {
      prepared.release();
    }
  },

  "cells-windows.cellGetc": (backend, args, kit) => {
    const recipe = parseCellsWindowsRecipeAsKind(args[0], "cells-windows.cellGetc", 0, "char");

    assertInteger(args[1], "cells-windows.cellGetc args[1]");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const cell = asCellsWindowsCellArg(prepared) as Parameters<SpiceBackend["kit"]["cellGetc"]>[0];

    try {
      backend.insrtc("b", cell);
      backend.insrtc("a", cell);
      backend.insrtc("c", cell);
      return kit.cellGetc(cell, args[1]);
    } finally {
      prepared.release();
    }
  },

  "cells-windows.wninsd": (backend, args, kit) => {
    assertNumberArg(args[0], "cells-windows.wninsd", 0);
    assertNumberArg(args[1], "cells-windows.wninsd", 1);
    const recipe = parseCellsWindowsRecipeAsKind(args[2], "cells-windows.wninsd", 2, "window");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const window = asCellsWindowsWindowArg(prepared);

    try {
      backend.wninsd(args[0], args[1], window);

      const intervals = backend.wncard(window);
      if (intervals > 0) {
        return {
          card: intervals,
          first: backend.wnfetd(window, 0),
        };
      }

      return { card: intervals };
    } finally {
      prepared.release();
    }
  },

  "cells-windows.wncard": (backend, args, kit) => {
    const recipe = parseCellsWindowsRecipeAsKind(args[0], "cells-windows.wncard", 0, "window");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const window = asCellsWindowsWindowArg(prepared);

    try {
      backend.wninsd(0, 1, window);
      backend.wninsd(2, 3, window);
      backend.wninsd(0.5, 2.5, window);
      return backend.wncard(window);
    } finally {
      prepared.release();
    }
  },

  "cells-windows.wnfetd": (backend, args, kit) => {
    const recipe = parseCellsWindowsRecipeAsKind(args[0], "cells-windows.wnfetd", 0, "window");
    assertInteger(args[1], "cells-windows.wnfetd args[1]");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const window = asCellsWindowsWindowArg(prepared);

    try {
      backend.wninsd(0, 1, window);
      backend.wninsd(2, 3, window);
      backend.wninsd(0.5, 2.5, window);
      return backend.wnfetd(window, args[1]);
    } finally {
      prepared.release();
    }
  },

  "cells-windows.wnvald": (backend, args, kit) => {
    assertInteger(args[0], "cells-windows.wnvald args[0]");
    assertInteger(args[1], "cells-windows.wnvald args[1]");
    const recipe = parseCellsWindowsRecipeAsKind(args[2], "cells-windows.wnvald", 2, "window");

    const prepared = prepareCellsWindowsHandle(kit, recipe);
    const window = asCellsWindowsWindowArg(prepared);

    try {
      backend.wnvald(args[0], args[1], window);
      return {
        card: backend.wncard(window),
        size: backend.size(window),
      };
    } finally {
      prepared.release();
    }
  },

  // ephemeris
  "ephemeris.spkezr": (backend, args) => {
    assertStringArg(args[0], "ephemeris.spkezr", 0);
    assertNumberArg(args[1], "ephemeris.spkezr", 1);
    assertStringArg(args[2], "ephemeris.spkezr", 2);
    assertStringArg(args[3], "ephemeris.spkezr", 3);
    assertStringArg(args[4], "ephemeris.spkezr", 4);
    return backend.spkezr(args[0], args[1], args[2], args[3], args[4]);
  },

  "ephemeris.spkpos": (backend, args) => {
    assertStringArg(args[0], "ephemeris.spkpos", 0);
    assertNumberArg(args[1], "ephemeris.spkpos", 1);
    assertStringArg(args[2], "ephemeris.spkpos", 2);
    assertStringArg(args[3], "ephemeris.spkpos", 3);
    assertStringArg(args[4], "ephemeris.spkpos", 4);
    return backend.spkpos(args[0], args[1], args[2], args[3], args[4]);
  },

  "ephemeris.spkez": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkez args[0]");
    assertNumberArg(args[1], "ephemeris.spkez", 1);
    assertStringArg(args[2], "ephemeris.spkez", 2);
    assertStringArg(args[3], "ephemeris.spkez", 3);
    assertInteger(args[4], "ephemeris.spkez args[4]");
    return backend.spkez(args[0], args[1], args[2], args[3], args[4]);
  },

  "ephemeris.spkezp": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkezp args[0]");
    assertNumberArg(args[1], "ephemeris.spkezp", 1);
    assertStringArg(args[2], "ephemeris.spkezp", 2);
    assertStringArg(args[3], "ephemeris.spkezp", 3);
    assertInteger(args[4], "ephemeris.spkezp args[4]");
    return backend.spkezp(args[0], args[1], args[2], args[3], args[4]);
  },

  "ephemeris.spkgeo": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkgeo args[0]");
    assertNumberArg(args[1], "ephemeris.spkgeo", 1);
    assertStringArg(args[2], "ephemeris.spkgeo", 2);
    assertInteger(args[3], "ephemeris.spkgeo args[3]");
    return backend.spkgeo(args[0], args[1], args[2], args[3]);
  },

  "ephemeris.spkgps": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkgps args[0]");
    assertNumberArg(args[1], "ephemeris.spkgps", 1);
    assertStringArg(args[2], "ephemeris.spkgps", 2);
    assertInteger(args[3], "ephemeris.spkgps args[3]");
    return backend.spkgps(args[0], args[1], args[2], args[3]);
  },

  "ephemeris.spkssb": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkssb args[0]");
    assertNumberArg(args[1], "ephemeris.spkssb", 1);
    assertStringArg(args[2], "ephemeris.spkssb", 2);
    return backend.spkssb(args[0], args[1], args[2]);
  },

  "ephemeris.spksfs": (backend, args) => {
    assertInteger(args[0], "ephemeris.spksfs args[0]");
    assertNumberArg(args[1], "ephemeris.spksfs", 1);
    return backend.spksfs(args[0], args[1]);
  },

  "ephemeris.spkpds": (backend, args) => {
    assertInteger(args[0], "ephemeris.spkpds args[0]");
    assertInteger(args[1], "ephemeris.spkpds args[1]");
    assertStringArg(args[2], "ephemeris.spkpds", 2);
    assertInteger(args[3], "ephemeris.spkpds args[3]");
    assertNumberArg(args[4], "ephemeris.spkpds", 4);
    assertNumberArg(args[5], "ephemeris.spkpds", 5);

    return backend.spkpds(args[0], args[1], args[2], args[3], args[4], args[5]);
  },

  "ephemeris.spkuds": (backend, args) => {
    assertSpkPackedDescriptor(args[0], "ephemeris.spkuds args[0]");
    return backend.spkuds(args[0]);
  },


  // coords-vectors
  "coords-vectors.axisar": (backend, args) => {
    assertVec3(args[0], "coords-vectors.axisar args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.axisar expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    return backend.axisar(args[0], args[1]);
  },

  "coords-vectors.georec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    if (typeof args[3] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[3] to be a number (got ${formatValue(args[3])})`);
    }
    if (typeof args[4] !== "number") {
      invalidArgs(`coords-vectors.georec expects args[4] to be a number (got ${formatValue(args[4])})`);
    }
    return backend.georec(args[0], args[1], args[2], args[3], args[4]);
  },

  "coords-vectors.latrec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.latrec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.latrec(args[0], args[1], args[2]);
  },

  "coords-vectors.mtxv": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mtxv args[0]");
    assertVec3(args[1], "coords-vectors.mtxv args[1]");
    return backend.mtxv(args[0], args[1]);
  },

  "coords-vectors.mxm": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mxm args[0]");
    assertMat3RowMajor(args[1], "coords-vectors.mxm args[1]");
    return backend.mxm(args[0], args[1]);
  },

  "coords-vectors.mxv": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.mxv args[0]");
    assertVec3(args[1], "coords-vectors.mxv args[1]");
    return backend.mxv(args[0], args[1]);
  },

  "coords-vectors.recgeo": (backend, args) => {
    assertVec3(args[0], "coords-vectors.recgeo args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.recgeo expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.recgeo expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.recgeo(args[0], args[1], args[2]);
  },

  "coords-vectors.reclat": (backend, args) => {
    assertVec3(args[0], "coords-vectors.reclat args[0]");
    return backend.reclat(args[0]);
  },

  "coords-vectors.recsph": (backend, args) => {
    assertVec3(args[0], "coords-vectors.recsph args[0]");
    return backend.recsph(args[0]);
  },

  "coords-vectors.rotate": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.rotate expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.rotate expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    assertInteger(args[1], "coords-vectors.rotate args[1]");
    return backend.rotate(args[0], args[1]);
  },

  "coords-vectors.rotmat": (backend, args) => {
    assertMat3RowMajor(args[0], "coords-vectors.rotmat args[0]");
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.rotmat expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.rotmat expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    assertInteger(args[2], "coords-vectors.rotmat args[2]");
    return backend.rotmat(args[0], args[1], args[2]);
  },

  "coords-vectors.sphrec": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    if (typeof args[1] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[1] to be a number (got ${formatValue(args[1])})`);
    }
    if (typeof args[2] !== "number") {
      invalidArgs(`coords-vectors.sphrec expects args[2] to be a number (got ${formatValue(args[2])})`);
    }
    return backend.sphrec(args[0], args[1], args[2]);
  },

  "coords-vectors.vadd": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vadd args[0]");
    assertVec3(args[1], "coords-vectors.vadd args[1]");
    return backend.vadd(args[0], args[1]);
  },

  "coords-vectors.vcrss": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vcrss args[0]");
    assertVec3(args[1], "coords-vectors.vcrss args[1]");
    return backend.vcrss(args[0], args[1]);
  },

  "coords-vectors.vdot": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vdot args[0]");
    assertVec3(args[1], "coords-vectors.vdot args[1]");
    return backend.vdot(args[0], args[1]);
  },

  "coords-vectors.vhat": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vhat args[0]");
    return backend.vhat(args[0]);
  },

  "coords-vectors.vminus": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vminus args[0]");
    return backend.vminus(args[0]);
  },

  "coords-vectors.vnorm": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vnorm args[0]");
    return backend.vnorm(args[0]);
  },

  "coords-vectors.vscl": (backend, args) => {
    if (typeof args[0] !== "number") {
      invalidArgs(`coords-vectors.vscl expects args[0] to be a number (got ${formatValue(args[0])})`);
    }
    assertVec3(args[1], "coords-vectors.vscl args[1]");
    return backend.vscl(args[0], args[1]);
  },

  "coords-vectors.vsub": (backend, args) => {
    assertVec3(args[0], "coords-vectors.vsub args[0]");
    assertVec3(args[1], "coords-vectors.vsub args[1]");
    return backend.vsub(args[0], args[1]);
  },

};

function safeErrorReport(error: unknown): RunnerErrorReport {
  if (error instanceof Error) {
    const report: RunnerErrorReport = { message: error.message };

    const anyErr = error as unknown as { code?: unknown };
    if (isRunnerValidationCode(anyErr.code)) report.code = anyErr.code;

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

        if (input.schemaVersion === 2) {
          const legacyInput = lowerV2InvokeLegacyCall(input, {
            invalidRequest,
            invalidArgs,
          });
          if (legacyInput !== null) {
            const fn = DISPATCH[legacyInput.call];
            if (!fn) {
              unsupportedCall(`Unsupported call: ${formatValue(legacyInput.call)}`);
            }

            const result = await fn(backend.raw, legacyInput.args, backend.kit, backend.kind);
            return { ok: true, result };
          }

          const result = await executeV2CaseWithBackend(backend, input);
          return { ok: true, result };
        }

        const fn = DISPATCH[input.call];
        if (!fn) {
          unsupportedCall(`Unsupported call: ${formatValue(input.call)}`);
        }

        const result = await fn(backend.raw, input.args, backend.kit, backend.kind);
        return { ok: true, result };
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
