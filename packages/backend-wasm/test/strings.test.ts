import { describe, expect, it } from "vitest";

import type { EmscriptenModule } from "../src/lowlevel/exports.js";

import {
  freeUtf8CStringArray,
  readFixedWidthCString,
  readFixedWidthCStringArray,
  writeUtf8CStringArray,
} from "../src/codec/strings.js";

const UTF8 = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

function makeModule(bytes: number[]) {
  return { HEAPU8: Uint8Array.from(bytes) };
}

function makeWriteModule(totalBytes = 4096): {
  module: Pick<EmscriptenModule, "_malloc" | "_free" | "HEAPU8" | "HEAPU32">;
  freed: number[];
} {
  const buffer = new ArrayBuffer(totalBytes);
  const HEAPU8 = new Uint8Array(buffer);
  const HEAPU32 = new Uint32Array(buffer);
  const freed: number[] = [];

  // Start allocations at a non-zero address; Emscripten treats `0` as null.
  let nextPtr = 8;

  const module: Pick<EmscriptenModule, "_malloc" | "_free" | "HEAPU8" | "HEAPU32"> = {
    HEAPU8,
    HEAPU32,
    _malloc(size: number) {
      // Maintain 4-byte alignment so the pointer-array base is always aligned.
      nextPtr = (nextPtr + 3) & ~3;
      const ptr = nextPtr;
      nextPtr += size;

      if (nextPtr > totalBytes) {
        return 0;
      }
      return ptr;
    },
    _free(ptr: number) {
      freed.push(ptr);
    },
  };

  return { module, freed };
}

function readCString(heap: Uint8Array, ptr: number): string {
  let end = ptr;
  while (end < heap.length && heap[end] !== 0) {
    end++;
  }
  return UTF8_DECODER.decode(heap.subarray(ptr, end));
}

describe("backend-wasm codec/strings", () => {
  it("readFixedWidthCString: stops at NUL terminator", () => {
    const module = makeModule([
      ...UTF8.encode("abc"),
      0,
      ...UTF8.encode("def"),
    ]);

    expect(readFixedWidthCString(module, 0, 7)).toBe("abc");
  });

  it("readFixedWidthCString: stops at embedded NUL", () => {
    const module = makeModule([
      ...UTF8.encode("ab"),
      0,
      ...UTF8.encode("c"),
      0,
    ]);

    expect(readFixedWidthCString(module, 0, 4)).toBe("ab");
  });

  it("readFixedWidthCString: right-trims only", () => {
    const module = makeModule([
      ...UTF8.encode("  hi  "),
      0,
    ]);

    // Leading spaces preserved; trailing spaces trimmed.
    expect(readFixedWidthCString(module, 0, 7)).toBe("  hi");
  });

  it("readFixedWidthCStringArray: reads contiguous fixed-width entries", () => {
    const width = 6;
    const bytes: number[] = [];

    // "a" padded
    bytes.push(...UTF8.encode("a"));
    bytes.push(...Array(width - 1).fill(" ".charCodeAt(0)));

    // "b" + NUL + garbage padding (should stop at NUL)
    bytes.push("b".charCodeAt(0));
    bytes.push(0);
    bytes.push(...Array(width - 2).fill("x".charCodeAt(0)));

    const module = makeModule(bytes);

    expect(readFixedWidthCStringArray(module, 0, 2, width)).toEqual(["a", "b"]);
  });

  it("writeUtf8CStringArray: writes u32 pointer array + NUL-terminated strings", () => {
    const { module, freed } = makeWriteModule();

    const arr = writeUtf8CStringArray(module, ["a", "bc"]);
    const [aPtr, bcPtr] = arr.itemPtrs;

    expect(aPtr).toBeTypeOf("number");
    expect(bcPtr).toBeTypeOf("number");

    expect(readCString(module.HEAPU8, aPtr!)).toBe("a");
    expect(readCString(module.HEAPU8, bcPtr!)).toBe("bc");

    const baseIndex = arr.ptr / module.HEAPU32.BYTES_PER_ELEMENT;
    expect(module.HEAPU32[baseIndex + 0]).toBe(aPtr);
    expect(module.HEAPU32[baseIndex + 1]).toBe(bcPtr);

    // Freeing should release both the strings and the pointer array.
    const expectedFrees = [aPtr!, bcPtr!, arr.ptr];
    freeUtf8CStringArray(module, arr);
    expect(freed).toEqual(expectedFrees);

    // Idempotent: calling twice should be a no-op.
    const freedAfterFirst = freed.length;
    freeUtf8CStringArray(module, arr);
    expect(freed.length).toBe(freedAfterFirst);
  });
});
