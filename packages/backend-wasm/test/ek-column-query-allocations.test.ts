import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createEkApi } from "../src/domains/ek.js";
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
describe("EK column/query allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["ekfind", 5],
    ["ekgc", 4],
    ["ekgd", 4],
    ["ekgi", 4],
    ["ekacli", 6],
    ["ekacld", 6],
    ["ekaclc", 6],
    ["ekffld", 2],
  ] as const)
    for (let failAt = 1; failAt <= count; failAt++)
      it(`${method}: allocation ${failAt}`, async () => {
        const module = await actualModule();
        const handles = createSpiceHandleRegistry();
        const handle = handles.register("EK", 17);
        const api = createEkApi(module, handles);
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
            if (method === "ekfind") return api.ekfind("SELECT ID FROM AUDIT");
            if (method === "ekgc") return api.ekgc(0, 0, 0);
            if (method === "ekgd") return api.ekgd(0, 0, 0);
            if (method === "ekgi") return api.ekgi(0, 0, 0);
            if (method === "ekacli")
              return api.ekacli(
                handle,
                0,
                "ID",
                [-7, 9],
                [1, 1],
                [false, false],
                [1, 2],
              );
            if (method === "ekacld")
              return api.ekacld(
                handle,
                0,
                "VAL",
                [-7.25, 9.5],
                [1, 1],
                [false, false],
                [1, 2],
              );
            if (method === "ekaclc")
              return api.ekaclc(
                handle,
                0,
                "TXT",
                ["A", "B"],
                [1, 1],
                [false, false],
                [1, 2],
              );
            return api.ekffld(handle, 0, [1, 2]);
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
          expect(handles.lookup(handle, ["EK"], "retry").nativeHandle).toBe(17);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
        }
        expect(leaked).toBe(0);
        expect(api.ekntab()).toBe(0);
      });
});
