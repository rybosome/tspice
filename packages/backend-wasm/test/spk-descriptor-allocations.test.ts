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
describe("SPK descriptor allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["spkpds", 3],
    ["spkuds", 10],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule();
        const api = createEphemerisApi(
          module,
          createSpiceHandleRegistry(),
          createVirtualOutputRegistry(),
        );
        const descriptor = api.spkpds(-123456, -42, "J2000", 8, -123.5, 456.75);
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
          expect(() =>
            method === "spkpds"
              ? api.spkpds(-123456, -42, "J2000", 8, -123.5, 456.75)
              : api.spkuds(descriptor),
          ).toThrow(/WASM malloc failed/);
          leaked = live.size;
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
        }
        expect(leaked).toBe(0);
        expect(api.spkuds(descriptor)).toEqual({
          body: -123456,
          center: -42,
          frame: 1,
          type: 8,
          first: -123.5,
          last: 456.75,
          baddr: 0,
          eaddr: 0,
        });
      });
});
