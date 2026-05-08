import { formatGot } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

/** Default max byte size for error buffers passed into CSPICE wasm shims. */
export const WASM_ERR_MAX_BYTES = 2048;

/**
 * Maximum allocation size (bytes) we'll attempt in codec helpers.
 *
 * This is a guardrail against pathological values (NaN/Infinity/huge numbers)
 * accidentally flowing into `_malloc()`.
 */
export const WASM_MAX_ALLOC_BYTES = 256 * 1024 * 1024; // 256 MiB

function formatInvalidMallocSize(expected: string, got: unknown): string {
  return `Invalid WASM malloc size. Expected: ${expected}. Got: ${formatGot(got)}`;
}

function assertValidMallocSize(size: number): void {
  if (typeof size !== "number") {
    throw new TypeError(formatInvalidMallocSize("a number", size));
  }
  if (!Number.isFinite(size)) {
    throw new RangeError(formatInvalidMallocSize("a finite number", size));
  }
  if (!Number.isSafeInteger(size)) {
    throw new TypeError(formatInvalidMallocSize("a safe integer", size));
  }
  if (size <= 0) {
    throw new RangeError(formatInvalidMallocSize("> 0", size));
  }
  if (size > WASM_MAX_ALLOC_BYTES) {
    throw new RangeError(formatInvalidMallocSize(`<= ${WASM_MAX_ALLOC_BYTES}`, size));
  }
}

/** Allocate WASM memory via `_malloc` with validation and a hard max size guard. */
export function mallocOrThrow(module: Pick<EmscriptenModule, "_malloc">, size: number): number {
  assertValidMallocSize(size);
  const ptr = module._malloc(size);
  if (!ptr) {
    throw new Error("WASM malloc failed");
  }
  return ptr;
}

/** Allocate a pointer, run `fn`, and always `_free` the pointer. */
export function withMalloc<T>(
  module: Pick<EmscriptenModule, "_malloc" | "_free">,
  size: number,
  fn: (ptr: number) => T,
): T {
  const ptr = mallocOrThrow(module, size);
  try {
    return fn(ptr);
  } finally {
    module._free(ptr);
  }
}

/** Allocate multiple pointers, run `fn`, and always `_free` all pointers (reverse order). */
export function withAllocs<T>(
  module: Pick<EmscriptenModule, "_malloc" | "_free">,
  sizes: readonly number[],
  fn: (...ptrs: number[]) => T,
): T {
  const ptrs: number[] = [];
  try {
    for (const size of sizes) {
      const ptr = mallocOrThrow(module, size);
      ptrs.push(ptr);
    }
    return fn(...ptrs);
  } finally {
    for (let i = ptrs.length - 1; i >= 0; i--) {
      module._free(ptrs[i]!);
    }
  }
}

/** Decode a CSPICE error message written into a UTF-8 buffer (fallbacks to code). */
export function decodeWasmSpiceError(
  module: Pick<EmscriptenModule, "UTF8ToString">,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): string {
  const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
  return message || `CSPICE call failed with code ${code}`;
}
