import {
  legacyPlateRows,
  maxLegacyPlateRows,
  surfaceGrid,
  surfaceVectors,
  surfaceTextBytes,
  dskRay,
  dskRayBatch,
  dskRaySelection,
  dskPoint,
  dskRaySource,
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

const legacyTextEncoder = new TextEncoder();
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
  function check(code: number, err: number) {
    if (code) throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, code);
  }
  function withSelection<T>(
    target: string,
    fixref: string,
    surfaces: Int32Array,
    sizes: number[],
    run: (
      err: number,
      trg: number,
      frame: number,
      ids: number,
      ...rest: number[]
    ) => T,
  ) {
    const enc = new TextEncoder(),
      t = enc.encode(target),
      f = enc.encode(fixref);
    return withAllocs(
      module,
      [
        WASM_ERR_MAX_BYTES,
        t.length + 1,
        f.length + 1,
        Math.max(4, surfaces.byteLength),
        ...sizes,
      ],
      (err, trg, frame, ids, ...rest) => {
        module.HEAPU8.set(t, trg);
        module.HEAPU8[trg + t.length] = 0;
        module.HEAPU8.set(f, frame);
        module.HEAPU8[frame + f.length] = 0;
        module.HEAP32.set(surfaces, ids >>> 2);
        return run(err, trg, frame, ids, ...rest);
      },
    );
  }
  return {
    illum_pl02(handle, dladsc, target, et, abcorr, obsrvr, spoint) {
      const h = handles.lookup(handle, DAS_BACKED, "illum_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const words = dskRay(spoint);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(target),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          words.byteLength,
          3 * 8,
          1 * 4,
        ],
        (
          err,
          ds,
          targetPtr,
          abcorrPtr,
          obsrvrPtr,
          spointPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          module.HEAPF64.set(words, spointPtr >>> 3);
          check(
            module._tspice_illum_pl02(
              h,
              ds,
              targetPtr,
              et,
              abcorrPtr,
              obsrvrPtr,
              spointPtr,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 3);
          return { phase: out[0]!, solar: out[1]!, emissn: out[2]! };
        },
      );
    },
    illum_plid_pl02(handle, dladsc, target, et, abcorr, obsrvr, spoint, plid) {
      const h = handles.lookup(
        handle,
        DAS_BACKED,
        "illum_plid_pl02",
      ).nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      assertSpiceInt32(plid, "plate ID");
      const words = dskRay(spoint);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(target),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          words.byteLength,
          7 * 8,
          2 * 4,
        ],
        (
          err,
          ds,
          targetPtr,
          abcorrPtr,
          obsrvrPtr,
          spointPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          module.HEAPF64.set(words, spointPtr >>> 3);
          check(
            module._tspice_illum_plid_pl02(
              h,
              ds,
              targetPtr,
              et,
              abcorrPtr,
              obsrvrPtr,
              spointPtr,
              plid,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 7),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + 2);
          return {
            trgepc: out[0]!,
            srfvec: dskPoint([out[1]!, out[2]!, out[3]!]),
            phase: out[4]!,
            solar: out[5]!,
            emissn: out[6]!,
            visible: ids[0] !== 0,
            lit: ids[1] !== 0,
          };
        },
      );
    },
    limb_pl02(handle, dladsc, target, et, fixref, abcorr, obsrvr, npts) {
      const h = handles.lookup(handle, DAS_BACKED, "limb_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const rows = legacyPlateRows(npts);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          (4 + 3 * rows) * 8,
          rows * 4,
        ],
        (
          err,
          ds,
          targetPtr,
          fixrefPtr,
          abcorrPtr,
          obsrvrPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(fixref), fixrefPtr);
          module.HEAPU8[fixrefPtr + surfaceTextBytes(fixref) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          check(
            module._tspice_limb_pl02(
              h,
              ds,
              targetPtr,
              et,
              fixrefPtr,
              abcorrPtr,
              obsrvrPtr,
              npts,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(
              outPtr >>> 3,
              (outPtr >>> 3) + (4 + 3 * rows),
            ),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + rows);
          return {
            trgepc: out[0]!,
            obspos: dskPoint([out[1]!, out[2]!, out[3]!]),
            lmbpts: surfaceVectors(out.subarray(4), npts),
            pltids: Array.from(ids.subarray(0, npts)),
          };
        },
      );
    },
    llgrid_pl02(handle, dladsc, grid) {
      const h = handles.lookup(handle, DAS_BACKED, "llgrid_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      const { count: npts, words } = surfaceGrid(grid, 2, maxLegacyPlateRows);
      const rows = legacyPlateRows(npts);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, 32, words.byteLength, 3 * rows * 8, rows * 4],
        (err, ds, gridPtr, outPtr, idsPtr) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPF64.set(words, gridPtr >>> 3);
          check(
            module._tspice_llgrid_pl02(
              h,
              ds,
              npts,
              gridPtr,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(
              outPtr >>> 3,
              (outPtr >>> 3) + 3 * rows,
            ),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + rows);
          return {
            srfpts: surfaceVectors(out.subarray(0), npts),
            pltids: Array.from(ids.subarray(0, npts)),
          };
        },
      );
    },
    subpt_pl02(handle, dladsc, method, target, et, abcorr, obsrvr) {
      const h = handles.lookup(handle, DAS_BACKED, "subpt_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(method),
          surfaceTextBytes(target),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          4 * 8,
          1 * 4,
        ],
        (
          err,
          ds,
          methodPtr,
          targetPtr,
          abcorrPtr,
          obsrvrPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(method), methodPtr);
          module.HEAPU8[methodPtr + surfaceTextBytes(method) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          check(
            module._tspice_subpt_pl02(
              h,
              ds,
              methodPtr,
              targetPtr,
              et,
              abcorrPtr,
              obsrvrPtr,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 4),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + 1);
          return {
            spoint: dskPoint([out[0]!, out[1]!, out[2]!]),
            alt: out[3]!,
            plateID: ids[0]!,
          };
        },
      );
    },
    subsol_pl02(handle, dladsc, method, target, et, abcorr, obsrvr) {
      const h = handles.lookup(handle, DAS_BACKED, "subsol_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(method),
          surfaceTextBytes(target),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          4 * 8,
          1 * 4,
        ],
        (
          err,
          ds,
          methodPtr,
          targetPtr,
          abcorrPtr,
          obsrvrPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(method), methodPtr);
          module.HEAPU8[methodPtr + surfaceTextBytes(method) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          check(
            module._tspice_subsol_pl02(
              h,
              ds,
              methodPtr,
              targetPtr,
              et,
              abcorrPtr,
              obsrvrPtr,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 4),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + 1);
          return {
            spoint: dskPoint([out[0]!, out[1]!, out[2]!]),
            dist: out[3]!,
            plateID: ids[0]!,
          };
        },
      );
    },
    term_pl02(
      handle,
      dladsc,
      trmtyp,
      source,
      target,
      et,
      fixref,
      abcorr,
      obsrvr,
      npts,
    ) {
      const h = handles.lookup(handle, DAS_BACKED, "term_pl02").nativeHandle;
      const desc = snapshotDskDataDescriptor(dladsc);
      if (!Number.isFinite(et))
        throw new TypeError("Expected finite plate epoch");
      const rows = legacyPlateRows(npts);
      return withAllocs(
        module,
        [
          WASM_ERR_MAX_BYTES,
          32,
          surfaceTextBytes(trmtyp),
          surfaceTextBytes(source),
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(obsrvr),
          (4 + 3 * rows) * 8,
          rows * 4,
        ],
        (
          err,
          ds,
          trmtypPtr,
          sourcePtr,
          targetPtr,
          fixrefPtr,
          abcorrPtr,
          obsrvrPtr,
          outPtr,
          idsPtr,
        ) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPU8.set(legacyTextEncoder.encode(trmtyp), trmtypPtr);
          module.HEAPU8[trmtypPtr + surfaceTextBytes(trmtyp) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(source), sourcePtr);
          module.HEAPU8[sourcePtr + surfaceTextBytes(source) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(target), targetPtr);
          module.HEAPU8[targetPtr + surfaceTextBytes(target) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(fixref), fixrefPtr);
          module.HEAPU8[fixrefPtr + surfaceTextBytes(fixref) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(abcorr), abcorrPtr);
          module.HEAPU8[abcorrPtr + surfaceTextBytes(abcorr) - 1] = 0;
          module.HEAPU8.set(legacyTextEncoder.encode(obsrvr), obsrvrPtr);
          module.HEAPU8[obsrvrPtr + surfaceTextBytes(obsrvr) - 1] = 0;
          check(
            module._tspice_term_pl02(
              h,
              ds,
              trmtypPtr,
              sourcePtr,
              targetPtr,
              et,
              fixrefPtr,
              abcorrPtr,
              obsrvrPtr,
              npts,
              outPtr,
              idsPtr,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const out = module.HEAPF64.subarray(
              outPtr >>> 3,
              (outPtr >>> 3) + (4 + 3 * rows),
            ),
            ids = module.HEAP32.subarray(idsPtr >>> 2, (idsPtr >>> 2) + rows);
          return {
            trgepc: out[0]!,
            obspos: dskPoint([out[1]!, out[2]!, out[3]!]),
            trmpts: surfaceVectors(out.subarray(4), npts),
            pltids: Array.from(ids.subarray(0, npts)),
          };
        },
      );
    },
    dskx02(handle, dladsc, vertex, raydir) {
      const h = handles.lookup(handle, DAS_BACKED, "dskx02").nativeHandle,
        desc = snapshotDskDataDescriptor(dladsc),
        v = dskRay(vertex),
        d = dskRay(raydir);
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, 32, 24, 24, 4, 24, 4],
        (err, ds, vp, dp, id, out, found) => {
          writeDlaDescr8(module, ds, desc);
          module.HEAPF64.set(v, vp >>> 3);
          module.HEAPF64.set(d, dp >>> 3);
          check(
            module._tspice_dskx02(
              h,
              ds,
              vp,
              dp,
              id,
              out,
              found,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          return module.HEAP32[found >>> 2]
            ? {
                found: true,
                plid: module.HEAP32[id >>> 2]!,
                xpt: dskPoint(
                  Array.from(
                    module.HEAPF64.subarray(out >>> 3, (out >>> 3) + 3),
                  ),
                ),
              }
            : { found: false };
        },
      );
    },
    dskxsi(
      pri,
      target,
      srflst,
      et,
      fixref,
      vertex,
      raydir,
      maxd = 1,
      maxi = 1,
    ) {
      const surfaces = dskRaySelection(pri, target, srflst, et, fixref);
      assertSpiceInt32(maxd, "maxd");
      assertSpiceInt32(maxi, "maxi");
      const v = dskRay(vertex),
        d = dskRay(raydir);
      return withSelection(
        target,
        fixref,
        surfaces,
        [24, 24, 216, 44],
        (err, trg, frame, ids, vp, dp, out, ints) => {
          module.HEAPF64.set(v, vp >>> 3);
          module.HEAPF64.set(d, dp >>> 3);
          check(
            module._tspice_dskxsi(
              pri ? 1 : 0,
              trg,
              surfaces.length,
              ids,
              et,
              frame,
              vp,
              dp,
              maxd,
              maxi,
              out,
              ints,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          const i = ints >>> 2;
          if (!module.HEAP32[i]) return { found: false };
          return dskRaySource(
            module.HEAP32[i + 1]!,
            module.HEAP32[i + 10]!,
            Array.from(module.HEAP32.subarray(i + 2, i + 10)),
            Array.from(module.HEAPF64.subarray(out >>> 3, (out >>> 3) + 27)),
          );
        },
      );
    },
    dskxv(pri, target, srflst, et, fixref, vertices, dirs) {
      const surfaces = dskRaySelection(pri, target, srflst, et, fixref);
      const { v, d, n } = dskRayBatch(vertices, dirs);
      const bytes = Math.max(24, v.byteLength);
      return withSelection(
        target,
        fixref,
        surfaces,
        [bytes, bytes, bytes, Math.max(4, n * 4)],
        (err, trg, frame, ids, vp, dp, out, flags) => {
          module.HEAPF64.set(v, vp >>> 3);
          module.HEAPF64.set(d, dp >>> 3);
          check(
            module._tspice_dskxv(
              pri ? 1 : 0,
              trg,
              surfaces.length,
              ids,
              et,
              frame,
              n,
              vp,
              dp,
              out,
              flags,
              err,
              WASM_ERR_MAX_BYTES,
            ),
            err,
          );
          return Array.from({ length: n }, (_, i) => {
            const offset = (out >>> 3) + 3 * i;
            return module.HEAP32[(flags >>> 2) + i]
              ? {
                  found: true as const,
                  xpt: dskPoint(
                    Array.from(module.HEAPF64.subarray(offset, offset + 3)),
                  ),
                }
              : { found: false as const };
          });
        },
      );
    },
    dskgtl(key) {
      assertSpiceInt32(key, "DSK tolerance key");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (err, out) => {
        check(module._tspice_dskgtl(key, out, err, WASM_ERR_MAX_BYTES), err);
        return module.HEAPF64[out >>> 3]!;
      });
    },
    dskstl(key, value) {
      assertSpiceInt32(key, "DSK tolerance key");
      if (!Number.isFinite(value))
        throw new TypeError("Expected finite DSK tolerance");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (err) => {
        check(module._tspice_dskstl(key, value, err, WASM_ERR_MAX_BYTES), err);
      });
    },
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
