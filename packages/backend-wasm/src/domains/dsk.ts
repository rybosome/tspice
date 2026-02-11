import type {
  DlaDescriptor,
  DskApi,
  DskDescriptor,
  DskType2Bookkeeping,
  SpiceHandle,
  SpiceIntCell,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { WASM_ERR_MAX_BYTES, withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";
import { resolveKernelPath } from "../runtime/fs.js";
import type { SpiceHandleKind, SpiceHandleRegistry } from "../runtime/spice-handles.js";

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

function assertDlaDescriptor(value: unknown, context: string): asserts value is DlaDescriptor {
  invariant(typeof value === "object" && value !== null, `${context}: expected an object`);
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
  }
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

function tspiceCallDskobj(module: EmscriptenModule, dsk: string, bodids: SpiceIntCell): void {
  const errPtr = module._malloc(WASM_ERR_MAX_BYTES);
  const dskPathPtr = writeUtf8CString(module, resolveKernelPath(dsk));

  if (!errPtr || !dskPathPtr) {
    if (dskPathPtr) module._free(dskPathPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    const code = module._tspice_dskobj(
      dskPathPtr,
      bodids as unknown as number,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  } finally {
    module._free(dskPathPtr);
    module._free(errPtr);
  }
}

function tspiceCallDsksrf(
  module: EmscriptenModule,
  dsk: string,
  bodyid: number,
  srfids: SpiceIntCell,
): void {
  const errPtr = module._malloc(WASM_ERR_MAX_BYTES);
  const dskPathPtr = writeUtf8CString(module, resolveKernelPath(dsk));

  if (!errPtr || !dskPathPtr) {
    if (dskPathPtr) module._free(dskPathPtr);
    if (errPtr) module._free(errPtr);
    throw new Error("WASM malloc failed");
  }

  try {
    const code = module._tspice_dsksrf(
      dskPathPtr,
      bodyid,
      srfids as unknown as number,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (code !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
    }
  } finally {
    module._free(dskPathPtr);
    module._free(errPtr);
  }
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
        module.HEAPF64.subarray(outDoubles18Ptr >> 3, (outDoubles18Ptr >> 3) + 18),
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
        module.HEAPF64.subarray(outDoubles10Ptr >> 3, (outDoubles10Ptr >> 3) + 10),
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

export function createDskApi(module: EmscriptenModule, handles: SpiceHandleRegistry): DskApi {
  return {
    dskobj: (dsk: string, bodids: SpiceIntCell) => {
      tspiceCallDskobj(module, dsk, bodids);
    },

    dsksrf: (dsk: string, bodyid: number, srfids: SpiceIntCell) => {
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
