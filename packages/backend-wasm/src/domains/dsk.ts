import { snapshotPlateInput } from "@rybosome/tspice-core";
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
    pltar(vertices, plates) {
      const verticesData = snapshotPlateInput(
        vertices,
        "vertices",
        WASM_MAX_ALLOC_BYTES,
      );
      const platesData = snapshotPlateInput(
        plates,
        "plates",
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [
          Math.max(1, verticesData.length) * 8,
          Math.max(1, platesData.length) * 4,
          8,
          WASM_ERR_MAX_BYTES,
        ],
        (verticesPtr, platesPtr, outPtr, errPtr) => {
          module.HEAPF64.set(verticesData, verticesPtr / 8);
          module.HEAP32.set(platesData, platesPtr / 4);
          const code = module._tspice_pltar(
            verticesData.length / 3,
            verticesPtr,
            platesData.length / 3,
            platesPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 1);
          return out[0]!;
        },
      );
    },
    pltexp(iverts, delta) {
      const ivertsData = snapshotPlateInput(
        iverts,
        "iverts",
        WASM_MAX_ALLOC_BYTES,
      );
      if (!Number.isFinite(delta)) throw new TypeError("Expected finite delta");
      return withAllocs(
        module,
        [Math.max(1, ivertsData.length) * 8, 72, WASM_ERR_MAX_BYTES],
        (ivertsPtr, outPtr, errPtr) => {
          module.HEAPF64.set(ivertsData, ivertsPtr / 8);
          const code = module._tspice_pltexp(
            ivertsPtr,
            delta,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 9);
          return [
            out[0]!,
            out[1]!,
            out[2]!,
            out[3]!,
            out[4]!,
            out[5]!,
            out[6]!,
            out[7]!,
            out[8]!,
          ];
        },
      );
    },
    pltnp(point, v1, v2, v3) {
      const pointData = snapshotPlateInput(
        point,
        "point",
        WASM_MAX_ALLOC_BYTES,
      );
      const v1Data = snapshotPlateInput(v1, "v1", WASM_MAX_ALLOC_BYTES);
      const v2Data = snapshotPlateInput(v2, "v2", WASM_MAX_ALLOC_BYTES);
      const v3Data = snapshotPlateInput(v3, "v3", WASM_MAX_ALLOC_BYTES);
      return withAllocs(
        module,
        [
          Math.max(1, pointData.length) * 8,
          Math.max(1, v1Data.length) * 8,
          Math.max(1, v2Data.length) * 8,
          Math.max(1, v3Data.length) * 8,
          32,
          WASM_ERR_MAX_BYTES,
        ],
        (pointPtr, v1Ptr, v2Ptr, v3Ptr, outPtr, errPtr) => {
          module.HEAPF64.set(pointData, pointPtr / 8);
          module.HEAPF64.set(v1Data, v1Ptr / 8);
          module.HEAPF64.set(v2Data, v2Ptr / 8);
          module.HEAPF64.set(v3Data, v3Ptr / 8);
          const code = module._tspice_pltnp(
            pointPtr,
            v1Ptr,
            v2Ptr,
            v3Ptr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 4);
          return { pnear: [out[0]!, out[1]!, out[2]!], dist: out[3]! };
        },
      );
    },
    pltnrm(v1, v2, v3) {
      const v1Data = snapshotPlateInput(v1, "v1", WASM_MAX_ALLOC_BYTES);
      const v2Data = snapshotPlateInput(v2, "v2", WASM_MAX_ALLOC_BYTES);
      const v3Data = snapshotPlateInput(v3, "v3", WASM_MAX_ALLOC_BYTES);
      return withAllocs(
        module,
        [
          Math.max(1, v1Data.length) * 8,
          Math.max(1, v2Data.length) * 8,
          Math.max(1, v3Data.length) * 8,
          24,
          WASM_ERR_MAX_BYTES,
        ],
        (v1Ptr, v2Ptr, v3Ptr, outPtr, errPtr) => {
          module.HEAPF64.set(v1Data, v1Ptr / 8);
          module.HEAPF64.set(v2Data, v2Ptr / 8);
          module.HEAPF64.set(v3Data, v3Ptr / 8);
          const code = module._tspice_pltnrm(
            v1Ptr,
            v2Ptr,
            v3Ptr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 3);
          return [out[0]!, out[1]!, out[2]!];
        },
      );
    },
    pltvol(vertices, plates) {
      const verticesData = snapshotPlateInput(
        vertices,
        "vertices",
        WASM_MAX_ALLOC_BYTES,
      );
      const platesData = snapshotPlateInput(
        plates,
        "plates",
        WASM_MAX_ALLOC_BYTES,
      );
      return withAllocs(
        module,
        [
          Math.max(1, verticesData.length) * 8,
          Math.max(1, platesData.length) * 4,
          8,
          WASM_ERR_MAX_BYTES,
        ],
        (verticesPtr, platesPtr, outPtr, errPtr) => {
          module.HEAPF64.set(verticesData, verticesPtr / 8);
          module.HEAP32.set(platesData, platesPtr / 4);
          const code = module._tspice_pltvol(
            verticesData.length / 3,
            verticesPtr,
            platesData.length / 3,
            platesPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 1);
          return out[0]!;
        },
      );
    },
    dskrb2(vertices, plates, corsys, corpar = []) {
      const verticesData = snapshotPlateInput(
        vertices,
        "vertices",
        WASM_MAX_ALLOC_BYTES,
      );
      const platesData = snapshotPlateInput(
        plates,
        "plates",
        WASM_MAX_ALLOC_BYTES,
      );
      assertSpiceInt32(corsys, "dskrb2(corsys)");
      const corparData = snapshotPlateInput(
        corpar,
        "corpar",
        WASM_MAX_ALLOC_BYTES,
      );
      if (corsys === 4 && corparData.length < 2)
        throw new RangeError(
          "Planetodetic bounds require equatorial radius and flattening",
        );
      return withAllocs(
        module,
        [
          Math.max(1, verticesData.length) * 8,
          Math.max(1, platesData.length) * 4,
          Math.max(1, corparData.length) * 8,
          16,
          WASM_ERR_MAX_BYTES,
        ],
        (verticesPtr, platesPtr, corparPtr, outPtr, errPtr) => {
          module.HEAPF64.set(verticesData, verticesPtr / 8);
          module.HEAP32.set(platesData, platesPtr / 4);
          module.HEAPF64.set(corparData, corparPtr / 8);
          const code = module._tspice_dskrb2(
            verticesData.length / 3,
            verticesPtr,
            platesData.length / 3,
            platesPtr,
            corsys,
            corparData.length,
            corparPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (code !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, code);
          const out = module.HEAPF64.subarray(outPtr / 8, outPtr / 8 + 2);
          return { mncor3: out[0]!, mxcor3: out[1]! };
        },
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
