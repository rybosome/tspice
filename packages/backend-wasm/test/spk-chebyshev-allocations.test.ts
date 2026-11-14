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

for (const kind of [2, 3, 20] as const) {
  for (const failAt of [1, 2, 3, 4, 0]) {
    it(
      "type " +
        kind +
        " frees all allocations at " +
        (failAt ? "failed allocation " + failAt : "successful physical write"),
      async () => {
        const module = await actualModule(),
          handles = createSpiceHandleRegistry(),
          raw = createEphemerisApi(
            module,
            handles,
            createVirtualOutputRegistry(),
          );
        module.FS.mkdirTree("/kernels");
        const h = raw.spkopn("w.bsp", "T", 0),
          common = [h, 101, 0, "J2000", 0, 1, "TEST"] as const;
        const length = kind === 2 ? 3 : 6,
          data = Array.from({ length }, (_, i) => i + 1);
        const run = () =>
          kind === 20
            ? raw.spkw20(...common, 1, 1, 0, data, 1, 1, 2451545, 0)
            : raw[kind === 2 ? "spkw02" : "spkw03"](
                ...common,
                1,
                1,
                0,
                data,
                0,
              );
        try {
          if (failAt) {
            expect(() => observe(module, failAt, run)).toThrow(/malloc/);
            run();
          } else {
            const { sizes } = observe(module, 0, run);
            expect(sizes).toEqual([6, 5, 8 * length, 2048]);
          }
        } finally {
          raw.spkcls(h);
        }
        expect(handles.size()).toBe(0);
      },
    );
  }
  it(
    "type " +
      kind +
      " rejects incomplete or oversized coefficient snapshots before any WASM allocation",
    async () => {
      const module = await actualModule(),
        handles = createSpiceHandleRegistry(),
        raw = createEphemerisApi(
          module,
          handles,
          createVirtualOutputRegistry(),
        ),
        h = handles.register("SPK", 12);
      const common = [h, 101, 0, "J2000", 0, 1, "TEST"] as const;
      let indexed = 0;
      const sparse = new Proxy(new Array<number>(33554433), {
        get(v, k) {
          if (k !== "length") indexed++;
          return Reflect.get(v, k);
        },
      });
      const run = (data: readonly number[]) =>
        kind === 20
          ? raw.spkw20(...common, 1, 1, 0, data, 1, 1, 2451545, 0)
          : raw[kind === 2 ? "spkw02" : "spkw03"](...common, 1, 1, 0, data, 0);
      const { sizes } = observe(module, 0, () => {
        expect(() => run(sparse)).toThrow(/256 MiB/);
        expect(() => run([1])).toThrow(/coefficient length/);
      });
      expect(sizes).toEqual([]);
      expect(indexed).toBe(0);
    },
  );
}
