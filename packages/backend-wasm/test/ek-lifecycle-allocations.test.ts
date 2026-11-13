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
describe("EK lifecycle allocation rollback on an actual WASM heap", () => {
  for (const [method, count] of [
    ["ekopr", 3],
    ["ekopw", 3],
    ["ekopn", 4],
    ["ekcls", 1],
    ["ekntab", 2],
    ["ektnam", 2],
    ["eknseg", 2],
    ["ekifld", 6],
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
            if (method === "ekopr") return api.ekopr("unused.ek");
            if (method === "ekopw") return api.ekopw("unused.ek");
            if (method === "ekopn") return api.ekopn("new.ek", "AUTHORED", 0);
            if (method === "ekcls") return api.ekcls(handle);
            if (method === "ekntab") return api.ekntab();
            if (method === "ektnam") return api.ektnam(0);
            if (method === "eknseg") return api.eknseg(handle);
            return api.ekifld(
              handle,
              "AUDIT_TABLE",
              2,
              ["ID"],
              ["DATATYPE=INTEGER"],
            );
          }).toThrow(/WASM malloc failed/);
          leaked = live.size;
          expect(handles.lookup(handle, ["EK"], "retry").nativeHandle).toBe(17);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
        }
        expect(leaked).toBe(0);
      });
});
