import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";

type HandleKind = "DAF" | "DAS" | "DLA";
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

type HandleEntry = {
  kind: HandleKind;
  nativeHandle: number;
};

function asHandleId(handle: SpiceHandle): number {
  return handle as unknown as number;
}

function asSpiceHandle(handleId: number): SpiceHandle {
  return handleId as unknown as SpiceHandle;
}

const DESCR_KEYS = [
  "bwdptr",
  "fwdptr",
  "ibase",
  "isize",
  "dbase",
  "dsize",
  "cbase",
  "csize",
] as const;

function writeDlaDescr8(module: EmscriptenModule, ptr: number, descr: DlaDescriptor): void {
  const base = ptr >> 2;
  module.HEAP32[base + 0] = descr.bwdptr | 0;
  module.HEAP32[base + 1] = descr.fwdptr | 0;
  module.HEAP32[base + 2] = descr.ibase | 0;
  module.HEAP32[base + 3] = descr.isize | 0;
  module.HEAP32[base + 4] = descr.dbase | 0;
  module.HEAP32[base + 5] = descr.dsize | 0;
  module.HEAP32[base + 6] = descr.cbase | 0;
  module.HEAP32[base + 7] = descr.csize | 0;
}

function readDlaDescr8(module: EmscriptenModule, ptr: number): DlaDescriptor {
  const base = ptr >> 2;
  const heap = module.HEAP32;

  // HEAP32 returns `undefined` for out-of-bounds reads. That can mask bugs and
  // lead to silently-corrupted DLA descriptors, so fail fast instead.
  if (base < 0 || base + 7 >= heap.length) {
    throw new RangeError(
      `readDlaDescr8: descriptor pointer out of bounds (ptr=${ptr}, base=${base}, heapLen=${heap.length})`,
    );
  }

  return {
    bwdptr: heap[base + 0]!,
    fwdptr: heap[base + 1]!,
    ibase: heap[base + 2]!,
    isize: heap[base + 3]!,
    dbase: heap[base + 4]!,
    dsize: heap[base + 5]!,
    cbase: heap[base + 6]!,
    csize: heap[base + 7]!,
  };
}

function assertDlaDescriptor(value: unknown, context: string): asserts value is DlaDescriptor {
  if (typeof value !== "object" || value === null) {
    throw new Error(`${context}: expected an object`);
  }
  const obj = value as Record<string, unknown>;
  for (const key of DESCR_KEYS) {
    const v = obj[key];
    if (
      typeof v !== "number" ||
      !Number.isInteger(v) ||
      v < I32_MIN ||
      v > I32_MAX
    ) {
      throw new Error(`${context}: expected ${key} to be a 32-bit signed integer`);
    }
  }
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

export function createFileIoApi(module: EmscriptenModule): FileIoApi {
  let nextHandleId = 1;
  const handles = new Map<number, HandleEntry>();

  function register(kind: HandleKind, nativeHandle: number): SpiceHandle {
    if (!Number.isFinite(nativeHandle)) {
      throw new Error(`Expected native backend to return a numeric handle for ${kind}`);
    }
    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: HandleKind): HandleEntry {
    const handleId = asHandleId(handle);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (entry.kind !== expected) {
      throw new Error(
        `Invalid SpiceHandle kind for ${expected} operation: ${handleId} is ${entry.kind}, expected ${expected}`,
      );
    }
    return entry;
  }

  function close(handle: SpiceHandle, expected: HandleKind, closeNative: (nativeHandle: number) => void): void {
    const handleId = asHandleId(handle);
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (entry.kind !== expected) {
      throw new Error(
        `Invalid SpiceHandle kind for ${expected} close: ${handleId} is ${entry.kind}, expected ${expected}`,
      );
    }

    closeNative(entry.nativeHandle);
    handles.delete(handleId);
  }

  return {
    exists: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outExistsPtr, errPtr) => {
          module.HEAP32[outExistsPtr >> 2] = 0;
          const code = module._tspice_exists(pathPtr, outExistsPtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return (module.HEAP32[outExistsPtr >> 2] ?? 0) !== 0;
        });
      } finally {
        module._free(pathPtr);
      }
    },

    getfat: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);

      const archMaxBytes = 64;
      const typeMaxBytes = 64;

      try {
        return withAllocs(module, [archMaxBytes, typeMaxBytes, WASM_ERR_MAX_BYTES], (archPtr, typePtr, errPtr) => {
          const code = module._tspice_getfat(
            pathPtr,
            archPtr,
            archMaxBytes,
            typePtr,
            typeMaxBytes,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          return {
            arch: module.UTF8ToString(archPtr, archMaxBytes).trim(),
            type: module.UTF8ToString(typePtr, typeMaxBytes).trim(),
          };
        });
      } finally {
        module._free(pathPtr);
      }
    },

    dafopr: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_dafopr(pathPtr, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return module.HEAP32[outHandlePtr >> 2] ?? 0;
        });
        return register("DAF", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dafcls: (handle: SpiceHandle) =>
      close(handle, "DAF", (h) => callVoidHandle(module, module._tspice_dafcls, h)),

    dafbfs: (handle: SpiceHandle) =>
      callVoidHandle(module, module._tspice_dafbfs, lookup(handle, "DAF").nativeHandle),

    daffna: (handle: SpiceHandle) => {
      const nativeHandle = lookup(handle, "DAF").nativeHandle;
      return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outFoundPtr, errPtr) => {
        module.HEAP32[outFoundPtr >> 2] = 0;
        const code = module._tspice_daffna(nativeHandle, outFoundPtr, errPtr, WASM_ERR_MAX_BYTES);
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }
        return (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
      });
    },

    dasopr: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_dasopr(pathPtr, outHandlePtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return module.HEAP32[outHandlePtr >> 2] ?? 0;
        });
        return register("DAS", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dascls: (handle: SpiceHandle) =>
      close(handle, "DAS", (h) => callVoidHandle(module, module._tspice_dascls, h)),

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) => {
      const resolved = resolveKernelPath(path);

      // `dlaopn_c` creates the output file via C stdio, so we must ensure the
      // directory exists in the Emscripten FS.
      const dir = resolved.split("/").slice(0, -1).join("/") || "/";
      if (dir && dir !== "/") {
        module.FS.mkdirTree(dir);
      }

      const pathPtr = writeUtf8CString(module, resolved);
      const ftypePtr = writeUtf8CString(module, ftype);
      const ifnamePtr = writeUtf8CString(module, ifname);

      try {
        const nativeHandle = withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outHandlePtr, errPtr) => {
          module.HEAP32[outHandlePtr >> 2] = 0;
          const code = module._tspice_dlaopn(
            pathPtr,
            ftypePtr,
            ifnamePtr,
            ncomch | 0,
            outHandlePtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return module.HEAP32[outHandlePtr >> 2] ?? 0;
        });

        return register("DLA", nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(ftypePtr);
        module._free(pathPtr);
      }
    },

    dlabfs: (handle: SpiceHandle): FoundDlaDescriptor => {
      const nativeHandle = lookup(handle, "DLA").nativeHandle;
      return withAllocs(module, [32, 4, WASM_ERR_MAX_BYTES], (outDescr8Ptr, outFoundPtr, errPtr) => {
        module.HEAP32[outFoundPtr >> 2] = 0;

        const code = module._tspice_dlabfs(
          nativeHandle,
          outDescr8Ptr,
          outFoundPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }

        const found = (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
        if (!found) {
          return { found: false };
        }

        return { found: true, descr: readDlaDescr8(module, outDescr8Ptr) };
      });
    },

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor): FoundDlaDescriptor => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      const nativeHandle = lookup(handle, "DLA").nativeHandle;

      return withAllocs(
        module,
        [32, 32, 4, WASM_ERR_MAX_BYTES],
        (inDescr8Ptr, outNextDescr8Ptr, outFoundPtr, errPtr) => {
          writeDlaDescr8(module, inDescr8Ptr, descr);
          module.HEAP32[outFoundPtr >> 2] = 0;

          const code = module._tspice_dlafns(
            nativeHandle,
            inDescr8Ptr,
            outNextDescr8Ptr,
            outFoundPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          const found = (module.HEAP32[outFoundPtr >> 2] ?? 0) !== 0;
          if (!found) {
            return { found: false };
          }

          return { found: true, descr: readDlaDescr8(module, outNextDescr8Ptr) };
        },
      );
    },

    dlacls: (handle: SpiceHandle) => close(handle, "DLA", (h) => callVoidHandle(module, module._tspice_dlacls, h)),
  } satisfies FileIoApi;
}
