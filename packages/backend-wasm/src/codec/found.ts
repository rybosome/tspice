import type { Found } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "./errors.js";
import { writeUtf8CString } from "./strings.js";

export function tspiceCallFoundInt(
  module: EmscriptenModule,
  fn: (argPtr: number, outIntPtr: number, foundPtr: number, errPtr: number, errMaxBytes: number) => number,
  arg: string,
): Found<{ value: number }> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const argPtr = writeUtf8CString(module, arg);
  const outPtr = module._malloc(4);
  const foundPtr = module._malloc(4);

  if (!errPtr || !argPtr || !outPtr || !foundPtr) {
    for (const ptr of [foundPtr, outPtr, argPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
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
  } finally {
    module._free(foundPtr);
    module._free(outPtr);
    module._free(argPtr);
    module._free(errPtr);
  }
}

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
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outMaxBytes = 256;
  const outPtr = module._malloc(outMaxBytes);
  const foundPtr = module._malloc(4);

  if (!errPtr || !outPtr || !foundPtr) {
    for (const ptr of [foundPtr, outPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
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
  } finally {
    module._free(foundPtr);
    module._free(outPtr);
    module._free(errPtr);
  }
}
