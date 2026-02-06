import type { EmscriptenModule } from "../lowlevel/exports.js";

import { mallocOrThrow } from "./alloc.js";

type Utf8CStringArray = {
  /** Pointer to a contiguous `char*[]` array (`HEAP32`), or `0` for empty arrays. */
  ptr: number;
  /** Pointers to each allocated null-terminated string. */
  itemPtrs: number[];
};

// Re-use a shared decoder to avoid allocating one per call.
const UTF8_DECODER = new TextDecoder();
// Re-use a shared encoder to avoid allocating one per call.
const UTF8_ENCODER = new TextEncoder();

export function writeUtf8CString(module: EmscriptenModule, value: string): number {
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
export function writeUtf8CStringArray(module: EmscriptenModule, values: string[]): Utf8CStringArray {
  if (values.length === 0) {
    return { ptr: 0, itemPtrs: [] };
  }

  // This helper intentionally targets wasm32 (32-bit pointers).
  // If we ever add wasm64, this should be revisited to use the correct pointer heap.
  const ptrBytes = module.HEAPU32.BYTES_PER_ELEMENT;
  if (ptrBytes !== 4) {
    throw new Error('writeUtf8CStringArray assumes 32-bit pointers (wasm32).');
  }

  const ptr = mallocOrThrow(module, values.length * ptrBytes);
  const baseIndex = ptr / ptrBytes;
  if (!Number.isInteger(baseIndex)) {
    throw new Error(`Internal error: unaligned pointer array base index (ptr=${ptr}, ptrBytes=${ptrBytes})`);
  }

  const itemPtrs: number[] = [];
  try {
    for (let i = 0; i < values.length; i++) {
      const itemPtr = writeUtf8CString(module, values[i]!);
      itemPtrs.push(itemPtr);
      module.HEAPU32[baseIndex + i] = itemPtr;
    }
    return { ptr, itemPtrs };
  } catch (error) {
    for (const itemPtr of itemPtrs) {
      module._free(itemPtr);
    }
    module._free(ptr);
    throw error;
  }
}

export function freeUtf8CStringArray(module: EmscriptenModule, arr: Utf8CStringArray): void {
  for (const itemPtr of arr.itemPtrs) {
    module._free(itemPtr);
  }
  // Make the helper idempotent (safe to call twice).
  arr.itemPtrs.length = 0;

  if (arr.ptr) {
    module._free(arr.ptr);
    arr.ptr = 0;
  }
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
