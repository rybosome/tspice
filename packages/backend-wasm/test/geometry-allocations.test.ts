import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
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
describe("Geometry allocation rollback on the actual WASM heap", () => {
  for (const [method, count] of [
    ["subpnt", 9],
    ["subslr", 9],
    ["sincpt", 12],
    ["ilumin", 12],
    ["illumg", 13],
    ["illumf", 15],
    ["occult", 10],
    ["nvc2pl", 3],
    ["pl2nvc", 4],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule(),
          api = createGeometryApi(module);
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
            if (method === "subpnt")
              return api.subpnt(
                "Near point: Ellipsoid",
                "MOON",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
              );
            if (method === "subslr")
              return api.subslr(
                "Near point: Ellipsoid",
                "MOON",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
              );
            if (method === "sincpt")
              return api.sincpt(
                "ELLIPSOID",
                "MOON",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
                "J2000",
                [1, 2, 3],
              );
            if (method === "ilumin")
              return api.ilumin(
                "ELLIPSOID",
                "MOON",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
                [1, 2, 3],
              );
            if (method === "illumg")
              return api.illumg(
                "ELLIPSOID",
                "MOON",
                "SUN",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
                [1, 2, 3],
              );
            if (method === "illumf")
              return api.illumf(
                "ELLIPSOID",
                "MOON",
                "SUN",
                0,
                "IAU_MOON",
                "NONE",
                "EARTH",
                [1, 2, 3],
              );
            if (method === "occult")
              return api.occult(
                "MOON",
                "ELLIPSOID",
                "IAU_MOON",
                "SUN",
                "POINT",
                "",
                "NONE",
                "EARTH",
                0,
              );
            if (method === "nvc2pl") return api.nvc2pl([1, 2, 3], 4);
            return api.pl2nvc([0, 0, 1, 2]);
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const p of live) free(p);
        }
        expect(leaked).toBe(0);
        expect(api.nvc2pl([0, 0, 2], 4)).toEqual([0, 0, 1, 2]);
      });
});
