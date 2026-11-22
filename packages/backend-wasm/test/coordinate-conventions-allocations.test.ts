import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { createKernelPoolApi } from "../src/domains/kernel-pool.js";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import { tspiceCall0 } from "../src/codec/calls.js";
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
    name: "azlrec",
    count: 2,
    invoke: (api) => api.azlrec(5, 0.7, -0.4, true, false),
  },
  {
    name: "recazl",
    count: 3,
    invoke: (api) => api.recazl([3, 4, -12], true, false),
  },
  {
    name: "pgrrec",
    count: 3,
    invoke: (api) => api.pgrrec("EARTH", 0.7, -0.4, 1, 3, 0.2),
  },
  {
    name: "recpgr",
    count: 4,
    invoke: (api) => api.recpgr("EARTH", [3, 4, -2], 3, 0.2),
  },
  { name: "radrec", count: 2, invoke: (api) => api.radrec(5, 0.7, -0.4) },
  { name: "recrad", count: 3, invoke: (api) => api.recrad([3, 4, -12]) },
  { name: "srfrec", count: 2, invoke: (api) => api.srfrec(9901001, 0.7, -0.4) },
];

describe("coordinate conventions on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createCoordsVectorsApi(module);
        const pool = createKernelPoolApi(module);
        try {
          pool.pdpool("BODY9901001_RADII", [3, 2, 1]);
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
          // Recovery executes this same genuine raw coordinate operation on the same heap.
          expect(call.invoke(api)).toEqual(expected);
        } finally {
          tspiceCall0(module, module._tspice_kclear);
          expect(pool.expool("BODY9901001_RADII")).toBe(false);
        }
      });
    }
  }
});
