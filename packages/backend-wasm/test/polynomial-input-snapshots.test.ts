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
  // Only the configured shim runs; these tests never call CSPICE.
  return createCoordsVectorsApi(module as EmscriptenModule);
}

function once(values: readonly number[]): number[] {
  const input: number[] = [];
  for (const [index, value] of values.entries()) {
    let read = false;
    Object.defineProperty(input, index, {
      configurable: true,
      get() {
        if (read) throw new Error("input entry read twice");
        read = true;
        return value;
      },
    });
  }
  return input;
}

it("marshals the validated coefficient count and transform snapshot into the heap", () => {
  const heap = new Float64Array(1024);
  const coefficients = once([11, -13, 17]);
  const transform: [number, number] = [7, -5];
  let reads = 0;
  Object.defineProperty(transform, 0, {
    get() {
      if (++reads !== 1) throw new Error("transform read twice");
      coefficients.length = 0;
      return 7;
    },
  });
  const shim = vi.fn(
    (cp: number, count: number, x2s: number, x: number, out: number) => {
      expect(count).toBe(3);
      expect(Array.from(heap.subarray(cp >>> 3, (cp >>> 3) + count))).toEqual([
        11, -13, 17,
      ]);
      expect(Array.from(heap.subarray(x2s >>> 3, (x2s >>> 3) + 2))).toEqual([
        7, -5,
      ]);
      expect(x).toBe(3);
      heap[out >>> 3] = 23;
      return 0;
    },
  );
  const api = mockApi(heap, { _tspice_chbval: shim });
  expect(api.chbval(coefficients, transform, 3)).toBe(23);
  expect(reads).toBe(1);
  expect(shim).toHaveBeenCalledOnce();
});

it("reads ordinary polynomial coefficients once and rejects a missing coefficient before malloc", () => {
  const heap = new Float64Array(1024);
  const shim = vi.fn(
    (cp: number, count: number, nderiv: number, t: number, out: number) => {
      expect(count).toBe(2);
      expect(Array.from(heap.subarray(cp >>> 3, (cp >>> 3) + count))).toEqual([
        3, -5,
      ]);
      expect(nderiv).toBe(0);
      expect(t).toBe(7);
      heap[out >>> 3] = 11;
      return 0;
    },
  );
  expect(
    mockApi(heap, { _tspice_polyds: shim }).polyds(once([3, -5]), 0, 7),
  ).toEqual([11]);
  const malloc = vi.fn();
  const invalid = [1, 2];
  Object.defineProperty(invalid, 0, {
    get() {
      invalid.length = 1;
      return 1;
    },
  });
  expect(() =>
    mockApi(heap, { _malloc: malloc, _tspice_polyds: shim }).polyds(
      invalid,
      0,
      7,
    ),
  ).toThrow(/finite number/);
  expect(malloc).not.toHaveBeenCalled();
  expect(shim).toHaveBeenCalledOnce();
});
