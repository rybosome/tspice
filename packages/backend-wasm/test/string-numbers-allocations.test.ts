import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { StringsApi } from "@rybosome/tspice-backend-contract";
import { createStringsApi } from "../src/domains/strings.js";
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

const calls: {
  name: string;
  count: number;
  invoke(api: StringsApi): unknown;
}[] = [
  { name: "dp2hx", count: 3, invoke: (a) => a.dp2hx(-15.5) },
  { name: "hx2dp", count: 5, invoke: (a) => a.hx2dp("1^-1") },
  { name: "prsdp", count: 3, invoke: (a) => a.prsdp("-PI") },
  { name: "prsint", count: 3, invoke: (a) => a.prsint("-1.5") },
  { name: "repmc", count: 5, invoke: (a) => a.repmc("X#Y", "#", "café") },
  { name: "repmct", count: 4, invoke: (a) => a.repmct("X#Y", "#", 42, "L") },
  { name: "repmd", count: 4, invoke: (a) => a.repmd("X#Y", "#", 2.125, 4) },
  {
    name: "repmf",
    count: 4,
    invoke: (a) => a.repmf("X#Y", "#", 2.125, 5, "F"),
  },
  { name: "repmi", count: 4, invoke: (a) => a.repmi("X#Y", "#", -99) },
  { name: "repml", count: 4, invoke: (a) => a.repml("X#Y", "#", true, "C") },
  { name: "repmot", count: 4, invoke: (a) => a.repmot("X#Y", "#", 42, "L") },
];
describe("numeric strings on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createStringsApi(module);
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
        // Recovery executes this same genuine raw string operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});
