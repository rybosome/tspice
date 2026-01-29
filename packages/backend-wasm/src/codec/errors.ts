import type { EmscriptenModule } from "../lowlevel/exports.js";

export function throwWasmSpiceError(
  module: EmscriptenModule,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): never {
  const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
  throw new Error(message || `CSPICE call failed with code ${code}`);
}
