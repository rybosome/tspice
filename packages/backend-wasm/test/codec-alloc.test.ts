import { describe, expect, it } from "vitest";

import { decodeWasmSpiceError, mallocOrThrow, withAllocs, withMalloc } from "../src/codec/alloc.js";

describe("backend-wasm codec alloc helpers", () => {
  it("mallocOrThrow throws when malloc returns 0", () => {
    const moduleLike = {
      _malloc: () => 0,
    };
    expect(() => mallocOrThrow(moduleLike as any, 16)).toThrow(/malloc failed/i);
  });

  it("withMalloc always frees", () => {
    const freed: number[] = [];
    const moduleLike = {
      _malloc: () => 123,
      _free: (ptr: number) => freed.push(ptr),
    };

    expect(() =>
      withMalloc(moduleLike as any, 16, () => {
        throw new Error("boom");
      }),
    ).toThrow(/boom/);

    expect(freed).toEqual([123]);
  });

  it("withAllocs frees previously allocated pointers when a later malloc fails", () => {
    const freed: number[] = [];
    let call = 0;
    const moduleLike = {
      _malloc: () => {
        call++;
        if (call === 1) return 111;
        return 0;
      },
      _free: (ptr: number) => freed.push(ptr),
    };

    expect(() => withAllocs(moduleLike as any, [8, 16], () => undefined)).toThrow(/malloc failed/i);
    expect(freed).toEqual([111]);
  });

  it("withAllocs frees all pointers even if callback throws", () => {
    const freed: number[] = [];
    let nextPtr = 100;
    const moduleLike = {
      _malloc: () => nextPtr++,
      _free: (ptr: number) => freed.push(ptr),
    };

    expect(() =>
      withAllocs(moduleLike as any, [8, 16, 32], () => {
        throw new Error("boom");
      }),
    ).toThrow(/boom/);

    // Freed in reverse allocation order.
    expect(freed).toEqual([102, 101, 100]);
  });

  it("decodeWasmSpiceError prefers the decoded message", () => {
    const moduleLike = {
      UTF8ToString: () => "  test error  ",
    };
    expect(decodeWasmSpiceError(moduleLike as any, 1, 2048, 123)).toBe("test error");
  });
});
