import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import type { Spice } from "@rybosome/tspice";

import {
  resolveMetaKernelKernelsToLoad,
  sanitizeMetaKernelTextForNativeNoKernels,
  sanitizeMetaKernelTextForWasm,
} from "../kernels/metaKernel.js";

import type { CaseSetup, KernelEntry } from "./types.js";

export const GENERATED_DISPATCH_UNAVAILABLE_CODE = "generated_dispatch_unavailable" as const;
export const GENERATED_DISPATCH_UNAVAILABLE_REASON = "generated-dispatch-unavailable" as const;

const FIXTURES_PREFIX = "$FIXTURES/";
const SPICE_INT32_MAX = 2147483647;

const PROMOTED_METHODS = [
  "time.str2et",
  "time.et2utc",
  "time.timdef",
  "ids-names.bodn2c",
  "coords-vectors.mxm",
  "coords-vectors.recgeo",
  "cells-windows.wninsd",
  "cells-windows.wnfetd",
  "kernel-pool.gcpool",
  "kernels.furnsh",
  "kernels.ktotal",
  "kernels.kdata",
  "kernels.kxtrct",
  "ek.ekfind",
  "ek.ekgc",
] as const;

export type PromotedGeneratedDispatchMethod = (typeof PROMOTED_METHODS)[number];

const promotedMethodSet = new Set<string>(PROMOTED_METHODS);

export function promotedGeneratedDispatchMethods(): readonly PromotedGeneratedDispatchMethod[] {
  return PROMOTED_METHODS;
}

export function isPromotedGeneratedDispatchMethod(fn: string): fn is PromotedGeneratedDispatchMethod {
  return promotedMethodSet.has(fn);
}

export type DispatchLane = "node" | "wasm" | "cspice";

export type GeneratedDispatchRuntimeContext = {
  raw: Spice["raw"];
  kit: Spice["kit"];
  backendKind: Spice["raw"]["kind"];
  repoRoot: string;
  fixtureRoot: string;
};

export type GeneratedDispatchRequest = {
  lane: DispatchLane;
  callId: string;
  fn: string;
  input: unknown;
  runtime?: GeneratedDispatchRuntimeContext;
};

type BoundaryDetails = {
  dispatchHandoffAttempted: true;
  fallbackUsed: false;
  stopPoint: typeof GENERATED_DISPATCH_UNAVAILABLE_REASON;
  fn: string;
};

type RunnerCodeError = Error & {
  code?: string;
  lane?: DispatchLane;
  callId?: string;
  reason?: string;
  details?: Record<string, unknown>;
};

type DispatchRequestWithRuntime = GeneratedDispatchRequest & {
  runtime: GeneratedDispatchRuntimeContext;
  fn: PromotedGeneratedDispatchMethod;
};

type DispatchHandler = (request: DispatchRequestWithRuntime) => unknown;

const wasmKernelVidToOsPath = new Map<string, string>();

function generatedDispatchBoundaryDetails(fn: string): BoundaryDetails {
  return {
    dispatchHandoffAttempted: true,
    fallbackUsed: false,
    stopPoint: GENERATED_DISPATCH_UNAVAILABLE_REASON,
    fn,
  };
}

function generatedDispatchUnavailableError(
  lane: DispatchLane,
  callId: string,
  fn: string,
): RunnerCodeError {
  const err = new Error(
    `Generated dispatch is unavailable for ${fn} (lane=${lane}, callId=${callId})`,
  ) as RunnerCodeError;

  err.code = GENERATED_DISPATCH_UNAVAILABLE_CODE;
  err.lane = lane;
  err.callId = callId;
  err.reason = GENERATED_DISPATCH_UNAVAILABLE_REASON;
  err.details = generatedDispatchBoundaryDetails(fn);
  return err;
}

function invalidRequest(message: string): never {
  const err = new Error(message) as RunnerCodeError;
  err.code = "invalid_request";
  throw err;
}

function invalidArgs(message: string): never {
  const err = new TypeError(message) as RunnerCodeError;
  err.code = "invalid_args";
  throw err;
}

function formatValue(value: unknown): string {
  try {
    const encoded = JSON.stringify(value);
    if (encoded !== undefined) {
      return encoded;
    }
  } catch {
    // fall through to String()
  }
  return String(value);
}

function assertStringArg(value: unknown, call: string, index: number): asserts value is string {
  if (typeof value !== "string") {
    invalidArgs(`${call} expects args[${index}] to be a string (got ${formatValue(value)})`);
  }
}

function assertNumberArg(value: unknown, call: string, index: number): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    invalidArgs(`${call} expects args[${index}] to be a finite number (got ${formatValue(value)})`);
  }
}

function assertIntegerArg(value: unknown, call: string, index: number): asserts value is number {
  assertNumberArg(value, call, index);
  if (!Number.isInteger(value)) {
    invalidArgs(`${call} expects args[${index}] to be an integer (got ${formatValue(value)})`);
  }
}

function assertNonNegativeIntArg(value: unknown, call: string, index: number): asserts value is number {
  assertIntegerArg(value, call, index);
  if (value < 0 || value > SPICE_INT32_MAX) {
    invalidArgs(`${call} expects args[${index}] to be a non-negative SpiceInt (got ${formatValue(value)})`);
  }
}

function assertStringArrayArg(value: unknown, call: string, index: number): asserts value is string[] {
  if (!Array.isArray(value) || !value.every((item): item is string => typeof item === "string")) {
    invalidArgs(`${call} expects args[${index}] to be string[] (got ${formatValue(value)})`);
  }
}

function assertVec3(value: unknown, label: string): asserts value is [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) {
    invalidArgs(`${label} expects a length-3 array (got ${formatValue(value)})`);
  }

  for (let i = 0; i < 3; i++) {
    if (typeof value[i] !== "number" || !Number.isFinite(value[i])) {
      invalidArgs(`${label}[${i}] expects a finite number (got ${formatValue(value[i])})`);
    }
  }
}

function assertMat3RowMajor(
  value: unknown,
  label: string,
): asserts value is [number, number, number, number, number, number, number, number, number] {
  if (!Array.isArray(value) || value.length !== 9) {
    invalidArgs(`${label} expects a length-9 array (got ${formatValue(value)})`);
  }

  for (let i = 0; i < 9; i++) {
    if (typeof value[i] !== "number" || !Number.isFinite(value[i])) {
      invalidArgs(`${label}[${i}] expects a finite number (got ${formatValue(value[i])})`);
    }
  }
}

function expectArgsArray(input: unknown, call: string): unknown[] {
  if (!Array.isArray(input)) {
    invalidArgs(`${call} expects workflow step input to resolve to args[] (got ${formatValue(input)})`);
  }
  return input;
}

function expectExactArity(args: unknown[], expected: number, call: string): void {
  if (args.length !== expected) {
    invalidArgs(`${call} expects ${expected} arg(s) (got ${args.length})`);
  }
}

function normalizeKernelKindQuery(value: unknown, label: string): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value) && value.every((item): item is string => typeof item === "string")) {
    if (value.length === 0) {
      invalidArgs(`${label} expects a non-empty string[]`);
    }
    return value.join(" ");
  }

  invalidArgs(`${label} expects string | string[] (got ${formatValue(value)})`);
}

function parseWindowRecipe(value: unknown, call: string, index: number): { maxIntervals: number } {
  if (!Array.isArray(value) || value.length !== 2) {
    invalidArgs(`${call} expects args[${index}] to be ["window", maxIntervals]`);
  }

  if (value[0] !== "window") {
    invalidArgs(`${call} expects args[${index}][0] to equal "window"`);
  }

  assertIntegerArg(value[1], call, index);
  if (value[1] < 0) {
    invalidArgs(`${call} expects args[${index}][1] to be >= 0`);
  }

  return { maxIntervals: value[1] };
}

function resolveFixtureAlias(pathOrRef: string, runtime: GeneratedDispatchRuntimeContext): string {
  if (!pathOrRef.startsWith(FIXTURES_PREFIX)) {
    if (path.isAbsolute(pathOrRef)) {
      return pathOrRef;
    }
    return path.resolve(runtime.repoRoot, pathOrRef);
  }

  const relativePath = pathOrRef.slice(FIXTURES_PREFIX.length);
  if (relativePath.length === 0) {
    invalidRequest("$FIXTURES reference must include a relative path");
  }

  const resolved = path.resolve(runtime.fixtureRoot, relativePath);
  const relativeFromRoot = path.relative(runtime.fixtureRoot, resolved);

  if (relativeFromRoot.startsWith("..") || path.isAbsolute(relativeFromRoot)) {
    invalidRequest(`Fixture reference escapes fixture root: ${pathOrRef}`);
  }

  return resolved;
}

function resolveKernelEntryPath(rawPath: string, runtime: GeneratedDispatchRuntimeContext): {
  path: string;
  restrictToDir?: string;
} {
  const resolved = resolveFixtureAlias(rawPath, runtime);

  if (!fs.existsSync(resolved)) {
    invalidRequest(`Setup kernel path does not exist: ${rawPath}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return { path: resolved };
  }

  const base = path.basename(resolved);
  const defaultMetaKernelPath = path.join(resolved, `${base}.tm`);
  if (!fs.existsSync(defaultMetaKernelPath) || !fs.statSync(defaultMetaKernelPath).isFile()) {
    invalidRequest(
      `Directory setup kernel requires <dir>/<basename>.tm meta-kernel (missing ${defaultMetaKernelPath})`,
    );
  }

  return {
    path: defaultMetaKernelPath,
    restrictToDir: resolved,
  };
}

function normalizeKernelEntry(entry: KernelEntry, runtime: GeneratedDispatchRuntimeContext): {
  path: string;
  restrictToDir?: string;
} {
  if (typeof entry === "string") {
    return resolveKernelEntryPath(entry, runtime);
  }

  const resolved = resolveKernelEntryPath(entry.path, runtime);
  const restrictToDir =
    entry.restrictToDir !== undefined
      ? resolveFixtureAlias(entry.restrictToDir, runtime)
      : resolved.restrictToDir;

  return {
    path: resolved.path,
    ...(restrictToDir === undefined ? {} : { restrictToDir }),
  };
}

function kernelVirtualIdFromOsPath(osPath: string): string {
  const absolutePath = path.resolve(osPath);
  const canonicalPath = fs.realpathSync.native?.(absolutePath) ?? fs.realpathSync(absolutePath);
  const hash = createHash("sha256").update(canonicalPath).digest("hex").slice(0, 16);
  const base = path.basename(canonicalPath);
  return `ospath/${hash}/${base}`;
}

function furnshOsKernelForWasm(
  runtime: GeneratedDispatchRuntimeContext,
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): void {
  const absolutePath = path.resolve(osPath);
  const loadedKey = `bytes:${absolutePath}`;
  if (loaded.has(loadedKey)) {
    return;
  }
  loaded.add(loadedKey);

  if (path.extname(absolutePath).toLowerCase() === ".tm") {
    const metaKernelText = fs.readFileSync(absolutePath, "utf8");
    const kernelsToLoad = resolveMetaKernelKernelsToLoad(
      metaKernelText,
      absolutePath,
      restrictToDir === undefined ? {} : { restrictToDir },
    );

    const sanitizedMetaKernel = sanitizeMetaKernelTextForWasm(metaKernelText);
    const virtualId = kernelVirtualIdFromOsPath(absolutePath);
    wasmKernelVidToOsPath.set(virtualId, absolutePath);
    runtime.raw.furnsh({
      path: virtualId,
      bytes: Buffer.from(sanitizedMetaKernel, "utf8"),
    });

    for (const kernelPath of kernelsToLoad) {
      furnshOsKernelForWasm(runtime, kernelPath, loaded, restrictToDir);
    }
    return;
  }

  const virtualId = kernelVirtualIdFromOsPath(absolutePath);
  const bytes = fs.readFileSync(absolutePath);
  wasmKernelVidToOsPath.set(virtualId, absolutePath);
  runtime.raw.furnsh({
    path: virtualId,
    bytes,
  });
}

function furnshOsKernelForNative(
  runtime: GeneratedDispatchRuntimeContext,
  osPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): void {
  const absolutePath = path.resolve(osPath);
  const mode = restrictToDir && path.extname(absolutePath).toLowerCase() === ".tm" ? "bytes" : "ospath";
  const loadedKey = `${mode}:${absolutePath}`;

  if (loaded.has(loadedKey)) {
    return;
  }
  loaded.add(loadedKey);

  if (restrictToDir && path.extname(absolutePath).toLowerCase() === ".tm") {
    const metaKernelText = fs.readFileSync(absolutePath, "utf8");
    const kernelsToLoad = resolveMetaKernelKernelsToLoad(metaKernelText, absolutePath, {
      restrictToDir,
    });
    const sanitizedMetaKernel = sanitizeMetaKernelTextForNativeNoKernels(metaKernelText);

    runtime.raw.furnsh({
      path: absolutePath,
      bytes: Buffer.from(sanitizedMetaKernel, "utf8"),
    });

    for (const kernelPath of kernelsToLoad) {
      furnshOsKernelForNative(runtime, kernelPath, loaded, restrictToDir);
    }
    return;
  }

  runtime.raw.furnsh(absolutePath);
}

function furnshKernelEntry(
  runtime: GeneratedDispatchRuntimeContext,
  kernelPath: string,
  loaded: Set<string>,
  restrictToDir?: string,
): void {
  if (runtime.backendKind === "wasm") {
    furnshOsKernelForWasm(runtime, kernelPath, loaded, restrictToDir);
    return;
  }

  furnshOsKernelForNative(runtime, kernelPath, loaded, restrictToDir);
}

function isolateRuntimeCase(runtime: GeneratedDispatchRuntimeContext): void {
  try {
    runtime.raw.kclear();
  } catch {
    // best effort
  }

  try {
    runtime.raw.reset();
  } catch {
    // best effort
  }
}

export function prepareGeneratedDispatchRuntime(
  runtime: GeneratedDispatchRuntimeContext,
  setup: CaseSetup | undefined,
): void {
  isolateRuntimeCase(runtime);

  const loaded = new Set<string>();
  for (const kernelEntry of setup?.kernels ?? []) {
    const normalized = normalizeKernelEntry(kernelEntry, runtime);
    furnshKernelEntry(runtime, normalized.path, loaded, normalized.restrictToDir);
  }
}

export function resetGeneratedDispatchRuntime(runtime: GeneratedDispatchRuntimeContext): void {
  isolateRuntimeCase(runtime);
}

function rewriteWasmKdataPathIfNeeded(
  runtime: GeneratedDispatchRuntimeContext,
  value: unknown,
): unknown {
  if (runtime.backendKind !== "wasm") {
    return value;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result = value as Record<string, unknown>;
  if (result.found !== true || typeof result.file !== "string") {
    return value;
  }

  const prefix = "/kernels/";
  if (!result.file.startsWith(prefix)) {
    return value;
  }

  const virtualId = result.file.slice(prefix.length);
  const osPath = wasmKernelVidToOsPath.get(virtualId);
  if (!osPath) {
    return value;
  }

  return {
    ...result,
    file: osPath,
  };
}

function parseKernelSource(
  value: unknown,
  runtime: GeneratedDispatchRuntimeContext,
): string | { path: string; bytes: Uint8Array } {
  if (typeof value === "string") {
    const resolvedPath = resolveFixtureAlias(value, runtime);
    const bytes = fs.readFileSync(resolvedPath);

    if (runtime.backendKind === "wasm") {
      const virtualId = kernelVirtualIdFromOsPath(resolvedPath);
      wasmKernelVidToOsPath.set(virtualId, resolvedPath);
      return { path: virtualId, bytes };
    }

    return { path: resolvedPath, bytes };
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    invalidArgs(`kernels.furnsh expects args[0] to be string | { path, bytes } (got ${formatValue(value)})`);
  }

  const source = value as { path?: unknown; bytes?: unknown };
  if (typeof source.path !== "string" || source.path.trim().length === 0) {
    invalidArgs("kernels.furnsh expects args[0].path to be a non-empty string");
  }

  let bytes: Uint8Array;
  if (source.bytes instanceof Uint8Array) {
    bytes = source.bytes;
  } else if (Array.isArray(source.bytes)) {
    if (
      !source.bytes.every(
        (item): item is number =>
          typeof item === "number" && Number.isInteger(item) && item >= 0 && item <= 255,
      )
    ) {
      invalidArgs("kernels.furnsh expects args[0].bytes array to contain byte values [0,255]");
    }
    bytes = Uint8Array.from(source.bytes);
  } else if (typeof source.bytes === "string") {
    const bytePath = resolveFixtureAlias(source.bytes, runtime);
    bytes = fs.readFileSync(bytePath);
  } else {
    invalidArgs(
      `kernels.furnsh expects args[0].bytes to be Uint8Array | number[] | string (got ${formatValue(source.bytes)})`,
    );
  }

  const resolvedPath = resolveFixtureAlias(source.path, runtime);
  if (runtime.backendKind === "wasm") {
    const virtualId = kernelVirtualIdFromOsPath(resolvedPath);
    wasmKernelVidToOsPath.set(virtualId, resolvedPath);
    return {
      path: virtualId,
      bytes,
    };
  }

  return {
    path: resolvedPath,
    bytes,
  };
}

const dispatchHandlers: Record<PromotedGeneratedDispatchMethod, DispatchHandler> = {
  "time.str2et": ({ input, runtime }) => {
    const args = expectArgsArray(input, "time.str2et");
    expectExactArity(args, 1, "time.str2et");

    const [time] = args;
    assertStringArg(time, "time.str2et", 0);
    return runtime.raw.str2et(time);
  },

  "time.et2utc": ({ input, runtime }) => {
    const args = expectArgsArray(input, "time.et2utc");
    expectExactArity(args, 3, "time.et2utc");

    const [et, format, precision] = args;
    assertNumberArg(et, "time.et2utc", 0);
    assertStringArg(format, "time.et2utc", 1);
    assertIntegerArg(precision, "time.et2utc", 2);

    return runtime.raw.et2utc(et, format, precision);
  },

  "time.timdef": ({ input, runtime }) => {
    const args = expectArgsArray(input, "time.timdef");
    if (args.length !== 2 && args.length !== 3) {
      invalidArgs(`time.timdef expects 2 or 3 args (got ${args.length})`);
    }

    const [action, item, value] = args;
    assertStringArg(action, "time.timdef", 0);
    assertStringArg(item, "time.timdef", 1);

    if (action === "GET") {
      return runtime.raw.timdef("GET", item);
    }

    if (action === "SET") {
      if (args.length !== 3) {
        invalidArgs("time.timdef SET expects args[2] to be provided");
      }
      assertStringArg(value, "time.timdef", 2);
      runtime.raw.timdef("SET", item, value);
      return null;
    }

    invalidArgs(`time.timdef expects args[0] to be \"GET\" or \"SET\" (got ${formatValue(action)})`);
  },

  "ids-names.bodn2c": ({ input, runtime }) => {
    const args = expectArgsArray(input, "ids-names.bodn2c");
    expectExactArity(args, 1, "ids-names.bodn2c");

    const [name] = args;
    assertStringArg(name, "ids-names.bodn2c", 0);
    return runtime.raw.bodn2c(name);
  },

  "coords-vectors.mxm": ({ input, runtime }) => {
    const args = expectArgsArray(input, "coords-vectors.mxm");
    expectExactArity(args, 2, "coords-vectors.mxm");

    const [left, right] = args;
    assertMat3RowMajor(left, "coords-vectors.mxm args[0]");
    assertMat3RowMajor(right, "coords-vectors.mxm args[1]");

    const leftMatrix = left as unknown as Parameters<Spice["raw"]["mxm"]>[0];
    const rightMatrix = right as unknown as Parameters<Spice["raw"]["mxm"]>[1];

    return runtime.raw.mxm(leftMatrix, rightMatrix);
  },

  "coords-vectors.recgeo": ({ input, runtime }) => {
    const args = expectArgsArray(input, "coords-vectors.recgeo");
    expectExactArity(args, 3, "coords-vectors.recgeo");

    const [rect, re, f] = args;
    assertVec3(rect, "coords-vectors.recgeo args[0]");
    assertNumberArg(re, "coords-vectors.recgeo", 1);
    assertNumberArg(f, "coords-vectors.recgeo", 2);

    return runtime.raw.recgeo(rect, re, f);
  },

  "cells-windows.wninsd": ({ input, runtime }) => {
    const args = expectArgsArray(input, "cells-windows.wninsd");
    expectExactArity(args, 3, "cells-windows.wninsd");

    const [left, right, recipeArg] = args;
    assertNumberArg(left, "cells-windows.wninsd", 0);
    assertNumberArg(right, "cells-windows.wninsd", 1);

    const recipe = parseWindowRecipe(recipeArg, "cells-windows.wninsd", 2);
    const window = runtime.kit.newWindow(recipe.maxIntervals);

    try {
      runtime.raw.wninsd(left, right, window);
      const card = runtime.raw.wncard(window);
      const first = runtime.raw.wnfetd(window, 0);
      return { card, first };
    } finally {
      runtime.kit.freeWindow(window);
    }
  },

  "cells-windows.wnfetd": ({ input, runtime }) => {
    const args = expectArgsArray(input, "cells-windows.wnfetd");
    expectExactArity(args, 2, "cells-windows.wnfetd");

    const [recipeArg, index] = args;
    const recipe = parseWindowRecipe(recipeArg, "cells-windows.wnfetd", 0);
    assertIntegerArg(index, "cells-windows.wnfetd", 1);

    const window = runtime.kit.newWindow(recipe.maxIntervals);
    try {
      runtime.raw.wninsd(0, 1, window);
      runtime.raw.wninsd(2, 3, window);
      runtime.raw.wninsd(0.5, 2.5, window);
      return runtime.raw.wnfetd(window, index);
    } finally {
      runtime.kit.freeWindow(window);
    }
  },

  "kernel-pool.gcpool": ({ input, runtime }) => {
    const args = expectArgsArray(input, "kernel-pool.gcpool");
    expectExactArity(args, 3, "kernel-pool.gcpool");

    const [name, start, room] = args;
    assertStringArg(name, "kernel-pool.gcpool", 0);
    assertIntegerArg(start, "kernel-pool.gcpool", 1);
    assertIntegerArg(room, "kernel-pool.gcpool", 2);

    if (start < 0) {
      invalidArgs(`kernel-pool.gcpool expects args[1] to be >= 0 (got ${formatValue(start)})`);
    }

    if (room <= 0) {
      invalidArgs(`kernel-pool.gcpool expects args[2] to be > 0 (got ${formatValue(room)})`);
    }

    return runtime.raw.gcpool(name, start, room);
  },

  "kernels.furnsh": ({ input, runtime }) => {
    const args = expectArgsArray(input, "kernels.furnsh");
    expectExactArity(args, 1, "kernels.furnsh");

    const [source] = args;
    runtime.raw.furnsh(parseKernelSource(source, runtime));
    return null;
  },

  "kernels.ktotal": ({ input, runtime }) => {
    const args = expectArgsArray(input, "kernels.ktotal");
    if (args.length === 0) {
      return runtime.raw.ktotal();
    }

    expectExactArity(args, 1, "kernels.ktotal");
    return runtime.raw.ktotal(normalizeKernelKindQuery(args[0], "kernels.ktotal args[0]"));
  },

  "kernels.kdata": ({ input, runtime }) => {
    const args = expectArgsArray(input, "kernels.kdata");
    if (args.length < 1 || args.length > 2) {
      invalidArgs(`kernels.kdata expects 1 or 2 args (got ${args.length})`);
    }

    assertIntegerArg(args[0], "kernels.kdata", 0);

    const result =
      args.length === 1
        ? runtime.raw.kdata(args[0])
        : runtime.raw.kdata(args[0], normalizeKernelKindQuery(args[1], "kernels.kdata args[1]"));

    return rewriteWasmKdataPathIfNeeded(runtime, result);
  },

  "kernels.kxtrct": ({ input, runtime }) => {
    const args = expectArgsArray(input, "kernels.kxtrct");
    expectExactArity(args, 3, "kernels.kxtrct");

    const [keywd, terms, wordsq] = args;
    assertStringArg(keywd, "kernels.kxtrct", 0);
    assertStringArrayArg(terms, "kernels.kxtrct", 1);
    assertStringArg(wordsq, "kernels.kxtrct", 2);

    return runtime.raw.kxtrct(keywd, terms, wordsq);
  },

  "ek.ekfind": ({ input, runtime }) => {
    const args = expectArgsArray(input, "ek.ekfind");
    expectExactArity(args, 1, "ek.ekfind");

    const [query] = args;
    assertStringArg(query, "ek.ekfind", 0);

    return runtime.raw.ekfind(query);
  },

  "ek.ekgc": ({ input, runtime }) => {
    const args = expectArgsArray(input, "ek.ekgc");
    expectExactArity(args, 3, "ek.ekgc");

    const [selidx, row, elment] = args;
    assertNonNegativeIntArg(selidx, "ek.ekgc", 0);
    assertNonNegativeIntArg(row, "ek.ekgc", 1);
    assertNonNegativeIntArg(elment, "ek.ekgc", 2);

    return runtime.raw.ekgc(selidx, row, elment);
  },
};

/**
 * Canonical handoff boundary for generated dispatch.
 *
 * - non-promoted methods fail closed at the seam with stable markers
 * - promoted methods execute through the handwritten dispatch table
 */
export function handoffToGeneratedDispatchSeam(request: GeneratedDispatchRequest): unknown {
  if (!isPromotedGeneratedDispatchMethod(request.fn) || request.runtime === undefined) {
    throw generatedDispatchUnavailableError(request.lane, request.callId, request.fn);
  }

  const handler = dispatchHandlers[request.fn];
  return handler({
    ...request,
    fn: request.fn,
    runtime: request.runtime,
  });
}
