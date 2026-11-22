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
    name: "hrmesp",
    count: 4,
    invoke: (a) => a.hrmesp(10, 2, [2, -1.5, -3, -7], 11),
  },
  {
    name: "hrmint",
    count: 6,
    invoke: (a) => a.hrmint([10, 12], [2, -1.5, -3, -7], 11),
  },
  {
    name: "lgresp",
    count: 3,
    invoke: (a) => a.lgresp(-1, 1, [17, 2, -3, -40], 0.5),
  },
  {
    name: "lgrind",
    count: 6,
    invoke: (a) => a.lgrind([-1, 0, 1, 2], [17, 2, -3, -40], 0.5),
  },
  {
    name: "lgrint",
    count: 4,
    invoke: (a) => a.lgrint([-1, 0, 1, 2], [17, 2, -3, -40], 0.5),
  },
  {
    name: "qderiv",
    count: 4,
    invoke: (a) => a.qderiv([-2, 3, -5, 7], [11, -13, 17, -19], 2),
  },
];
describe("interpolation on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw interpolation operation on the same heap.
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
        invoke: () => api.hrmesp(10, 0, [2, -3], 11),
        message: "INVALIDSTEPSIZE",
        routineAllocations: 4,
      },
      {
        invoke: () => api.hrmint([0, 0], [2, -3, 4, 5], 1),
        message: "DIVIDEBYZERO",
        routineAllocations: 6,
      },
      {
        invoke: () => api.lgresp(0, 0, [1], 1),
        message: "INVALIDSTEPSIZE",
        routineAllocations: 3,
      },
      {
        invoke: () => api.lgrind([0, 0], [1, 2], 1),
        message: "DIVIDEBYZERO",
        routineAllocations: 6,
      },
      {
        invoke: () => api.lgrint([0, 0], [1, 2], 1),
        message: "DIVIDEBYZERO",
        routineAllocations: 4,
      },
      {
        invoke: () => api.qderiv([1], [2], 0),
        message: "DIVIDEBYZERO",
        routineAllocations: 4,
      },
      {
        invoke: () => api.hrmesp(0, 1, [], 0),
        message: "INVALIDSIZE",
        routineAllocations: 4,
      },
      {
        invoke: () => api.hrmint([], [], 0),
        message: "INVALIDSIZE",
        routineAllocations: 6,
      },
      {
        invoke: () => api.lgresp(0, 1, [], 0),
        message: "INVALIDSIZE",
        routineAllocations: 3,
      },
      {
        invoke: () => api.lgrind([], [], 0),
        message: "INVALIDSIZE",
        routineAllocations: 6,
      },
      {
        invoke: () => api.lgrint([], [], 0),
        message: "INVALIDSIZE",
        routineAllocations: 4,
      },
    ];
    for (const probe of errors) {
      count = 0;
      expect(probe.invoke).toThrow(probe.message);
      // throwWasmSpiceError also allocates short/long/trace diagnostics.
      expect(count).toBe(probe.routineAllocations + 3);
      expect(live.size).toBe(0);
      expect(error.failed()).toBe(false);
      expect(api.hrmesp(10, 2, [7, -3], 12)).toEqual({ f: 1, df: -3 });
      expect(api.qderiv([1], [9], 1)).toEqual([4]);
      expect(live.size).toBe(0);
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
    error.reset();
  }
});

it("rejects unsafe input and workspace sizes before entry reads or heap allocation", async () => {
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
          throw new Error("Unexpected input read");
        return Reflect.get(target, key, receiver);
      },
    });
  try {
    const large = 33554433;
    expect(() => api.hrmesp(0, 1, proxy(2 * 8388609), 0)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.hrmint(proxy(8388609), proxy(2 * 8388609), 0)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.lgresp(0, 1, proxy(large), 0)).toThrow(/buffer exceeds/);
    expect(() => api.lgrind(proxy(16777217), proxy(16777217), 0)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.lgrint(proxy(large), proxy(large), 0)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.qderiv(proxy(large), proxy(large), 1)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.qderiv([], [], 1)).toThrow(RangeError);
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.qderiv([1], [9], 1)).toEqual([4]);
});

it("rejects array entries removed by another input getter before allocating", async () => {
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
  try {
    for (const n of ["hrmint", "lgrind", "lgrint", "qderiv"] as const) {
      const a = [0, 1],
        b = n === "hrmint" ? [2, -3, 4, 5] : [2, 4];
      Object.defineProperty(a, 0, {
        get() {
          b.length = 1;
          return 0;
        },
      });
      expect(() => api[n](a, b, 1)).toThrow(TypeError);
    }
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.qderiv([1], [9], 1)).toEqual([4]);
});

it("owns every returned component after freed heap blocks are overwritten", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const a = [-2, 3, -5, 7],
    b = [11, -13, 17, -19];
  const derivative = api.qderiv(a, b, 2),
    pair = api.hrmint([10, 12], [2, -1.5, -3, -7], 11),
    lagrange = api.lgrind([10, 12], [2, 4], 11);
  for (let i = 0; i < 10; i++) {
    const sizes = [2048, 32, 32, 32];
    withAllocs(module, sizes, (...pointers) => {
      pointers.forEach((p, j) => module.HEAPU8.fill(127, p, p + sizes[j]!));
    });
  }
  expect(derivative).toEqual([3.25, -4, 5.5, -6.5]);
  expect(pair).toEqual({ f: 0.875, df: -1.625 });
  expect(lagrange).toEqual({ p: 3, dp: 1 });
  derivative.fill(0);
  expect(api.qderiv(a, b, 2)).toEqual([3.25, -4, 5.5, -6.5]);
});
