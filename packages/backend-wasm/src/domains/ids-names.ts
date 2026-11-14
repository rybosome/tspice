import type { IdsNamesApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  normalizeBodItem,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import {
  WASM_ERR_MAX_BYTES,
  WASM_MAX_ALLOC_BYTES,
  withAllocs,
} from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
import { tspiceCallFoundInt, tspiceCallFoundString } from "../codec/found.js";

const BODY_NAME_MAX_BYTES = 256;

// N0067 SpiceSrf.h: 36 payload bytes, then the terminating NUL.
const SURFACE_BYTES = 37;
const surfaceDecoder = new TextDecoder("utf-8", {
  fatal: true,
  ignoreBOM: true,
});
const surfaceEncoder = new TextEncoder();

function encodeSurfaceText(value: string, label: string): Uint8Array {
  spiceStringByteLength(value, label, WASM_MAX_ALLOC_BYTES - 1);
  return surfaceEncoder.encode(value);
}

function storeSurfaceText(
  module: EmscriptenModule,
  ptr: number,
  bytes: Uint8Array,
): void {
  module.HEAPU8.set(bytes, ptr);
  module.HEAPU8[ptr + bytes.length] = 0;
}

function surfaceResult(
  module: EmscriptenModule,
  text: number,
  room: number,
  flag: number,
) {
  const bytes = module.HEAPU8.subarray(text, text + room);
  const end = bytes.indexOf(0);
  if (end < 0) throw new Error("Missing terminator in CSPICE surface name");
  return {
    surface: surfaceDecoder.decode(bytes.subarray(0, end)),
    isName: module.HEAP32[flag >>> 2] !== 0,
  };
}

function stringArg(value: string, label: string): string {
  if (typeof value !== "string")
    throw new TypeError(`${label}: expected a string`);
  return value;
}

function bodyItem(item: string, fn: string): string {
  const normalized = normalizeBodItem(stringArg(item, `${fn}(item)`));
  if (normalized.length === 0)
    throw new RangeError(`${fn}(item): expected a non-empty item`);
  return normalized;
}

function tspiceCallBodc2s(module: EmscriptenModule, code: number): string {
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, BODY_NAME_MAX_BYTES],
    (errPtr, outPtr) => {
      module.HEAPU8[outPtr] = 0;

      const result = module._tspice_bodc2s(
        code,
        outPtr,
        BODY_NAME_MAX_BYTES,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }

      return readFixedWidthCString(module, outPtr, BODY_NAME_MAX_BYTES);
    },
  );
}

function tspiceCallBoddef(
  module: EmscriptenModule,
  name: string,
  code: number,
): void {
  const namePtr = writeUtf8CString(module, name);
  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
      const result = module._tspice_boddef(
        namePtr,
        code,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(namePtr);
  }
}

function tspiceCallBodfnd(
  module: EmscriptenModule,
  body: number,
  item: string,
): boolean {
  const itemPtr = writeUtf8CString(module, item);
  try {
    return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
      module.HEAP32[outPtr >> 2] = 0;
      const result = module._tspice_bodfnd(
        body,
        itemPtr,
        outPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0)
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      return (module.HEAP32[outPtr >> 2] ?? 0) !== 0;
    });
  } finally {
    module._free(itemPtr);
  }
}

function tspiceCallBodvar(
  module: EmscriptenModule,
  body: number,
  item: string,
): number[] {
  const itemPtr = writeUtf8CString(module, item);
  try {
    // Query the shared shim's normalized numeric dimension first. This shares
    // NAIF's 32-byte key semantics without duplicating byte truncation in JS.
    const maxn = withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 4],
      (errPtr, outDimPtr) => {
        module.HEAP32[outDimPtr >> 2] = 0;
        const result = module._tspice_bodvar(
          body,
          itemPtr,
          0,
          outDimPtr,
          0,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (result !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        return module.HEAP32[outDimPtr >> 2] ?? 0;
      },
    );
    if (maxn <= 0) return [];
    const valuesBytes = Math.max(8, maxn * 8);

    return withAllocs(
      module,
      [WASM_ERR_MAX_BYTES, 4, valuesBytes + 7],
      (errPtr, outDimPtr, rawValuesPtr) => {
        module.HEAP32[outDimPtr >> 2] = 0;

        // Ensure 8-byte alignment for `HEAPF64` reads.
        const valuesPtr = (rawValuesPtr + 7) & ~7;

        const result = module._tspice_bodvar(
          body,
          itemPtr,
          maxn,
          outDimPtr,
          valuesPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );

        if (result !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
        }

        const dimRaw = module.HEAP32[outDimPtr >> 2] ?? 0;
        const dim = Math.min(maxn, Math.max(0, dimRaw));
        return Array.from(
          module.HEAPF64.subarray(valuesPtr >> 3, (valuesPtr >> 3) + dim),
        );
      },
    );
  } finally {
    module._free(itemPtr);
  }
}

/** Create an {@link IdsNamesApi} implementation backed by a WASM Emscripten module. */
export function createIdsNamesApi(module: EmscriptenModule): IdsNamesApi {
  return {
    srfc2s: (code, bodyId, srflen = 37) => {
      assertSpiceInt32(code, "srfc2s(code)", { min: -2147483647 });
      assertSpiceInt32(bodyId, "srfc2s(bodyId)");
      assertSpiceInt32(srflen, "srfc2s(srflen)");
      const capacity = Math.min(srflen, SURFACE_BYTES);
      return withAllocs(
        module,
        [Math.max(1, capacity), 4, WASM_ERR_MAX_BYTES],
        (out, flag, err) => {
          const status = module._tspice_srfc2s(
            code,
            bodyId,
            capacity,
            out,
            flag,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return surfaceResult(module, out, capacity, flag);
        },
      );
    },
    srfcss: (code, body, srflen = 37) => {
      assertSpiceInt32(code, "srfcss(code)", { min: -2147483647 });
      const bodyBytes = encodeSurfaceText(body, "srfcss(body)");
      assertSpiceInt32(srflen, "srfcss(srflen)");
      const capacity = Math.min(srflen, SURFACE_BYTES);
      return withAllocs(
        module,
        [bodyBytes.length + 1, Math.max(1, capacity), 4, WASM_ERR_MAX_BYTES],
        (bodyPtr, out, flag, err) => {
          storeSurfaceText(module, bodyPtr, bodyBytes);
          const status = module._tspice_srfcss(
            code,
            bodyPtr,
            capacity,
            out,
            flag,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          return surfaceResult(module, out, capacity, flag);
        },
      );
    },
    srfs2c: (surface, body) => {
      const surfaceBytes = encodeSurfaceText(surface, "srfs2c(surface)");
      const bodyBytes = encodeSurfaceText(body, "srfs2c(body)");
      return withAllocs(
        module,
        [
          surfaceBytes.length + 1,
          bodyBytes.length + 1,
          4,
          4,
          WASM_ERR_MAX_BYTES,
        ],
        (surfacePtr, bodyPtr, out, flag, err) => {
          storeSurfaceText(module, surfacePtr, surfaceBytes);
          storeSurfaceText(module, bodyPtr, bodyBytes);
          const status = module._tspice_srfs2c(
            surfacePtr,
            bodyPtr,
            out,
            flag,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          if (!module.HEAP32[flag >>> 2]) return { found: false };
          return { found: true, code: module.HEAP32[out >>> 2]! };
        },
      );
    },
    srfscc: (surface, bodyId) => {
      const surfaceBytes = encodeSurfaceText(surface, "srfscc(surface)");
      assertSpiceInt32(bodyId, "srfscc(bodyId)");
      return withAllocs(
        module,
        [surfaceBytes.length + 1, 4, 4, WASM_ERR_MAX_BYTES],
        (surfacePtr, out, flag, err) => {
          storeSurfaceText(module, surfacePtr, surfaceBytes);
          const status = module._tspice_srfscc(
            surfacePtr,
            bodyId,
            out,
            flag,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
          if (!module.HEAP32[flag >>> 2]) return { found: false };
          return { found: true, code: module.HEAP32[out >>> 2]! };
        },
      );
    },
    bodn2c: (name: string) => {
      const out = tspiceCallFoundInt(
        module,
        module._tspice_bodn2c,
        stringArg(name, "bodn2c(name)"),
      );
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },

    bodc2n: (code: number) => {
      assertSpiceInt32(code, "bodc2n(code)");
      const out = tspiceCallFoundString(module, module._tspice_bodc2n, code);
      if (!out.found) return { found: false };
      return { found: true, name: out.value };
    },

    bodc2s: (code: number) => {
      assertSpiceInt32(code, "bodc2s(code)");
      return tspiceCallBodc2s(module, code);
    },

    bods2c: (name: string) => {
      const out = tspiceCallFoundInt(
        module,
        module._tspice_bods2c,
        stringArg(name, "bods2c(name)"),
      );
      if (!out.found) return { found: false };
      return { found: true, code: out.value };
    },

    boddef: (name: string, code: number) => {
      assertSpiceInt32(code, "boddef(code)");
      tspiceCallBoddef(module, stringArg(name, "boddef(name)"), code);
    },

    bodfnd: (body: number, item: string) => {
      assertSpiceInt32(body, "bodfnd(body)");
      return tspiceCallBodfnd(module, body, bodyItem(item, "bodfnd"));
    },

    bodvar: (body: number, item: string) => {
      assertSpiceInt32(body, "bodvar(body)");
      return tspiceCallBodvar(module, body, bodyItem(item, "bodvar"));
    },
  } satisfies IdsNamesApi;
}
