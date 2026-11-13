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
describe("SPK state/search allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["spkezr", 7],
    ["spkpos", 7],
    ["spkez", 5],
    ["spkezp", 5],
    ["spkgeo", 4],
    ["spkgps", 4],
    ["spkssb", 3],
    ["spksfs", 5],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule();
        const bytes = fs.readFileSync(
          new URL(
            "../../py-parity-checking/fixtures/kernels/audit-ephemeris.bsp",
            import.meta.url,
          ),
        );
        module.FS.writeFile("/query.bsp", bytes);
        const api = createEphemerisApi(
          module,
          createSpiceHandleRegistry(),
          createVirtualOutputRegistry(),
        );
        // Loading uses the actual compiled export, independently of the query.
        const encoded = new TextEncoder().encode("/query.bsp\0"),
          pathPtr = module._malloc(encoded.length),
          errPtr = module._malloc(4096);
        module.HEAPU8.set(encoded, pathPtr);
        try {
          expect(module._tspice_furnsh(pathPtr, errPtr, 4096)).toBe(0);
        } finally {
          module._free(pathPtr);
          module._free(errPtr);
        }
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
            if (method === "spkezr")
              return api.spkezr("100001", 125.25, "J2000", "CN+S", "100002");
            if (method === "spkpos")
              return api.spkpos("100001", 125.25, "J2000", "CN+S", "100002");
            if (method === "spkez")
              return api.spkez(100001, 125.25, "J2000", "CN+S", 100002);
            if (method === "spkezp")
              return api.spkezp(100001, 125.25, "J2000", "CN+S", 100002);
            if (method === "spkgeo")
              return api.spkgeo(100001, 125.25, "J2000", 100002);
            if (method === "spkgps")
              return api.spkgps(100001, 125.25, "J2000", 100002);
            if (method === "spkssb") return api.spkssb(100001, 125.25, "J2000");
            return api.spksfs(100001, 125.25);
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const p of live) free(p);
        }
        expect(leaked).toBe(0);
        const restored = api.spkez(
          100001,
          125.25,
          "J2000",
          "NONE",
          100002,
        ).state;
        expect(restored[0]).toBeCloseTo(50000, 8);
        for (const v of restored.slice(1))
          expect(Math.abs(v)).toBeLessThan(1e-9);
        expect(api.spksfs(100001, 125.25).found).toBe(true);
      });
});
