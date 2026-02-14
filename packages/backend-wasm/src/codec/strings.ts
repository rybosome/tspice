import type { EmscriptenModule } from "../lowlevel/exports.js";

import { mallocOrThrow } from "./alloc.js";

type Utf8CStringWriteModule = Pick<EmscriptenModule, "_malloc" | "HEAPU8">;
type Utf8CStringArrayWriteModule = Pick<EmscriptenModule, "_malloc" | "_free" | "HEAPU8" | "HEAPU32">;
type Utf8CStringArrayFreeModule = Pick<EmscriptenModule, "_free">;

type Utf8CStringArray = {
  /** Pointer to a contiguous `char*[]` array (written via `HEAPU32`), or `0` for empty arrays. */
  ptr: number;
  /** Pointers to each allocated null-terminated string. */
  itemPtrs: number[];
};

// Re-use a shared decoder to avoid allocating one per call.
const UTF8_DECODER = new TextDecoder();
// Re-use a shared encoder to avoid allocating one per call.
const UTF8_ENCODER = new TextEncoder();

/** Allocate and write a null-terminated UTF-8 C string into the WASM heap; returns the pointer. */
export function writeUtf8CString(module: Utf8CStringWriteModule, value: string): number {
  const encoded = UTF8_ENCODER.encode(value);
  const ptr = mallocOrThrow(module, encoded.length + 1);
  module.HEAPU8.set(encoded, ptr);
  module.HEAPU8[ptr + encoded.length] = 0;
  return ptr;
}

/**
 * Allocate a `char*[]` array (4-byte pointers) and a null-terminated utf-8 string for each
 * item.
 *
 * The caller owns the returned memory and must free it with {@link freeUtf8CStringArray}.
 */
export function writeUtf8CStringArray(module: Utf8CStringArrayWriteModule, values: string[]): Utf8CStringArray {
  if (values.length === 0) {
    return { ptr: 0, itemPtrs: [] };
  }

  // This helper intentionally targets wasm32 (32-bit pointers).
  // If we ever add wasm64, this should be revisited to use the correct pointer heap.
  const ptrBytes = module.HEAPU32.BYTES_PER_ELEMENT;
  if (ptrBytes !== 4) {
    throw new Error('writeUtf8CStringArray assumes 32-bit pointers (wasm32).');
  }

  const arr: Utf8CStringArray = { ptr: 0, itemPtrs: [] };
  arr.ptr = mallocOrThrow(module, values.length * ptrBytes);

  try {
    if (arr.ptr % ptrBytes !== 0) {
      throw new Error(`Internal error: unaligned pointer array base pointer (ptr=${arr.ptr}, ptrBytes=${ptrBytes})`);
    }

    const baseIndex = arr.ptr / ptrBytes;

    // IMPORTANT: With `ALLOW_MEMORY_GROWTH=1`, any allocation (including the `_malloc()`
    // inside `writeUtf8CString()`) may grow the WASM memory and cause Emscripten to
    // recreate the `HEAP*` typed array views. Do not cache `module.HEAPU8` /
    // `module.HEAPU32` across allocations; always access them at point-of-use after
    // the allocation completes.

    for (let i = 0; i < values.length; i++) {
      const itemPtr = writeUtf8CString(module, values[i]!);
      // Safety: HEAPU32 stores unsigned 32-bit pointers; guard against accidental truncation.
      if (!Number.isInteger(itemPtr) || itemPtr < 0 || itemPtr > 0xffff_ffff) {
        throw new Error(`Internal error: string item pointer out of u32 range (itemPtr=${itemPtr})`);
      }

      arr.itemPtrs.push(itemPtr);
      module.HEAPU32[baseIndex + i] = itemPtr;
    }

    return arr;
  } catch (e) {
    freeUtf8CStringArray(module, arr);
    throw e;
  }
}

/** Free memory allocated by {@link writeUtf8CStringArray} (idempotent). */
export function freeUtf8CStringArray(module: Utf8CStringArrayFreeModule, arr: Utf8CStringArray): void {
  for (const itemPtr of arr.itemPtrs) {
    if (itemPtr) {
      module._free(itemPtr);
    }
  }

  // Make the helper idempotent (safe to call twice).
  arr.itemPtrs.length = 0;

  if (arr.ptr) {
    module._free(arr.ptr);
  }
  arr.ptr = 0;
}


/**
 * Reads a fixed-width C string (padded/truncated) from the WASM heap.
 *
 * - Decodes at most `width` bytes.
 * - Treats the first `\0` byte as the terminator (embedded NUL ends the string).
 * - Trims *right* whitespace only (SPICE commonly pads with trailing spaces).
 */
export function readFixedWidthCString(
  module: Pick<EmscriptenModule, "HEAPU8">,
  ptr: number,
  width: number,
): string {
  if (width <= 0) {
    return "";
  }

  const bytes = module.HEAPU8.subarray(ptr, ptr + width);
  const nulIndex = bytes.indexOf(0);
  const end = nulIndex === -1 ? bytes.length : nulIndex;

  return UTF8_DECODER.decode(bytes.subarray(0, end)).trimEnd();
}

/** Read an array of fixed-width C strings from the WASM heap (see {@link readFixedWidthCString}). */
export function readFixedWidthCStringArray(
  module: Pick<EmscriptenModule, "HEAPU8">,
  ptr: number,
  count: number,
  width: number,
): string[] {
  if (count <= 0 || width <= 0) {
    return [];
  }

  const out = new Array<string>(count);
  for (let i = 0; i < count; i++) {
    out[i] = readFixedWidthCString(module, ptr + i * width, width);
  }
  return out;
}
