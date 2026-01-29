import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "./errors.js";
import { writeUtf8CString } from "./strings.js";

export function tspiceCall0(
  module: EmscriptenModule,
  fn: (errPtr: number, errMaxBytes: number) => number,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  if (!errPtr) {
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(errPtr);
  }
}

export function tspiceCall1Path(
  module: EmscriptenModule,
  fn: (pathPtr: number, errPtr: number, errMaxBytes: number) => number,
  path: string,
): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const pathPtr = writeUtf8CString(module, path);

  if (!errPtr || !pathPtr) {
    if (errPtr) module._free(errPtr);
    if (pathPtr) module._free(pathPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    const result = fn(pathPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(pathPtr);
    module._free(errPtr);
  }
}
