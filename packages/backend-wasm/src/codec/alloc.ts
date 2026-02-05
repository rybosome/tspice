import type { EmscriptenModule } from "../lowlevel/exports.js";

/** Default max byte size for error buffers passed into CSPICE wasm shims. */
export const WASM_ERR_MAX_BYTES = 2048;

export function mallocOrThrow(module: Pick<EmscriptenModule, "_malloc">, size: number): number {
  const ptr = module._malloc(size);
  if (!ptr) {
    throw new Error("WASM malloc failed");
  }
  return ptr;
}

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

export function withAllocs<T>(
  module: Pick<EmscriptenModule, "_malloc" | "_free">,
  sizes: readonly number[],
  fn: (...ptrs: number[]) => T,
): T {
  const ptrs: number[] = [];
  try {
    for (const size of sizes) {
      const ptr = module._malloc(size);
      if (!ptr) {
        throw new Error("WASM malloc failed");
      }
      ptrs.push(ptr);
    }
    return fn(...ptrs);
  } finally {
    for (let i = ptrs.length - 1; i >= 0; i--) {
      module._free(ptrs[i]!);
    }
  }
}

export function decodeWasmSpiceError(
  module: Pick<EmscriptenModule, "UTF8ToString">,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): string {
  const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
  return message || `CSPICE call failed with code ${code}`;
}
