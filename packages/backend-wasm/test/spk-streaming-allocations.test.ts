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

for (const [name, points] of [
  ["begin", 3],
  ["add", 3],
  ["end", 1],
] as const) {
  for (let failAt = 0; failAt <= points; failAt++) {
    it(
      name +
        " releases the actual WASM heap at allocation " +
        failAt +
        " and permits a same-file retry",
      async () => {
        const mod = await actualModule(),
          handles = createSpiceHandleRegistry(),
          raw = createEphemerisApi(mod, handles, createVirtualOutputRegistry());
        mod.FS.mkdirTree("/kernels");
        const h = raw.spkopn("stream.bsp", "T", 0);
        const begin = () => raw.spk14b(h, "STREAM", 101, 0, "J2000", -1, 1, 0),
          add = () => raw.spk14a(h, 1, [0, 1, 1, 2, 3, 4, 5, 6], [-1]),
          end = () => raw.spk14e(h);
        if (name !== "begin") begin();
        if (name === "end") add();
        const run = name === "begin" ? begin : name === "add" ? add : end;
        if (failAt) {
          expect(() => observe(mod, failAt, run)).toThrow(/malloc/);
          run();
        } else
          expect(observe(mod, 0, run).sizes).toEqual(
            name === "begin"
              ? [7, 6, 2048]
              : name === "add"
                ? [64, 8, 2048]
                : [2048],
          );
        if (name === "begin") add();
        if (name !== "end") end();
        raw.spkcls(h);
        expect(handles.size()).toBe(0);
      },
    );
  }
}
it("bounds active record sizes before indexing sparse input or acquiring WASM memory", async () => {
  const mod = await actualModule(),
    handles = createSpiceHandleRegistry(),
    raw = createEphemerisApi(mod, handles, createVirtualOutputRegistry());
  mod.FS.mkdirTree("/kernels");
  const h = raw.spkopn("bounds.bsp", "T", 0);
  raw.spk14b(h, "X", 101, 0, "J2000", 0, 1, 0);
  let indexed = 0;
  const sparse = (n: number) =>
    new Proxy(new Array<number>(n), {
      get(v, k) {
        if (k !== "length") indexed++;
        return Reflect.get(v, k);
      },
    });
  const { sizes } = observe(mod, 0, () => {
    expect(() =>
      raw.spk14a(h, 3800000, sparse(30400000), sparse(3800000)),
    ).toThrow(/256 MiB/);
    expect(() => raw.spk14a(h, 1, sparse(7), [0])).toThrow(/Incomplete/);
    expect(() =>
      raw.spk14a(h, 1, [0, 1, 1, 2, 3, 4, 5, Infinity], [0]),
    ).toThrow(/finite/);
  });
  expect(indexed).toBe(0);
  expect(sizes).toEqual([]);
  raw.spk14a(h, 1, [0, 1, 1, 2, 3, 4, 5, 6], [0]);
  raw.spk14e(h);
  raw.spkcls(h);
});
it("releases raw SPK14A storage and structured-error buffers after a real ordering failure", async () => {
  const mod = await actualModule(),
    handles = createSpiceHandleRegistry(),
    raw = createEphemerisApi(mod, handles, createVirtualOutputRegistry());
  mod.FS.mkdirTree("/kernels");
  const h = raw.spkopn("order.bsp", "T", 0);
  raw.spk14b(h, "X", 101, 0, "J2000", 0, 2, 0);
  const row = [0.5, 0.5, 1, 2, 3, 4, 5, 6];
  raw.spk14a(h, 1, row, [0]);
  const { sizes } = observe(mod, 0, () =>
    expect(() => raw.spk14a(h, 1, row, [0])).toThrow(/UNORDEREDREFS/),
  );
  expect(sizes.length).toBe(6);
  raw.spk14a(h, 1, [1.5, ...row.slice(1)], [1]);
  raw.spk14e(h);
  raw.spkcls(h);
});
