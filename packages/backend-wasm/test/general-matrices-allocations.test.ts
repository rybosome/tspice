import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
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
function tracked<T>(module: EmscriptenModule, failAt: number, fn: () => T) {
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const live = new Set<number>(),
    sizes: number[] = [];
  module._malloc = (size) => {
    sizes.push(size);
    if (sizes.length === failAt) return 0;
    const p = malloc(size);
    if (p) live.add(p);
    return p;
  };
  module._free = (p) => {
    expect(live.delete(p)).toBe(true);
    free(p);
  };
  try {
    return { value: fn(), sizes };
  } finally {
    module._malloc = malloc;
    module._free = free;
    const leaked = live.size;
    for (const p of live) free(p);
    expect(leaked).toBe(0);
  }
}
const matrix = [1, 2, 3, 4, 5, 6],
  v = [-2, 3];
function operations(api: ReturnType<typeof createCoordsVectorsApi>) {
  return {
    mequg: () => api.mequg(matrix, 2, 3),
    mtxmg: () => api.mtxmg(matrix, v, 3, 2, 1),
    mtxvg: () => api.mtxvg(matrix, v, 3, 2),
    mxmg: () => api.mxmg(matrix, [2, 3, 4], 2, 3, 1),
    mxmtg: () => api.mxmtg(matrix, [2, 3, 4], 2, 3, 1),
    mxvg: () => api.mxvg(matrix, [2, 3, 4], 2, 3),
    vtmvg: () => api.vtmvg(v, matrix, [2, 3, 4], 2, 3),
    xposeg: () => api.xposeg(matrix, 2, 3),
  };
}
const expected = {
  mequg: { sizes: [2048, 48, 48], value: matrix },
  mtxmg: { sizes: [2048, 48, 16, 24], value: [10, 11, 12] },
  mtxvg: { sizes: [2048, 48, 16, 24], value: [10, 11, 12] },
  mxmg: { sizes: [2048, 48, 24, 16], value: [20, 47] },
  mxmtg: { sizes: [2048, 48, 24, 16], value: [20, 47] },
  mxvg: { sizes: [2048, 48, 24, 16], value: [20, 47] },
  vtmvg: { sizes: [2048, 16, 48, 24, 8], value: 101 },
  xposeg: { sizes: [2048, 48, 48], value: [1, 4, 2, 5, 3, 6] },
} as const;
for (const name of Object.keys(expected) as Array<keyof typeof expected>) {
  for (let i = 1; i <= expected[name].sizes.length; i++)
    it(name + " rolls back on acquisition " + i, async () => {
      const mod = await actualModule(),
        api = createCoordsVectorsApi(mod),
        fn = operations(api)[name];
      expect(() => tracked<unknown>(mod, i, fn)).toThrow(/WASM malloc failed/);
      expect(fn()).toEqual(expected[name].value);
    });
  it(
    name +
      " returns the full row-major result and releases every acquired buffer",
    async () => {
      const mod = await actualModule(),
        api = createCoordsVectorsApi(mod),
        fn = operations(api)[name];
      const { sizes, value } = tracked<unknown>(mod, 0, fn);
      expect(sizes).toEqual(expected[name].sizes);
      expect(value).toEqual(expected[name].value);
      api.mxmg([7], [8], 1, 1, 1);
      expect(value).toEqual(expected[name].value);
    },
  );
}
it("owns one valid sentinel per empty buffer, including negative documented contraction", async () => {
  const mod = await actualModule(),
    api = createCoordsVectorsApi(mod);
  const { sizes, value } = tracked(mod, 0, () => api.mtxmg([], [], 2, -1, 3));
  expect(sizes).toEqual([2048, 8, 8, 48]);
  expect(value).toEqual([0, 0, 0, 0, 0, 0]);
  expect(api.xposeg([], -1, 2147483647)).toEqual([]);
  expect(api.mequg([], 0, 2147483647)).toEqual([]);
  expect(api.vtmvg([], [], [], 0, 0)).toBe(0);
  expect(api.mxmg([], [], 0, 3, 0)).toEqual([]);
});
it("validates all shapes, output, outer-loop and private temporary sizes before heap allocation", async () => {
  const mod = await actualModule(),
    api = createCoordsVectorsApi(mod);
  const p = [3];
  Object.defineProperty(p, 0, {
    get() {
      throw Error("premature read");
    },
  });
  const { sizes } = tracked(mod, 0, () => {
    expect(() => api.mxmg(p, [], 1, 1, 1)).toThrow(/flat array/);
    expect(() => api.mxmg([], [], 2147483647, 0, 0)).toThrow(/loop bound/);
    expect(() => api.mxmg([], [], 8193, 0, 4096)).toThrow(/256 MiB/);
    expect(() => api.mxvg([], [], 33554433, 0)).toThrow(/256 MiB/);
    expect(() => api.mequg([], -2, 3)).toThrow();
    expect(() => api.xposeg([], 65536, 65536)).toThrow(/256 MiB/);
    expect(() => api.mxmtg([], [], 0, -1, 0)).toThrow();
  });
  expect(sizes).toEqual([]);
});
it("marshals read-once input accessors and returns independent copies", async () => {
  const mod = await actualModule(),
    api = createCoordsVectorsApi(mod);
  const input = [2, 3];
  const seen = new Set<PropertyKey>();
  const proxy = new Proxy(input, {
    get(target, key, receiver) {
      if (key === "length" || key === "0" || key === "1") {
        if (seen.has(key)) throw Error("reread");
        seen.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
  const result = api.xposeg(proxy, 1, 2);
  expect(result).toEqual([2, 3]);
  result[0] = 7;
  expect(input).toEqual([2, 3]);
});
