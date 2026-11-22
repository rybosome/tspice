import { expect, it, vi } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";

function mockApi(heap: Float64Array, shims: Partial<EmscriptenModule>) {
  let next = 8;
  const module: Partial<EmscriptenModule> = {
    HEAPF64: heap,
    _malloc(bytes) {
      const ptr = next;
      next += bytes;
      return ptr;
    },
    _free() {},
    ...shims,
  };
  // Only the supplied mock shim runs; no CSPICE scientific call is made.
  return createCoordsVectorsApi(module as EmscriptenModule);
}

it("marshals read-once vectors and derives the shim dimension from their owned copies", () => {
  const heap = new Float64Array(1024);
  const a = [11, -13];
  const b = [17, -19];
  let readA = false;
  let readB = false;
  Object.defineProperty(a, 0, {
    configurable: true,
    get() {
      if (readA) throw new Error("a read twice");
      readA = true;
      return 11;
    },
  });
  Object.defineProperty(b, 0, {
    get() {
      if (readB) throw new Error("b read twice");
      readB = true;
      a.length = 0;
      return 17;
    },
  });
  const shim = vi.fn(
    (aPtr: number, bPtr: number, count: number, out: number) => {
      expect(count).toBe(2);
      expect(
        Array.from(heap.subarray(aPtr >>> 3, (aPtr >>> 3) + count)),
      ).toEqual([11, -13]);
      expect(
        Array.from(heap.subarray(bPtr >>> 3, (bPtr >>> 3) + count)),
      ).toEqual([17, -19]);
      heap.set([23, -29], out >>> 3);
      return 0;
    },
  );
  const api = mockApi(heap, { _tspice_vaddg: shim });
  expect(api.vaddg(a, b)).toEqual([23, -29]);
  expect(shim).toHaveBeenCalledOnce();
});

it("rejects disappearing entries before any WASM allocation or shim invocation", () => {
  const a = [1, 2];
  const b = [3, 4];
  Object.defineProperty(a, 0, {
    get() {
      b.length = 0;
      return 1;
    },
  });
  const malloc = vi.fn();
  const shim = vi.fn();
  const api = mockApi(new Float64Array(16), {
    _malloc: malloc,
    _tspice_vdotg: shim,
  });
  expect(() => api.vdotg(a, b)).toThrow(/finite number/);
  expect(malloc).not.toHaveBeenCalled();
  expect(shim).not.toHaveBeenCalled();
});
