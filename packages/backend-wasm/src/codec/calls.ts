import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withMalloc } from "./alloc.js";
import { throwWasmSpiceError } from "./errors.js";
import { writeUtf8CString } from "./strings.js";

/** Invoke a WASM-exported function that only returns an error code (no input args). */
export function tspiceCall0(
  module: EmscriptenModule,
  fn: (errPtr: number, errMaxBytes: number) => number,
): void {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  withMalloc(module, errMaxBytes, (errPtr) => {
    const result = fn(errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  });
}

/** Invoke a WASM-exported function that takes a single path string and returns an error code. */
export function tspiceCall1Path(
  module: EmscriptenModule,
  fn: (pathPtr: number, errPtr: number, errMaxBytes: number) => number,
  path: string,
): void {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const pathPtr = writeUtf8CString(module, path);
  try {
    withMalloc(module, errMaxBytes, (errPtr) => {
      const result = fn(pathPtr, errPtr, errMaxBytes);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }
    });
  } finally {
    module._free(pathPtr);
  }
}
