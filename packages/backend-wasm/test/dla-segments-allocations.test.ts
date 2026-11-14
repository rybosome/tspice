import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createVirtualOutputRegistry } from "../src/runtime/virtual-outputs.js";
import { createFileIoApi } from "../src/domains/file-io.js";
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
function track<T>(module: EmscriptenModule, failAt: number, action: () => T) {
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
    return { result: action(), sizes };
  } finally {
    module._malloc = malloc;
    module._free = free;
    const leaked = live.size;
    for (const p of live) free(p);
    expect(leaked).toBe(0);
  }
}
const sizes = {
  dlabns: [2048],
  dlaens: [2048],
  dlabbs: [32, 4, 2048],
  dlafps: [32, 32, 4, 2048],
} as const;
const first = {
  bwdptr: -1,
  fwdptr: 13,
  ibase: 11,
  isize: 1,
  dbase: 0,
  dsize: 0,
  cbase: 0,
  csize: 0,
};
const last = {
  bwdptr: 4,
  fwdptr: -1,
  ibase: 20,
  isize: -1,
  dbase: 0,
  dsize: -1,
  cbase: 0,
  csize: -1,
};
async function setup() {
  const module = await actualModule();
  const handles = createSpiceHandleRegistry(),
    api = createFileIoApi(module, handles, createVirtualOutputRegistry());
  const h = api.dlaopn("file.dla", "DLA", "allocator", 0);
  api.dlabns(h);
  api.dasadi(h, 1, [73]);
  api.dlaens(h);
  api.dlabns(h);
  const calls = {
    dlabns: () => api.dlabns(h),
    dlaens: () => api.dlaens(h),
    dlabbs: () => api.dlabbs(h),
    dlafps: () => api.dlafps(h, last),
  };
  return { module, api, h, handles, calls };
}
for (const name of Object.keys(sizes) as Array<keyof typeof sizes>) {
  for (let ordinal = 0; ordinal <= sizes[name].length; ordinal++) {
    it(
      name +
        " cleans every temporary buffer at allocation " +
        ordinal +
        " and preserves the original handle",
      async () => {
        const { module, api, h, calls } = await setup();
        try {
          if (ordinal) {
            expect(() => track<unknown>(module, ordinal, calls[name])).toThrow(
              /WASM malloc failed/,
            );
            expect(api.dlabbs(h)).toEqual({ found: true, descr: last });
            expect(api.dlafps(h, last)).toEqual({ found: true, descr: first });
          }
          const got = track<unknown>(module, 0, calls[name]);
          expect(got.sizes).toEqual(sizes[name]);
          if (name === "dlabbs" || name === "dlafps") {
            api.dlaens(h);
            api.dlabns(h);
            expect(got.result).toEqual({
              found: true,
              descr: name === "dlabbs" ? last : first,
            });
          } else {
            const actual = api.dlabbs(h);
            expect(actual).toMatchObject({
              found: true,
              descr: {
                ibase: name === "dlabns" ? 28 : 20,
                isize: name === "dlabns" ? -1 : 0,
              },
            });
          }
        } finally {
          api.dascls(h);
        }
      },
    );
  }
}
it("retains writer state and frees diagnostic allocations after an empty-list end error", async () => {
  const m = await actualModule(),
    a = createFileIoApi(
      m,
      createSpiceHandleRegistry(),
      createVirtualOutputRegistry(),
    );
  const h = a.dlaopn("empty.dla", "DLA", "empty", 0);
  try {
    const before = track(m, 0, () =>
      expect(() => a.dlaens(h)).toThrow(/DASNOSUCHADDRESS/),
    );
    expect(before.sizes.length).toBe(4);
    expect(a.dlabbs(h)).toEqual({ found: false });
    a.dlabns(h);
    a.dlaens(h);
    expect(a.dlabbs(h)).toMatchObject({
      found: true,
      descr: { ibase: 11, isize: 0 },
    });
  } finally {
    a.dascls(h);
  }
});
it("validates and snapshots all eight caller words once, checks ownership after getters, and allocates nothing for stale claims", async () => {
  const { module, api, h, handles } = await setup();
  let open = true;
  try {
    const reads = new Map<PropertyKey, number>();
    const input = new Proxy(last, {
      get(t, k, r) {
        reads.set(k, (reads.get(k) ?? 0) + 1);
        return Reflect.get(t, k, r);
      },
    });
    expect(api.dlafps(h, input)).toEqual({ found: true, descr: first });
    expect([...reads.values()]).toEqual(new Array(8).fill(1));
    const other = createSpiceHandleRegistry().register("DAS", 12),
      wrong = handles.register("DAF", 12);
    const observed = track(module, 0, () => {
      for (const bad of [other, wrong]) {
        expect(() => api.dlabbs(bad)).toThrow();
        expect(() => api.dlabns(bad)).toThrow();
        expect(() => api.dlaens(bad)).toThrow();
        expect(() => api.dlafps(bad, last)).toThrow();
      }
      expect(() => api.dlafps(h, { ...last, cbase: NaN })).toThrow();
      const closes = {
        ...last,
        get isize() {
          api.dascls(h);
          open = false;
          return -1;
        },
      };
      expect(() => api.dlafps(h, closes)).toThrow(/invalid|closed/);
    });
    expect(observed.sizes).toEqual([2048]); // Only the getter's actual DAS close.
  } finally {
    if (open) api.dascls(h);
  }
});

it("writes original DLA controls and zeroes unused bytes in the first physical integer record", async () => {
  const m = await actualModule(),
    api = createFileIoApi(
      m,
      createSpiceHandleRegistry(),
      createVirtualOutputRegistry(),
    );
  const h = api.dlaopn("ordinary.dla", "DATA", "first record", 0);
  try {
    api.dlabns(h);
    api.dlaens(h);
    expect(api.dasrdi(h, 1, 11)).toEqual([
      1000000, 4, 4, -1, -1, 11, 0, 0, 0, 0, 0,
    ]);
  } finally {
    api.dascls(h);
  }
  const bytes = m.FS.readFile("/kernels/ordinary.dla", { encoding: "binary" });
  expect(bytes.length).toBe(3072);
  const tail = bytes.subarray(2048 + 44, 3072);
  expect(tail.length).toBe(980);
  expect(tail.every((x) => x === 0)).toBe(true);
});
