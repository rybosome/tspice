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

function tspiceCallDeltet(module: EmscriptenModule, epoch: number, eptype: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const eptypePtr = writeUtf8CString(module, eptype);
  const outDeltaPtr = module._malloc(8);

  if (!errPtr || !eptypePtr || !outDeltaPtr) {
    for (const ptr of [outDeltaPtr, eptypePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outDeltaPtr >> 3] = 0;
    const result = module._tspice_deltet(epoch, eptypePtr, outDeltaPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outDeltaPtr >> 3] ?? 0;
  } finally {
    module._free(outDeltaPtr);
    module._free(eptypePtr);
    module._free(errPtr);
  }
}

function tspiceCallUnitim(
  module: EmscriptenModule,
  epoch: number,
  insys: string,
  outsys: string,
): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const insysPtr = writeUtf8CString(module, insys);
  const outsysPtr = writeUtf8CString(module, outsys);
  const outEpochPtr = module._malloc(8);

  if (!errPtr || !insysPtr || !outsysPtr || !outEpochPtr) {
    for (const ptr of [outEpochPtr, outsysPtr, insysPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEpochPtr >> 3] = 0;
    const result = module._tspice_unitim(epoch, insysPtr, outsysPtr, outEpochPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEpochPtr >> 3] ?? 0;
  } finally {
    module._free(outEpochPtr);
    module._free(outsysPtr);
    module._free(insysPtr);
    module._free(errPtr);
  }
}

function tspiceCallTparse(module: EmscriptenModule, timstr: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const timstrPtr = writeUtf8CString(module, timstr);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !timstrPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, timstrPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_tparse(timstrPtr, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(timstrPtr);
    module._free(errPtr);
  }
}

function tspiceCallTpictr(module: EmscriptenModule, sample: string, picturIn: string): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const samplePtr = writeUtf8CString(module, sample);
  const picturInPtr = writeUtf8CString(module, picturIn);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !samplePtr || !picturInPtr || !outPtr) {
    for (const ptr of [outPtr, picturInPtr, samplePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_tpictr(samplePtr, picturInPtr, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(picturInPtr);
    module._free(samplePtr);
    module._free(errPtr);
  }
}


function tspiceCallTimdefGet(module: EmscriptenModule, item: string): string {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const itemPtr = writeUtf8CString(module, item);

  // Buffer size includes terminating NUL.
  const outMaxBytes = 2048;
  const outPtr = module._malloc(outMaxBytes);

  if (!errPtr || !itemPtr || !outPtr) {
    for (const ptr of [outPtr, itemPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_timdef_get(itemPtr, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(itemPtr);
    module._free(errPtr);
  }
}

function tspiceCallTimdefSet(module: EmscriptenModule, item: string, value: string): void {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const itemPtr = writeUtf8CString(module, item);
  const valuePtr = writeUtf8CString(module, value);

  if (!errPtr || !itemPtr || !valuePtr) {
    for (const ptr of [valuePtr, itemPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    const result = module._tspice_timdef_set(itemPtr, valuePtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
  } finally {
    module._free(valuePtr);
    module._free(itemPtr);
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

function tspiceCallScencd(module: EmscriptenModule, sc: number, sclkch: string): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const sclkchPtr = writeUtf8CString(module, sclkch);
  const outSclkdpPtr = module._malloc(8);

  if (!errPtr || !sclkchPtr || !outSclkdpPtr) {
    for (const ptr of [outSclkdpPtr, sclkchPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outSclkdpPtr >> 3] = 0;
    const result = module._tspice_scencd(sc, sclkchPtr, outSclkdpPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outSclkdpPtr >> 3] ?? 0;
  } finally {
    module._free(outSclkdpPtr);
    module._free(sclkchPtr);
    module._free(errPtr);
  }
}

function tspiceCallScdecd(module: EmscriptenModule, sc: number, sclkdp: number): string {
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
    const result = module._tspice_scdecd(sc, sclkdp, outPtr, outMaxBytes, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trim();
  } finally {
    module._free(outPtr);
    module._free(errPtr);
  }
}

function tspiceCallSct2e(module: EmscriptenModule, sc: number, sclkdp: number): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outEtPtr = module._malloc(8);

  if (!errPtr || !outEtPtr) {
    for (const ptr of [outEtPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_sct2e(sc, sclkdp, outEtPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  } finally {
    module._free(outEtPtr);
    module._free(errPtr);
  }
}

function tspiceCallSce2c(module: EmscriptenModule, sc: number, et: number): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const outSclkdpPtr = module._malloc(8);

  if (!errPtr || !outSclkdpPtr) {
    for (const ptr of [outSclkdpPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outSclkdpPtr >> 3] = 0;
    const result = module._tspice_sce2c(sc, et, outSclkdpPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }
    return module.HEAPF64[outSclkdpPtr >> 3] ?? 0;
  } finally {
    module._free(outSclkdpPtr);
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

    timdef: (() => {
      function timdef(action: "GET", item: string): string;
      function timdef(action: "SET", item: string, value: string): void;
      function timdef(action: "GET" | "SET", item: string, value?: string): string | void {
        if (action === "GET") {
          return tspiceCallTimdefGet(module, item);
        }

        if (action === "SET") {
          if (typeof value !== "string") {
            throw new TypeError("timdef(SET) requires a string value");
          }
          tspiceCallTimdefSet(module, item, value);
          return;
        }

        throw new Error(`Unsupported timdef action: ${action}`);
      }

      return timdef;
    })(),

    str2et: (utc) => tspiceCallStr2et(module, utc),
    et2utc: (et, format, prec) => tspiceCallEt2utc(module, et, format, prec),
    timout: (et, picture) => tspiceCallTimout(module, et, picture),

    deltet: (epoch, eptype) => tspiceCallDeltet(module, epoch, eptype),
    unitim: (epoch, insys, outsys) => tspiceCallUnitim(module, epoch, insys, outsys),

    tparse: (timstr) => tspiceCallTparse(module, timstr),
    tpictr: (sample, pictur) => tspiceCallTpictr(module, sample, pictur),

    scs2e: (sc, sclkch) => tspiceCallScs2e(module, sc, sclkch),
    sce2s: (sc, et) => tspiceCallSce2s(module, sc, et),

    scencd: (sc, sclkch) => tspiceCallScencd(module, sc, sclkch),
    scdecd: (sc, sclkdp) => tspiceCallScdecd(module, sc, sclkdp),
    sct2e: (sc, sclkdp) => tspiceCallSct2e(module, sc, sclkdp),
    sce2c: (sc, et) => tspiceCallSce2c(module, sc, et),
  };
}
