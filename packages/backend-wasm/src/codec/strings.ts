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

export function writeUtf8CString(module: EmscriptenModule, value: string): number {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(value);
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

  const ptr = mallocOrThrow(module, values.length * 4);

  const itemPtrs: number[] = [];
  try {
    for (let i = 0; i < values.length; i++) {
      const itemPtr = writeUtf8CString(module, values[i]!);
      itemPtrs.push(itemPtr);
      module.HEAP32[ptr / 4 + i] = itemPtr;
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
  if (arr.ptr) {
    module._free(arr.ptr);
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

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(readFixedWidthCString(module, ptr + i * width, width));
  }
  return out;
}
