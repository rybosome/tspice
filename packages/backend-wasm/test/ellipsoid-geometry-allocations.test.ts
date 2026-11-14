import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
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
import type {
  GeometryApi,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
function once<T extends number[]>(input: T): T {
  const seen = new Set<PropertyKey>();
  return new Proxy(input, {
    get(target, key, receiver) {
      if (key === "length" || (typeof key === "string" && /^\d+$/.test(key))) {
        if (seen.has(key)) throw new Error("Repeated access: " + String(key));
        seen.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

function calls(api: GeometryApi) {
  const p = () => once<SpiceVector3>([5, 3, 2]),
    u = () => once<SpiceVector3>([-5, -3, -2]);
  return {
    nearpt: () => api.nearpt(p(), 3, 2, 1),
    npedln: () => api.npedln(3, 2, 1, p(), u()),
    edlimb: () => api.edlimb(3, 2, 1, p()),
    ednmpt: () => api.ednmpt(3, 2, 1, p()),
    edpnt: () => api.edpnt(p(), 3, 2, 1),
    surfnm: () => api.surfnm(3, 2, 1, p()),
    surfpt: () => api.surfpt(p(), u(), 3, 2, 1),
  };
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
const sizes = {
  nearpt: [24, 24, 8, 2048],
  npedln: [24, 24, 24, 8, 2048],
  edlimb: [24, 72, 2048],
  ednmpt: [24, 24, 2048],
  edpnt: [24, 24, 2048],
  surfnm: [24, 24, 2048],
  surfpt: [24, 24, 24, 4, 2048],
} as const;
for (const method of Object.keys(sizes) as Array<keyof typeof sizes>) {
  const expected = sizes[method];
  for (let i = 1; i <= expected.length; i++)
    it(
      method + " releases prior acquisitions after failed allocation " + i,
      async () => {
        const module = await actualModule(),
          api = createGeometryApi(module);
        expect(() => observe<unknown>(module, i, calls(api)[method])).toThrow(
          /WASM malloc failed/,
        );
        expect(calls(api)[method]()).toBeDefined();
      },
    );
  it(
    method +
      " frees exact buffers and retains owned results on the actual heap",
    async () => {
      const module = await actualModule(),
        api = createGeometryApi(module);
      const { value, sizes } = observe<unknown>(module, 0, calls(api)[method]);
      expect(sizes).toEqual(expected);
      const original = structuredClone(value);
      // Reuse the same heap for calls with different inputs and return layouts.
      api.edlimb(4, 3, 2, [-8, 4, 5]);
      api.nearpt([-5, -1, 2], 4, 3, 2);
      expect(value).toEqual(original);
    },
  );
}
it("releases the ray and diagnostic buffers after a true toolkit error and omits undefined miss data", async () => {
  const m = await actualModule(),
    api = createGeometryApi(m);
  const observed = observe(m, 0, () =>
    expect(() => api.surfpt([5, 0, 0], [0, 0, 0], 0, 2, 1)).toThrow(
      /ZEROVECTOR/,
    ),
  );
  expect(observed.sizes.length).toBe(8);
  expect(api.surfpt([5, 0, 0], [1, 0, 0], 3, 2, 1)).toEqual({ found: false });
  expect(api.surfpt([5, 0, 0], [-1, 0, 0], 3, 2, 1)).toEqual({
    found: true,
    point: [3, 0, 0],
  });
});
it("validates caller shape, sparse vectors and nonfinite input before allocating", async () => {
  const m = await actualModule(),
    api = createGeometryApi(m);
  for (const v of [[1, 0], [0, Infinity, 0], Array<number>(3)]) {
    expect(
      observe(m, 0, () =>
        expect(() => Reflect.apply(api.edpnt, api, [v, 3, 2, 1])).toThrow(),
      ).sizes,
    ).toEqual([]);
  }
  expect(
    observe(m, 0, () =>
      expect(() => api.edlimb(NaN, 2, 1, [5, 0, 0])).toThrow(),
    ).sizes,
  ).toEqual([]);
});
