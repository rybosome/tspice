import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
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

const matrix = brandMat3RowMajor([2, -3, 5, 7, 11, -13, 17, 19, 23]);
const calls: {
  name: string;
  count: number;
  invoke(api: CoordsVectorsApi): unknown;
}[] = [
  {
    name: "vlcom",
    count: 4,
    invoke: (api) => api.vlcom(2, [1, -2, 4], -3, [5, 7, -11]),
  },
  {
    name: "vlcom3",
    count: 5,
    invoke: (api) =>
      api.vlcom3(2, [1, -2, 4], -3, [5, 7, -11], 0.5, [-13, 17, 19]),
  },
  {
    name: "vperp",
    count: 4,
    invoke: (api) => api.vperp([1, -2, 4], [5, 7, -11]),
  },
  {
    name: "vproj",
    count: 4,
    invoke: (api) => api.vproj([1, -2, 4], [5, 7, -11]),
  },
  {
    name: "vrel",
    count: 4,
    invoke: (api) => api.vrel([1, -2, 4], [5, 7, -11]),
  },
  {
    name: "vrotv",
    count: 4,
    invoke: (api) => api.vrotv([1, -2, 4], [2, -3, 5], 0.7),
  },
  { name: "rotvec", count: 3, invoke: (api) => api.rotvec([1, -2, 4], 0.7, 3) },
  {
    name: "vtmv",
    count: 5,
    invoke: (api) => api.vtmv([1, -2, 4], matrix, [5, 7, -11]),
  },
];

describe("vector combinations on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw vector operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});
