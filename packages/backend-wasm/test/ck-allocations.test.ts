import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
import { createCellsWindowsKitApi } from "../src/domains/cells-windows.js";
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
describe("CK allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["cklpf", 3],
    ["ckupf", 1],
    ["ckobj", 2],
    ["ckcov", 4],
    ["ckgp", 5],
    ["ckgpav", 6],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule();
        const api = createFramesApi(module);
        const kit = createCellsWindowsKitApi(module);
        const ids = kit.newIntCell(4);
        const cover = kit.newWindow(4);
        // Emscripten resolves these exported aliases on first use. Prime them
        // before instrumentation so the lazy wrapper cannot replace our hook.
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
            if (method === "cklpf") return api.cklpf("unused.bc");
            if (method === "ckupf") return api.ckupf(17);
            if (method === "ckobj") return api.ckobj("unused.bc", ids);
            if (method === "ckcov")
              return api.ckcov(
                "unused.bc",
                -123000,
                false,
                "INTERVAL",
                0,
                "SCLK",
                cover,
              );
            if (method === "ckgp") return api.ckgp(-123000, 1000, 0, "J2000");
            return api.ckgpav(-123000, 1000, 0, "J2000");
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
          kit.freeCell(ids);
          kit.freeWindow(cover);
        }
        expect(leaked).toBe(0);
        expect(api.namfrm("J2000")).toEqual({ found: true, code: 1 });
      });
});
