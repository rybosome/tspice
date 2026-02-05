import type { EmscriptenModule } from "../lowlevel/exports.js";

import { decodeWasmSpiceError } from "./alloc.js";

export function throwWasmSpiceError(
  module: EmscriptenModule,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): never {
  throw new Error(decodeWasmSpiceError(module, errPtr, errMaxBytes, code));
}
