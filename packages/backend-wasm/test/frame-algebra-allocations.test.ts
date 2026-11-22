import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createFramesApi } from "../src/domains/frames.js";
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
  FramesApi,
  SpiceStateVector,
  SpiceVector3,
  SpiceMatrix6x6,
} from "@rybosome/tspice-backend-contract";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
const identity: SpiceMatrix6x6 = [
  1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0,
  0, 0, 1, 0, 0, 0, 0, 0, 0, 1,
];
const rotation = brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1], {
  freeze: "never",
});
function once<T extends readonly number[]>(input: T): T {
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

function calls(api: FramesApi) {
  return {
    frame: () => api.frame(once<SpiceVector3>([3, 4, 0])),
    twovec: () =>
      api.twovec(
        once<SpiceVector3>([1, 0, 0]),
        1,
        once<SpiceVector3>([0, 1, 0]),
        2,
      ),
    twovxf: () =>
      api.twovxf(
        once<SpiceStateVector>([1, 0, 0, 0, 0.25, 0]),
        1,
        once<SpiceStateVector>([0, 1, 0, -0.25, 0, 0]),
        2,
      ),
    eul2xf: () =>
      api.eul2xf(once<SpiceStateVector>([0.3, 0.4, 0.7, 1, 2, 3]), 3, 1, 3),
    xf2eul: () => api.xf2eul(once(identity), 3, 1, 3),
    xf2rav: () => api.xf2rav(once(identity)),
    rav2xf: () => api.rav2xf(once(rotation), once<SpiceVector3>([1, 2, 3])),
    invstm: () => api.invstm(once(identity)),
    xpose6: () => api.xpose6(once(identity)),
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
  frame: [24, 24, 24, 24, 2048],
  twovec: [24, 24, 72, 2048],
  twovxf: [48, 48, 288, 2048],
  eul2xf: [48, 288, 2048],
  xf2eul: [288, 48, 4, 2048],
  xf2rav: [288, 72, 24, 2048],
  rav2xf: [72, 24, 288, 2048],
  invstm: [288, 288, 2048],
  xpose6: [288, 288, 2048],
} as const;
for (const method of Object.keys(sizes) as Array<keyof typeof sizes>) {
  const expected = sizes[method];
  for (let i = 1; i <= expected.length; i++)
    it(
      method + " releases prior acquisitions after failed allocation " + i,
      async () => {
        const module = await actualModule(),
          api = createFramesApi(module);
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
        api = createFramesApi(module);
      const { value, sizes } = observe<unknown>(module, 0, calls(api)[method]);
      expect(sizes).toEqual(expected);
      const original = structuredClone(value);
      // Reuse the same heap for calls with different inputs and return layouts.
      api.eul2xf([1, 2, 3, 4, 5, 6], 3, 2, 1);
      api.frame([1, 2, 3]);
      expect(value).toEqual(original);
    },
  );
}
it("rejects malformed operands before any allocation and safely recovers from traced toolkit errors", async () => {
  const m = await actualModule(),
    api = createFramesApi(m);
  const { sizes } = observe(m, 0, () => {
    expect(() => api.frame([1, NaN, 3])).toThrow(/finite/);
    expect(() => api.twovec([1, 0, 0], 2 ** 31, [0, 1, 0], 2)).toThrow();
    expect(() =>
      Reflect.apply(api.xpose6, api, [new Float64Array(35)]),
    ).toThrow(/36/);
  });
  expect(sizes).toEqual([]);
  const checked = observe(m, 0, () => {
    expect(() =>
      api.twovxf([1, 0, 0, 0, 0, 0], 1, [2, 0, 0, 0, 0, 0], 2),
    ).toThrow(/DEPENDENTVECTORS[\s\S]*twovxf_c --> TWOVXF --> ZZTWOVXF/);
    expect(() => api.xf2eul(identity, 1, 1, 2)).toThrow(
      /BADAXISNUMBERS[\s\S]*xf2eul_c --> XF2EUL --> M2EUL/,
    );
    expect(() => api.eul2xf([0, 0, 0, 0, 0, 0], 0, 0, 3)).toThrow(
      /BADAXISNUMBERS[\s\S]*eul2xf_c --> EUL2XF --> EUL2M/,
    );
  });
  expect(checked.sizes.length).toBeGreaterThan(11);
  expect(api.xf2eul(identity, 3, 1, 3)).toMatchObject({ unique: false });
});
it("returns both Euler statuses and preserves independent mutable state outputs", async () => {
  const m = await actualModule(),
    api = createFramesApi(m);
  const eulang: SpiceStateVector = [0.25, 0.5, 0.75, 1, 2, 3];
  const xf = api.eul2xf(eulang, 3, 1, 3),
    e = api.xf2eul(xf, 3, 1, 3);
  expect(e.unique).toBe(true);
  e.eulang.forEach((v, i) => expect(v).toBeCloseTo(eulang[i]!, 12));
  const input: SpiceVector3 = [3, 4, 0];
  const triad = api.frame(input);
  triad.x[0] = 100;
  expect(input).toEqual([3, 4, 0]);
  expect(api.frame(input).x[0]).toBeCloseTo(0.6, 14);
  const got = api.xf2eul(identity, 3, 1, 3);
  expect(got.unique).toBe(false);
  expect(got.eulang).toHaveLength(6);
});
