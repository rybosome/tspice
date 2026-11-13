import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDskApi } from "../src/domains/dsk.js";
import { createCellsWindowsKitApi } from "../src/domains/cells-windows.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
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
const descriptor = {
  bwdptr: -1,
  fwdptr: -1,
  ibase: 0,
  isize: 0,
  dbase: 0,
  dsize: 0,
  cbase: 0,
  csize: 0,
};
describe("DSK query allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["dskobj", 2],
    ["dsksrf", 2],
    ["dskgd", 4],
    ["dskb02", 4],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule();
        const kit = createCellsWindowsKitApi(module);
        const cell = kit.newIntCell(2);
        const handles = createSpiceHandleRegistry();
        const handle = handles.register("DAS", 17);
        const api = createDskApi(module, handles);
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
            if (method === "dskobj") return api.dskobj("unused.bds", cell);
            if (method === "dsksrf") return api.dsksrf("unused.bds", 399, cell);
            if (method === "dskgd") return api.dskgd(handle, descriptor);
            return api.dskb02(handle, descriptor);
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
          expect(handles.lookup(handle, ["DAS"], "retry").nativeHandle).toBe(
            17,
          );
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
          kit.freeCell(cell);
        }
        expect(leaked).toBe(0);
      });
});
