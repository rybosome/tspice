import { createCellsWindowsKitApi } from "../src/domains/cells-windows.js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createSpiceHandleRegistry } from "../src/runtime/spice-handles.js";
import { createVirtualOutputRegistry } from "../src/runtime/virtual-outputs.js";
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
describe("SPK file/writer allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["spkopn", 4],
    ["spkopa", 3],
    ["spkw08", 4],
    ["spkcls", 1],
    ["spkobj", 2],
    ["spkcov", 2],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule(),
          kit = createCellsWindowsKitApi(module);
        const api = createEphemerisApi(
          module,
          createSpiceHandleRegistry(),
          createVirtualOutputRegistry(),
        );
        const ids = kit.newIntCell(8),
          cover = kit.newWindow(8);
        const states = [1, 2, 3, 4, 5, 6, 241, 302, 363, 4, 5, 6];
        const handle = api.spkopn("active.bsp", "AUTHORED", 0);
        api.spkw08(
          handle,
          100001,
          0,
          "J2000",
          0,
          60,
          "ACTIVE",
          1,
          states,
          0,
          60,
        );
        const warm = module._malloc(8);
        module._free(warm);
        const malloc = module._malloc,
          free = module._free;
        let allocations = 0;
        const live = new Set<number>();
        module._malloc = (bytes: number) => {
          if (++allocations === failAt) return 0;
          const ptr = malloc(bytes);
          if (ptr) live.add(ptr);
          return ptr;
        };
        module._free = (ptr: number) => {
          expect(live.delete(ptr)).toBe(true);
          free(ptr);
        };
        let leaked = 0;
        try {
          expect(() => {
            if (method === "spkopn")
              return api.spkopn("new.bsp", "AUTHORED", 0);
            if (method === "spkopa") return api.spkopa("active.bsp");
            if (method === "spkw08")
              return api.spkw08(
                handle,
                100001,
                0,
                "J2000",
                0,
                60,
                "SECOND",
                1,
                states,
                0,
                60,
              );
            if (method === "spkcls") return api.spkcls(handle);
            if (method === "spkobj") return api.spkobj("active.bsp", ids);
            return api.spkcov("active.bsp", 100001, cover);
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
          api.spkcls(handle);
          kit.freeCell(ids);
          kit.freeWindow(cover);
        }
        expect(leaked).toBe(0);
        expect(api.spkuds(api.spkpds(100001, 0, "J2000", 8, 0, 60)).body).toBe(
          100001,
        );
      });
});
