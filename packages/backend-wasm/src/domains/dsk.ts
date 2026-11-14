import {
  snapshotDskDataDescriptor,
  dskPageStorage,
  dskDataRows,
} from "@rybosome/tspice-core";
import type {
  DlaDescriptor,
  DskApi,
  DskDescriptor,
  DskType2Bookkeeping,
  SpiceHandle,
  SpiceIntCell,
} from "@rybosome/tspice-backend-contract";
import { invariant, assertSpiceInt32 } from "@rybosome/tspice-core";

import { WASM_MAX_ALLOC_BYTES } from "../codec/alloc.js";
import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs, withMalloc } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type {
  SpiceHandleKind,
  SpiceHandleRegistry,
} from "../runtime/spice-handles.js";

import { assertWasmOwnedCellHandle, wasmCellPointer } from "./cells-windows.js";

const DAS_BACKED = ["DAS", "DLA"] as const satisfies readonly SpiceHandleKind[];

const I32_MIN = -2147483648;
const I32_MAX = 2147483647;

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

function assertDlaDescriptor(
  value: unknown,
  context: string,
): asserts value is DlaDescriptor {
  invariant(
    typeof value === "object" && value !== null,
    `${context}: expected an object`,
  );
  const obj = value as Record<string, unknown>;
  for (const key of DESCR_KEYS) {
    const v = obj[key];
    invariant(
      typeof v === "number" &&
        Number.isInteger(v) &&
        v >= I32_MIN &&
        v <= I32_MAX,
      `${context}: expected ${key} to be a 32-bit signed integer`,
    );
    const min = key === "bwdptr" || key === "fwdptr" ? -1 : 0;
    invariant(v >= min, `${context}: expected ${key} >= ${min}`);
  }
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

function tspiceCallDskobj(
  module: EmscriptenModule,
  dsk: string,
  bodids: SpiceIntCell,
): void {
  return withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const dskPathPtr = writeUtf8CString(module, resolveKernelPath(dsk));
    try {
      const code = module._tspice_dskobj(
        dskPathPtr,
        wasmCellPointer(module, bodids, "dskobj()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
    } finally {
      module._free(dskPathPtr);
    }
  });
}

function tspiceCallDsksrf(
  module: EmscriptenModule,
  dsk: string,
  bodyid: number,
  srfids: SpiceIntCell,
): void {
  return withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const dskPathPtr = writeUtf8CString(module, resolveKernelPath(dsk));
    try {
      const code = module._tspice_dsksrf(
        dskPathPtr,
        bodyid,
        wasmCellPointer(module, srfids, "dsksrf()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }
    } finally {
      module._free(dskPathPtr);
    }
  });
}

function tspiceCallDskgd(
  module: EmscriptenModule,
  handle: number,
  dladsc: DlaDescriptor,
): DskDescriptor {
  return withAllocs(
    module,
    [32, 24, 18 * 8, WASM_ERR_MAX_BYTES],
    (inDescr8Ptr, outInts6Ptr, outDoubles18Ptr, errPtr) => {
      writeDlaDescr8(module, inDescr8Ptr, dladsc);

      const code = module._tspice_dskgd(
        handle,
        inDescr8Ptr,
        outInts6Ptr,
        outDoubles18Ptr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }

      const ints = Array.from(
        module.HEAP32.subarray(outInts6Ptr >> 2, (outInts6Ptr >> 2) + 6),
      );
      const doubles = Array.from(
        module.HEAPF64.subarray(
          outDoubles18Ptr >> 3,
          (outDoubles18Ptr >> 3) + 18,
        ),
      );

      return {
        surfce: ints[0] ?? 0,
        center: ints[1] ?? 0,
        dclass: ints[2] ?? 0,
        dtype: ints[3] ?? 0,
        frmcde: ints[4] ?? 0,
        corsys: ints[5] ?? 0,
        corpar: doubles.slice(0, 10),
        co1min: doubles[10] ?? 0,
        co1max: doubles[11] ?? 0,
        co2min: doubles[12] ?? 0,
        co2max: doubles[13] ?? 0,
        co3min: doubles[14] ?? 0,
        co3max: doubles[15] ?? 0,
        start: doubles[16] ?? 0,
        stop: doubles[17] ?? 0,
      };
    },
  );
}

function tspiceCallDskb02(
  module: EmscriptenModule,
  handle: number,
  dladsc: DlaDescriptor,
): DskType2Bookkeeping {
  return withAllocs(
    module,
    [32, 10 * 4, 10 * 8, WASM_ERR_MAX_BYTES],
    (inDescr8Ptr, outInts10Ptr, outDoubles10Ptr, errPtr) => {
      writeDlaDescr8(module, inDescr8Ptr, dladsc);

      const code = module._tspice_dskb02(
        handle,
        inDescr8Ptr,
        outInts10Ptr,
        outDoubles10Ptr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (code !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
      }

      const ints = Array.from(
        module.HEAP32.subarray(outInts10Ptr >> 2, (outInts10Ptr >> 2) + 10),
      );
      const doubles = Array.from(
        module.HEAPF64.subarray(
          outDoubles10Ptr >> 3,
          (outDoubles10Ptr >> 3) + 10,
        ),
      );

      return {
        nv: ints[0] ?? 0,
        np: ints[1] ?? 0,
        nvxtot: ints[2] ?? 0,
        vtxbds: [
          [doubles[0] ?? 0, doubles[1] ?? 0],
          [doubles[2] ?? 0, doubles[3] ?? 0],
          [doubles[4] ?? 0, doubles[5] ?? 0],
        ],
        voxsiz: doubles[6] ?? 0,
        voxori: [doubles[7] ?? 0, doubles[8] ?? 0, doubles[9] ?? 0],
        vgrext: [ints[3] ?? 0, ints[4] ?? 0, ints[5] ?? 0],
        cgscal: ints[6] ?? 0,
        vtxnpl: ints[7] ?? 0,
        voxnpt: ints[8] ?? 0,
        voxnpl: ints[9] ?? 0,
      };
    },
  );
}

/** Create a {@link DskApi} implementation backed by a WASM Emscripten module. */
export function createDskApi(
  module: EmscriptenModule,
  handles: SpiceHandleRegistry,
): DskApi {
  return {
    dskd02(handle, dladsc, item, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskd02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertSpiceInt32(item, "dskd02(item)");
      assertSpiceInt32(start, "dskd02(start)");
      assertSpiceInt32(room, "dskd02(room)");
      const words = dskPageStorage(
        descriptor.dsize,
        room,
        1,
        8,
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [32, 4, words * 8, WASM_ERR_MAX_BYTES],
        (descr, count, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          module.HEAP32[count / 4] = 0;
          const code = module._tspice_dskd02(
            actual,
            descr,
            item,
            start,
            room,
            words,
            count,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = module.HEAP32[count / 4]! * 1;
          if (length < 0 || length > words)
            throw new RangeError("Invalid WASM DSK count");
          const result = Array.from(
            module.HEAPF64.subarray(out / 8, out / 8 + length),
          );
          return result;
        },
      );
    },
    dski02(handle, dladsc, item, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dski02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertSpiceInt32(item, "dski02(item)");
      assertSpiceInt32(start, "dski02(start)");
      assertSpiceInt32(room, "dski02(room)");
      const words = dskPageStorage(
        descriptor.isize,
        room,
        1,
        4,
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [32, 4, words * 4, WASM_ERR_MAX_BYTES],
        (descr, count, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          module.HEAP32[count / 4] = 0;
          const code = module._tspice_dski02(
            actual,
            descr,
            item,
            start,
            room,
            words,
            count,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = module.HEAP32[count / 4]! * 1;
          if (length < 0 || length > words)
            throw new RangeError("Invalid WASM DSK count");
          const result = Array.from(
            module.HEAP32.subarray(out / 4, out / 4 + length),
          );
          return result;
        },
      );
    },
    dskn02(handle, dladsc, plid) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskn02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertSpiceInt32(plid, "dskn02(plid)");
      const words = 3;
      return withAllocs(
        module,
        [32, words * 8, WASM_ERR_MAX_BYTES],
        (descr, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          const code = module._tspice_dskn02(
            actual,
            descr,
            plid,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = words;
          const result = Array.from(
            module.HEAPF64.subarray(out / 8, out / 8 + length),
          );
          if (result.length !== words)
            throw new RangeError("Invalid DSK result length");
          return [result[0]!, result[1]!, result[2]!];
        },
      );
    },
    dskp02(handle, dladsc, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskp02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertSpiceInt32(start, "dskp02(start)");
      assertSpiceInt32(room, "dskp02(room)");
      const words = dskPageStorage(
        descriptor.isize,
        room,
        3,
        4,
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [32, 4, words * 4, WASM_ERR_MAX_BYTES],
        (descr, count, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          module.HEAP32[count / 4] = 0;
          const code = module._tspice_dskp02(
            actual,
            descr,
            start,
            room,
            words,
            count,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = module.HEAP32[count / 4]! * 3;
          if (length < 0 || length > words)
            throw new RangeError("Invalid WASM DSK count");
          const result = Array.from(
            module.HEAP32.subarray(out / 4, out / 4 + length),
          );
          return dskDataRows(result);
        },
      );
    },
    dskv02(handle, dladsc, start, room) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskv02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      assertSpiceInt32(start, "dskv02(start)");
      assertSpiceInt32(room, "dskv02(room)");
      const words = dskPageStorage(
        descriptor.dsize,
        room,
        3,
        8,
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [32, 4, words * 8, WASM_ERR_MAX_BYTES],
        (descr, count, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          module.HEAP32[count / 4] = 0;
          const code = module._tspice_dskv02(
            actual,
            descr,
            start,
            room,
            words,
            count,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = module.HEAP32[count / 4]! * 3;
          if (length < 0 || length > words)
            throw new RangeError("Invalid WASM DSK count");
          const result = Array.from(
            module.HEAPF64.subarray(out / 8, out / 8 + length),
          );
          return dskDataRows(result);
        },
      );
    },
    dskz02(handle, dladsc) {
      const actual = handles.lookup(handle, DAS_BACKED, "dskz02").nativeHandle;
      const descriptor = snapshotDskDataDescriptor(dladsc);
      const words = 2;
      return withAllocs(
        module,
        [32, words * 4, WASM_ERR_MAX_BYTES],
        (descr, out, err) => {
          writeDlaDescr8(module, descr, descriptor);
          const code = module._tspice_dskz02(
            actual,
            descr,
            out,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          const length = words;
          const result = Array.from(
            module.HEAP32.subarray(out / 4, out / 4 + length),
          );
          if (result.length !== words)
            throw new RangeError("Invalid DSK result length");
          return { nv: result[0]!, np: result[1]! };
        },
      );
    },
    dskcls(handle, optmiz) {
      if (typeof optmiz !== "boolean")
        throw new TypeError("Expected boolean optimize flag");
      handles.close(
        handle,
        DAS_BACKED,
        (entry) => {
          withMalloc(module, WASM_ERR_MAX_BYTES, (err) => {
            const code = module._tspice_dskcls(
              entry.nativeHandle,
              optmiz ? 1 : 0,
              err,
              WASM_ERR_MAX_BYTES,
            );
            if (code)
              throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
          });
        },
        "dskcls",
      );
    },
    dskobj: (dsk: string, bodids: SpiceIntCell) => {
      assertWasmOwnedCellHandle(module, bodids, "dskobj(bodids)");
      tspiceCallDskobj(module, dsk, bodids);
    },

    dsksrf: (dsk: string, bodyid: number, srfids: SpiceIntCell) => {
      assertSpiceInt32(bodyid, "dsksrf(bodyid)");
      assertWasmOwnedCellHandle(module, srfids, "dsksrf(srfids)");
      tspiceCallDsksrf(module, dsk, bodyid, srfids);
    },

    dskgd: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskgd(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskgd");
      return tspiceCallDskgd(module, entry.nativeHandle, dladsc);
    },

    dskb02: (handle: SpiceHandle, dladsc: DlaDescriptor) => {
      assertDlaDescriptor(dladsc, "dskb02(dladsc)");
      const entry = handles.lookup(handle, DAS_BACKED, "dskb02");
      return tspiceCallDskb02(module, entry.nativeHandle, dladsc);
    },
  } satisfies DskApi;
}
