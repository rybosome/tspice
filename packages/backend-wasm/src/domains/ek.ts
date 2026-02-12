import type { EkApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32NonNegative } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";

type HandleEntry = {
  kind: "EK";
  nativeHandle: number;
};

function asHandleId(handle: SpiceHandle, context: string): number {
  const id = handle as unknown as number;
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new TypeError(`${context}: expected a positive safe integer SpiceHandle`);
  }
  return id;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

function readHeapI32(module: EmscriptenModule, idx: number, context: string): number {
  const heap = module.HEAP32;
  const v = heap[idx];
  if (v === undefined) {
    throw new RangeError(
      `${context}: out-of-bounds HEAP32 read (idx=${idx}, heapLen=${heap.length})`,
    );
  }
  return v;
}

function callVoidHandle(
  module: EmscriptenModule,
  fn: (handle: number, errPtr: number, errMaxBytes: number) => number,
  handle: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const code = fn(handle, errPtr, WASM_ERR_MAX_BYTES);
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  });
}

export function createEkApi(module: EmscriptenModule): EkApi {
  let nextHandleId = 1;
  const handles = new Map<number, HandleEntry>();

  function register(nativeHandle: number): SpiceHandle {
    if (
      typeof nativeHandle !== "number" ||
      !Number.isInteger(nativeHandle) ||
      nativeHandle < -2147483648 ||
      nativeHandle > 2147483647
    ) {
      throw new Error("Expected native backend to return a 32-bit signed integer EK handle");
    }

    if (nextHandleId >= Number.MAX_SAFE_INTEGER) {
      throw new Error(`SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`);
    }

    const handleId = nextHandleId++;
    handles.set(handleId, { kind: "EK", nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle): HandleEntry {
    const handleId = asHandleId(handle, "lookup(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    return entry;
  }

  function close(handle: SpiceHandle, closeNative: (entry: HandleEntry) => void): void {
    const handleId = asHandleId(handle, "close(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }

    // Close-once semantics: only forget the handle after the native close succeeds.
    closeNative(entry);
    handles.delete(handleId);
  }

  const TABLE_NAME_MAX_BYTES = 256;

  const api = {
    ekopr: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_ekopr(pathPtr, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return readHeapI32(module, outHandlePtr >> 2, "ekopr(outHandlePtr)");
        });
        return register(nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    ekopw: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_ekopw(pathPtr, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return readHeapI32(module, outHandlePtr >> 2, "ekopw(outHandlePtr)");
        });
        return register(nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    ekopn: (path: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "ekopn(ncomch)");

      const resolved = resolveKernelPath(path);

      // `ekopn_c` creates the output file via C stdio, so we must ensure the
      // directory exists in the Emscripten FS.
      const dir = resolved.split("/").slice(0, -1).join("/") || "/";
      if (dir && dir !== "/") {
        module.FS.mkdirTree(dir);
      }

      const pathPtr = writeUtf8CString(module, resolved);
      const ifnamePtr = writeUtf8CString(module, ifname);

      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_ekopn(
            pathPtr,
            ifnamePtr,
            ncomch,
            outHandlePtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return readHeapI32(module, outHandlePtr >> 2, "ekopn(outHandlePtr)");
        });

        return register(nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(pathPtr);
      }
    },

    ekcls: (handle: SpiceHandle) =>
      close(handle, (entry) => callVoidHandle(module, module._tspice_ekcls, entry.nativeHandle)),

    ekntab: () =>
      withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outNPtr, errPtr) => {
        module.HEAP32[outNPtr >> 2] = 0;
        const code = module._tspice_ekntab(outNPtr, errPtr, WASM_ERR_MAX_BYTES);
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }
        const n = readHeapI32(module, outNPtr >> 2, "ekntab(outNPtr)");
        assertSpiceInt32NonNegative(n, "ekntab()");
        return n;
      }),

    ektnam: (n: number) => {
      assertSpiceInt32NonNegative(n, "ektnam(n)");

      return withAllocs(module, [TABLE_NAME_MAX_BYTES, WASM_ERR_MAX_BYTES], (outNamePtr, errPtr) => {
        module.HEAPU8[outNamePtr] = 0;
        const code = module._tspice_ektnam(
          n,
          outNamePtr,
          TABLE_NAME_MAX_BYTES,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }
        return readFixedWidthCString(module, outNamePtr, TABLE_NAME_MAX_BYTES);
      });
    },

    eknseg: (handle: SpiceHandle) => {
      const nativeHandle = lookup(handle).nativeHandle;
      return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outNsegPtr, errPtr) => {
        module.HEAP32[outNsegPtr >> 2] = 0;
        const code = module._tspice_eknseg(nativeHandle, outNsegPtr, errPtr, WASM_ERR_MAX_BYTES);
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }
        const nseg = readHeapI32(module, outNsegPtr >> 2, "eknseg(outNsegPtr)");
        assertSpiceInt32NonNegative(nseg, "eknseg(handle)");
        return nseg;
      });
    },
  } satisfies EkApi;

  Object.defineProperty(api, "__debugOpenHandleCount", {
    value: () => handles.size,
    enumerable: false,
  });

  return api;
}
