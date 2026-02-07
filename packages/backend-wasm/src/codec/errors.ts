import type { EmscriptenModule } from "../lowlevel/exports.js";

import { decodeWasmSpiceError, WASM_ERR_MAX_BYTES, withMalloc } from "./alloc.js";

export type SpiceErrorFields = {
  spiceShort?: string;
  spiceLong?: string;
  spiceTrace?: string;
};

function readLastErrorField(
  module: Pick<
    EmscriptenModule,
    "_malloc" | "_free" | "HEAPU8" | "UTF8ToString" | "_tspice_get_last_error_short" | "_tspice_get_last_error_long" | "_tspice_get_last_error_trace"
  >,
  which: "short" | "long" | "trace",
): string | undefined {
  const outMaxBytes = WASM_ERR_MAX_BYTES;
  return withMalloc(module, outMaxBytes, (outPtr) => {
    module.HEAPU8[outPtr] = 0;
    if (which === "short") module._tspice_get_last_error_short(outPtr, outMaxBytes);
    if (which === "long") module._tspice_get_last_error_long(outPtr, outMaxBytes);
    if (which === "trace") module._tspice_get_last_error_trace(outPtr, outMaxBytes);
    const s = module.UTF8ToString(outPtr, outMaxBytes).trim();
    return s || undefined;
  });
}

export function throwWasmSpiceError(
  module: EmscriptenModule,
  errPtr: number,
  errMaxBytes: number,
  code: number,
): never {
  const message = decodeWasmSpiceError(module, errPtr, errMaxBytes, code);

  // Best-effort structured fields.
  const spiceShort = readLastErrorField(module, "short");
  const spiceLong = readLastErrorField(module, "long");
  const spiceTrace = readLastErrorField(module, "trace");

  const err = new Error(message) as Error & SpiceErrorFields;
  if (spiceShort) err.spiceShort = spiceShort;
  if (spiceLong) err.spiceLong = spiceLong;
  if (spiceTrace) err.spiceTrace = spiceTrace;

  throw err;
}
