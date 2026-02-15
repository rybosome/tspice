import type { Found } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs } from "./alloc.js";
import { throwWasmSpiceError } from "./errors.js";
import { writeUtf8CString } from "./strings.js";

/** Invoke a WASM function that follows the SPICE `found`-flag convention (int output + found flag). */
export function tspiceCallFoundInt(
  module: EmscriptenModule,
  fn: (argPtr: number, outIntPtr: number, foundPtr: number, errPtr: number, errMaxBytes: number) => number,
  arg: string,
): Found<{ value: number }> {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const argPtr = writeUtf8CString(module, arg);
  try {
    return withAllocs(module, [errMaxBytes, 4, 4], (errPtr, outPtr, foundPtr) => {
      module.HEAP32[outPtr >> 2] = 0;
      module.HEAP32[foundPtr >> 2] = 0;
      const result = fn(argPtr, outPtr, foundPtr, errPtr, errMaxBytes);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }
      const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
      if (!found) {
        return { found: false };
      }
      return { found: true, value: module.HEAP32[outPtr >> 2] ?? 0 };
    });
  } finally {
    module._free(argPtr);
  }
}

/** Invoke a WASM function that follows the SPICE `found`-flag convention (string output + found flag). */
export function tspiceCallFoundString(
  module: EmscriptenModule,
  fn: (
    code: number,
    outStrPtr: number,
    outStrMaxBytes: number,
    foundPtr: number,
    errPtr: number,
    errMaxBytes: number,
  ) => number,
  code: number,
): Found<{ value: string }> {
  const errMaxBytes = WASM_ERR_MAX_BYTES;
  const outMaxBytes = 256;

  return withAllocs(module, [errMaxBytes, outMaxBytes, 4], (errPtr, outPtr, foundPtr) => {
    module.HEAPU8[outPtr] = 0;
    module.HEAP32[foundPtr >> 2] = 0;
    const result = fn(code, outPtr, outMaxBytes, foundPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    const found = (module.HEAP32[foundPtr >> 2] ?? 0) !== 0;
    if (!found) {
      return { found: false };
    }
    return { found: true, value: module.UTF8ToString(outPtr, outMaxBytes).trim() };
  });
}
