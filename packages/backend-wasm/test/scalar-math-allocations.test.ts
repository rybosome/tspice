import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { withAllocs } from "../src/codec/alloc.js";
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
  { name: "brcktd", count: 2, invoke: (api) => api.brcktd(0.5, 3, -2) },
  { name: "brckti", count: 2, invoke: (api) => api.brckti(1, 3, -2) },
  { name: "convrt", count: 4, invoke: (api) => api.convrt(1, "KM", "M") },
  { name: "sumad", count: 3, invoke: (api) => api.sumad([1.25, -2.5, 7.75]) },
  { name: "sumai", count: 3, invoke: (api) => api.sumai([7, -11, 19, -5]) },
  {
    name: "maxd",
    count: 3,
    invoke: (api) => api.maxd([-8.25, 2.25, 1.25, 17.25]),
  },
  { name: "maxi", count: 3, invoke: (api) => api.maxi([-8, 2, 1, 17]) },
  {
    name: "mind",
    count: 3,
    invoke: (api) => api.mind([-8.25, 2.25, 1.25, 17.25]),
  },
  { name: "mini", count: 3, invoke: (api) => api.mini([-8, 2, 1, 17]) },
];

describe("scalar math on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw scalar operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("sumai shared-C safety guard rejects unsafe prefixes before actual sumai_c", async () => {
  const module = await actualModule();
  withAllocs(module, [2048, 12, 4], (errPtr, valuesPtr, outPtr) => {
    // This calls tspice's protective shim, never the undefined oracle case.
    // The checked prefix rejects even when the final mathematical total fits.
    for (const values of [
      [2147483647, 1, -1],
      [-2147483648, -1, 1],
    ]) {
      module.HEAP32.set(values, valuesPtr >> 2);
      const status = module._tspice_sumai(
        valuesPtr,
        values.length,
        outPtr,
        errPtr,
        2048,
      );
      expect(status).not.toBe(0);
      expect(module.UTF8ToString(errPtr, 2048)).toMatch(
        /prefix.*signed 32-bit/i,
      );
    }
    module.HEAP32.set([2147483647, -2147483647, 1], valuesPtr >> 2);
    expect(module._tspice_sumai(valuesPtr, 3, outPtr, errPtr, 2048)).toBe(0);
    expect(module.HEAP32[outPtr >> 2]).toBe(1);
  });
});

it("rejects oversized sparse buffers and unsafe prefixes before heap allocation", async () => {
  const module = await actualModule();
  const api = createCoordsVectorsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc;
  let allocations = 0;
  module._malloc = () => {
    allocations++;
    throw new Error("Unexpected heap allocation");
  };
  try {
    expect(() => api.sumad(new Array<number>(33554433))).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.sumai(new Array<number>(67108865))).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.sumai([2147483647, 1, -1])).toThrow(
      /prefix.*signed 32-bit/i,
    );
    expect(() => api.maxd(Array(31).fill(1))).toThrow(/30/);
    expect(allocations).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.sumai([1, -2, 3])).toBe(2);
  expect(api.sumad([])).toBe(0);
  expect(api.maxd([])).toBe(0);
});
