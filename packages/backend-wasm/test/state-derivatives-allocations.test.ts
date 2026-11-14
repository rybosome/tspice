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
    name: "ducrss",
    count: 4,
    invoke: (api) => api.ducrss([1, -2, 4, 3, -5, 7], [-3, 5, 7, 11, 13, -17]),
  },
  {
    name: "dvcrss",
    count: 4,
    invoke: (api) => api.dvcrss([1, -2, 4, 3, -5, 7], [-3, 5, 7, 11, 13, -17]),
  },
  {
    name: "dvdot",
    count: 4,
    invoke: (api) => api.dvdot([1, -2, 4, 3, -5, 7], [-3, 5, 7, 11, 13, -17]),
  },
  {
    name: "dvsep",
    count: 4,
    invoke: (api) => api.dvsep([1, -2, 4, 3, -5, 7], [-3, 5, 7, 11, 13, -17]),
  },
  { name: "dvhat", count: 3, invoke: (api) => api.dvhat([1, -2, 4, 3, -5, 7]) },
  {
    name: "dvnorm",
    count: 3,
    invoke: (api) => api.dvnorm([1, -2, 4, 3, -5, 7]),
  },
];
describe("state derivatives on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw state-derivative operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("frees all buffers after genuine dvsep decimal overflow and recovers on the same heap", async () => {
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
    for (const rate of [1.5e308, -1.5e308]) {
      count = 0;
      expect(() =>
        api.dvsep([1, 0, 0, 0, rate, 0], [0, 1, 0, 0, 0, 0]),
      ).toThrow(/NUMERICOVERFLOW/);
      // Four routine buffers plus short/long/trace buffers allocated by the
      // existing structured CSPICE-error decoder must all be released.
      expect(count).toBe(7);
      expect(live.size).toBe(0);
      expect(error.failed()).toBe(false);
      expect(api.dvsep([1, 0, 0, 0, 2, 0], [0, 1, 0, 0, 0, 0])).toBe(-2);
      expect(live.size).toBe(0);
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
    error.reset();
  }
});

it("rejects malformed or nonfinite states before allocating", async () => {
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
    for (const call of calls) {
      const name = call.name;
      const member: unknown = Reflect.get(api, name);
      if (typeof member !== "function")
        throw new Error("Missing actual state method");
      for (const invalid of [
        [1, 2, 3],
        [1, 2, 3, 4, 5, Infinity],
        [1, 2, 3, 4, 5, 6, 7],
        new Float64Array(6),
      ]) {
        expect(() =>
          Reflect.apply(member, api, [invalid, [1, 2, 3, 4, 5, 6]]),
        ).toThrow();
      }
    }
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.dvhat([0, 0, 0, 2, -3, 4])).toEqual([0, 0, 0, 2, -3, 4]);
});

it("copies all six output components before freed WASM memory is overwritten", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const a: [number, number, number, number, number, number] = [
      1, -2, 4, 3, -5, 7,
    ],
    b: [number, number, number, number, number, number] = [
      -3, 5, 7, 11, 13, -17,
    ];
  const outputs = [api.ducrss(a, b), api.dvcrss(a, b), api.dvhat(a)],
    expected = outputs.map((value) => [...value]);
  for (let repeat = 0; repeat < 8; repeat++)
    withAllocs(module, [2048, 48, 48, 48], (...pointers) => {
      for (let i = 0; i < pointers.length; i++)
        module.HEAPU8.fill(
          0x7f,
          pointers[i]!,
          pointers[i]! + (i === 0 ? 2048 : 48),
        );
    });
  expect(outputs).toEqual(expected);
  for (const output of outputs) output.fill(0);
  expect(a).toEqual([1, -2, 4, 3, -5, 7]);
  expect(b).toEqual([-3, 5, 7, 11, 13, -17]);
  expect(api.dvcrss(a, b)).toEqual(expected[1]);
});
