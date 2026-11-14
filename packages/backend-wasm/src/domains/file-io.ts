import type {
  DlaDescriptor,
  FileIoApi,
  FileIoKitApi,
  FoundDlaDescriptor,
  SpiceHandle,
  VirtualOutput,
} from "@rybosome/tspice-backend-contract";
import {
  dafComponentLayout,
  dafComponents,
  dafBytes,
  dafRecordBytes,
  dafAddressWords,
  dafFileNameCapacity,
  DAF_MAX_SUMMARY_BYTES,
  dafPathByteLength,
  dafSummaryFormat,
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import {
  WASM_ERR_MAX_BYTES,
  WASM_MAX_ALLOC_BYTES,
  withAllocs,
  withMalloc,
} from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type {
  SpiceHandleEntry,
  SpiceHandleKind,
  SpiceHandleRegistry,
} from "../runtime/spice-handles.js";
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

function readHeapI32(
  module: EmscriptenModule,
  idx: number,
  context: string,
): number {
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
    throw new TypeError(
      `${context}: expected ptr to be a finite integer (got ${ptr})`,
    );
  }
  if (ptr < 0) {
    throw new RangeError(`${context}: expected ptr to be >= 0 (got ${ptr})`);
  }
  if (ptr % 4 !== 0) {
    throw new RangeError(
      `${context}: expected ptr to be 4-byte aligned (got ${ptr})`,
    );
  }
  return ptr / 4;
}

function writeDlaDescr8(
  module: EmscriptenModule,
  ptr: number,
  descr: DlaDescriptor,
): void {
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

function assertDlaDescriptor(
  value: unknown,
  context: string,
): asserts value is DlaDescriptor {
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
      throw new Error(
        `${context}: expected ${key} to be a 32-bit signed integer`,
      );
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

function assertNumberArray(value: unknown, label: string): void {
  if (!Array.isArray(value))
    throw new TypeError(`${label} must be a number array`);
  for (let i = 0; i < value.length; i++) {
    const item: unknown = value[i];
    if (typeof item !== "number")
      throw new TypeError(`${label}[${i}] must be a number`);
  }
}

function assertNumber(value: unknown, label: string): void {
  if (typeof value !== "number")
    throw new TypeError(`${label} must be a number`);
}

function assertString(value: unknown, label: string): void {
  if (typeof value !== "string")
    throw new TypeError(`${label} must be a string`);
}

/** Create a {@link FileIoApi} implementation backed by a WASM Emscripten module. */
export function createFileIoApi(
  module: EmscriptenModule,
  handles: SpiceHandleRegistry,
): FileIoApi {
  function closeDasBacked(handle: SpiceHandle, context: string): void {
    handles.close(
      handle,
      DAS_BACKED,
      (entry: SpiceHandleEntry) => {
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
        return withAllocs(
          module,
          [4, WASM_ERR_MAX_BYTES],
          (outExistsPtr, errPtr) => {
            module.HEAP32[outExistsPtr >> 2] = 0;
            const code = module._tspice_exists(
              pathPtr,
              outExistsPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
            return (
              readHeapI32(module, outExistsPtr >> 2, "exists(outExistsPtr)") !==
              0
            );
          },
        );
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
        return withAllocs(
          module,
          [archMaxBytes, typeMaxBytes, WASM_ERR_MAX_BYTES],
          (archPtr, typePtr, errPtr) => {
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
          },
        );
      } finally {
        module._free(pathPtr);
      }
    },

    dafps: (nd, ni, dc, ic) => {
      const { n, m, bytes } = dafComponentLayout(nd, ni);
      const doubles = dafComponents(dc, n, false),
        ints = dafComponents(ic, m, true);
      return withAllocs(
        module,
        [
          Math.max(8, 8 * n),
          Math.max(4, 4 * m),
          Math.max(8, bytes),
          WASM_ERR_MAX_BYTES,
        ],
        (d, i, out, e) => {
          module.HEAPF64.set(doubles, d / 8);
          module.HEAP32.set(ints, i / 4);
          const rc = module._tspice_dafps(
            nd,
            ni,
            d,
            n,
            i,
            m,
            out,
            bytes,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          return module.HEAPU8.slice(out, out + bytes);
        },
      );
    },
    dafus: (summary, nd, ni) => {
      const { n, m, bytes } = dafComponentLayout(nd, ni),
        input = dafBytes(summary, bytes);
      return withAllocs(
        module,
        [
          Math.max(8, bytes),
          Math.max(8, 8 * n),
          Math.max(4, 4 * m),
          WASM_ERR_MAX_BYTES,
        ],
        (s, d, i, e) => {
          module.HEAPU8.set(input, s);
          const rc = module._tspice_dafus(
            s,
            bytes,
            nd,
            ni,
            d,
            n,
            i,
            m,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          return {
            dc: Array.from(module.HEAPF64.subarray(d / 8, d / 8 + n)),
            ic: Array.from(module.HEAP32.subarray(i / 4, i / 4 + m)),
          };
        },
      );
    },
    dafgsr: (handle, recno, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafgsr").nativeHandle;
      const bytes = dafRecordBytes(recno, begin, end, 2097152);
      return withAllocs(
        module,
        [Math.max(8, bytes), 4, WASM_ERR_MAX_BYTES],
        (out, f, e) => {
          const rc = module._tspice_dafgsr(
            h,
            recno,
            begin,
            end,
            out,
            bytes,
            f,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          const found = module.HEAP32[f / 4];
          if (found === 0) return { found: false };
          if (found !== 1) throw new TypeError("Invalid DAFGSR found flag");
          return { found: true, data: module.HEAPU8.slice(out, out + bytes) };
        },
      );
    },
    dafrfr: (handle, ifnlen = 61) => {
      const h = handles.lookup(handle, ["DAF"], "dafrfr").nativeHandle;
      const cap = dafFileNameCapacity(ifnlen);
      return withAllocs(
        module,
        [cap, 20, WASM_ERR_MAX_BYTES],
        (name, fields, e) => {
          const rc = module._tspice_dafrfr(
            h,
            cap,
            name,
            cap,
            fields,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          const bytes = module.HEAPU8.subarray(name, name + cap),
            end = bytes.indexOf(0);
          if (end < 0) throw new TypeError("Missing DAFRFR name terminator");
          const field = (i: number) =>
            readHeapI32(
              module,
              heap32IndexFromPtr(fields, "dafrfr") + i,
              "dafrfr",
            );
          return {
            nd: field(0),
            ni: field(1),
            ifname: new TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: true,
            }).decode(bytes.subarray(0, end)),
            fward: field(2),
            bward: field(3),
            free: field(4),
          };
        },
      );
    },
    dafrda: (handle, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafrda").nativeHandle;
      const words = dafAddressWords(begin, end, 268435456);
      return withAllocs(
        module,
        [Math.max(8, 8 * words), WASM_ERR_MAX_BYTES],
        (out, e) => {
          const rc = module._tspice_dafrda(
            h,
            begin,
            end,
            out,
            words,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          return module.HEAPU8.slice(out, out + 8 * words);
        },
      );
    },
    dafgda: (handle, begin, end) => {
      const h = handles.lookup(handle, ["DAF"], "dafgda").nativeHandle;
      const words = dafAddressWords(begin, end, 268435456);
      return withAllocs(
        module,
        [Math.max(8, 8 * words), WASM_ERR_MAX_BYTES],
        (out, e) => {
          const rc = module._tspice_dafgda(
            h,
            begin,
            end,
            out,
            words,
            e,
            WASM_ERR_MAX_BYTES,
          );
          if (rc) throwWasmSpiceError(module, e, WASM_ERR_MAX_BYTES, rc);
          return Array.from(module.HEAPF64.subarray(out / 8, out / 8 + words));
        },
      );
    },
    dafbbs: (handle: SpiceHandle) =>
      callVoidHandle(
        module,
        module._tspice_dafbbs,
        handles.lookup(handle, ["DAF"], "dafbbs").nativeHandle,
      ),
    dafcs: (handle: SpiceHandle) =>
      callVoidHandle(
        module,
        module._tspice_dafcs,
        handles.lookup(handle, ["DAF"], "dafcs").nativeHandle,
      ),
    daffpa: (handle: SpiceHandle) => {
      const native = handles.lookup(handle, ["DAF"], "daffpa").nativeHandle;
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (err, out) => {
        const code = module._tspice_daffpa(
          native,
          out,
          err,
          WASM_ERR_MAX_BYTES,
        );
        if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
        const flag = readHeapI32(
          module,
          heap32IndexFromPtr(out, "daffpa"),
          "daffpa",
        );
        if (flag !== 0 && flag !== 1)
          throw new TypeError("Invalid DAF search flag");
        return flag === 1;
      });
    },
    dafgh: () =>
      withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (err, out) => {
        const code = module._tspice_dafgh(out, err, WASM_ERR_MAX_BYTES);
        if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
        return handles.findOwned(
          "DAF",
          readHeapI32(module, heap32IndexFromPtr(out, "dafgh"), "dafgh"),
          "dafgh",
        );
      }),
    dafgn: (handle: SpiceHandle, namlen = DAF_MAX_SUMMARY_BYTES + 1) => {
      const native = handles.lookup(handle, ["DAF"], "dafgn").nativeHandle;
      assertSpiceInt32(namlen, "dafgn(namlen)");
      const capacity = Math.min(namlen, DAF_MAX_SUMMARY_BYTES + 1);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, Math.max(capacity, 1)],
        (err, out) => {
          const code = module._tspice_dafgn(
            native,
            capacity,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const bytes = module.HEAPU8.subarray(out, out + capacity);
          const end = bytes.indexOf(0);
          if (end < 0) throw new RangeError("Missing DAF name terminator");
          return new TextDecoder("utf-8", {
            fatal: true,
            ignoreBOM: true,
          }).decode(bytes.subarray(0, end));
        },
      );
    },
    dafgs: (handle: SpiceHandle) => {
      const native = handles.lookup(handle, ["DAF"], "dafgs").nativeHandle;
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, DAF_MAX_SUMMARY_BYTES, 4],
        (err, out, len) => {
          const code = module._tspice_dafgs(
            native,
            out,
            DAF_MAX_SUMMARY_BYTES,
            len,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const count = readHeapI32(
            module,
            heap32IndexFromPtr(len, "dafgs"),
            "dafgs",
          );
          if (count < 8 || count > DAF_MAX_SUMMARY_BYTES || count % 8)
            throw new RangeError("Invalid packed DAF summary size");
          return module.HEAPU8.slice(out, out + count);
        },
      );
    },
    dafhsf: (handle: SpiceHandle) => {
      const native = handles.lookup(handle, ["DAF"], "dafhsf").nativeHandle;
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4, 4], (err, nd, ni) => {
        const code = module._tspice_dafhsf(
          native,
          nd,
          ni,
          err,
          WASM_ERR_MAX_BYTES,
        );
        if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
        return dafSummaryFormat(
          readHeapI32(
            module,
            heap32IndexFromPtr(nd, "dafhsf(nd)"),
            "dafhsf(nd)",
          ),
          readHeapI32(
            module,
            heap32IndexFromPtr(ni, "dafhsf(ni)"),
            "dafhsf(ni)",
          ),
        );
      });
    },
    dafopw: (path: string) => {
      dafPathByteLength(path, WASM_MAX_ALLOC_BYTES - 1);
      const resolved = path.length ? resolveKernelPath(path) : path;
      const size = dafPathByteLength(resolved, WASM_MAX_ALLOC_BYTES - 1) + 1;
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, size, 4],
        (err, pathPtr, out) => {
          const bytes = new TextEncoder().encode(resolved);
          module.HEAPU8.set(bytes, pathPtr);
          module.HEAPU8[pathPtr + bytes.length] = 0;
          const code = module._tspice_dafopw(
            pathPtr,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const handle = readHeapI32(
            module,
            heap32IndexFromPtr(out, "dafopw"),
            "dafopw",
          );
          try {
            return handles.register("DAF", handle);
          } catch (error) {
            // The open already acquired a DAF claim. Reuse the owned error buffer for rollback.
            const closeCode = module._tspice_dafcls(
              handle,
              err,
              WASM_ERR_MAX_BYTES,
            );
            if (closeCode) {
              try {
                throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, closeCode);
              } catch (closeError) {
                throw new AggregateError(
                  [error, closeError],
                  "Cannot register or close DAF writer",
                );
              }
            }
            throw error;
          }
        },
      );
    },
    dafopr: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(
          module,
          [4, WASM_ERR_MAX_BYTES],
          (outHandlePtr, errPtr) => {
            module.HEAP32[outHandlePtr >> 2] = 0;
            const code = module._tspice_dafopr(
              pathPtr,
              outHandlePtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
            return readHeapI32(
              module,
              outHandlePtr >> 2,
              "dafopr(outHandlePtr)",
            );
          },
        );
        return handles.register("DAF", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dafcls: (handle: SpiceHandle) =>
      handles.close(
        handle,
        ["DAF"],
        (entry: SpiceHandleEntry) =>
          callVoidHandle(module, module._tspice_dafcls, entry.nativeHandle),
        "dafcls",
      ),

    dafbfs: (handle: SpiceHandle) =>
      callVoidHandle(
        module,
        module._tspice_dafbfs,
        handles.lookup(handle, ["DAF"], "dafbfs").nativeHandle,
      ),

    daffna: (handle: SpiceHandle) => {
      const nativeHandle = handles.lookup(
        handle,
        ["DAF"],
        "daffna",
      ).nativeHandle;
      return withAllocs(
        module,
        [4, WASM_ERR_MAX_BYTES],
        (outFoundPtr, errPtr) => {
          module.HEAP32[outFoundPtr >> 2] = 0;
          const code = module._tspice_daffna(
            nativeHandle,
            outFoundPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
          return (
            readHeapI32(module, outFoundPtr >> 2, "daffna(outFoundPtr)") !== 0
          );
        },
      );
    },

    dasopr: (path: string) => {
      const resolved = resolveKernelPath(path);
      const pathPtr = writeUtf8CString(module, resolved);
      try {
        const nativeHandle = withAllocs(
          module,
          [4, WASM_ERR_MAX_BYTES],
          (outHandlePtr, errPtr) => {
            module.HEAP32[outHandlePtr >> 2] = 0;
            const code = module._tspice_dasopr(
              pathPtr,
              outHandlePtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
            return readHeapI32(
              module,
              outHandlePtr >> 2,
              "dasopr(outHandlePtr)",
            );
          },
        );
        return handles.register("DAS", nativeHandle);
      } finally {
        module._free(pathPtr);
      }
    },

    dascls: (handle: SpiceHandle) => closeDasBacked(handle, "dascls"),

    dlaopn: (path: string, ftype: string, ifname: string, ncomch: number) => {
      assertString(ftype, "dlaopn(ftype)");
      assertString(ifname, "dlaopn(ifname)");
      assertSpiceInt32NonNegative(ncomch, "dlaopn(ncomch)");

      const resolved = resolveKernelPath(path);

      // `dlaopn_c` creates the output file via C stdio, so we must ensure the
      // directory exists in the Emscripten FS.
      const dir = resolved.split("/").slice(0, -1).join("/") || "/";
      if (dir && dir !== "/") {
        module.FS.mkdirTree(dir);
      }

      const pathPtr = writeUtf8CString(module, resolved);
      let ftypePtr = 0;
      let ifnamePtr = 0;
      try {
        ftypePtr = writeUtf8CString(module, ftype);
        ifnamePtr = writeUtf8CString(module, ifname);
        const nativeHandle = withAllocs(
          module,
          [4, WASM_ERR_MAX_BYTES],
          (outHandlePtr, errPtr) => {
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
            return readHeapI32(
              module,
              outHandlePtr >> 2,
              "dlaopn(outHandlePtr)",
            );
          },
        );

        return handles.register("DLA", nativeHandle);
      } finally {
        if (ifnamePtr) module._free(ifnamePtr);
        if (ftypePtr) module._free(ftypePtr);
        module._free(pathPtr);
      }
    },

    dlabfs: (handle: SpiceHandle): FoundDlaDescriptor => {
      const nativeHandle = handles.lookup(
        handle,
        DAS_BACKED,
        "dlabfs",
      ).nativeHandle;
      return withAllocs(
        module,
        [32, 4, WASM_ERR_MAX_BYTES],
        (outDescr8Ptr, outFoundPtr, errPtr) => {
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

          const found =
            readHeapI32(module, outFoundPtr >> 2, "dlabfs(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false };
          }

          return { found: true, descr: readDlaDescr8(module, outDescr8Ptr) };
        },
      );
    },

    dlafns: (handle: SpiceHandle, descr: DlaDescriptor): FoundDlaDescriptor => {
      assertDlaDescriptor(descr, "dlafns(descr)");
      const nativeHandle = handles.lookup(
        handle,
        DAS_BACKED,
        "dlafns",
      ).nativeHandle;

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

          const found =
            readHeapI32(module, outFoundPtr >> 2, "dlafns(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false };
          }

          return {
            found: true,
            descr: readDlaDescr8(module, outNextDescr8Ptr),
          };
        },
      );
    },

    dlacls: (handle: SpiceHandle) => closeDasBacked(handle, "dlacls"),

    dskopn: (path: string, ifname: string, ncomch: number) => {
      assertString(ifname, "dskopn(ifname)");
      assertSpiceInt32NonNegative(ncomch, "dskopn(ncomch)");

      const resolved = resolveKernelPath(path);

      // `dskopn_c` creates the output file via C stdio, so we must ensure the
      // directory exists in the Emscripten FS.
      const dir = resolved.split("/").slice(0, -1).join("/") || "/";
      if (dir && dir !== "/") {
        module.FS.mkdirTree(dir);
      }

      const pathPtr = writeUtf8CString(module, resolved);
      let ifnamePtr = 0;
      try {
        ifnamePtr = writeUtf8CString(module, ifname);
        const nativeHandle = withAllocs(
          module,
          [4, WASM_ERR_MAX_BYTES],
          (outHandlePtr, errPtr) => {
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
            return readHeapI32(
              module,
              outHandlePtr >> 2,
              "dskopn(outHandlePtr)",
            );
          },
        );

        // DSKs are DAS-backed; register as DAS so `dascls` can close it.
        return handles.register("DAS", nativeHandle);
      } finally {
        if (ifnamePtr) module._free(ifnamePtr);
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
      // Match native argument types before heap writes/FFI can coerce JS values.
      assertNumberArray(vrtces, "dskmi2(vrtces)");
      assertNumberArray(plates, "dskmi2(plates)");
      assertNumber(finscl, "dskmi2(finscl)");
      if (typeof makvtl !== "boolean")
        throw new TypeError("dskmi2(makvtl) must be a boolean");
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
        throw new RangeError(
          `dskmi2(vrtces): expected length ${expectedVrtcesLen}, got ${vrtces.length}`,
        );
      }

      const expectedPlatesLen = np * 3;
      if (expectedPlatesLen <= 0) {
        throw new RangeError("dskmi2(np): expected np > 0");
      }
      if (plates.length !== expectedPlatesLen) {
        throw new RangeError(
          `dskmi2(plates): expected length ${expectedPlatesLen}, got ${plates.length}`,
        );
      }

      for (let i = 0; i < plates.length; i++) {
        const v = plates[i];
        if (v === undefined) {
          throw new RangeError(
            `dskmi2(plates[${i}]): expected a value, got undefined`,
          );
        }
        assertSpiceInt32(v, `dskmi2(plates[${i}])`);
        if (v < 1 || v > nv) {
          throw new RangeError(
            `dskmi2(plates[${i}]): expected value in [1, nv] (nv=${nv}), got ${v}`,
          );
        }
      }

      if (worksz <= 0) {
        throw new RangeError("dskmi2(worksz): expected worksz > 0");
      }
      if (worksz > DSKMI2_MAX_SIZE) {
        throw new RangeError(
          `dskmi2(worksz): expected worksz <= ${DSKMI2_MAX_SIZE}, got ${worksz}`,
        );
      }

      if (spxisz <= 0) {
        throw new RangeError("dskmi2(spxisz): expected spxisz > 0");
      }
      if (spxisz > DSKMI2_MAX_SIZE) {
        throw new RangeError(
          `dskmi2(spxisz): expected spxisz <= ${DSKMI2_MAX_SIZE}, got ${spxisz}`,
        );
      }

      const vrtcesBytes = expectedVrtcesLen * 8;
      const platesBytes = expectedPlatesLen * 4;
      const spaixdBytes = DSK02_IXDFIX * 8;
      const spaixiBytes = spxisz * 4;

      return withAllocs(
        module,
        [
          vrtcesBytes,
          platesBytes,
          spaixdBytes,
          spaixiBytes,
          WASM_ERR_MAX_BYTES,
        ],
        (vrtcesPtr, platesPtr, outSpaixdPtr, outSpaixiPtr, errPtr) => {
          module.HEAPF64.set(vrtces, vrtcesPtr >> 3);
          module.HEAP32.set(plates, platesPtr >> 2);

          module.HEAPF64.fill(
            0,
            outSpaixdPtr >> 3,
            (outSpaixdPtr >> 3) + DSK02_IXDFIX,
          );
          module.HEAP32.fill(
            0,
            outSpaixiPtr >> 2,
            (outSpaixiPtr >> 2) + spxisz,
          );

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
            module.HEAPF64.subarray(
              outSpaixdPtr >> 3,
              (outSpaixdPtr >> 3) + DSK02_IXDFIX,
            ),
          );
          const spaixi = Array.from(
            module.HEAP32.subarray(
              outSpaixiPtr >> 2,
              (outSpaixiPtr >> 2) + spxisz,
            ),
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
      assertString(frame, "dskw02(frame)");
      for (const [label, values] of [
        ["corpar", corpar],
        ["vrtces", vrtces],
        ["plates", plates],
        ["spaixd", spaixd],
        ["spaixi", spaixi],
      ] as const)
        assertNumberArray(values, `dskw02(${label})`);
      for (const [label, value] of [
        ["mncor1", mncor1],
        ["mxcor1", mxcor1],
        ["mncor2", mncor2],
        ["mxcor2", mxcor2],
        ["mncor3", mncor3],
        ["mxcor3", mxcor3],
        ["first", first],
        ["last", last],
      ] as const)
        assertNumber(value, `dskw02(${label})`);
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
        throw new RangeError(
          `dskw02(vrtces): expected length ${expectedVrtcesLen}, got ${vrtces.length}`,
        );
      }

      const expectedPlatesLen = np * 3;
      if (expectedPlatesLen <= 0) {
        throw new RangeError("dskw02(np): expected np > 0");
      }
      if (plates.length !== expectedPlatesLen) {
        throw new RangeError(
          `dskw02(plates): expected length ${expectedPlatesLen}, got ${plates.length}`,
        );
      }

      for (let i = 0; i < plates.length; i++) {
        const v = plates[i];
        if (v === undefined) {
          throw new RangeError(
            `dskw02(plates[${i}]): expected a value, got undefined`,
          );
        }
        assertSpiceInt32(v, `dskw02(plates[${i}])`);
        if (v < 1 || v > nv) {
          throw new RangeError(
            `dskw02(plates[${i}]): expected value in [1, nv] (nv=${nv}), got ${v}`,
          );
        }
      }

      if (corpar.length !== 10) {
        throw new RangeError(
          `dskw02(corpar): expected length 10, got ${corpar.length}`,
        );
      }
      if (spaixd.length !== DSK02_IXDFIX) {
        throw new RangeError(
          `dskw02(spaixd): expected length ${DSK02_IXDFIX}, got ${spaixd.length}`,
        );
      }

      const spaixiLen = spaixi.length;
      assertSpiceInt32NonNegative(spaixiLen, "dskw02(spaixi.length)");
      if (spaixiLen <= 0) {
        throw new RangeError("dskw02(spaixi): expected a non-empty array");
      }

      for (let i = 0; i < spaixiLen; i++) {
        const v = spaixi[i];
        if (v === undefined) {
          throw new RangeError(
            `dskw02(spaixi[${i}]): expected a value, got undefined`,
          );
        }
        assertSpiceInt32(v, `dskw02(spaixi[${i}])`);
      }

      const nativeHandle = handles.lookup(
        handle,
        ["DAS"],
        "dskw02",
      ).nativeHandle;

      const framePtr = writeUtf8CString(module, frame);
      try {
        const corparBytes = 10 * 8;
        const vrtcesBytes = expectedVrtcesLen * 8;
        const platesBytes = expectedPlatesLen * 4;
        const spaixdBytes = DSK02_IXDFIX * 8;
        const spaixiBytes = spaixiLen * 4;

        withAllocs(
          module,
          [
            corparBytes,
            vrtcesBytes,
            platesBytes,
            spaixdBytes,
            spaixiBytes,
            WASM_ERR_MAX_BYTES,
          ],
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

/** Create a {@link FileIoKitApi} implementation for virtual output reads. */
export function createFileIoKitApi(
  module: EmscriptenModule,
  virtualOutputs: VirtualOutputRegistry,
): FileIoKitApi {
  return {
    readVirtualOutput: (output: VirtualOutput) => {
      if (typeof output !== "object" || output === null) {
        throw new Error("readVirtualOutput(output): expected an object");
      }
      const obj = output as { kind?: unknown; path?: unknown };
      if (obj.kind !== "virtual-output") {
        throw new Error(
          "readVirtualOutput(output): expected kind='virtual-output'",
        );
      }
      if (typeof obj.path !== "string") {
        throw new Error(
          "readVirtualOutput(output): expected path to be a string",
        );
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
  };
}
