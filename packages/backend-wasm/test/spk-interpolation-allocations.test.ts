import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createVirtualOutputRegistry } from "../src/runtime/virtual-outputs.js";
import {
  assertEmscriptenModule,
  type EmscriptenModule,
} from "../src/lowlevel/exports.js";
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
function observe<T>(module: EmscriptenModule, failAt: number, action: () => T) {
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const allocated = new Set<number>(),
    sizes: number[] = [];
  module._malloc = (size) => {
    sizes.push(size);
    if (sizes.length === failAt) return 0;
    const p = malloc(size);
    if (p) allocated.add(p);
    return p;
  };
  module._free = (p) => {
    expect(allocated.delete(p)).toBe(true);
    free(p);
  };
  try {
    return { value: action(), sizes };
  } finally {
    module._malloc = malloc;
    module._free = free;
    const leaked = allocated.size;
    for (const p of allocated) free(p);
    expect(leaked).toBe(0);
  }
}

for (const kind of [9, 12, 13, 18] as const) {
  const count = kind === 12 ? 4 : 5;
  for (let fault = 0; fault <= count; fault++)
    it(
      "type " +
        kind +
        " releases its buffers " +
        (fault
          ? "at allocation failure " + fault
          : "on successful file output"),
      async () => {
        const m = await actualModule();
        m.FS.mkdirTree("/kernels");
        const handles = createSpiceHandleRegistry(),
          raw = createEphemerisApi(m, handles, createVirtualOutputRegistry());
        const h = raw.spkopn("e05alloc.bsp", "E05", 0),
          pre = [199777, 0, "J2000", 0, 1, "TEST", 1] as const;
        const data = [0, 2, 3, 4, 5, 6, 1, 3, 4, 5, 6, 7],
          ep = [0, 1];
        const run = () =>
          kind === 12
            ? raw.spkw12(h, ...pre, data, 0, 1)
            : kind === 18
              ? raw.spkw18(h, 1, ...pre, data, ep)
              : raw[kind === 9 ? "spkw09" : "spkw13"](h, ...pre, data, ep);
        try {
          if (fault) {
            expect(() => observe(m, fault, run)).toThrow(/malloc/);
            run();
          } else
            expect(observe(m, 0, run).sizes).toEqual(
              kind === 12 ? [6, 5, 96, 2048] : [6, 5, 96, 2048, 16],
            );
        } finally {
          raw.spkcls(h);
        }
        expect(handles.size()).toBe(0);
      },
    );
  it(
    "type " +
      kind +
      " rejects incomplete and oversized storage before allocating",
    async () => {
      const m = await actualModule(),
        handles = createSpiceHandleRegistry(),
        raw = createEphemerisApi(m, handles, createVirtualOutputRegistry()),
        h = handles.register("SPK", 110);
      const pre = [199777, 0, "J2000", 0, 1, "TEST", 1] as const;
      let reads = 0;
      const big = new Proxy(new Array<number>(33554433), {
        get(a, k) {
          if (k !== "length") reads++;
          return Reflect.get(a, k);
        },
      });
      const run = (data: readonly number[]) =>
        kind === 12
          ? raw.spkw12(h, ...pre, data, 0, 1)
          : kind === 18
            ? raw.spkw18(h, 1, ...pre, data, [])
            : raw[kind === 9 ? "spkw09" : "spkw13"](h, ...pre, data, []);
      expect(
        observe(m, 0, () => {
          expect(() => run(big)).toThrow(/256 MiB/);
          expect(() => run([1])).toThrow(/Incomplete/);
        }).sizes,
      ).toEqual([]);
      expect(reads).toBe(0);
    },
  );
}
