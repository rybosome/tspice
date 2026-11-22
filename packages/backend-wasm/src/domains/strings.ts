import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  snapshotSearchRows,
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

function searchPosition(
  module: EmscriptenModule,
  text: string,
  needle: string,
  start: number,
  call: EmscriptenModule["_tspice_cpos"],
): number {
  const textBytes = spiceStringByteLength(
    text,
    "search text",
    WASM_MAX_ALLOC_BYTES - 1,
  );
  const needleBytes = spiceStringByteLength(
    needle,
    "search argument",
    WASM_MAX_ALLOC_BYTES - 1,
  );
  assertSpiceInt32(start, "search start");
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, textBytes + 1, needleBytes + 1, 4],
    (err, textPtr, needlePtr, out) => {
      writeString(module, textPtr, text, textBytes);
      writeString(module, needlePtr, needle, needleBytes);
      const status = call(
        textPtr,
        needlePtr,
        start,
        out,
        err,
        WASM_ERR_MAX_BYTES,
      );
      if (status !== 0)
        throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
      return module.HEAP32[out >>> 2]!;
    },
  );
}

/** Create the raw string API backed by the WASM CSPICE module. */
export function createStringsApi(module: EmscriptenModule): StringsApi {
  return {
    cpos: (text, chars, start) =>
      searchPosition(module, text, chars, start, module._tspice_cpos),
    cposr: (text, chars, start) =>
      searchPosition(module, text, chars, start, module._tspice_cposr),
    ncpos: (text, chars, start) =>
      searchPosition(module, text, chars, start, module._tspice_ncpos),
    ncposr: (text, chars, start) =>
      searchPosition(module, text, chars, start, module._tspice_ncposr),
    pos: (text, substr, start) =>
      searchPosition(module, text, substr, start, module._tspice_pos),
    posr: (text, substr, start) =>
      searchPosition(module, text, substr, start, module._tspice_posr),
    esrchc: (value, values) => {
      const bytes = spiceStringByteLength(
        value,
        "esrchc(value)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const { rows, width } = snapshotSearchRows(values, WASM_MAX_ALLOC_BYTES);
      const size = Math.max(1, rows.length * width);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1, size, 4],
        (err, key, table, out) => {
          writeString(module, key, value, bytes);
          const offset = table >>> 0;
          const buffer = module.HEAPU8.subarray(offset, offset + size);
          buffer.fill(0);
          for (let i = 0; i < rows.length; i++) {
            const begin = i * width;
            encoder.encodeInto(
              rows[i]!,
              buffer.subarray(begin, begin + width - 1),
            );
          }
          const status = module._tspice_esrchc(
            key,
            rows.length,
            width,
            table,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return module.HEAP32[out >>> 2]!;
        },
      );
    },
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
