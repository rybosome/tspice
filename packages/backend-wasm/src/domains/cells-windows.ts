import type {
  CellsWindowsApi,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, withMalloc, WASM_ERR_MAX_BYTES } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

// Track fixed string length for char cell handles so we can allocate the right
// output buffer in `cellGetc`.
const charCellLengths = new Map<number, number>();

function tspiceCallNewIntCell(module: EmscriptenModule, size: number): SpiceIntCell {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_int_cell(size, outCellPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    return (ptr >>> 0) as unknown as SpiceIntCell;
  });
}

function tspiceCallNewDoubleCell(module: EmscriptenModule, size: number): SpiceDoubleCell {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_double_cell(size, outCellPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    return (ptr >>> 0) as unknown as SpiceDoubleCell;
  });
}

function tspiceCallNewCharCell(module: EmscriptenModule, size: number, length: number): SpiceCharCell {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCellPtr) => {
    module.HEAP32[outCellPtr >> 2] = 0;
    const result = module._tspice_new_char_cell(size, length, outCellPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outCellPtr >> 2] ?? 0;
    const handle = (ptr >>> 0) as unknown as SpiceCharCell;
    charCellLengths.set(handle, length);
    return handle;
  });
}

function tspiceCallNewWindow(module: EmscriptenModule, maxIntervals: number): SpiceWindow {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outWindowPtr) => {
    module.HEAP32[outWindowPtr >> 2] = 0;
    const result = module._tspice_new_window(maxIntervals, outWindowPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    const ptr = module.HEAP32[outWindowPtr >> 2] ?? 0;
    return (ptr >>> 0) as unknown as SpiceWindow;
  });
}

function tspiceCallFreeCell(module: EmscriptenModule, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_free_cell(cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });

  // Best-effort cleanup; freed handles must not be used again.
  charCellLengths.delete(cell);
}

function tspiceCallFreeWindow(module: EmscriptenModule, window: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_free_window(window, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallSsize(module: EmscriptenModule, size: number, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_ssize(size, cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallScard(module: EmscriptenModule, card: number, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_scard(card, cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallCard(module: EmscriptenModule, cell: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCardPtr) => {
    module.HEAP32[outCardPtr >> 2] = 0;
    const result = module._tspice_card(cell, outCardPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outCardPtr >> 2] ?? 0;
  });
}

function tspiceCallSize(module: EmscriptenModule, cell: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outSizePtr) => {
    module.HEAP32[outSizePtr >> 2] = 0;
    const result = module._tspice_size(cell, outSizePtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outSizePtr >> 2] ?? 0;
  });
}

function tspiceCallValid(module: EmscriptenModule, size: number, n: number, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_valid(size, n, cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrti(module: EmscriptenModule, item: number, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_insrti(item, cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrtd(module: EmscriptenModule, item: number, cell: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_insrtd(item, cell, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallInsrtc(module: EmscriptenModule, item: string, cell: number): void {
  const itemPtr = writeUtf8CString(module, item);
  try {
    withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
      const result = module._tspice_insrtc(itemPtr, cell, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    });
  } finally {
    module._free(itemPtr);
  }
}

function tspiceCallCellGeti(module: EmscriptenModule, cell: number, index: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outItemPtr) => {
    module.HEAP32[outItemPtr >> 2] = 0;
    const result = module._tspice_cell_geti(cell, index, outItemPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outItemPtr >> 2] ?? 0;
  });
}

function tspiceCallCellGetd(module: EmscriptenModule, cell: number, index: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outItemPtr) => {
    module.HEAPF64[outItemPtr >> 3] = 0;
    const result = module._tspice_cell_getd(cell, index, outItemPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAPF64[outItemPtr >> 3] ?? 0;
  });
}

function tspiceCallCellGetc(module: EmscriptenModule, cell: number, index: number): string {
  const outMaxBytes = charCellLengths.get(cell) ?? 2048;
  return withAllocs(module, [WASM_ERR_MAX_BYTES, outMaxBytes], (errPtr, outPtr) => {
    module.HEAPU8[outPtr] = 0;
    const result = module._tspice_cell_getc(cell, index, outPtr, outMaxBytes, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.UTF8ToString(outPtr, outMaxBytes).trimEnd();
  });
}

function tspiceCallWninsd(module: EmscriptenModule, left: number, right: number, window: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_wninsd(left, right, window, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallWncard(module: EmscriptenModule, window: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 4], (errPtr, outCardPtr) => {
    module.HEAP32[outCardPtr >> 2] = 0;
    const result = module._tspice_wncard(window, outCardPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return module.HEAP32[outCardPtr >> 2] ?? 0;
  });
}

function tspiceCallWnfetd(module: EmscriptenModule, window: number, index: number): readonly [number, number] {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8, 8], (errPtr, outLeftPtr, outRightPtr) => {
    module.HEAPF64[outLeftPtr >> 3] = 0;
    module.HEAPF64[outRightPtr >> 3] = 0;

    const result = module._tspice_wnfetd(
      window,
      index,
      outLeftPtr,
      outRightPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
    return [module.HEAPF64[outLeftPtr >> 3] ?? 0, module.HEAPF64[outRightPtr >> 3] ?? 0] as const;
  });
}

function tspiceCallWnvald(module: EmscriptenModule, size: number, n: number, window: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_wnvald(size, n, window, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

export function createCellsWindowsApi(module: EmscriptenModule): CellsWindowsApi {
  return {
    newIntCell: (size) => tspiceCallNewIntCell(module, size),
    newDoubleCell: (size) => tspiceCallNewDoubleCell(module, size),
    newCharCell: (size, length) => tspiceCallNewCharCell(module, size, length),
    newWindow: (maxIntervals) => tspiceCallNewWindow(module, maxIntervals),

    freeCell: (cell) => tspiceCallFreeCell(module, cell),
    freeWindow: (window) => tspiceCallFreeWindow(module, window),

    ssize: (size, cell) => tspiceCallSsize(module, size, cell),
    scard: (card, cell) => tspiceCallScard(module, card, cell),
    card: (cell) => tspiceCallCard(module, cell),
    size: (cell) => tspiceCallSize(module, cell),
    valid: (size, n, cell) => tspiceCallValid(module, size, n, cell),

    insrti: (item, cell) => tspiceCallInsrti(module, item, cell),
    insrtd: (item, cell) => tspiceCallInsrtd(module, item, cell),
    insrtc: (item, cell) => tspiceCallInsrtc(module, item, cell),

    cellGeti: (cell, index) => tspiceCallCellGeti(module, cell, index),
    cellGetd: (cell, index) => tspiceCallCellGetd(module, cell, index),
    cellGetc: (cell, index) => tspiceCallCellGetc(module, cell, index),

    wninsd: (left, right, window) => tspiceCallWninsd(module, left, right, window),
    wncard: (window) => tspiceCallWncard(module, window),
    wnfetd: (window, index) => tspiceCallWnfetd(module, window, index),
    wnvald: (size, n, window) => tspiceCallWnvald(module, size, n, window),
  };
}
