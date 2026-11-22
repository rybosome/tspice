import type {
  CellsWindowsApi,
  CellsWindowsKitApi,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  issueOpaqueSpiceHandle,
  spiceStringByteLength,
  assertWindowScalar,
  windowSideByte,
  windowOperatorBytes,
  windowSummaryIndex,
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";
import * as emscriptenExports from "../lowlevel/exports.js";

import {
  withAllocs,
  withMalloc,
  WASM_ERR_MAX_BYTES,
  WASM_MAX_ALLOC_BYTES,
} from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

function writeCellItem(
  module: EmscriptenModule,
  ptr: number,
  bytes: number,
  text: string,
): void {
  const start = ptr >>> 0;
  new TextEncoder().encodeInto(
    text,
    module.HEAPU8.subarray(start, start + bytes),
  );
  module.HEAPU8[start + bytes] = 0;
}

function tspiceCallNewIntCell(module: EmscriptenModule, size: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_int_cell(
      size,
      outCellPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    return ptr >>> 0;
  });
}

function tspiceCallNewDoubleCell(
  module: EmscriptenModule,
  size: number,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_double_cell(
      size,
      outCellPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    return ptr >>> 0;
  });
}

function tspiceCallNewCharCell(
  module: EmscriptenModule,
  size: number,
  length: number,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_char_cell(
      size,
      length,
      outCellPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    return ptr >>> 0;
  });
}

function tspiceCallNewWindow(
  module: EmscriptenModule,
  maxIntervals: number,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outWindowPtr) => {
    module.HEAP32[outWindowPtr >> 2] = 0;
    const result = module._tspice_new_window(
      maxIntervals,
      outWindowPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outWindowPtr >> 2] ?? 0;
    return ptr >>> 0;
  });
}

function tspiceCallFreeCell(module: EmscriptenModule, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_free_cell(
      wasmCellPointer(module, cell, "free_cell()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallFreeWindow(module: EmscriptenModule, window: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_free_window(
      wasmWindowPointer(module, window, "free_window()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallSsize(
  module: EmscriptenModule,
  size: number,
  cell: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_ssize(
      size,
      wasmCellOrWindowPointer(module, cell, "ssize()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallScard(
  module: EmscriptenModule,
  card: number,
  cell: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_scard(
      card,
      wasmCellOrWindowPointer(module, cell, "scard()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallCard(module: EmscriptenModule, cell: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCardPtr) => {
    module.HEAP32[outCardPtr >> 2] = 0;
    const result = module._tspice_card(
      wasmCellOrWindowPointer(module, cell, "card()"),
      outCardPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outCardPtr >> 2] ?? 0;
  });
}

function tspiceCallSize(module: EmscriptenModule, cell: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outSizePtr) => {
    module.HEAP32[outSizePtr >> 2] = 0;
    const result = module._tspice_size(
      wasmCellOrWindowPointer(module, cell, "size()"),
      outSizePtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outSizePtr >> 2] ?? 0;
  });
}

function tspiceCallValid(
  module: EmscriptenModule,
  size: number,
  n: number,
  cell: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_valid(
      size,
      n,
      wasmCellOrWindowPointer(module, cell, "valid()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrti(
  module: EmscriptenModule,
  item: number,
  cell: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_insrti(
      item,
      wasmCellPointer(module, cell, "insrti()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrtd(
  module: EmscriptenModule,
  item: number,
  cell: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_insrtd(
      item,
      wasmCellPointer(module, cell, "insrtd()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrtc(
  module: EmscriptenModule,
  item: string,
  cell: number,
): void {
  const itemPtr = writeUtf8CString(module, item);
  try {
    withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
      const result = module._tspice_insrtc(
        itemPtr,
        wasmCellPointer(module, cell, "insrtc()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(itemPtr);
  }
}

function tspiceCallCellGeti(
  module: EmscriptenModule,
  cell: number,
  index: number,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outItemPtr) => {
    module.HEAP32[outItemPtr >> 2] = 0;
    const result = module._tspice_cell_geti(
      wasmCellPointer(module, cell, "cell_geti()"),
      index,
      outItemPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outItemPtr >> 2] ?? 0;
  });
}

function tspiceCallCellGetd(
  module: EmscriptenModule,
  cell: number,
  index: number,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outItemPtr) => {
    module.HEAPF64[outItemPtr >> 3] = 0;
    const result = module._tspice_cell_getd(
      wasmCellPointer(module, cell, "cell_getd()"),
      index,
      outItemPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAPF64[outItemPtr >> 3] ?? 0;
  });
}

function tspiceCallCellGetc(
  module: EmscriptenModule,
  cell: number,
  index: number,
  outMaxBytes: number,
): string {
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, outMaxBytes],
    (errPtr, outPtr) => {
      module.HEAPU8[outPtr] = 0;
      const result = module._tspice_cell_getc(
        wasmCellPointer(module, cell, "cell_getc()"),
        index,
        outPtr,
        outMaxBytes,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return module.UTF8ToString(outPtr, outMaxBytes).trimEnd();
    },
  );
}

function tspiceCallWninsd(
  module: EmscriptenModule,
  left: number,
  right: number,
  window: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_wninsd(
      left,
      right,
      wasmWindowPointer(module, window, "wninsd()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallWncard(module: EmscriptenModule, window: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCardPtr) => {
    module.HEAP32[outCardPtr >> 2] = 0;
    const result = module._tspice_wncard(
      wasmWindowPointer(module, window, "wncard()"),
      outCardPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outCardPtr >> 2] ?? 0;
  });
}

function tspiceCallWnfetd(
  module: EmscriptenModule,
  window: number,
  index: number,
): readonly [number, number] {
  return withAllocs(
    module,
    [WASM_ERR_MAX_BYTES, 8, 8],
    (errPtr, outLeftPtr, outRightPtr) => {
      module.HEAPF64[outLeftPtr >> 3] = 0;
      module.HEAPF64[outRightPtr >> 3] = 0;

      const result = module._tspice_wnfetd(
        wasmWindowPointer(module, window, "wnfetd()"),
        index,
        outLeftPtr,
        outRightPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
      return [
        module.HEAPF64[outLeftPtr >> 3] ?? 0,
        module.HEAPF64[outRightPtr >> 3] ?? 0,
      ] as const;
    },
  );
}

function tspiceCallWnvald(
  module: EmscriptenModule,
  size: number,
  n: number,
  window: number,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_wnvald(
      size,
      n,
      wasmWindowPointer(module, window, "wnvald()"),
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

type WasmHandleOwnership = {
  allocatedCells: Map<number, number>;
  allocatedWindows: Map<number, number>;
  charCellLengths: Map<number, number>;
};

// Per-Emscripten-module handle ownership registry.
//
// Maps opaque token identities to private module-local pointers. Pointer reuse
// cannot revive an expired token or accept another module's token.
const WASM_HANDLE_OWNERSHIP = new WeakMap<
  EmscriptenModule,
  WasmHandleOwnership
>();

function getOrInitWasmHandleOwnership(
  module: EmscriptenModule,
): WasmHandleOwnership {
  let ownership = WASM_HANDLE_OWNERSHIP.get(module);
  if (!ownership) {
    ownership = {
      allocatedCells: new Map<number, number>(),
      allocatedWindows: new Map<number, number>(),
      charCellLengths: new Map<number, number>(),
    };
    WASM_HANDLE_OWNERSHIP.set(module, ownership);
  }
  return ownership;
}

/** Assert that a cell handle was allocated by (and is still owned by) this WASM backend instance. */
export function assertWasmOwnedCellHandle(
  module: EmscriptenModule,
  handle: number,
  context: string,
): void {
  if (
    typeof handle !== "number" ||
    !Number.isFinite(handle) ||
    !Number.isInteger(handle)
  ) {
    throw new TypeError(
      `${context}: expected handle to be an integer number (got ${handle})`,
    );
  }
  if (handle <= 0) {
    throw new RangeError(
      `${context}: expected handle to be > 0 (got ${handle})`,
    );
  }

  const { allocatedCells } = getOrInitWasmHandleOwnership(module);
  if (!allocatedCells.has(handle)) {
    throw new RangeError(
      `${context}: unknown/expired WASM cell handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
    );
  }
}

/** Assert that a window handle was allocated by (and is still owned by) this WASM backend instance. */
export function assertWasmOwnedWindowHandle(
  module: EmscriptenModule,
  handle: number,
  context: string,
): void {
  if (
    typeof handle !== "number" ||
    !Number.isFinite(handle) ||
    !Number.isInteger(handle)
  ) {
    throw new TypeError(
      `${context}: expected handle to be an integer number (got ${handle})`,
    );
  }
  if (handle <= 0) {
    throw new RangeError(
      `${context}: expected handle to be > 0 (got ${handle})`,
    );
  }

  const { allocatedWindows } = getOrInitWasmHandleOwnership(module);
  if (!allocatedWindows.has(handle)) {
    throw new RangeError(
      `${context}: unknown/expired WASM window handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
    );
  }
}

/** Resolve a live opaque cell token to this module's private C pointer. */
export function wasmCellPointer(
  module: EmscriptenModule,
  handle: number,
  context: string,
): number {
  assertWasmOwnedCellHandle(module, handle, context);
  const pointer =
    getOrInitWasmHandleOwnership(module).allocatedCells.get(handle);
  if (pointer === undefined)
    throw new RangeError(`${context}: unknown/expired WASM cell handle`);
  return pointer;
}

/** Resolve a live opaque window token to this module's private C pointer. */
export function wasmWindowPointer(
  module: EmscriptenModule,
  handle: number,
  context: string,
): number {
  assertWasmOwnedWindowHandle(module, handle, context);
  const pointer =
    getOrInitWasmHandleOwnership(module).allocatedWindows.get(handle);
  if (pointer === undefined)
    throw new RangeError(`${context}: unknown/expired WASM window handle`);
  return pointer;
}

function wasmCellOrWindowPointer(
  module: EmscriptenModule,
  handle: number,
  context: string,
): number {
  const owner = getOrInitWasmHandleOwnership(module);
  const pointer =
    owner.allocatedCells.get(handle) ?? owner.allocatedWindows.get(handle);
  if (pointer === undefined)
    throw new RangeError(
      `${context}: unknown/expired WASM handle ${handle} (handles are per-module)`,
    );
  return pointer;
}

/** Create a {@link CellsWindowsApi} implementation backed by a WASM Emscripten module. */
export function createCellsWindowsApi(
  module: EmscriptenModule,
): CellsWindowsApi {
  emscriptenExports.assertEmscriptenModule(module);

  // Public handles are unique opaque tokens. Private pointers remain scoped to
  // the owning module and are resolved only at the compiled-call boundary.
  const { allocatedCells, allocatedWindows } =
    getOrInitWasmHandleOwnership(module);

  function assertKnownCell(handle: number, context: string): void {
    if (!allocatedCells.has(handle)) {
      throw new RangeError(
        `${context}: unknown/expired WASM cell handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
      );
    }
  }

  function assertKnownWindow(handle: number, context: string): void {
    if (!allocatedWindows.has(handle)) {
      throw new RangeError(
        `${context}: unknown/expired WASM window handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
      );
    }
  }

  function assertKnownCellOrWindow(handle: number, context: string): void {
    if (!allocatedCells.has(handle) && !allocatedWindows.has(handle)) {
      throw new RangeError(
        `${context}: unknown/expired WASM handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
      );
    }
  }

  return {
    ssize: (size, cell) => {
      assertSpiceInt32NonNegative(size, "ssize(size)");
      assertKnownCellOrWindow(cell, "ssize()");
      tspiceCallSsize(module, size, cell);
    },
    scard: (card, cell) => {
      assertSpiceInt32NonNegative(card, "scard(card)");
      assertKnownCellOrWindow(cell, "scard()");
      tspiceCallScard(module, card, cell);
    },
    card: (cell) => {
      assertKnownCellOrWindow(cell, "card()");
      return tspiceCallCard(module, cell);
    },
    size: (cell) => {
      assertKnownCellOrWindow(cell, "size()");
      return tspiceCallSize(module, cell);
    },
    valid: (size, n, cell) => {
      assertSpiceInt32NonNegative(size, "valid(size)");
      assertSpiceInt32NonNegative(n, "valid(n)");
      assertKnownCellOrWindow(cell, "valid()");
      tspiceCallValid(module, size, n, cell);
    },

    appndc: (item, cell) => {
      const bytes = spiceStringByteLength(
        item,
        "appndc(item)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const cellPtr = wasmCellPointer(module, cell, "appndc()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1],
        (errPtr, itemPtr) => {
          writeCellItem(module, itemPtr, bytes, item);
          const status = module._tspice_appndc(
            itemPtr,
            cellPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    appndd: (item, cell) => {
      if (typeof item !== "number" || Number.isNaN(item))
        throw new TypeError("appndd(item) must be an ordered number");
      const cellPtr = wasmCellPointer(module, cell, "appndd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_appndd(
          item,
          cellPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    appndi: (item, cell) => {
      assertSpiceInt32(item, "appndi(item)");
      const cellPtr = wasmCellPointer(module, cell, "appndi()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_appndi(
          item,
          cellPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    elemc: (item, cell) => {
      const bytes = spiceStringByteLength(
        item,
        "elemc(item)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const cellPtr = wasmCellPointer(module, cell, "elemc()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1, 4],
        (errPtr, itemPtr, outPtr) => {
          writeCellItem(module, itemPtr, bytes, item);
          const status = module._tspice_elemc(
            itemPtr,
            cellPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const result = module.HEAP32[outPtr >>> 2];
          if (result !== 0 && result !== 1)
            throw new TypeError("Invalid cell membership result");
          return result === 1;
        },
      );
    },
    elemd: (item, cell) => {
      if (typeof item !== "number" || Number.isNaN(item))
        throw new TypeError("elemd(item) must be an ordered number");
      const cellPtr = wasmCellPointer(module, cell, "elemd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_elemd(
          item,
          cellPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const result = module.HEAP32[outPtr >>> 2];
        if (result !== 0 && result !== 1)
          throw new TypeError("Invalid cell membership result");
        return result === 1;
      });
    },
    elemi: (item, cell) => {
      assertSpiceInt32(item, "elemi(item)");
      const cellPtr = wasmCellPointer(module, cell, "elemi()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_elemi(
          item,
          cellPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const result = module.HEAP32[outPtr >>> 2];
        if (result !== 0 && result !== 1)
          throw new TypeError("Invalid cell membership result");
        return result === 1;
      });
    },
    diff: (a, b, result) => {
      const aPtr = wasmCellPointer(module, a, "diff()");
      const bPtr = wasmCellPointer(module, b, "diff()");
      const resultPtr = wasmCellPointer(module, result, "diff()");
      if (result === a || result === b)
        throw new RangeError("Result set must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_diff(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    inter: (a, b, result) => {
      const aPtr = wasmCellPointer(module, a, "inter()");
      const bPtr = wasmCellPointer(module, b, "inter()");
      const resultPtr = wasmCellPointer(module, result, "inter()");
      if (result === a || result === b)
        throw new RangeError("Result set must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_inter(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    sdiff: (a, b, result) => {
      const aPtr = wasmCellPointer(module, a, "sdiff()");
      const bPtr = wasmCellPointer(module, b, "sdiff()");
      const resultPtr = wasmCellPointer(module, result, "sdiff()");
      if (result === a || result === b)
        throw new RangeError("Result set must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_sdiff(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    union: (a, b, result) => {
      const aPtr = wasmCellPointer(module, a, "union()");
      const bPtr = wasmCellPointer(module, b, "union()");
      const resultPtr = wasmCellPointer(module, result, "union()");
      if (result === a || result === b)
        throw new RangeError("Result set must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_union(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    set: (a, op, b) => {
      const aPtr = wasmCellPointer(module, a, "set()");
      const bytes = spiceStringByteLength(
        op,
        "set(op)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const bPtr = wasmCellPointer(module, b, "set()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1, 4],
        (errPtr, opPtr, outPtr) => {
          writeCellItem(module, opPtr, bytes, op);
          const status = module._tspice_set(
            aPtr,
            opPtr,
            bPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const out = module.HEAP32[outPtr >>> 2];
          if (out !== 0 && out !== 1)
            throw new TypeError("Invalid set relation result");
          return out === 1;
        },
      );
    },
    removc: (item, cell) => {
      const bytes = spiceStringByteLength(
        item,
        "removc(item)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const cellPtr = wasmCellPointer(module, cell, "removc()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1],
        (errPtr, itemPtr) => {
          writeCellItem(module, itemPtr, bytes, item);
          const status = module._tspice_removc(
            itemPtr,
            cellPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    removd: (item, cell) => {
      if (typeof item !== "number" || Number.isNaN(item))
        throw new TypeError("removd(item) must be an ordered number");
      const cellPtr = wasmCellPointer(module, cell, "removd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_removd(
          item,
          cellPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    removi: (item, cell) => {
      assertSpiceInt32(item, "removi(item)");
      const cellPtr = wasmCellPointer(module, cell, "removi()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_removi(
          item,
          cellPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    ordc: (item, cell) => {
      const bytes = spiceStringByteLength(
        item,
        "ordc(item)",
        WASM_MAX_ALLOC_BYTES - 1,
      );
      const cellPtr = wasmCellPointer(module, cell, "ordc()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1, 4],
        (errPtr, itemPtr, outPtr) => {
          writeCellItem(module, itemPtr, bytes, item);
          const status = module._tspice_ordc(
            itemPtr,
            cellPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const result = module.HEAP32[outPtr >>> 2];
          if (result === undefined || result < -1)
            throw new TypeError("Invalid set ordinal");
          return result;
        },
      );
    },
    ordd: (item, cell) => {
      if (typeof item !== "number" || Number.isNaN(item))
        throw new TypeError("ordd(item) must be an ordered number");
      const cellPtr = wasmCellPointer(module, cell, "ordd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_ordd(
          item,
          cellPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const result = module.HEAP32[outPtr >>> 2];
        if (result === undefined || result < -1)
          throw new TypeError("Invalid set ordinal");
        return result;
      });
    },
    ordi: (item, cell) => {
      assertSpiceInt32(item, "ordi(item)");
      const cellPtr = wasmCellPointer(module, cell, "ordi()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_ordi(
          item,
          cellPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const result = module.HEAP32[outPtr >>> 2];
        if (result === undefined || result < -1)
          throw new TypeError("Invalid set ordinal");
        return result;
      });
    },
    copy: (source, destination) => {
      const sourcePtr = wasmCellPointer(module, source, "copy()");
      const destinationPtr = wasmCellPointer(module, destination, "copy()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_copy(
          sourcePtr,
          destinationPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    insrti: (item, cell) => {
      assertSpiceInt32(item, "insrti(item)");
      assertKnownCell(cell, "insrti()");
      tspiceCallInsrti(module, item, cell);
    },
    insrtd: (item, cell) => {
      assertKnownCell(cell, "insrtd()");
      tspiceCallInsrtd(module, item, cell);
    },
    insrtc: (item, cell) => {
      if (typeof item !== "string")
        throw new TypeError("insrtc(item): expected a string");
      assertKnownCell(cell, "insrtc()");
      tspiceCallInsrtc(module, item, cell);
    },
    wncomd: (left, right, window, result) => {
      assertWindowScalar(left, "wncomd(left)");
      assertWindowScalar(right, "wncomd(right)");
      const windowPtr = wasmWindowPointer(module, window, "wncomd()");
      const resultPtr = wasmWindowPointer(module, result, "wncomd()");
      if (result === window)
        throw new RangeError("Result window must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wncomd(
          left,
          right,
          windowPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wncond: (left, right, window) => {
      assertWindowScalar(left, "wncond(left)");
      assertWindowScalar(right, "wncond(right)");
      const windowPtr = wasmWindowPointer(module, window, "wncond()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wncond(
          left,
          right,
          windowPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wndifd: (a, b, result) => {
      const aPtr = wasmWindowPointer(module, a, "wndifd()");
      const bPtr = wasmWindowPointer(module, b, "wndifd()");
      const resultPtr = wasmWindowPointer(module, result, "wndifd()");
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wndifd(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnelmd: (point, window) => {
      assertWindowScalar(point, "wnelmd(point)");
      const windowPtr = wasmWindowPointer(module, window, "wnelmd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_wnelmd(
          point,
          windowPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const out = module.HEAP32[outPtr >>> 2];
        if (out !== 0 && out !== 1)
          throw new TypeError("Invalid window predicate result");
        return out === 1;
      });
    },
    wnexpd: (left, right, window) => {
      assertWindowScalar(left, "wnexpd(left)");
      assertWindowScalar(right, "wnexpd(right)");
      const windowPtr = wasmWindowPointer(module, window, "wnexpd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnexpd(
          left,
          right,
          windowPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnextd: (side, window) => {
      const sideByte = windowSideByte(side);
      const windowPtr = wasmWindowPointer(module, window, "wnextd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnextd(
          sideByte,
          windowPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnfild: (small, window) => {
      assertWindowScalar(small, "wnfild(small)");
      const windowPtr = wasmWindowPointer(module, window, "wnfild()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnfild(
          small,
          windowPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnfltd: (small, window) => {
      assertWindowScalar(small, "wnfltd(small)");
      const windowPtr = wasmWindowPointer(module, window, "wnfltd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnfltd(
          small,
          windowPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnincd: (left, right, window) => {
      assertWindowScalar(left, "wnincd(left)");
      assertWindowScalar(right, "wnincd(right)");
      const windowPtr = wasmWindowPointer(module, window, "wnincd()");
      return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outPtr) => {
        const status = module._tspice_wnincd(
          left,
          right,
          windowPtr,
          outPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
        const out = module.HEAP32[outPtr >>> 2];
        if (out !== 0 && out !== 1)
          throw new TypeError("Invalid window predicate result");
        return out === 1;
      });
    },
    wnintd: (a, b, result) => {
      const aPtr = wasmWindowPointer(module, a, "wnintd()");
      const bPtr = wasmWindowPointer(module, b, "wnintd()");
      const resultPtr = wasmWindowPointer(module, result, "wnintd()");
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnintd(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wnreld: (a, op, b) => {
      const aPtr = wasmWindowPointer(module, a, "wnreld()");
      const bytes = windowOperatorBytes(op, WASM_MAX_ALLOC_BYTES - 1);
      const bPtr = wasmWindowPointer(module, b, "wnreld()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, bytes + 1, 4],
        (errPtr, opPtr, outPtr) => {
          const start = opPtr >>> 0;
          new TextEncoder().encodeInto(
            op,
            module.HEAPU8.subarray(start, start + bytes),
          );
          module.HEAPU8[start + bytes] = 0;
          const status = module._tspice_wnreld(
            aPtr,
            opPtr,
            bPtr,
            outPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          const out = module.HEAP32[outPtr >>> 2];
          if (out !== 0 && out !== 1)
            throw new TypeError("Invalid window predicate result");
          return out === 1;
        },
      );
    },
    wnsumd: (window) => {
      const windowPtr = wasmWindowPointer(module, window, "wnsumd()");
      return withAllocs(
        module,
        [WASM_ERR_MAX_BYTES, 8, 8, 8, 4, 4],
        (errPtr, measPtr, avgPtr, stddevPtr, shortestPtr, longestPtr) => {
          const status = module._tspice_wnsumd(
            windowPtr,
            measPtr,
            avgPtr,
            stddevPtr,
            shortestPtr,
            longestPtr,
            errPtr,
            WASM_ERR_MAX_BYTES,
          );
          if (status !== 0)
            throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
          return {
            meas: module.HEAPF64[measPtr >>> 3]!,
            avg: module.HEAPF64[avgPtr >>> 3]!,
            stddev: module.HEAPF64[stddevPtr >>> 3]!,
            shortest: windowSummaryIndex(module.HEAP32[shortestPtr >>> 2]),
            longest: windowSummaryIndex(module.HEAP32[longestPtr >>> 2]),
          };
        },
      );
    },
    wnunid: (a, b, result) => {
      const aPtr = wasmWindowPointer(module, a, "wnunid()");
      const bPtr = wasmWindowPointer(module, b, "wnunid()");
      const resultPtr = wasmWindowPointer(module, result, "wnunid()");
      if (result === a || result === b)
        throw new RangeError("Result window must be distinct from each input");
      return withAllocs(module, [WASM_ERR_MAX_BYTES], (errPtr) => {
        const status = module._tspice_wnunid(
          aPtr,
          bPtr,
          resultPtr,
          errPtr,
          WASM_ERR_MAX_BYTES,
        );
        if (status !== 0)
          throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, status);
      });
    },
    wninsd: (left, right, window) => {
      assertKnownWindow(window, "wninsd()");
      tspiceCallWninsd(module, left, right, window);
    },
    wncard: (window) => {
      assertKnownWindow(window, "wncard()");
      return tspiceCallWncard(module, window);
    },
    wnfetd: (window, index) => {
      assertSpiceInt32NonNegative(index, "wnfetd(index)");
      assertKnownWindow(window, "wnfetd()");
      return tspiceCallWnfetd(module, window, index);
    },
    wnvald: (size, n, window) => {
      assertSpiceInt32NonNegative(size, "wnvald(size)");
      assertSpiceInt32NonNegative(n, "wnvald(n)");
      assertKnownWindow(window, "wnvald()");
      tspiceCallWnvald(module, size, n, window);
    },
  };
}

/** Create backend kit hooks for cells/windows backed by a WASM Emscripten module. */
export function createCellsWindowsKitApi(
  module: EmscriptenModule,
): CellsWindowsKitApi {
  emscriptenExports.assertEmscriptenModule(module);

  // Public handles are unique opaque tokens. Private pointers remain scoped to
  // the owning module and are resolved only at the compiled-call boundary.
  const { allocatedCells, allocatedWindows, charCellLengths } =
    getOrInitWasmHandleOwnership(module);

  function assertKnownCell(handle: number, context: string): void {
    if (!allocatedCells.has(handle)) {
      throw new RangeError(
        `${context}: unknown/expired WASM cell handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
      );
    }
  }

  function assertKnownWindow(handle: number, context: string): void {
    if (!allocatedWindows.has(handle)) {
      throw new RangeError(
        `${context}: unknown/expired WASM window handle ${handle} (handles are per-module; did you mix Node/WASM backends or multiple WASM backends?)`,
      );
    }
  }

  return {
    newIntCell: (size) => {
      assertSpiceInt32NonNegative(size, "newIntCell(size)");
      const handle = issueOpaqueSpiceHandle();
      const cell = tspiceCallNewIntCell(module, size);
      allocatedCells.set(handle, cell);
      return handle as SpiceIntCell;
    },
    newDoubleCell: (size) => {
      assertSpiceInt32NonNegative(size, "newDoubleCell(size)");
      const handle = issueOpaqueSpiceHandle();
      const cell = tspiceCallNewDoubleCell(module, size);
      allocatedCells.set(handle, cell);
      return handle as SpiceDoubleCell;
    },
    newCharCell: (size, length) => {
      assertSpiceInt32NonNegative(size, "newCharCell(size)");
      assertSpiceInt32(length, "newCharCell(length)", { min: 1 });
      const handle = issueOpaqueSpiceHandle();
      const cell = tspiceCallNewCharCell(module, size, length);
      allocatedCells.set(handle, cell);
      charCellLengths.set(handle, length);
      return handle as SpiceCharCell;
    },
    newWindow: (maxIntervals) => {
      assertSpiceInt32NonNegative(maxIntervals, "newWindow(maxIntervals)");
      const handle = issueOpaqueSpiceHandle();
      const window = tspiceCallNewWindow(module, maxIntervals);
      allocatedWindows.set(handle, window);
      return handle as SpiceWindow;
    },

    freeCell: (cell) => {
      const handle = cell;
      assertKnownCell(handle, "freeCell()");
      tspiceCallFreeCell(module, handle);
      allocatedCells.delete(handle);
      charCellLengths.delete(handle);
    },
    freeWindow: (window) => {
      const handle = window;
      assertKnownWindow(handle, "freeWindow()");
      tspiceCallFreeWindow(module, handle);
      allocatedWindows.delete(handle);
    },

    cellGeti: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGeti(index)");
      assertKnownCell(cell, "cellGeti()");
      return tspiceCallCellGeti(module, cell, index);
    },
    cellGetd: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetd(index)");
      assertKnownCell(cell, "cellGetd()");
      return tspiceCallCellGetd(module, cell, index);
    },
    cellGetc: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetc(index)");
      assertKnownCell(cell, "cellGetc()");
      const handle = cell;
      const outMaxBytes = charCellLengths.get(handle);
      if (outMaxBytes === undefined) {
        throw new RangeError(
          `cellGetc(): unknown/expired char cell handle ${handle} (handles are per-module)`,
        );
      }
      return tspiceCallCellGetc(module, cell, index, outMaxBytes);
    },
  };
}
