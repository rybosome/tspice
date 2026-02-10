import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32NonNegative } from "@rybosome/tspice-backend-contract";

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

function readHeapI32(module: EmscriptenModule, idx: number, context: string): number {
  const heap = module.HEAP32;
  const v = heap[idx];

  // Typed array OOB reads return `undefined`. We should treat that as a bug
  // rather than silently fabricating a `0` value.
  if (v === undefined) {
    throw new RangeError(
      `${context}: out-of-bounds HEAP32 read (idx=${idx}, heapLen=${heap.length})`,
    );
  }

  return v;
}

function heap32IndexFromPtr(ptr: number, context: string): number {
  if (!Number.isFinite(ptr) || !Number.isInteger(ptr)) {
    throw new TypeError(`${context}: expected ptr to be a finite integer (got ${ptr})`);
  }
  if (ptr < 0) {
    throw new RangeError(`${context}: expected ptr to be >= 0 (got ${ptr})`);
  }
  if (ptr % 4 !== 0) {
    throw new RangeError(`${context}: expected ptr to be 4-byte aligned (got ${ptr})`);
  }
  return ptr / 4;
}

function writeDlaDescr8(module: EmscriptenModule, ptr: number, descr: DlaDescriptor): void {
  const base = heap32IndexFromPtr(ptr, "writeDlaDescr8(ptr)");
  const heap = module.HEAP32;

  // Typed array out-of-bounds writes are ignored, which can mask bugs and
  // lead to silently-corrupted descriptors. Fail fast instead.
  if (base < 0 || base + 7 >= heap.length) {
    throw new RangeError(
      `writeDlaDescr8: descriptor pointer out of bounds (ptr=${ptr}, base=${base}, heapLen=${heap.length})`,
    );
  }

  heap[base + 0] = descr.bwdptr | 0;
  heap[base + 1] = descr.fwdptr | 0;
  heap[base + 2] = descr.ibase | 0;
  heap[base + 3] = descr.isize | 0;
  heap[base + 4] = descr.dbase | 0;
  heap[base + 5] = descr.dsize | 0;
  heap[base + 6] = descr.cbase | 0;
  heap[base + 7] = descr.csize | 0;
}

function readDlaDescr8(module: EmscriptenModule, ptr: number): DlaDescriptor {
  const base = heap32IndexFromPtr(ptr, "readDlaDescr8(ptr)");
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
    if (
      typeof nativeHandle !== "number" ||
      !Number.isInteger(nativeHandle) ||
      nativeHandle < I32_MIN ||
      nativeHandle > I32_MAX
    ) {
      throw new Error(`Expected native backend to return a 32-bit signed integer handle for ${kind}`);
    }
    if (nextHandleId >= Number.MAX_SAFE_INTEGER) {
      throw new Error(`SpiceHandle ID overflow: too many handles allocated (nextHandleId=${nextHandleId})`);
    }
    const handleId = nextHandleId++;
    handles.set(handleId, { kind, nativeHandle });
    return asSpiceHandle(handleId);
  }

  function lookup(handle: SpiceHandle, expected: readonly HandleKind[]): HandleEntry {
    const handleId = asHandleId(handle, "lookup(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
      );
    }
    return entry;
  }

  function close(
    handle: SpiceHandle,
    expected: readonly HandleKind[],
    closeNative: (entry: HandleEntry) => void,
  ): void {
    const handleId = asHandleId(handle, "close(handle)");
    const entry = handles.get(handleId);
    if (!entry) {
      throw new Error(`Invalid or closed SpiceHandle: ${handleId}`);
    }
    if (!expected.includes(entry.kind)) {
      throw new Error(
        `Invalid SpiceHandle kind: ${handleId} is ${entry.kind}, expected ${expected.join(" or ")}`,
      );
    }

    closeNative(entry);
    handles.delete(handleId);
  }

  function closeDasBacked(handle: SpiceHandle): void {
    close(handle, ["DAS", "DLA"], (entry) => {
      // In CSPICE, `dascls_c` closes both DAS and DLA handles, and `dlacls_c`
      // is just an alias.
      callVoidHandle(module, module._tspice_dascls, entry.nativeHandle);
    });
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
          return readHeapI32(module, outExistsPtr >> 2, "exists(outExistsPtr)") !== 0;
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
          return readHeapI32(module, outHandlePtr >> 2, "dafopr(outHandlePtr)");
        });
        return register("DAF", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dafcls: (handle: SpiceHandle) =>
      close(handle, ["DAF"], (e) => callVoidHandle(module, module._tspice_dafcls, e.nativeHandle)),

    dafbfs: (handle: SpiceHandle) =>
      callVoidHandle(module, module._tspice_dafbfs, lookup(handle, ["DAF"]).nativeHandle),

    daffna: (handle: SpiceHandle) => {
      const nativeHandle = lookup(handle, ["DAF"]).nativeHandle;
      return withAllocs(module, [4, WASM_ERR_MAX_BYTES], (outFoundPtr, errPtr) => {
        module.HEAP32[outFoundPtr >> 2] = 0;
        const code = module._tspice_daffna(nativeHandle, outFoundPtr, errPtr, WASM_ERR_MAX_BYTES);
        if (code !== 0) {
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
        }
        return readHeapI32(module, outFoundPtr >> 2, "daffna(outFoundPtr)") !== 0;
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
          return readHeapI32(module, outHandlePtr >> 2, "dasopr(outHandlePtr)");
        });
        return register("DAS", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dascls: closeDasBacked,

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "dlaopn(ncomch)");

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
            ncomch,
            outHandlePtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return readHeapI32(module, outHandlePtr >> 2, "dlaopn(outHandlePtr)");
        });

        return register("DLA", nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(ftypePtr);
        module._free(pathPtr);
      }
    },

    dlabfs: (handle: SpiceHandle): FoundDlaDescriptor => {
      const nativeHandle = lookup(handle, ["DAS", "DLA"]).nativeHandle;
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

        const found = readHeapI32(module, outFoundPtr >> 2, "dlabfs(outFoundPtr)") !== 0;
        if (!found) {
          return { found: false };
        }

        return { found: true, descr: readDlaDescr8(module, outDescr8Ptr) };
      });
    },

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor): FoundDlaDescriptor => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      const nativeHandle = lookup(handle, ["DAS", "DLA"]).nativeHandle;

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

          const found = readHeapI32(module, outFoundPtr >> 2, "dlafns(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false };
          }

          return { found: true, descr: readDlaDescr8(module, outNextDescr8Ptr) };
        },
      );
    },

    dlacls: closeDasBacked,
  } satisfies FileIoApi;
}
