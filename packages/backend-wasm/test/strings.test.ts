import { describe, expect, it } from "vitest";

import { readFixedWidthCString, readFixedWidthCStringArray } from "../src/codec/strings.js";

function makeModule(bytes: number[]) {
  return { HEAPU8: Uint8Array.from(bytes) };
}

describe("backend-wasm codec/strings", () => {
  it("readFixedWidthCString: stops at NUL terminator", () => {
    const module = makeModule([
      ...new TextEncoder().encode("abc"),
      0,
      ...new TextEncoder().encode("def"),
    ]);

    expect(readFixedWidthCString(module, 0, 7)).toBe("abc");
  });

  it("readFixedWidthCString: stops at embedded NUL", () => {
    const module = makeModule([
      ...new TextEncoder().encode("ab"),
      0,
      ...new TextEncoder().encode("c"),
      0,
    ]);

    expect(readFixedWidthCString(module, 0, 4)).toBe("ab");
  });

  it("readFixedWidthCString: right-trims only", () => {
    const module = makeModule([
      ...new TextEncoder().encode("  hi  "),
      0,
    ]);

    // Leading spaces preserved; trailing spaces trimmed.
    expect(readFixedWidthCString(module, 0, 7)).toBe("  hi");
  });

  it("readFixedWidthCStringArray: reads contiguous fixed-width entries", () => {
    const width = 6;
    const bytes: number[] = [];

    // "a" padded
    bytes.push(...new TextEncoder().encode("a"));
    bytes.push(...Array(width - 1).fill(" ".charCodeAt(0)));

    // "b" + NUL + garbage padding (should stop at NUL)
    bytes.push("b".charCodeAt(0));
    bytes.push(0);
    bytes.push(...Array(width - 2).fill("x".charCodeAt(0)));

    const module = makeModule(bytes);

    expect(readFixedWidthCStringArray(module, 0, 2, width)).toEqual(["a", "b"]);
  });
});
