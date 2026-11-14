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

function finite(value: number, name: string): void {
  if (!Number.isFinite(value))
    throw new TypeError(name + " must be a finite number");
}

/** Create the raw string API backed by the WASM CSPICE module. */
export function createStringsApi(module: EmscriptenModule): StringsApi {
  return {
    dp2hx: (value, lenout) => {
      finite(value, "dp2hx value");
      const bound = 255;
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, Math.max(1, capacity), 4],
        (err, textOut, sizeOut) => {
          const status = module._tspice_dp2hx(
            value,
            capacity,
            textOut,
            sizeOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          const hxssiz = module.HEAP32[sizeOut >>> 2];
          if (hxssiz === undefined || hxssiz < 1 || hxssiz > 255)
            throw new Error("Invalid dp2hx size");
          return { hxstr: readString(module, textOut, capacity), hxssiz };
        },
      );
    },
    hx2dp: (input, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "hx2dp input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const bound = 192;
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8, 4, Math.max(1, capacity)],
        (err, inputPtr, numberOut, errorOut, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_hx2dp(
            inputPtr,
            capacity,
            numberOut,
            errorOut,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          const errmsg = readString(module, textOut, capacity);
          if (module.HEAP32[errorOut >>> 2]) return { error: true, errmsg };
          const number = module.HEAPF64[numberOut >>> 3];
          if (number === undefined || errmsg !== "")
            throw new Error("Invalid hx2dp result");
          return { error: false, number, errmsg };
        },
      );
    },
    prsdp: (input) => {
      const inputBytes = spiceStringByteLength(
        input,
        "prsdp input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 8],
        (err, inputPtr, numberOut) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_prsdp(
            inputPtr,
            numberOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          const number = module.HEAPF64[numberOut >>> 3];
          if (number === undefined) throw new Error("Missing parsed number");
          return number;
        },
      );
    },
    prsint: (input) => {
      const inputBytes = spiceStringByteLength(
        input,
        "prsint input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, inputBytes + 1, 4],
        (err, inputPtr, numberOut) => {
          writeString(module, inputPtr, input, inputBytes);
          const status = module._tspice_prsint(
            inputPtr,
            numberOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          const number = module.HEAP32[numberOut >>> 2];
          if (number === undefined) throw new Error("Missing parsed number");
          return number;
        },
      );
    },
    repmc: (input, marker, value, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmc input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmc marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const valueBytes = spiceStringByteLength(
        value,
        "repmc value",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const bound = inputBytes + Math.max(1, valueBytes);
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          valueBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, valuePtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          writeString(module, valuePtr, value, valueBytes);
          const status = module._tspice_repmc(
            inputPtr,
            markerPtr,
            valuePtr,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repmct: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmct input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmct marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(value, "repmct value");
      const rtcaseByte = spiceAsciiChar(rtcase, "repmct rtcase");
      const bound = inputBytes + 145;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repmct(
            inputPtr,
            markerPtr,
            value,
            rtcaseByte,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repmd: (input, marker, value, sigdig, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmd input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmd marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      finite(value, "repmd value");
      assertSpiceInt32(sigdig, "repmd sigdig");
      const bound = inputBytes + 23;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repmd(
            inputPtr,
            markerPtr,
            value,
            sigdig,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repmf: (input, marker, value, sigdig, format, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmf input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmf marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      finite(value, "repmf value");
      assertSpiceInt32(sigdig, "repmf sigdig");
      const formatByte = spiceAsciiChar(format, "repmf format");
      const bound = inputBytes + 56;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repmf(
            inputPtr,
            markerPtr,
            value,
            sigdig,
            formatByte,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repmi: (input, marker, value, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmi input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmi marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(value, "repmi value");
      const bound = inputBytes + 11;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repmi(
            inputPtr,
            markerPtr,
            value,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repml: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repml input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repml marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      if (typeof value !== "boolean")
        throw new TypeError("repml value must be a boolean");
      const rtcaseByte = spiceAsciiChar(rtcase, "repml rtcase");
      const bound = inputBytes + 5;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 2, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repml(
            inputPtr,
            markerPtr,
            Number(value),
            rtcaseByte,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
        },
      );
    },
    repmot: (input, marker, value, rtcase, lenout) => {
      const inputBytes = spiceStringByteLength(
        input,
        "repmot input",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const markerBytes = spiceStringByteLength(
        marker,
        "repmot marker",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      assertSpiceInt32(value, "repmot value");
      const rtcaseByte = spiceAsciiChar(rtcase, "repmot rtcase");
      const bound = inputBytes + 147;
      if (bound >= 2147483647)
        throw new RangeError("Replacement result exceeds signed32 storage");
      const capacity = spiceStringOutputCapacity(bound, 1, lenout);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          inputBytes + 1,
          markerBytes + 1,
          Math.max(1, capacity),
        ],
        (err, inputPtr, markerPtr, textOut) => {
          writeString(module, inputPtr, input, inputBytes);
          writeString(module, markerPtr, marker, markerBytes);
          const status = module._tspice_repmot(
            inputPtr,
            markerPtr,
            value,
            rtcaseByte,
            capacity,
            textOut,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return readString(module, textOut, capacity);
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
