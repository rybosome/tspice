import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
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
    name: "dazldr",
    count: 2,
    invoke: (api) => api.dazldr(3, 4, -2, true, false),
  },
  { name: "dcyldr", count: 2, invoke: (api) => api.dcyldr(3, 4, -2) },
  { name: "dgeodr", count: 2, invoke: (api) => api.dgeodr(3, 4, -2, 3, 0.125) },
  { name: "dlatdr", count: 2, invoke: (api) => api.dlatdr(3, 4, -2) },
  {
    name: "dpgrdr",
    count: 3,
    invoke: (api) => api.dpgrdr("Earth", 3, 4, -2, 3, 0.125),
  },
  {
    name: "drdazl",
    count: 2,
    invoke: (api) => api.drdazl(5, 0.7, -0.4, true, false),
  },
  { name: "drdcyl", count: 2, invoke: (api) => api.drdcyl(5, 0.7, -2) },
  {
    name: "drdgeo",
    count: 2,
    invoke: (api) => api.drdgeo(0.7, -0.4, 2, 3, 0.125),
  },
  { name: "drdlat", count: 2, invoke: (api) => api.drdlat(5, 0.7, -0.4) },
  {
    name: "drdpgr",
    count: 3,
    invoke: (api) => api.drdpgr("Earth", 0.7, -0.4, 2, 3, 0.125),
  },
  { name: "drdsph", count: 2, invoke: (api) => api.drdsph(5, 1.1, 0.7) },
  { name: "dsphdr", count: 2, invoke: (api) => api.dsphdr(3, 4, -2) },
];

describe("coordinate Jacobians on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw matrix operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});
