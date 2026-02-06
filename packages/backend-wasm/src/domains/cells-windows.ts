import type {
  CellsWindowsApi,
  SpiceCharCell,
  SpiceDoubleCell,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  assertSpiceInt32NonNegative,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, withMalloc, WASM_ERR_MAX_BYTES } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

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
    return (ptr >>> 0) as unknown as SpiceCharCell;
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

function tspiceCallCellGetc(
  module: EmscriptenModule,
  cell: number,
  index: number,
  outMaxBytes: number,
): string {
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
  // Security + correctness: track allocated pointers per backend instance.
  //
  // In the WASM backend, cell/window handles are raw pointers. Without this
  // tracking, callers could attempt to free arbitrary pointers or double-free
  // previously-freed handles.
  const allocatedCells = new Set<number>();
  const allocatedWindows = new Set<number>();
  const charCellLengths = new Map<number, number>();

  function assertKnownCell(handle: number, context: string): void {
    if (!allocatedCells.has(handle)) {
      throw new Error(`${context}: unknown/expired cell handle`);
    }
  }

  function assertKnownWindow(handle: number, context: string): void {
    if (!allocatedWindows.has(handle)) {
      throw new Error(`${context}: unknown/expired window handle`);
    }
  }

  function assertKnownCellOrWindow(handle: number, context: string): void {
    if (!allocatedCells.has(handle) && !allocatedWindows.has(handle)) {
      throw new Error(`${context}: unknown/expired handle`);
    }
  }

  return {
    newIntCell: (size) => {
      assertSpiceInt32NonNegative(size, "newIntCell(size)");
      const cell = tspiceCallNewIntCell(module, size);
      allocatedCells.add(cell as unknown as number);
      return cell;
    },
    newDoubleCell: (size) => {
      assertSpiceInt32NonNegative(size, "newDoubleCell(size)");
      const cell = tspiceCallNewDoubleCell(module, size);
      allocatedCells.add(cell as unknown as number);
      return cell;
    },
    newCharCell: (size, length) => {
      assertSpiceInt32NonNegative(size, "newCharCell(size)");
      assertSpiceInt32(length, "newCharCell(length)", { min: 1 });
      const cell = tspiceCallNewCharCell(module, size, length);
      allocatedCells.add(cell as unknown as number);
      charCellLengths.set(cell as unknown as number, length);
      return cell;
    },
    newWindow: (maxIntervals) => {
      assertSpiceInt32NonNegative(maxIntervals, "newWindow(maxIntervals)");
      const window = tspiceCallNewWindow(module, maxIntervals);
      allocatedWindows.add(window as unknown as number);
      return window;
    },

    freeCell: (cell) => {
      const handle = cell as unknown as number;
      assertKnownCell(handle, "freeCell()");
      tspiceCallFreeCell(module, handle);
      allocatedCells.delete(handle);
      charCellLengths.delete(handle);
    },
    freeWindow: (window) => {
      const handle = window as unknown as number;
      assertKnownWindow(handle, "freeWindow()");
      tspiceCallFreeWindow(module, handle);
      allocatedWindows.delete(handle);
    },

    ssize: (size, cell) => {
      assertSpiceInt32NonNegative(size, "ssize(size)");
      assertKnownCellOrWindow(cell as unknown as number, "ssize()");
      tspiceCallSsize(module, size, cell);
    },
    scard: (card, cell) => {
      assertSpiceInt32NonNegative(card, "scard(card)");
      assertKnownCellOrWindow(cell as unknown as number, "scard()");
      tspiceCallScard(module, card, cell);
    },
    card: (cell) => {
      assertKnownCellOrWindow(cell as unknown as number, "card()");
      return tspiceCallCard(module, cell);
    },
    size: (cell) => {
      assertKnownCellOrWindow(cell as unknown as number, "size()");
      return tspiceCallSize(module, cell);
    },
    valid: (size, n, cell) => {
      assertSpiceInt32NonNegative(size, "valid(size)");
      assertSpiceInt32NonNegative(n, "valid(n)");
      assertKnownCellOrWindow(cell as unknown as number, "valid()");
      tspiceCallValid(module, size, n, cell);
    },

    insrti: (item, cell) => {
      assertSpiceInt32(item, "insrti(item)");
      assertKnownCell(cell as unknown as number, "insrti()");
      tspiceCallInsrti(module, item, cell);
    },
    insrtd: (item, cell) => {
      assertKnownCell(cell as unknown as number, "insrtd()");
      tspiceCallInsrtd(module, item, cell);
    },
    insrtc: (item, cell) => {
      assertKnownCell(cell as unknown as number, "insrtc()");
      tspiceCallInsrtc(module, item, cell);
    },

    cellGeti: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGeti(index)");
      assertKnownCell(cell as unknown as number, "cellGeti()");
      return tspiceCallCellGeti(module, cell, index);
    },
    cellGetd: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetd(index)");
      assertKnownCell(cell as unknown as number, "cellGetd()");
      return tspiceCallCellGetd(module, cell, index);
    },
    cellGetc: (cell, index) => {
      assertSpiceInt32NonNegative(index, "cellGetc(index)");
      assertKnownCell(cell as unknown as number, "cellGetc()");
      const outMaxBytes = charCellLengths.get(cell as unknown as number) ?? 2048;
      return tspiceCallCellGetc(module, cell, index, outMaxBytes);
    },

    wninsd: (left, right, window) => {
      assertKnownWindow(window as unknown as number, "wninsd()");
      tspiceCallWninsd(module, left, right, window);
    },
    wncard: (window) => {
      assertKnownWindow(window as unknown as number, "wncard()");
      return tspiceCallWncard(module, window);
    },
    wnfetd: (window, index) => {
      assertSpiceInt32NonNegative(index, "wnfetd(index)");
      assertKnownWindow(window as unknown as number, "wnfetd()");
      return tspiceCallWnfetd(module, window, index);
    },
    wnvald: (size, n, window) => {
      assertSpiceInt32NonNegative(size, "wnvald(size)");
      assertSpiceInt32NonNegative(n, "wnvald(n)");
      assertKnownWindow(window as unknown as number, "wnvald()");
      tspiceCallWnvald(module, size, n, window);
    },
  };
}
