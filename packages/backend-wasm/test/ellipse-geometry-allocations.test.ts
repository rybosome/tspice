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
  SpicePlane,
  SpiceEllipseInput,
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

function ellipse(): SpiceEllipseInput {
  const shape = {
    center: once<SpiceVector3>([1, 2, 3]),
    semiMajor: once<SpiceVector3>([4, 0, 0]),
    semiMinor: once<SpiceVector3>([0, 2, 0]),
  };
  const seen = new Set<PropertyKey>();
  return new Proxy(shape, {
    get(t, k, r) {
      if (seen.has(k)) throw new Error("Repeated ellipse field read");
      seen.add(k);
      return Reflect.get(t, k, r);
    },
  });
}
function calls(api: GeometryApi) {
  return {
    cgv2el: () =>
      api.cgv2el(
        once<SpiceVector3>([1, 2, 3]),
        once<SpiceVector3>([4, 0, 0]),
        once<SpiceVector3>([0, 2, 0]),
      ),
    el2cgv: () => api.el2cgv(ellipse()),
    saelgv: () =>
      api.saelgv(once<SpiceVector3>([4, 0, 0]), once<SpiceVector3>([0, 2, 0])),
    pjelpl: () => api.pjelpl(ellipse(), once<SpicePlane>([0, 0, 1, 0])),
    inedpl: () => api.inedpl(4, 3, 2, once<SpicePlane>([0, 0, 1, 1])),
    inelpl: () => api.inelpl(ellipse(), once<SpicePlane>([1, 0, 0, 1])),
    npelpt: () => api.npelpt(once<SpiceVector3>([9, 2, 3]), ellipse()),
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
  cgv2el: [24, 24, 24, 72, 2048],
  el2cgv: [72, 24, 24, 24, 2048],
  saelgv: [24, 24, 24, 24, 2048],
  pjelpl: [72, 32, 72, 2048],
  inedpl: [32, 72, 4, 2048],
  inelpl: [72, 32, 4, 24, 24, 2048],
  npelpt: [24, 72, 24, 8, 2048],
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
      api.el2cgv(ellipse());
      api.inedpl(4, 3, 2, [0, 0, 1, 2]);
      expect(value).toEqual(original);
    },
  );
}
it("validates nested finite inputs before allocating, preserves undefined payloads and recovers after genuine errors", async () => {
  const m = await actualModule(),
    api = createGeometryApi(m);
  const checked = observe(m, 0, () => {
    expect(() => api.el2cgv({ ...ellipse(), semiMajor: [1, NaN, 3] })).toThrow(
      /finite/,
    );
    expect(() => api.inedpl(1, Infinity, 3, [0, 0, 1, 0])).toThrow(/finite/);
  });
  expect(checked.sizes).toEqual([]);
  expect(api.inelpl(ellipse(), [0, 0, 1, 3])).toEqual({ nxpts: -1 });
  expect(api.inelpl(ellipse(), [0, 0, 1, 4])).toEqual({ nxpts: 0 });
  expect(api.inedpl(4, 3, 2, [0, 0, 1, 4])).toEqual({ found: false });
  expect(() =>
    api.inelpl({ ...ellipse(), semiMinor: [2, 0, 0] }, [0, 0, 1, 0]),
  ).toThrow(/INVALIDELLIPSE/);
  expect(api.npelpt([9, 2, 3], ellipse())).toEqual({
    pnear: [5, 2, 3],
    dist: 4,
  });
});
it("checks the guarded distorted plane and releases all allocations including toolkit diagnostics", async () => {
  const m = await actualModule(),
    api = createGeometryApi(m),
    n = Math.sqrt(1 / 3);
  const out = observe(m, 0, () =>
    expect(() => api.inedpl(1e300, 1e-300, 1e300, [n, n, n, 0])).toThrow(
      /Spanning vectors are parallel\.[\s\S]*inedpl_c --> psv2pl_c/,
    ),
  );
  expect(out.sizes.length).toBe(7);
  expect(api.inedpl(4, 3, 2, [0, 0, 1, 4])).toEqual({ found: false });
});
