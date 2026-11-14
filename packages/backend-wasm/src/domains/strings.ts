import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  spiceAsciiChar,
  spiceStringByteLength,
  spiceStringOutputCapacity,
  spiceTokenTable,
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
    nextwd: (input, nexlen, reslen) => {
      const inputBytes = spiceStringByteLength(
        input,
        "nextwd(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const nextCap = spiceStringOutputCapacity(inputBytes, 2, nexlen);
      const restCap = spiceStringOutputCapacity(inputBytes, 2, reslen);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          Math.max(1, nextCap),
          Math.max(1, restCap),
        ],
        (errPtr, inputPtr, nextPtr, restPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_nextwd(
            inputPtr,
            nextCap,
            restCap,
            nextPtr,
            restPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            next: readString(module, nextPtr, nextCap),
            rest: readString(module, restPtr, restCap),
          };
        },
      );
    },
    nthwd: (input, nth, worlen) => {
      const inputBytes = spiceStringByteLength(
        input,
        "nthwd(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(nth, "nth");
      const wordCap = spiceStringOutputCapacity(inputBytes, 2, worlen);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, Math.max(1, wordCap), 4],
        (errPtr, inputPtr, wordPtr, locPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_nthwd(
            inputPtr,
            nth,
            wordCap,
            wordPtr,
            locPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            word: readString(module, wordPtr, wordCap),
            loc: module.HEAP32[locPtr >>> 2]!,
          };
        },
      );
    },
    lparse: (list, delim, nmax, itemln) => {
      const inputBytes = spiceStringByteLength(
        list,
        "lparse(list)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const delimiterBytes = spiceStringByteLength(
        delim,
        "lparse(delim)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const table = spiceTokenTable(inputBytes, nmax, itemln);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          delimiterBytes + 1,
          4,
          table.bytes,
        ],
        (errPtr, inputPtr, delimiterPtr, countPtr, itemsPtr) => {
          writeString(module, inputPtr, list, inputBytes);
          writeString(module, delimiterPtr, delim, delimiterBytes);
          const status = module._tspice_lparse(
            inputPtr,
            delimiterPtr,
            table.count,
            table.width,
            countPtr,
            itemsPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const n = module.HEAP32[countPtr >>> 2]!;
          if (n < 0 || n > Math.max(0, table.count))
            throw new Error("Invalid returned token count");
          const items = Array.from({ length: n }, (_, i) =>
            readString(module, itemsPtr + i * table.width, table.width),
          );
          return { n, items };
        },
      );
    },
    lparsm: (list, delims, nmax, itemln) => {
      const inputBytes = spiceStringByteLength(
        list,
        "lparsm(list)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const delimiterBytes = spiceStringByteLength(
        delims,
        "lparsm(delims)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const table = spiceTokenTable(inputBytes, nmax, itemln);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          delimiterBytes + 1,
          4,
          table.bytes,
        ],
        (errPtr, inputPtr, delimiterPtr, countPtr, itemsPtr) => {
          writeString(module, inputPtr, list, inputBytes);
          writeString(module, delimiterPtr, delims, delimiterBytes);
          const status = module._tspice_lparsm(
            inputPtr,
            delimiterPtr,
            table.count,
            table.width,
            countPtr,
            itemsPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const n = module.HEAP32[countPtr >>> 2]!;
          if (n < 0 || n > Math.max(0, table.count))
            throw new Error("Invalid returned token count");
          const items = Array.from({ length: n }, (_, i) =>
            readString(module, itemsPtr + i * table.width, table.width),
          );
          return { n, items };
        },
      );
    },
    lx4dec: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4dec(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(first, "first");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4],
        (errPtr, inputPtr, lastPtr, ncharPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lx4dec(
            inputPtr,
            first,
            lastPtr,
            ncharPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            last: module.HEAPF64[lastPtr >>> 3]!,
            nchar: module.HEAP32[ncharPtr >>> 2]!,
          };
        },
      );
    },
    lx4num: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4num(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(first, "first");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4],
        (errPtr, inputPtr, lastPtr, ncharPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lx4num(
            inputPtr,
            first,
            lastPtr,
            ncharPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            last: module.HEAPF64[lastPtr >>> 3]!,
            nchar: module.HEAP32[ncharPtr >>> 2]!,
          };
        },
      );
    },
    lx4sgn: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4sgn(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(first, "first");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4],
        (errPtr, inputPtr, lastPtr, ncharPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lx4sgn(
            inputPtr,
            first,
            lastPtr,
            ncharPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            last: module.HEAPF64[lastPtr >>> 3]!,
            nchar: module.HEAP32[ncharPtr >>> 2]!,
          };
        },
      );
    },
    lx4uns: (input, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lx4uns(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(first, "first");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4],
        (errPtr, inputPtr, lastPtr, ncharPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lx4uns(
            inputPtr,
            first,
            lastPtr,
            ncharPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            last: module.HEAPF64[lastPtr >>> 3]!,
            nchar: module.HEAP32[ncharPtr >>> 2]!,
          };
        },
      );
    },
    lxqstr: (input, qchar, first) => {
      const inputBytes = spiceStringByteLength(
        input,
        "lxqstr(input)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const quoteByte = spiceAsciiChar(qchar, "qchar");
      assertSpiceInt32(first, "first");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4],
        (errPtr, inputPtr, lastPtr, ncharPtr) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_lxqstr(
            inputPtr,
            quoteByte,
            first,
            lastPtr,
            ncharPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            last: module.HEAPF64[lastPtr >>> 3]!,
            nchar: module.HEAP32[ncharPtr >>> 2]!,
          };
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
