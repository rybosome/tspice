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

for (const kind of [5, 10, 15, 17] as const) {
  for (const failAt of [0, 1, 2, 3, 4]) {
    it(
      "type " +
        kind +
        " releases allocations and retains the writer after acquisition " +
        failAt,
      async () => {
        const module = await actualModule(),
          handles = createSpiceHandleRegistry(),
          raw = createEphemerisApi(
            module,
            handles,
            createVirtualOutputRegistry(),
          );
        module.FS.mkdirTree("/kernels");
        const h = raw.spkopn("a.bsp", "SPK", 0),
          pre = [h, 101, 0, "J2000", -1, 1, "TEST"] as const;
        const write = () =>
          kind === 5
            ? raw.spkw05(...pre, 1, [1, 0, 0, 0, 1, 0], [0])
            : kind === 10
              ? raw.spkw10(
                  ...pre,
                  [0.001, 0, 0, 0.074, 120, 78, 6378, 1],
                  [0, 0, 0, 0.5, 0.2, 0.03, 0.4, 0.7, 0.06, 0],
                  [0],
                )
              : kind === 15
                ? raw.spkw15(
                    ...pre,
                    0,
                    [0, 0, 3],
                    [2, 0, 0],
                    7000,
                    0.1,
                    3,
                    [0, 0, 2],
                    398600,
                    0.001,
                    6378,
                  )
                : raw.spkw17(
                    ...pre,
                    0,
                    [7000, 0, 0, 0, 0, 0, 0, 0.001, 0],
                    0,
                    1,
                  );
        try {
          if (failAt) {
            expect(() => observe(module, failAt, write)).toThrow(/malloc/);
            write();
          } else
            expect(observe(module, 0, write).sizes).toEqual([
              6,
              5,
              8 * { 5: 8, 10: 19, 15: 16, 17: 12 }[kind],
              2048,
            ]);
        } finally {
          raw.spkcls(h);
        }
        expect(handles.size()).toBe(0);
      },
    );
  }
}
it("bounds a complete type 10 packet allocation before reading large caller arrays", async () => {
  const module = await actualModule(),
    handles = createSpiceHandleRegistry(),
    raw = createEphemerisApi(module, handles, createVirtualOutputRegistry()),
    h = handles.register("SPK", 99);
  let inspected = 0;
  const sparse = (n: number) =>
    new Proxy(new Array<number>(n), {
      get(v, k) {
        if (k !== "length") inspected++;
        return Reflect.get(v, k);
      },
    });
  const { sizes } = observe(module, 0, () =>
    expect(() =>
      raw.spkw10(
        h,
        101,
        0,
        "J2000",
        0,
        1,
        "T",
        sparse(8),
        sparse(31000000),
        sparse(3100000),
      ),
    ).toThrow(/256 MiB/),
  );
  expect(sizes).toEqual([]);
  expect(inspected).toBe(0);
});
