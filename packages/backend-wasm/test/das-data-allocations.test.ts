import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import type { FileIoApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createFileIoApi } from "../src/domains/file-io.js";
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
  // Resolve Emscripten's self-replacing lazy allocator exports before instrumentation.
  const dummy = module._malloc(8);
  if (!dummy) throw new Error("Cannot initialize actual WASM allocator");
  module._free(dummy);
  return module;
}
const bytes = Uint8Array.of(9, 0, 255, 8);
const transfers: {
  name: string;
  size: number;
  run: (api: FileIoApi, h: SpiceHandle) => unknown;
}[] = [
  { name: "dasadc", size: 4, run: (a, h) => a.dasadc(h, 2, 1, 2, 4, bytes) },
  { name: "dasadd", size: 16, run: (a, h) => a.dasadd(h, 2, [0.5, -0.75]) },
  { name: "dasadi", size: 8, run: (a, h) => a.dasadi(h, 2, [5, -7]) },
  { name: "dasrdc", size: 4, run: (a, h) => a.dasrdc(h, 1, 2, 1, 2, 4, bytes) },
  { name: "dasrdd", size: 16, run: (a, h) => a.dasrdd(h, 1, 2) },
  { name: "dasrdi", size: 8, run: (a, h) => a.dasrdi(h, 1, 2) },
  { name: "dasudc", size: 4, run: (a, h) => a.dasudc(h, 1, 2, 1, 2, 4, bytes) },
  { name: "dasudd", size: 16, run: (a, h) => a.dasudd(h, 1, 2, [0.5, -0.75]) },
  { name: "dasudi", size: 8, run: (a, h) => a.dasudi(h, 1, 2, [5, -7]) },
];
for (const spec of transfers)
  for (const fail of [0, 1, 2]) {
    it(
      spec.name + " releases caller buffers at allocation " + fail,
      async () => {
        const m = await actualModule(),
          registry = createSpiceHandleRegistry(),
          api = createFileIoApi(m, registry);
        const h = api.dasops();
        try {
          api.dasadc(h, 2, 0, 1, 2, Uint8Array.of(97, 98));
          api.dasadd(h, 2, [1, -2]);
          api.dasadi(h, 2, [3, -4]);
          const alloc = m._malloc,
            free = m._free,
            live = new Set<number>(),
            sizes: number[] = [];
          m._malloc = (n) => {
            sizes.push(n);
            if (sizes.length === fail) return 0;
            const p = alloc(n);
            if (p) live.add(p);
            return p;
          };
          m._free = (p) => {
            expect(live.delete(p)).toBe(true);
            free(p);
          };
          try {
            if (fail) expect(() => spec.run(api, h)).toThrow(/malloc failed/);
            else spec.run(api, h);
            expect(sizes).toEqual(fail === 1 ? [2048] : [2048, spec.size]);
            expect(live.size).toBe(0);
          } finally {
            m._malloc = alloc;
            m._free = free;
            for (const p of live) free(p);
          }
          if (fail) {
            expect(api.daslla(h)).toEqual({ lastc: 2, lastd: 2, lasti: 2 });
            spec.run(api, h);
          }
          expect(api.dasrdi(h, 1, 1)).toHaveLength(1);
        } finally {
          api.dascls(h);
        }
        expect(registry.size()).toBe(0);
      },
    );
  }
it("rejects oversized transfers before reading values and protects partial source rows", async () => {
  const m = await actualModule(),
    raw = createFileIoApi(m, createSpiceHandleRegistry()),
    h = raw.dasops();
  try {
    const huge = new Proxy<number[]>([], {
      get(_, key) {
        if (key === "length") return 2147483647;
        throw new Error("entry read");
      },
    });
    expect(() => raw.dasadd(h, 1, huge)).toThrow(/buffer limit/);
    expect(() => raw.dasrdi(h, 1, 2147483647)).toThrow(/buffer limit/);
    raw.dasadc(h, 1028, 0, 0, 1, new Uint8Array(1028).fill(17));
    expect(() =>
      raw.dasudc(h, 1024, 1027, 2, 3, 5, new Uint8Array(10)),
    ).toThrow(/additional source row/);
    expect([...raw.dasrdc(h, 1024, 1027, 0, 3, 4, new Uint8Array(4))]).toEqual([
      17, 17, 17, 17,
    ]);
  } finally {
    raw.dascls(h);
  }
});
