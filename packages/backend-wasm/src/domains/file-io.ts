import type {
  DlaDescriptor,
  FileIoApi,
  FoundDlaDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32, assertSpiceInt32NonNegative } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";
import type { VirtualOutputRegistry } from "../runtime/virtual-outputs.js";

const DAS_BACKED = ["DAS", "DLA"] as const satisfies readonly SpiceHandleKind[];
const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

// Fixed-size portion of the DSK type 2 spatial index double component.
//
// CSPICE: `SPICE_DSK02_IXDFIX` (and `SPICE_DSK02_SPADSZ`).
const DSK02_IXDFIX = 10;

// Hard cap for DSK spatial index scratch sizes (worksz/spxisz).
// Matches native-addon validation.
const DSKMI2_MAX_SIZE = 5_000_000;

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

    const min = key === "bwdptr" || key === "fwdptr" ? -1 : 0;
    if (v < min) {
      throw new Error(`${context}: expected ${key} to be >= ${min}`);
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

export function createFileIoApi(
  module: EmscriptenModule,
  handles: SpiceHandleRegistry,
  virtualOutputs: VirtualOutputRegistry,
): FileIoApi {
  function closeDasBacked(handle: SpiceHandle, context: string): void {
    handles.close(
      handle,
      DAS_BACKED,
      (entry) => {
        // In CSPICE, `dascls_c` closes both DAS and DLA handles, and `dlacls_c`
        // is just an alias.
        callVoidHandle(module, module._tspice_dascls, entry.nativeHandle);
      },
      context,
    );
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

    readVirtualOutput: (output: VirtualOutput) => {
      if (typeof output !== "object" || output === null) {
        throw new Error("readVirtualOutput(output): expected an object");
      }
      const obj = output as { kind?: unknown; path?: unknown };
      if (obj.kind !== "virtual-output") {
        throw new Error("readVirtualOutput(output): expected kind='virtual-output'");
      }
      if (typeof obj.path !== "string") {
        throw new Error("readVirtualOutput(output): expected path to be a string");
      }

      const resolved = resolveKernelPath(obj.path);

      // Namespace/lifecycle restriction: `readVirtualOutput()` should not be a
      // generic WASM-FS read primitive.
      virtualOutputs.assertReadable(resolved, obj.path);

      // Emscripten returns a Uint8Array for binary reads.
      try {
        return module.FS.readFile(resolved, { encoding: "binary" });
      } catch (error) {
        // Emscripten FS errors use Node-style codes in the message, but don't
        // reliably surface a typed `code` property.
        throw new Error(
          `readVirtualOutput(): failed to read VirtualOutput ${JSON.stringify(obj.path)} at ${resolved}. ` +
            "Make sure the writer handle was closed successfully before reading.",
          { cause: error },
        );
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
        return handles.register("DAF", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dafcls: (handle: SpiceHandle) =>
      handles.close(
        handle,
        ["DAF"],
        (e) => callVoidHandle(module, module._tspice_dafcls, e.nativeHandle),
        "dafcls",
      ),

    dafbfs: (handle: SpiceHandle) =>
      callVoidHandle(
        module,
        module._tspice_dafbfs,
        handles.lookup(handle, ["DAF"], "dafbfs").nativeHandle,
      ),

    daffna: (handle: SpiceHandle) => {
      const nativeHandle = handles.lookup(handle, ["DAF"], "daffna").nativeHandle;
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
        return handles.register("DAS", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dascls: (handle: SpiceHandle) => closeDasBacked(handle, "dascls"),

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

        return handles.register("DLA", nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(ftypePtr);
        module._free(pathPtr);
      }
    },

    dlabfs: (handle: SpiceHandle): FoundDlaDescriptor => {
      const nativeHandle = handles.lookup(handle, DAS_BACKED, "dlabfs").nativeHandle;
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
      const nativeHandle = handles.lookup(handle, DAS_BACKED, "dlafns").nativeHandle;

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

    dlacls: (handle: SpiceHandle) => closeDasBacked(handle, "dlacls"),

    dskopn: (path: string, ifname: string, ncomch: number) => {
      assertSpiceInt32NonNegative(ncomch, "dskopn(ncomch)");

      const resolved = resolveKernelPath(path);

      // `dskopn_c` creates the output file via C stdio, so we must ensure the
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
          const code = module._tspice_dskopn(
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
          return readHeapI32(module, outHandlePtr >> 2, "dskopn(outHandlePtr)");
        });

        // DSKs are DAS-backed; register as DAS so `dascls` can close it.
        return handles.register("DAS", nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(pathPtr);
      }
    },

    dskmi2: (
      nv: number,
      vrtces: readonly number[],
      np: number,
      plates: readonly number[],
      finscl: number,
      corscl: number,
      worksz: number,
      voxpsz: number,
      voxlsz: number,
      makvtl: boolean,
      spxisz: number,
    ) => {
      assertSpiceInt32NonNegative(nv, "dskmi2(nv)");
      assertSpiceInt32NonNegative(np, "dskmi2(np)");
      assertSpiceInt32(corscl, "dskmi2(corscl)");
      assertSpiceInt32NonNegative(worksz, "dskmi2(worksz)");
      assertSpiceInt32NonNegative(voxpsz, "dskmi2(voxpsz)");
      assertSpiceInt32NonNegative(voxlsz, "dskmi2(voxlsz)");
      assertSpiceInt32NonNegative(spxisz, "dskmi2(spxisz)");

      const expectedVrtcesLen = nv * 3;
      if (expectedVrtcesLen <= 0) {
        throw new RangeError("dskmi2(nv): expected nv > 0");
      }
      if (vrtces.length !== expectedVrtcesLen) {
        throw new RangeError(`dskmi2(vrtces): expected length ${expectedVrtcesLen}, got ${vrtces.length}`);
      }

      const expectedPlatesLen = np * 3;
      if (expectedPlatesLen <= 0) {
        throw new RangeError("dskmi2(np): expected np > 0");
      }
      if (plates.length !== expectedPlatesLen) {
        throw new RangeError(`dskmi2(plates): expected length ${expectedPlatesLen}, got ${plates.length}`);
      }

      for (let i = 0; i < plates.length; i++) {
        const v = plates[i];
        if (v === undefined) {
          throw new RangeError(`dskmi2(plates[${i}]): expected a value, got undefined`);
        }
        assertSpiceInt32(v, `dskmi2(plates[${i}])`);
        if (v < 1 || v > nv) {
          throw new RangeError(`dskmi2(plates[${i}]): expected value in [1, nv] (nv=${nv}), got ${v}`);
        }
      }

      if (worksz <= 0) {
        throw new RangeError("dskmi2(worksz): expected worksz > 0");
      }
      if (worksz > DSKMI2_MAX_SIZE) {
        throw new RangeError(`dskmi2(worksz): expected worksz <= ${DSKMI2_MAX_SIZE}, got ${worksz}`);
      }

      if (spxisz <= 0) {
        throw new RangeError("dskmi2(spxisz): expected spxisz > 0");
      }
      if (spxisz > DSKMI2_MAX_SIZE) {
        throw new RangeError(`dskmi2(spxisz): expected spxisz <= ${DSKMI2_MAX_SIZE}, got ${spxisz}`);
      }

      const vrtcesBytes = expectedVrtcesLen * 8;
      const platesBytes = expectedPlatesLen * 4;
      const spaixdBytes = DSK02_IXDFIX * 8;
      const spaixiBytes = spxisz * 4;

      return withAllocs(
        module,
        [vrtcesBytes, platesBytes, spaixdBytes, spaixiBytes, WASM_ERR_MAX_BYTES],
        (vrtcesPtr, platesPtr, outSpaixdPtr, outSpaixiPtr, errPtr) => {
          module.HEAPF64.set(vrtces, vrtcesPtr >> 3);
          module.HEAP32.set(plates, platesPtr >> 2);

          module.HEAPF64.fill(0, outSpaixdPtr >> 3, (outSpaixdPtr >> 3) + DSK02_IXDFIX);
          module.HEAP32.fill(0, outSpaixiPtr >> 2, (outSpaixiPtr >> 2) + spxisz);

          const code = module._tspice_dskmi2(
            nv,
            vrtcesPtr,
            np,
            platesPtr,
            finscl,
            corscl,
            worksz,
            voxpsz,
            voxlsz,
            makvtl ? 1 : 0,
            spxisz,
            outSpaixdPtr,
            DSK02_IXDFIX,
            outSpaixiPtr,
            spxisz,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          const spaixd = Array.from(
            module.HEAPF64.subarray(outSpaixdPtr >> 3, (outSpaixdPtr >> 3) + DSK02_IXDFIX),
          );
          const spaixi = Array.from(
            module.HEAP32.subarray(outSpaixiPtr >> 2, (outSpaixiPtr >> 2) + spxisz),
          );

          return { spaixd, spaixi };
        },
      );
    },

    dskw02: (
      handle: SpiceHandle,
      center: number,
      surfid: number,
      dclass: number,
      frame: string,
      corsys: number,
      corpar: readonly number[],
      mncor1: number,
      mxcor1: number,
      mncor2: number,
      mxcor2: number,
      mncor3: number,
      mxcor3: number,
      first: number,
      last: number,
      nv: number,
      vrtces: readonly number[],
      np: number,
      plates: readonly number[],
      spaixd: readonly number[],
      spaixi: readonly number[],
    ): void => {
      assertSpiceInt32(center, "dskw02(center)");
      assertSpiceInt32(surfid, "dskw02(surfid)");
      assertSpiceInt32(dclass, "dskw02(dclass)");
      assertSpiceInt32(corsys, "dskw02(corsys)");
      assertSpiceInt32NonNegative(nv, "dskw02(nv)");
      assertSpiceInt32NonNegative(np, "dskw02(np)");

      const expectedVrtcesLen = nv * 3;
      if (expectedVrtcesLen <= 0) {
        throw new RangeError("dskw02(nv): expected nv > 0");
      }
      if (vrtces.length !== expectedVrtcesLen) {
        throw new RangeError(`dskw02(vrtces): expected length ${expectedVrtcesLen}, got ${vrtces.length}`);
      }

      const expectedPlatesLen = np * 3;
      if (expectedPlatesLen <= 0) {
        throw new RangeError("dskw02(np): expected np > 0");
      }
      if (plates.length !== expectedPlatesLen) {
        throw new RangeError(`dskw02(plates): expected length ${expectedPlatesLen}, got ${plates.length}`);
      }

      for (let i = 0; i < plates.length; i++) {
        const v = plates[i];
        if (v === undefined) {
          throw new RangeError(`dskw02(plates[${i}]): expected a value, got undefined`);
        }
        assertSpiceInt32(v, `dskw02(plates[${i}])`);
        if (v < 1 || v > nv) {
          throw new RangeError(`dskw02(plates[${i}]): expected value in [1, nv] (nv=${nv}), got ${v}`);
        }
      }

      if (corpar.length !== 10) {
        throw new RangeError(`dskw02(corpar): expected length 10, got ${corpar.length}`);
      }
      if (spaixd.length !== DSK02_IXDFIX) {
        throw new RangeError(`dskw02(spaixd): expected length ${DSK02_IXDFIX}, got ${spaixd.length}`);
      }

      const spaixiLen = spaixi.length;
      assertSpiceInt32NonNegative(spaixiLen, "dskw02(spaixi.length)");
      if (spaixiLen <= 0) {
        throw new RangeError("dskw02(spaixi): expected a non-empty array");
      }

      for (let i = 0; i < spaixiLen; i++) {
        const v = spaixi[i];
        if (v === undefined) {
          throw new RangeError(`dskw02(spaixi[${i}]): expected a value, got undefined`);
        }
        assertSpiceInt32(v, `dskw02(spaixi[${i}])`);
      }

      const nativeHandle = handles.lookup(handle, ["DAS"], "dskw02").nativeHandle;

      const framePtr = writeUtf8CString(module, frame);
      try {
        const corparBytes = 10 * 8;
        const vrtcesBytes = expectedVrtcesLen * 8;
        const platesBytes = expectedPlatesLen * 4;
        const spaixdBytes = DSK02_IXDFIX * 8;
        const spaixiBytes = spaixiLen * 4;

        withAllocs(
          module,
          [corparBytes, vrtcesBytes, platesBytes, spaixdBytes, spaixiBytes, WASM_ERR_MAX_BYTES],
          (corparPtr, vrtcesPtr, platesPtr, spaixdPtr, spaixiPtr, errPtr) => {
            module.HEAPF64.set(corpar, corparPtr >> 3);
            module.HEAPF64.set(vrtces, vrtcesPtr >> 3);
            module.HEAP32.set(plates, platesPtr >> 2);
            module.HEAPF64.set(spaixd, spaixdPtr >> 3);
            module.HEAP32.set(spaixi, spaixiPtr >> 2);

            const code = module._tspice_dskw02(
              nativeHandle,
              center,
              surfid,
              dclass,
              framePtr,
              corsys,
              corparPtr,
              mncor1,
              mxcor1,
              mncor2,
              mxcor2,
              mncor3,
              mxcor3,
              first,
              last,
              nv,
              vrtcesPtr,
              np,
              platesPtr,
              spaixdPtr,
              DSK02_IXDFIX,
              spaixiPtr,
              spaixiLen,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
          },
        );
      } finally {
        module._free(framePtr);
      }
    },
  } satisfies FileIoApi;
}
