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
  SpicePlane,
  SpiceVector3,
  GeometryApi,
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
  return {
    nvp2pl: () =>
      api.nvp2pl(once<SpiceVector3>([0, 0, 1]), once<SpiceVector3>([1, 2, 2])),
    pl2nvp: () => api.pl2nvp(once<SpicePlane>([0, 0, 1, 2])),
    pl2psv: () => api.pl2psv(once<SpicePlane>([0, 0, 1, 2])),
    psv2pl: () =>
      api.psv2pl(
        once<SpiceVector3>([1, 2, 2]),
        once<SpiceVector3>([1, 0, 0]),
        once<SpiceVector3>([0, 1, 0]),
      ),
    inrypl: () =>
      api.inrypl(
        once<SpiceVector3>([1, 2, -1]),
        once<SpiceVector3>([0, 0, 1]),
        once<SpicePlane>([0, 0, 1, 2]),
      ),
    vprjp: () =>
      api.vprjp(once<SpiceVector3>([1, 2, 2]), once<SpicePlane>([0, 0, 1, 2])),
    vprjpi: () =>
      api.vprjpi(
        once<SpiceVector3>([1, 2, 2]),
        once<SpicePlane>([0, 0, 1, 2]),
        once<SpicePlane>([0, 0, 1, 7]),
      ),
    nplnpt: () =>
      api.nplnpt(
        once<SpiceVector3>([0, 0, 0]),
        once<SpiceVector3>([1, 0, 0]),
        once<SpiceVector3>([1, 2, 2]),
      ),
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
  nvp2pl: [24, 24, 32, 2048],
  pl2nvp: [32, 24, 24, 2048],
  pl2psv: [32, 24, 24, 24, 2048],
  psv2pl: [24, 24, 24, 32, 2048],
  inrypl: [24, 24, 32, 4, 24, 2048],
  vprjp: [24, 32, 24, 2048],
  vprjpi: [24, 32, 32, 24, 4, 2048],
  nplnpt: [24, 24, 24, 24, 8, 2048],
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
      api.pl2nvp([1, 0, 0, 100]);
      api.inrypl([1, 2, 3], [0, 0, 1], [0, 0, 1, 8]);
      expect(value).toEqual(original);
    },
  );
}
it("rejects nonfinite inputs before malloc and retires all buffers after a real error", async () => {
  const module = await actualModule(),
    api = createGeometryApi(module);
  const { sizes } = observe(module, 0, () => {
    expect(() => api.nvp2pl([1, 2, 3], [0, 1, NaN])).toThrow(/finite/);
    expect(() =>
      api.vprjpi([1, 2, 3], [0, 0, 1, 0], [0, 0, 1, Infinity]),
    ).toThrow(/finite/);
  });
  expect(sizes).toEqual([]);
  const rejected = observe(module, 0, () =>
    expect(() => api.nplnpt([0, 0, 0], [0, 0, 0], [1, 2, 3])).toThrow(
      /ZEROVECTOR/,
    ),
  );
  expect(rejected.sizes.length).toBeGreaterThan(sizes.length);
  expect(api.vprjpi([1, 2, 0], [0, 0, 1, 0], [1, 0, 0, 3])).toEqual({
    found: false,
  });
  expect(api.nplnpt([0, 0, 0], [1, 0, 0], [1, 2, 0])).toEqual({
    pnear: [1, 0, 0],
    dist: 2,
  });
});
