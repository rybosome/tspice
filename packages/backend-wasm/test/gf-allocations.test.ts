import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGeometryGfApi } from "../src/domains/geometry-gf.js";
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
describe("GF allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["gfsstp", 1],
    ["gfstep", 2],
    ["gfstol", 1],
    ["gfrefn", 2],
    ["gfbail", 2],
    ["gfclrh", 1],
    ["gfinth", 1],
    ["gfrepu", 1],
    ["gfrepi", 3],
    ["gfrepf", 1],
    ["gfsep", 10],
    ["gfdist", 5],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule(),
          api = createGeometryGfApi(module),
          kit = createCellsWindowsKitApi(module),
          cnfine = kit.newWindow(4),
          result = kit.newWindow(4);
        const warm = module._malloc(8);
        module._free(warm);
        const malloc = module._malloc,
          free = module._free;
        let allocations = 0;
        const live = new Set<number>();
        module._malloc = (bytes: number) => {
          if (++allocations === failAt) return 0;
          const p = malloc(bytes);
          if (p) live.add(p);
          return p;
        };
        module._free = (p: number) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        let leaked = 0;
        try {
          expect(() => {
            if (method === "gfsstp") return api.gfsstp(10);
            if (method === "gfstep") return api.gfstep(0);
            if (method === "gfstol") return api.gfstol(1e-9);
            if (method === "gfrefn") return api.gfrefn(-5, 9, true, false);
            if (method === "gfbail") return api.gfbail();
            if (method === "gfclrh") return api.gfclrh();
            if (method === "gfinth") return api.gfinth(2);
            if (method === "gfrepu") return api.gfrepu(1, 3, 2);
            if (method === "gfrepi") return api.gfrepi(cnfine, "BEGIN", "END");
            if (method === "gfrepf") return api.gfrepf();
            if (method === "gfsep")
              return api.gfsep(
                "100101",
                "POINT",
                "J2000",
                "100103",
                "POINT",
                "J2000",
                "NONE",
                "100104",
                "<",
                0.1,
                0,
                10,
                100,
                cnfine,
                result,
              );
            return api.gfdist(
              "100101",
              "NONE",
              "100102",
              "<",
              10,
              0,
              10,
              100,
              cnfine,
              result,
            );
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const p of live) free(p);
          kit.freeWindow(cnfine);
          kit.freeWindow(result);
        }
        expect(leaked).toBe(0);
        expect(api.gfrefn(-5, 9, true, false)).toBe(2);
      });
});
