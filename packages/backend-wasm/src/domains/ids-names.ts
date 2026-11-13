import type { IdsNamesApi } from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32, normalizeBodItem } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
import { tspiceCallFoundInt, tspiceCallFoundString } from "../codec/found.js";

const BODY_NAME_MAX_BYTES = 256;

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
