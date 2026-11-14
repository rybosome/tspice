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

describe("SPK segment operations on actual WASM heap allocations", () => {
  for (const [name, count] of [
    ["spklef", 3],
    ["spkuef", 1],
    ["spkpvn", 5],
    ["spksub", 3],
  ] as const) {
    for (let failAt = 1; failAt <= count; failAt++)
      it(
        name +
          " allocation " +
          failAt +
          " releases all earlier buffers and permits retry",
        async () => {
          const module = await actualModule();
          const api = createEphemerisApi(
            module,
            createSpiceHandleRegistry(),
            createVirtualOutputRegistry(),
          );
          module.FS.mkdirTree("/kernels");
          module.FS.writeFile(
            "/kernels/source.bsp",
            fs.readFileSync(
              new URL(
                "../../py-parity-checking/fixtures/kernels/audit-ephemeris.bsp",
                import.meta.url,
              ),
            ),
          );
          const h = api.spklef("source.bsp"),
            s = api.spksfs(-100011, 0);
          if (!s.found) throw Error("missing genuine source segment");
          const output =
            name === "spksub"
              ? api.spkopn("out.bsp", "ACTUAL SUBSET", 0)
              : undefined;
          const run = () => {
            if (name === "spklef") return api.spklef("source.bsp");
            if (name === "spkuef") return api.spkuef(h);
            if (name === "spkpvn") return api.spkpvn(h, s.descr, 125);
            if (output === undefined) throw Error("missing output");
            return api.spksub(h, s.descr, "PART", -5, 10, output);
          };
          const malloc = module._malloc,
            free = module._free,
            live = new Set<number>();
          let n = 0;
          module._malloc = (size) => {
            if (++n === failAt) return 0;
            const ptr = malloc(size);
            if (ptr) live.add(ptr);
            return ptr;
          };
          module._free = (ptr) => {
            expect(live.delete(ptr)).toBe(true);
            free(ptr);
          };
          try {
            expect(run).toThrow(/WASM malloc failed/);
            expect(live.size).toBe(0);
          } finally {
            module._malloc = malloc;
            module._free = free;
          }
          const result = run();
          if (name === "spkpvn")
            expect(result).toEqual({
              ref: 1,
              center: -100010,
              state: [8187.5, -20078.125, 30054.6875, 1.75, -0.5, 0.375],
            });
          if (name === "spklef") expect(result).toBe(h);
          if (output !== undefined) {
            api.spkcls(output);
            const selected = api.spklef("out.bsp");
            const sub = api.spksfs(-100011, 1);
            if (!sub.found) throw Error("subset was not persisted");
            expect(sub.ident).toBe("PART");
            expect(api.spkpvn(selected, sub.descr, 1).center).toBe(-100010);
            api.spkuef(selected);
          }
          if (name !== "spkuef") api.spkuef(h);
        },
      );
  }
});
