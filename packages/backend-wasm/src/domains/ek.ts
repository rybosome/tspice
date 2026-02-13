import type { EkApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32, assertSpiceInt32NonNegative } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, WASM_MAX_ALLOC_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { readFixedWidthCString, writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";

const UTF8_ENCODER = new TextEncoder();

const INT32_MAX = 2_147_483_647;
// Keep parity with the Node backend's `kMaxEkArrayLen`.
const kMaxEkArrayLen = 1_000_000;
// Prevent pathological `vallen` from forcing enormous allocations.
const kMaxEkVallenBytes = 1_000_000;

function utf8TruncateLen(encoded: Uint8Array, maxBytes: number): number {
  if (maxBytes <= 0) {
    return 0;
  }

  if (encoded.length <= maxBytes) {
    return encoded.length;
  }

  // Truncate to a UTF-8 boundary so we don't split a multi-byte codepoint.
  //
  // We only need to inspect the last few bytes because UTF-8 sequences are
  // at most 4 bytes long.
  let len = maxBytes;
  let start = len - 1;

  // Walk backwards over continuation bytes (10xxxxxx).
  while (start >= 0 && (encoded[start]! & 0b1100_0000) === 0b1000_0000) {
    start--;
  }

  if (start < 0) {
    // The slice starts mid-codepoint (e.g. maxBytes < first codepoint length).
    return 0;
  }

  const lead = encoded[start]!;

  let seqLen: number;
  if ((lead & 0b1000_0000) === 0) {
    seqLen = 1;
  } else if ((lead & 0b1110_0000) === 0b1100_0000) {
    seqLen = 2;
  } else if ((lead & 0b1111_0000) === 0b1110_0000) {
    seqLen = 3;
  } else if ((lead & 0b1111_1000) === 0b1111_0000) {
    seqLen = 4;
  } else {
    // Shouldn't happen for TextEncoder output; treat as a single byte.
    seqLen = 1;
  }

  // If the last codepoint would extend past our slice, drop it.
  if (start + seqLen > len) {
    len = start;
  }

  return len;
}

function writeFixedWidthStringArray(
  module: Pick<EmscriptenModule, "HEAPU8">,
  ptr: number,
  stride: number,
  values: readonly string[],
): void {
  const totalBytes = stride * values.length;
  module.HEAPU8.fill(0, ptr, ptr + totalBytes);

  const maxBytes = Math.max(0, stride - 1);

  let offset = ptr;
  for (const value of values) {
    const encoded = UTF8_ENCODER.encode(value);
    const copyLen = utf8TruncateLen(encoded, maxBytes);
    if (copyLen > 0) {
      module.HEAPU8.set(encoded.subarray(0, copyLen), offset);
    }
    module.HEAPU8[offset + copyLen] = 0;
    offset += stride;
  }
}

function sumEntszsChecked(entszs: readonly number[], nlflgs: readonly unknown[], context: string): number {
  if (entszs.length !== nlflgs.length) {
    throw new RangeError(`${context}: expected entszs.length === nlflgs.length`);
  }

  let sum = 0;
  for (let i = 0; i < entszs.length; i++) {
    const isNull = nlflgs[i];
    if (typeof isNull !== "boolean") {
      throw new TypeError(`${context}: expected nlflgs[${i}] to be a boolean`);
    }

    // CSPICE semantics (keep parity with the C shim + Node addon):
    // - NULL entries may have entszs[i] == 0 (and are allowed to be any value >= 0)
    // - non-NULL entries must have entszs[i] >= 1
    assertSpiceInt32(entszs[i]!, `${context}(entszs[${i}])`, { min: isNull ? 0 : 1 });

    sum += entszs[i]!;
    if (sum > INT32_MAX) {
      throw new RangeError(`${context}: sum(entszs) overflow (max ${INT32_MAX})`);
    }
    if (sum > kMaxEkArrayLen) {
      throw new RangeError(`${context}: sum(entszs) must be <= ${kMaxEkArrayLen}`);
    }
  }
  return sum;
}

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

export function createEkApi(module: EmscriptenModule, handles: SpiceHandleRegistry): EkApi {
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
        return handles.register("EK", nativeHandle);
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
        return handles.register("EK", nativeHandle);
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

        return handles.register("EK", nativeHandle);
      } finally {
        module._free(ifnamePtr);
        module._free(pathPtr);
      }
    },

    ekcls: (handle: SpiceHandle) =>
      handles.close(
        handle,
        EK_ONLY,
        (entry) => callVoidHandle(module, module._tspice_ekcls, entry.nativeHandle),
        "ekcls",
      ),

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
      const nativeHandle = handles.lookup(handle, EK_ONLY, "eknseg").nativeHandle;
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

    ekfind: (query: string) => {
      const queryPtr = writeUtf8CString(module, query);
      const outErrmsgMaxBytes = WASM_ERR_MAX_BYTES;
      try {
        return withAllocs(
          module,
          [4, 4, outErrmsgMaxBytes, WASM_ERR_MAX_BYTES],
          (outNmrowsPtr, outErrorPtr, outErrmsgPtr, errPtr) => {
            module.HEAP32[outNmrowsPtr >> 2] = 0;
            module.HEAP32[outErrorPtr >> 2] = 0;
            module.HEAPU8[outErrmsgPtr] = 0;

            const code = module._tspice_ekfind(
              queryPtr,
              outErrmsgMaxBytes,
              outNmrowsPtr,
              outErrorPtr,
              outErrmsgPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }

            const error = readHeapI32(module, outErrorPtr >> 2, "ekfind(outErrorPtr)") !== 0;
            if (error) {
              return { ok: false, errmsg: readFixedWidthCString(module, outErrmsgPtr, outErrmsgMaxBytes) };
            }

            const nmrows = readHeapI32(module, outNmrowsPtr >> 2, "ekfind(outNmrowsPtr)");
            return { ok: true, nmrows };
          },
        );
      } finally {
        module._free(queryPtr);
      }
    },

    ekgc: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgc(selidx)");
      assertSpiceInt32NonNegative(row, "ekgc(row)");
      assertSpiceInt32NonNegative(elment, "ekgc(elment)");

      // Keep parity with backend-node's `kOutMaxBytes`: large enough to avoid truncating
    // before CSPICE's own ~1024-char EK string limit (1024 + NUL).
    const outMaxBytes = WASM_ERR_MAX_BYTES;
      return withAllocs(
        module,
        [outMaxBytes, 4, 4, WASM_ERR_MAX_BYTES],
        (outCdataPtr, outNullPtr, outFoundPtr, errPtr) => {
          module.HEAPU8[outCdataPtr] = 0;
          module.HEAP32[outNullPtr >> 2] = 0;
          module.HEAP32[outFoundPtr >> 2] = 0;

          const code = module._tspice_ekgc(
            selidx,
            row,
            elment,
            outCdataPtr,
            outMaxBytes,
            outNullPtr,
            outFoundPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          const found = readHeapI32(module, outFoundPtr >> 2, "ekgc(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false } as const;
          }

          const isNull = readHeapI32(module, outNullPtr >> 2, "ekgc(outNullPtr)") !== 0;
          if (isNull) {
            return { found: true, isNull: true } as const;
          }

          return {
            found: true,
            isNull: false,
            value: readFixedWidthCString(module, outCdataPtr, outMaxBytes),
          } as const;
        },
      );
    },

    ekgd: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgd(selidx)");
      assertSpiceInt32NonNegative(row, "ekgd(row)");
      assertSpiceInt32NonNegative(elment, "ekgd(elment)");

      return withAllocs(
        module,
        [8, 4, 4, WASM_ERR_MAX_BYTES],
        (outDdataPtr, outNullPtr, outFoundPtr, errPtr) => {
          module.HEAPF64[outDdataPtr >> 3] = 0;
          module.HEAP32[outNullPtr >> 2] = 0;
          module.HEAP32[outFoundPtr >> 2] = 0;

          const code = module._tspice_ekgd(
            selidx,
            row,
            elment,
            outDdataPtr,
            outNullPtr,
            outFoundPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          const found = readHeapI32(module, outFoundPtr >> 2, "ekgd(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false } as const;
          }

          const isNull = readHeapI32(module, outNullPtr >> 2, "ekgd(outNullPtr)") !== 0;
          if (isNull) {
            return { found: true, isNull: true } as const;
          }

          const value = module.HEAPF64[outDdataPtr >> 3]!;
          return { found: true, isNull: false, value } as const;
        },
      );
    },

    ekgi: (selidx: number, row: number, elment: number) => {
      assertSpiceInt32NonNegative(selidx, "ekgi(selidx)");
      assertSpiceInt32NonNegative(row, "ekgi(row)");
      assertSpiceInt32NonNegative(elment, "ekgi(elment)");

      return withAllocs(
        module,
        [4, 4, 4, WASM_ERR_MAX_BYTES],
        (outIdataPtr, outNullPtr, outFoundPtr, errPtr) => {
          module.HEAP32[outIdataPtr >> 2] = 0;
          module.HEAP32[outNullPtr >> 2] = 0;
          module.HEAP32[outFoundPtr >> 2] = 0;

          const code = module._tspice_ekgi(
            selidx,
            row,
            elment,
            outIdataPtr,
            outNullPtr,
            outFoundPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }

          const found = readHeapI32(module, outFoundPtr >> 2, "ekgi(outFoundPtr)") !== 0;
          if (!found) {
            return { found: false } as const;
          }

          const isNull = readHeapI32(module, outNullPtr >> 2, "ekgi(outNullPtr)") !== 0;
          if (isNull) {
            return { found: true, isNull: true } as const;
          }

          const value = readHeapI32(module, outIdataPtr >> 2, "ekgi(outIdataPtr)");
          return { found: true, isNull: false, value } as const;
        },
      );
    },

    ekifld: (
      handle: SpiceHandle,
      tabnam: string,
      nrows: number,
      cnames: readonly string[],
      decls: readonly string[],
    ) => {
      assertSpiceInt32(nrows, "ekifld(nrows)", { min: 1 });
      if (cnames.length === 0) {
        throw new RangeError("ekifld(cnames): expected cnames.length > 0");
      }
      if (decls.length !== cnames.length) {
        throw new RangeError("ekifld(decls): expected decls.length === cnames.length");
      }

      const ncols = cnames.length;

      let cnamln = 2;
      for (const s of cnames) {
        cnamln = Math.max(cnamln, UTF8_ENCODER.encode(s).length + 1);
      }

      let declen = 2;
      for (const s of decls) {
        declen = Math.max(declen, UTF8_ENCODER.encode(s).length + 1);
      }

      const nativeHandle = lookup(handle).nativeHandle;
      const tabnamPtr = writeUtf8CString(module, tabnam);

      try {
        return withAllocs(
          module,
          [ncols * cnamln, ncols * declen, 4, nrows * 4, WASM_ERR_MAX_BYTES],
          (cnamesPtr, declsPtr, outSegnoPtr, outRcptrsPtr, errPtr) => {
            writeFixedWidthStringArray(module, cnamesPtr, cnamln, cnames);
            writeFixedWidthStringArray(module, declsPtr, declen, decls);

            module.HEAP32[outSegnoPtr >> 2] = 0;

            const code = module._tspice_ekifld(
              nativeHandle,
              tabnamPtr,
              ncols,
              nrows,
              cnamln,
              cnamesPtr,
              declen,
              declsPtr,
              outSegnoPtr,
              outRcptrsPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }

            const segno = readHeapI32(module, outSegnoPtr >> 2, "ekifld(outSegnoPtr)");
            const rcptrsView = module.HEAP32.subarray(outRcptrsPtr >> 2, (outRcptrsPtr >> 2) + nrows);
            return { segno, rcptrs: Array.from(rcptrsView) };
          },
        );
      } finally {
        module._free(tabnamPtr);
      }
    },

    ekacli: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      ivals: readonly number[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekacli(segno)");
      const nrows = rcptrs.length;
      if (entszs.length !== nrows || nlflgs.length !== nrows) {
        throw new RangeError("ekacli(): expected entszs/nlflgs/rcptrs to have the same length");
      }
      if (nrows === 0) {
        throw new RangeError("ekacli(): expected rcptrs.length > 0");
      }

      if (nrows > kMaxEkArrayLen) {
        throw new RangeError(`ekacli(): expected nrows <= ${kMaxEkArrayLen}`);
      }

      const required = sumEntszsChecked(entszs, nlflgs, "ekacli()");
      if (ivals.length !== required) {
        throw new RangeError("ekacli(): expected ivals.length === sum(entszs)");
      }

      const nativeHandle = lookup(handle).nativeHandle;
      const columnPtr = writeUtf8CString(module, column);

      try {
        return withAllocs(
          module,
          [ivals.length * 4, nrows * 4, nrows * 4, nrows * 4, WASM_ERR_MAX_BYTES],
          (ivalsPtr, entszsPtr, nlflgsPtr, rcptrsPtr, errPtr) => {
            module.HEAP32.set(Int32Array.from(ivals), ivalsPtr >> 2);
            module.HEAP32.set(Int32Array.from(entszs), entszsPtr >> 2);
            module.HEAP32.set(Int32Array.from(nlflgs.map((b) => (b ? 1 : 0))), nlflgsPtr >> 2);
            module.HEAP32.set(Int32Array.from(rcptrs), rcptrsPtr >> 2);

            const code = module._tspice_ekacli(
              nativeHandle,
              segno,
              columnPtr,
              nrows,
              ivalsPtr,
              ivals.length,
              entszsPtr,
              nlflgsPtr,
              rcptrsPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
          },
        );
      } finally {
        module._free(columnPtr);
      }
    },

    ekacld: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      dvals: readonly number[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekacld(segno)");
      const nrows = rcptrs.length;
      if (entszs.length !== nrows || nlflgs.length !== nrows) {
        throw new RangeError("ekacld(): expected entszs/nlflgs/rcptrs to have the same length");
      }
      if (nrows === 0) {
        throw new RangeError("ekacld(): expected rcptrs.length > 0");
      }

      if (nrows > kMaxEkArrayLen) {
        throw new RangeError(`ekacld(): expected nrows <= ${kMaxEkArrayLen}`);
      }

      const required = sumEntszsChecked(entszs, nlflgs, "ekacld()");
      if (dvals.length !== required) {
        throw new RangeError("ekacld(): expected dvals.length === sum(entszs)");
      }

      const nativeHandle = lookup(handle).nativeHandle;
      const columnPtr = writeUtf8CString(module, column);

      try {
        return withAllocs(
          module,
          [dvals.length * 8, nrows * 4, nrows * 4, nrows * 4, WASM_ERR_MAX_BYTES],
          (dvalsPtr, entszsPtr, nlflgsPtr, rcptrsPtr, errPtr) => {
            module.HEAPF64.set(Float64Array.from(dvals), dvalsPtr >> 3);
            module.HEAP32.set(Int32Array.from(entszs), entszsPtr >> 2);
            module.HEAP32.set(Int32Array.from(nlflgs.map((b) => (b ? 1 : 0))), nlflgsPtr >> 2);
            module.HEAP32.set(Int32Array.from(rcptrs), rcptrsPtr >> 2);

            const code = module._tspice_ekacld(
              nativeHandle,
              segno,
              columnPtr,
              nrows,
              dvalsPtr,
              dvals.length,
              entszsPtr,
              nlflgsPtr,
              rcptrsPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
          },
        );
      } finally {
        module._free(columnPtr);
      }
    },

    ekaclc: (
      handle: SpiceHandle,
      segno: number,
      column: string,
      cvals: readonly string[],
      entszs: readonly number[],
      nlflgs: readonly boolean[],
      rcptrs: readonly number[],
    ) => {
      assertSpiceInt32NonNegative(segno, "ekaclc(segno)");
      const nrows = rcptrs.length;
      if (entszs.length !== nrows || nlflgs.length !== nrows) {
        throw new RangeError("ekaclc(): expected entszs/nlflgs/rcptrs to have the same length");
      }
      if (nrows === 0) {
        throw new RangeError("ekaclc(): expected rcptrs.length > 0");
      }

      if (nrows > kMaxEkArrayLen) {
        throw new RangeError(`ekaclc(): expected nrows <= ${kMaxEkArrayLen}`);
      }

      const required = sumEntszsChecked(entszs, nlflgs, "ekaclc()");
      if (cvals.length !== required) {
        throw new RangeError("ekaclc(): expected cvals.length === sum(entszs)");
      }

      const nvals = cvals.length;

      let vallen = 1;
      for (const s of cvals) {
        const bytes = UTF8_ENCODER.encode(s).length + 1;
        if (bytes > kMaxEkVallenBytes) {
          throw new RangeError(`ekaclc(): value byte length exceeds cap (${kMaxEkVallenBytes})`);
        }
        vallen = Math.max(vallen, bytes);
      }

      if (nvals > kMaxEkArrayLen) {
        throw new RangeError(`ekaclc(): expected nvals <= ${kMaxEkArrayLen}`);
      }
      if (!Number.isSafeInteger(nvals * vallen)) {
        throw new RangeError("ekaclc(): cvals buffer size overflow");
      }
      const cvalsMaxBytes = nvals * vallen;
      if (cvalsMaxBytes > WASM_MAX_ALLOC_BYTES) {
        throw new RangeError(`ekaclc(): cvals buffer too large (${cvalsMaxBytes} bytes)`);
      }

      const nativeHandle = lookup(handle).nativeHandle;
      const columnPtr = writeUtf8CString(module, column);

      try {
        return withAllocs(
          module,
          [nvals * vallen, nrows * 4, nrows * 4, nrows * 4, WASM_ERR_MAX_BYTES],
          (cvalsPtr, entszsPtr, nlflgsPtr, rcptrsPtr, errPtr) => {
            writeFixedWidthStringArray(module, cvalsPtr, vallen, cvals);
            module.HEAP32.set(Int32Array.from(entszs), entszsPtr >> 2);
            module.HEAP32.set(Int32Array.from(nlflgs.map((b) => (b ? 1 : 0))), nlflgsPtr >> 2);
            module.HEAP32.set(Int32Array.from(rcptrs), rcptrsPtr >> 2);

            const code = module._tspice_ekaclc(
              nativeHandle,
              segno,
              columnPtr,
              nrows,
              nvals,
              vallen,
              cvalsMaxBytes,
              cvalsPtr,
              entszsPtr,
              nlflgsPtr,
              rcptrsPtr,
              errPtr,
              WASM_ERR_MAX_BYTES,
            );
            if (code !== 0) {
              throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
            }
          },
        );
      } finally {
        module._free(columnPtr);
      }
    },

    ekffld: (handle: SpiceHandle, segno: number, rcptrs: readonly number[]) => {
      assertSpiceInt32NonNegative(segno, "ekffld(segno)");
      if (rcptrs.length === 0) {
        throw new RangeError("ekffld(rcptrs): expected rcptrs.length > 0");
      }

      const nativeHandle = lookup(handle).nativeHandle;

      return withAllocs(
        module,
        [rcptrs.length * 4, WASM_ERR_MAX_BYTES],
        (rcptrsPtr, errPtr) => {
          module.HEAP32.set(Int32Array.from(rcptrs), rcptrsPtr >> 2);
          const code = module._tspice_ekffld(nativeHandle, segno, rcptrsPtr, errPtr, WASM_ERR_MAX_BYTES);
          if (code !== 0) {
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          }
        },
      );
    },
  } satisfies EkApi;

  return api;
}
