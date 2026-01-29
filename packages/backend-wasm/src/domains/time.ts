import type { TimeApi } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

function tspiceCallStr2et(module: EmscriptenModule, utc: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const utcPtr = writeUtf8CString(module, utc);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !utcPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, utcPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_str2et(utcPtr, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(utcPtr);
    module._free(errPtr);
  }
}

function tspiceCallEt2utc(
  module: EmscriptenModule,
  et: number,
  format: string,
  prec: number,
): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const formatPtr = writeUtf8CString(module, format);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !formatPtr || !outPtr) {
    for (const ptr of [outPtr, formatPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_et2utc(et, formatPtr, prec, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(formatPtr);
    module._free(errPtr);
  }
}

function tspiceCallTimout(module: EmscriptenModule, et: number, picture: string): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const picturePtr = writeUtf8CString(module, picture);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !picturePtr || !outPtr) {
    for (const ptr of [outPtr, picturePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_timout(et, picturePtr, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(picturePtr);
    module._free(errPtr);
  }
}

function tspiceCallScs2e(module: EmscriptenModule, sc: number, sclkch: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const sclkchPtr = writeUtf8CString(module, sclkch);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !sclkchPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, sclkchPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_scs2e(sc, sclkchPtr, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(sclkchPtr);
    module._free(errPtr);
  }
}

function tspiceCallSce2s(module: EmscriptenModule, sc: number, et: number): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !outPtr) {
    for (const ptr of [outPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_sce2s(sc, et, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(errPtr);
  }
}

export function getToolkitVersion(module: EmscriptenModule): string {
  const outMaxBytes = 256;
  const errMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);
  const errPtr = module._malloc(errMaxBytes);

  if (!outPtr || !errPtr) {
    if (errPtr) {
      module._free(errPtr);
    }
    if (outPtr) {
      module._free(outPtr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_tkvrsn_toolkit(outPtr, outMaxBytes, errPtr, errMaxBytes);

    if (result !== 0) {
      const message = module.UTF8ToString(errPtr, errMaxBytes).trim();
      throw new Error(message || `CSPICE call failed with code ${result}`);
    }

    return module.UTF8ToString(outPtr, outMaxBytes);
  } finally {
    module._free(errPtr);
    module._free(outPtr);
  }
}

export function createTimeApi(module: EmscriptenModule, toolkitVersion: string): TimeApi {
  return {
    spiceVersion: () => toolkitVersion,
    tkvrsn: (item) => {
      if (item !== "TOOLKIT") {
        throw new Error(`Unsupported tkvrsn item: ${item}`);
      }
      return toolkitVersion;
    },

    str2et: (utc) => tspiceCallStr2et(module, utc),
    et2utc: (et, format, prec) => tspiceCallEt2utc(module, et, format, prec),
    timout: (et, picture) => tspiceCallTimout(module, et, picture),

    scs2e: (sc, sclkch) => tspiceCallScs2e(module, sc, sclkch),
    sce2s: (sc, et) => tspiceCallSce2s(module, sc, et),
  };
}
