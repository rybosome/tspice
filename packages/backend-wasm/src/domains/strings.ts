import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  spiceStringByteLength,
  spiceStringOutputCapacity,
} from "@rybosome/tspice-core";
import {
  withAllocs,
  WASM_ERR_MAX_BYTES,
  WASM_MAX_ALLOC_BYTES,
} from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import type { EmscriptenModule } from "../lowlevel/exports.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

function writeString(
  module: EmscriptenModule,
  ptr: number,
  text: string,
  bytes: number,
): void {
  const start = ptr >>> 0;
  // Write into this allocation only. Fetch HEAPU8 after all allocations.
  encoder.encodeInto(text, module.HEAPU8.subarray(start, start + bytes));
  module.HEAPU8[start + bytes] = 0;
}

function readString(
  module: EmscriptenModule,
  ptr: number,
  capacity: number,
): string {
  const start = ptr >>> 0;
  const bytes = module.HEAPU8.subarray(start, start + capacity);
  const end = bytes.indexOf(0);
  if (end < 0) throw new Error("CSPICE string result has no NUL terminator");
  try {
    return decoder.decode(bytes.subarray(0, end));
  } catch {
    throw new TypeError("CSPICE string result is not valid UTF-8");
  }
}

/** Create the raw string API backed by the WASM CSPICE module. */
export function createStringsApi(module: EmscriptenModule): StringsApi {
  return {
    cmprss: (delim, n, input, lenout) => {
      const delimByte = spiceAsciiChar(delim, "cmprss(delim)");
      assertSpiceInt32(n, "cmprss(n)");
      const inputBytes = spiceStringByteLength(
        input,
        "cmprss(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const capacity = spiceStringOutputCapacity(inputBytes, 1, lenout);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, Math.max(1, capacity)],
        (errPtr, inputPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_cmprss(
            delimByte,
            n,
            inputPtr,
            capacity,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return readString(module, outPtr, capacity);
        },
      );
    },
    eqstr: (a, b) => {
      const aBytes = spiceStringByteLength(
        a,
        "eqstr(a)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const bBytes = spiceStringByteLength(
        b,
        "eqstr(b)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, aBytes + 1, bBytes + 1, 4],
        (errPtr, aPtr, bPtr, outPtr) => {
          writeString(module, aPtr, a, aBytes);
          writeString(module, bPtr, b, bBytes);
          const status = module._tspice_eqstr(
            aPtr,
            bPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2] !== 0;
        },
      );
    },
    iswhsp: (input) => {
      const inputBytes = spiceStringByteLength(
        input,
        "iswhsp(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 4],
        (errPtr, inputPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_iswhsp(
            inputPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2] !== 0;
        },
      );
    },
    lastnb: (input) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lastnb(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 4],
        (errPtr, inputPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lastnb(
            inputPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2]!;
        },
      );
    },
    lcase: (input, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lcase(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const capacity = spiceStringOutputCapacity(inputBytes, 2, lenout);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, Math.max(1, capacity)],
        (errPtr, inputPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lcase(
            inputPtr,
            capacity,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return readString(module, outPtr, capacity);
        },
      );
    },
    ucase: (input, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "ucase(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const capacity = spiceStringOutputCapacity(inputBytes, 2, lenout);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, Math.max(1, capacity)],
        (errPtr, inputPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_ucase(
            inputPtr,
            capacity,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return readString(module, outPtr, capacity);
        },
      );
    },
    matchi: (input, templ, wstr, wchr) => {
      const inputBytes = spiceStringByteLength(
        input,
        "matchi(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const templBytes = spiceStringByteLength(
        templ,
        "matchi(templ)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const wstrByte = spiceAsciiChar(wstr, "matchi(wstr)");
      const wchrByte = spiceAsciiChar(wchr, "matchi(wchr)");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, templBytes + 1, 4],
        (errPtr, inputPtr, templPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, templPtr, templ, templBytes);
          const status = module._tspice_matchi(
            inputPtr,
            templPtr,
            wstrByte,
            wchrByte,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2] !== 0;
        },
      );
    },
    matchw: (input, templ, wstr, wchr) => {
      const inputBytes = spiceStringByteLength(
        input,
        "matchw(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const templBytes = spiceStringByteLength(
        templ,
        "matchw(templ)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const wstrByte = spiceAsciiChar(wstr, "matchw(wstr)");
      const wchrByte = spiceAsciiChar(wchr, "matchw(wchr)");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, templBytes + 1, 4],
        (errPtr, inputPtr, templPtr, outPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, templPtr, templ, templBytes);
          const status = module._tspice_matchw(
            inputPtr,
            templPtr,
            wstrByte,
            wchrByte,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[outPtr >>> 2] !== 0;
        },
      );
    },
  };
}
