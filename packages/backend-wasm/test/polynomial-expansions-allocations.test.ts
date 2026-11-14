import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { withAllocs } from "../src/codec/alloc.js";
import { createErrorApi } from "../src/domains/error.js";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";

async function actualModule() {
  const assets = new URL("../emscripten/", import.meta.url);
  const imported: unknown = await import(
    new URL("tspice_backend_wasm.node.js", assets).href
  );
  if (typeof imported !== "object" || imported === null)
    throw new Error("Missing actual module factory");
  const factory: unknown = Reflect.get(imported, "default");
  if (typeof factory !== "function")
    throw new Error("Missing actual module factory");
  const pending: unknown = Reflect.apply(factory, undefined, [
    {
      wasmBinary: fs.readFileSync(new URL("tspice_backend_wasm.wasm", assets)),
      locateFile: (name: string) => fileURLToPath(new URL(name, assets)),
    },
  ]);
  const module = await pending;
  assertEmscriptenModule(module);
  return module;
}

const calls: {
  name: string;
  count: number;
  invoke(api: CoordsVectorsApi): unknown;
}[] = [
  {
    name: "chbder",
    count: 5,
    invoke: (api) => api.chbder([2, -3, 5, -7], [10, 4], 12, 6),
  },
  {
    name: "chbigr",
    count: 5,
    invoke: (api) => api.chbigr([2, -3, 5, -7], [10, 4], 12),
  },
  {
    name: "chbint",
    count: 5,
    invoke: (api) => api.chbint([2, -3, 5, -7], [10, 4], 12),
  },
  {
    name: "chbval",
    count: 4,
    invoke: (api) => api.chbval([2, -3, 5, -7], [10, 4], 12),
  },
  {
    name: "polyds",
    count: 3,
    invoke: (api) => api.polyds([2, -3, 5, -7], 6, 0.5),
  },
  { name: "rquad", count: 3, invoke: (api) => api.rquad(1, 2, 5) },
];
describe("polynomial expansions on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createCoordsVectorsApi(module);
        const expected = call.invoke(api);
        // Prime Emscripten's lazy malloc/free aliases before instrumentation.
        const warm = module._malloc(8);
        module._free(warm);
        const malloc = module._malloc;
        const free = module._free;
        let allocations = 0;
        const live = new Set<number>();
        module._malloc = (bytes: number) => {
          if (++allocations === failAt) return 0;
          const pointer = malloc(bytes);
          if (pointer) live.add(pointer);
          return pointer;
        };
        module._free = (pointer: number) => {
          expect(live.delete(pointer)).toBe(true);
          free(pointer);
        };
        let leaked = 0;
        try {
          if (failAt)
            expect(() => call.invoke(api)).toThrow(/WASM malloc failed/);
          else expect(call.invoke(api)).toEqual(expected);
          leaked = live.size;
          expect(allocations).toBe(failAt || call.count);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const pointer of live) free(pointer);
        }
        expect(leaked).toBe(0);
        // Recovery executes this same genuine raw polynomial operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("cleans genuine SPICE error buffers and structured diagnostics before recovery", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module),
    error = createErrorApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const live = new Set<number>();
  let count = 0;
  module._malloc = (bytes: number) => {
    count++;
    const ptr = malloc(bytes);
    live.add(ptr);
    return ptr;
  };
  module._free = (ptr: number) => {
    expect(live.delete(ptr)).toBe(true);
    free(ptr);
  };
  try {
    const errors = [
      {
        invoke: () => api.chbigr([], [0, 1], 0),
        message: "INVALIDDEGREE",
        routineAllocations: 5,
      },
      {
        invoke: () => api.chbigr([1], [0, 0], 0),
        message: "INVALIDRADIUS",
        routineAllocations: 5,
      },
      {
        invoke: () => api.chbigr([1], [0, -2], 0),
        message: "INVALIDRADIUS",
        routineAllocations: 5,
      },
      {
        invoke: () => api.rquad(0, 0, 1),
        message: "DEGENERATECASE",
        routineAllocations: 3,
      },
    ];
    for (const probe of errors) {
      count = 0;
      expect(probe.invoke).toThrow(probe.message);
      // throwWasmSpiceError also allocates short/long/trace diagnostics.
      expect(count).toBe(probe.routineAllocations + 3);
      expect(live.size).toBe(0);
      expect(error.failed()).toBe(false);
      expect(api.chbigr([1], [0, 1], 0.5)).toEqual({ p: 1, itgrlp: 0.5 });
      expect(api.rquad(0, 2, -6)).toEqual({ root1: [3, 0], root2: [3, 0] });
      expect(live.size).toBe(0);
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
    error.reset();
  }
});

it("rejects unsafe coefficient/output/workspace sizes before entry reads or heap allocation", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc;
  let count = 0;
  module._malloc = () => {
    count++;
    throw new Error("Unexpected allocation");
  };
  const proxy = (length: number) =>
    new Proxy<number[]>([], {
      get(target, key, receiver) {
        if (key === "length") return length;
        if (typeof key === "string" && /^\d+$/.test(key))
          throw new Error("Unexpected coefficient read");
        return Reflect.get(target, key, receiver);
      },
    });
  try {
    const oversize = proxy(33554433),
      unread = proxy(1);
    for (const name of ["chbder", "chbigr", "chbint", "chbval"] as const)
      expect(() =>
        Reflect.apply(api[name], api, [oversize, [0, 1], 0, 1]),
      ).toThrow(/buffer exceeds/);
    expect(() => api.polyds(oversize, 1, 0)).toThrow(/buffer exceeds/);
    expect(() => api.chbder(unread, [0, 1], 0, 11184810)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.polyds(unread, 33554432, 0)).toThrow(/buffer exceeds/);
    expect(() => api.chbder(unread, [0, 1], 0, 715827882)).toThrow(
      /derivative order/,
    );
    expect(() => api.polyds(unread, 2147483647, 0)).toThrow(/derivative order/);
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.polyds([1, 2], 1, 3)).toEqual([7, 2]);
});

it("protects shared-C workspace bounds and executes negative-order no-write with valid sentinel storage", async () => {
  const module = await actualModule();
  withAllocs(
    module,
    [2048, 16, 16, 24, 16],
    (errPtr, cpPtr, x2sPtr, workspacePtr, outPtr) => {
      module.HEAPF64.set([2, -3], cpPtr >>> 3);
      module.HEAPF64.set([0, 1], x2sPtr >>> 3);
      module.HEAPF64.set([101, 202, 303], workspacePtr >>> 3);
      module.HEAPF64.set([404, 505], outPtr >>> 3);
      for (const order of [-1, 715827882])
        expect(
          module._tspice_chbder(
            cpPtr,
            2,
            x2sPtr,
            0,
            order,
            workspacePtr,
            outPtr,
            errPtr,
            2048,
          ),
        ).not.toBe(0);
      expect(
        module._tspice_polyds(cpPtr, 2, 2147483647, 0, outPtr, errPtr, 2048),
      ).not.toBe(0);
      for (const order of [-1, -2, -2147483648])
        expect(
          module._tspice_polyds(cpPtr, 2, order, 0, outPtr, errPtr, 2048),
        ).toBe(0);
      expect(
        Array.from(
          module.HEAPF64.subarray(workspacePtr >>> 3, (workspacePtr >>> 3) + 3),
        ),
      ).toEqual([101, 202, 303]);
      expect(
        Array.from(module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 2)),
      ).toEqual([404, 505]);
    },
  );
  const api = createCoordsVectorsApi(module);
  expect(api.polyds([], 3, 2)).toEqual([0, 0, 0, 0]);
  expect(api.polyds([], -1, 2)).toEqual([]);
});

it("copies derivative and root arrays before freed real heap memory is overwritten", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const coefficients = [2, -3, 5, -7];
  const derivatives = api.chbder(coefficients, [10, 4], 12, 6),
    power = api.polyds(coefficients, 6, 0.5),
    roots = api.rquad(1, 2, 5);
  const arrays = [derivatives, power, roots.root1, roots.root2],
    expected = arrays.map((values) => [...values]);
  expect(roots.root1).not.toBe(roots.root2);
  for (let repeat = 0; repeat < 8; repeat++)
    withAllocs(module, [2048, 32, 16, 168, 56], (...pointers) => {
      const sizes = [2048, 32, 16, 168, 56];
      for (let i = 0; i < pointers.length; i++)
        module.HEAPU8.fill(0x7f, pointers[i]!, pointers[i]! + sizes[i]!);
    });
  expect(arrays).toEqual(expected);
  for (const array of arrays) array.fill(0);
  expect(coefficients).toEqual([2, -3, 5, -7]);
  expect(api.polyds(coefficients, 6, 0.5)).toEqual(expected[1]);
});
