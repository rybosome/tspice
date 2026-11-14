import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createDskApi } from "../src/domains/dsk.js";
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
import type { DskApi, SpiceVector3 } from "@rybosome/tspice-backend-contract";
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

import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
function calls(api: DskApi) {
  const a = () => once([0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 4]),
    p = () => once([1, 3, 2, 1, 2, 4, 1, 4, 3, 2, 3, 4]);
  const x = () => once<SpiceVector3>([2, 0, 0]),
    y = () => once<SpiceVector3>([0, 3, 0]),
    z = () => once<SpiceVector3>([0, 0, 0]);
  return {
    pltar: () => api.pltar(a(), p()),
    pltvol: () => api.pltvol(a(), p()),
    pltexp: () => api.pltexp(once([0, 0, 0, 2, 0, 0, 0, 3, 0]), 0.5),
    pltnp: () => api.pltnp(y(), z(), x(), y()),
    pltnrm: () => api.pltnrm(z(), x(), y()),
    dskrb2: () => api.dskrb2(a(), p(), 3, once([])),
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
  pltar: [96, 48, 8, 2048],
  pltvol: [96, 48, 8, 2048],
  pltexp: [72, 72, 2048],
  pltnp: [24, 24, 24, 24, 32, 2048],
  pltnrm: [24, 24, 24, 24, 2048],
  dskrb2: [96, 48, 8, 16, 2048],
} as const;
for (const method of Object.keys(sizes) as Array<keyof typeof sizes>) {
  const expected = sizes[method];
  for (let i = 1; i <= expected.length; i++)
    it(
      method + " releases prior acquisitions after failed allocation " + i,
      async () => {
        const module = await actualModule(),
          api = createDskApi(module, createSpiceHandleRegistry());
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
        api = createDskApi(module, createSpiceHandleRegistry());
      const { value, sizes } = observe<unknown>(module, 0, calls(api)[method]);
      expect(sizes).toEqual(expected);
      const original = structuredClone(value);
      // Reuse the same heap for calls with different inputs and return layouts.
      api.pltnrm([0, 0, 0], [1, 1, 0], [1, 0, -2]);
      api.pltexp([0, 0, 0, 1, 2, 3, 4, 5, 6], -1);
      expect(value).toEqual(original);
    },
  );
}

it("frees physical empty sentinels, errors and valid post-error results", async () => {
  const m = await actualModule(),
    api = createDskApi(m, createSpiceHandleRegistry());
  expect(observe(m, 0, () => api.pltar([], []))).toEqual({
    sizes: [8, 4, 8, 2048],
    value: 0,
  });
  expect(
    observe(m, 0, () =>
      expect(() => api.dskrb2([1, 2, 3], [1, 1, 1], 2)).toThrow(/NOTSUPPORTED/),
    ).sizes.length,
  ).toBe(8);
  expect(api.dskrb2([1, 2, 3], [0, -2, 99], 3)).toEqual({
    mncor3: 3,
    mxcor3: 3,
  });
  expect(
    observe(m, 0, () =>
      expect(() => api.dskrb2([1, 2, 3], [0, 1, 1], 1)).toThrow(/one-based/),
    ).sizes.length,
  ).toBeGreaterThanOrEqual(5);
  expect(api.pltnp([0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0])).toEqual({
    pnear: [0, 0, 0],
    dist: 1,
  });
});
it("checks shape and byte capacity before reading or allocating oversized meshes", async () => {
  const m = await actualModule(),
    api = createDskApi(m, createSpiceHandleRegistry());
  const huge = new Proxy<number[]>([], {
    get(_target, key) {
      if (key === "length") return 2 ** 28;
      throw new Error("unexpected element read");
    },
  });
  expect(
    observe(m, 0, () =>
      expect(() => api.pltar(huge, [])).toThrow(/buffer size/),
    ).sizes,
  ).toEqual([]);
  expect(
    observe(m, 0, () =>
      expect(() => api.dskrb2([], [], 4, [])).toThrow(/parameters|radius/),
    ).sizes,
  ).toEqual([]);
  expect(
    observe(m, 0, () => expect(() => api.pltexp([1, 2], 1)).toThrow(/length/))
      .sizes,
  ).toEqual([]);
});
