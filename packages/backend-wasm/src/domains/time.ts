import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { assertNever } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";

/**
 * Max byte size for string outputs from CSPICE time calls (`et2utc_c`, `timout_c`).
 *
 * This intentionally differs from `WASM_ERR_MAX_BYTES`:
 * - time formatting outputs can be much larger than error messages (esp. with long TIMOUT pictures)
 * - we want a stable, explicit cap for output allocations
 */
const WASM_TIME_OUT_MAX_BYTES = 16 * 1024; // 16 KiB

const WASM_TIME_SMALL_OUT_MAX_BYTES = 2048;

/** Max byte size for SCLK string outputs (sce2s/scdecd). */
const WASM_SCLK_OUT_MAX_BYTES = 2048;

function withUtf8CString<T>(
  module: EmscriptenModule,
  value: string,
  fn: (ptr: number) => T,
): T {
  const ptr = writeUtf8CString(module, value);
  try {
    return fn(ptr);
  } finally {
    module._free(ptr);
  }
}

function tspiceCallStr2et(module: EmscriptenModule, utc: string): number {
  return withUtf8CString(module, utc, (utcPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outEtPtr) => {
      module.HEAPF64[outEtPtr >> 3] = 0;
      const result = module._tspice_str2et(utcPtr, outEtPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.HEAPF64[outEtPtr >> 3] ?? 0;
    });
  });
}

function tspiceCallEt2utc(
  module: EmscriptenModule,
  et: number,
  format: string,
  prec: number,
): string {
  const outMaxBytes = WASM_TIME_OUT_MAX_BYTES;

  return withUtf8CString(module, format, (formatPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
      module.HEAPU8[outPtr] = 0;
      const result = module._tspice_et2utc(
        et,
        formatPtr,
        prec,
        outPtr,
        outMaxBytes,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return readFixedWidthCString(module, outPtr, outMaxBytes);
    });
  });
}

function tspiceCallTimout(module: EmscriptenModule, et: number, picture: string): string {
  const outMaxBytes = WASM_TIME_OUT_MAX_BYTES;

  return withUtf8CString(module, picture, (picturePtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
      module.HEAPU8[outPtr] = 0;
      const result = module._tspice_timout(
        et,
        picturePtr,
        outPtr,
        outMaxBytes,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return readFixedWidthCString(module, outPtr, outMaxBytes);
    });
  });
}

function tspiceCallDeltet(module: EmscriptenModule, epoch: number, eptype: string): number {
  return withUtf8CString(module, eptype, (eptypePtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outDeltaPtr) => {
      module.HEAPF64[outDeltaPtr >> 3] = 0;
      const result = module._tspice_deltet(epoch, eptypePtr, outDeltaPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.HEAPF64[outDeltaPtr >> 3] ?? 0;
    });
  });
}

function tspiceCallUnitim(
  module: EmscriptenModule,
  epoch: number,
  insys: string,
  outsys: string,
): number {
  return withUtf8CString(module, insys, (insysPtr) => {
    return withUtf8CString(module, outsys, (outsysPtr) => {
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outEpochPtr) => {
        module.HEAPF64[outEpochPtr >> 3] = 0;
        const result = module._tspice_unitim(
          epoch,
          insysPtr,
          outsysPtr,
          outEpochPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
        return module.HEAPF64[outEpochPtr >> 3] ?? 0;
      });
    });
  });
}

function tspiceCallTparse(module: EmscriptenModule, timstr: string): number {
  return withUtf8CString(module, timstr, (timstrPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outEtPtr) => {
      module.HEAPF64[outEtPtr >> 3] = 0;
      const result = module._tspice_tparse(timstrPtr, outEtPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.HEAPF64[outEtPtr >> 3] ?? 0;
    });
  });
}

function tspiceCallTpictr(module: EmscriptenModule, sample: string, picturIn: string): string {
  const outMaxBytes = WASM_TIME_OUT_MAX_BYTES;

  return withUtf8CString(module, sample, (samplePtr) => {
    return withUtf8CString(module, picturIn, (picturInPtr) => {
      return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
        module.HEAPU8[outPtr] = 0;
        const result = module._tspice_tpictr(
          samplePtr,
          picturInPtr,
          outPtr,
          outMaxBytes,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
        return readFixedWidthCString(module, outPtr, outMaxBytes);
      });
    });
  });
}

function tspiceCallTimdefGet(module: EmscriptenModule, item: string): string {
  const outMaxBytes = WASM_TIME_SMALL_OUT_MAX_BYTES;

  return withUtf8CString(module, item, (itemPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
      module.HEAPU8[outPtr] = 0;
      const result = module._tspice_timdef_get(itemPtr, outPtr, outMaxBytes, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return readFixedWidthCString(module, outPtr, outMaxBytes);
    });
  });
}

function tspiceCallTimdefSet(module: EmscriptenModule, item: string, value: string): void {
  withUtf8CString(module, item, (itemPtr) => {
    withUtf8CString(module, value, (valuePtr) => {
      withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
        const result = module._tspice_timdef_set(itemPtr, valuePtr, errPtr, WASM_ERR_MAX_BYTES);
        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }
      });
    });
  });
}

function tspiceCallScs2e(module: EmscriptenModule, sc: number, sclkch: string): number {
  return withUtf8CString(module, sclkch, (sclkchPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outEtPtr) => {
      module.HEAPF64[outEtPtr >> 3] = 0;
      const result = module._tspice_scs2e(sc, sclkchPtr, outEtPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.HEAPF64[outEtPtr >> 3] ?? 0;
    });
  });
}

function tspiceCallSce2s(module: EmscriptenModule, sc: number, et: number): string {
  const outMaxBytes = WASM_SCLK_OUT_MAX_BYTES;

  return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_sce2s(sc, et, outPtr, outMaxBytes, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return readFixedWidthCString(module, outPtr, outMaxBytes);
  });
}

function tspiceCallScencd(module: EmscriptenModule, sc: number, sclkch: string): number {
  return withUtf8CString(module, sclkch, (sclkchPtr) => {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outSclkdpPtr) => {
      module.HEAPF64[outSclkdpPtr >> 3] = 0;
      const result = module._tspice_scencd(sc, sclkchPtr, outSclkdpPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.HEAPF64[outSclkdpPtr >> 3] ?? 0;
    });
  });
}

function tspiceCallScdecd(module: EmscriptenModule, sc: number, sclkdp: number): string {
  const outMaxBytes = WASM_SCLK_OUT_MAX_BYTES;

  return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_scdecd(sc, sclkdp, outPtr, outMaxBytes, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return readFixedWidthCString(module, outPtr, outMaxBytes);
  });
}

function tspiceCallSct2e(module: EmscriptenModule, sc: number, sclkdp: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outEtPtr) => {
    module.HEAPF64[outEtPtr >> 3] = 0;
    const result = module._tspice_sct2e(sc, sclkdp, outEtPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAPF64[outEtPtr >> 3] ?? 0;
  });
}

function tspiceCallSce2c(module: EmscriptenModule, sc: number, et: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outSclkdpPtr) => {
    module.HEAPF64[outSclkdpPtr >> 3] = 0;
    const result = module._tspice_sce2c(sc, et, outSclkdpPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAPF64[outSclkdpPtr >> 3] ?? 0;
  });
}

/** Read the embedded CSPICE toolkit version string from the WASM module. */
export function getToolkitVersion(module: EmscriptenModule): string {
  const outMaxBytes = 256;
  return withAllocs(module, [outMaxBytes, WASM_ERR_MAX_BYTES], (outPtr, errPtr) => {
    const result = module._tspice_tkvrsn_toolkit(outPtr, outMaxBytes, errPtr, WASM_ERR_MAX_BYTES);

    if (result !== 0) {
      const message = module.UTF8ToString(errPtr, WASM_ERR_MAX_BYTES).trim();
      throw new Error(message || `CSPICE call failed with code ${result}`);
    }

    return module.UTF8ToString(outPtr, outMaxBytes);
  });
}

/** Create a {@link TimeApi} implementation backed by a WASM Emscripten module. */
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
        if (item.length === 0) {
          throw new RangeError("timdef(): item must be a non-empty string");
        }

        switch (action) {
          case "GET": {
            return tspiceCallTimdefGet(module, item);
          }

          case "SET": {
            if (typeof value !== "string") {
              throw new TypeError("timdef(SET) requires a string value");
            }
            if (value.length === 0) {
              throw new RangeError("timdef(SET)(): value must be a non-empty string");
            }
            tspiceCallTimdefSet(module, item, value);
            return;
          }

          default:
            return assertNever(action, "Unsupported timdef action");
        }
      }

      return timdef;
    })(),

    str2et: (utc) => tspiceCallStr2et(module, utc),
    et2utc: (et, format, prec) => tspiceCallEt2utc(module, et, format, prec),
    timout: (et, picture) => tspiceCallTimout(module, et, picture),

    deltet: (epoch, eptype) => tspiceCallDeltet(module, epoch, eptype),
    unitim: (epoch, insys, outsys) => tspiceCallUnitim(module, epoch, insys, outsys),

    tparse: (timstr) => {
      if (timstr.length === 0) {
        throw new RangeError("tparse(): timstr must be a non-empty string");
      }
      return tspiceCallTparse(module, timstr);
    },
    tpictr: (sample, pictur) => {
      if (sample.length === 0) {
        throw new RangeError("tpictr(): sample must be a non-empty string");
      }
      if (pictur.length === 0) {
        throw new RangeError("tpictr(): pictur must be a non-empty string");
      }
      return tspiceCallTpictr(module, sample, pictur);
    },

    scs2e: (sc, sclkch) => tspiceCallScs2e(module, sc, sclkch),
    sce2s: (sc, et) => tspiceCallSce2s(module, sc, et),

    scencd: (sc, sclkch) => tspiceCallScencd(module, sc, sclkch),
    scdecd: (sc, sclkdp) => tspiceCallScdecd(module, sc, sclkdp),
    sct2e: (sc, sclkdp) => tspiceCallSct2e(module, sc, sclkdp),
    sce2c: (sc, et) => tspiceCallSce2c(module, sc, et),
  };
}
