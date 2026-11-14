import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
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
const fixture = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-two-segment.bsp",
    import.meta.url,
  ),
);
const names = {
  dafbbs: 1,
  dafcs: 1,
  daffpa: 2,
  dafgh: 2,
  dafgn: 2,
  dafgs: 3,
  dafhsf: 3,
  dafopw: 3,
} as const;
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
async function setup() {
  const module = await actualModule();
  module.FS.mkdirTree("/kernels");
  module.FS.writeFile("/kernels/arrays.bsp", fixture);
  module.FS.writeFile("/kernels/other.bsp", fixture);
  const handles = createSpiceHandleRegistry(),
    api = createFileIoApi(module, handles);
  const h = api.dafopr("arrays.bsp");
  api.dafbbs(h);
  expect(api.daffpa(h)).toBe(true);
  const call = {
    dafbbs: () => api.dafbbs(h),
    dafcs: () => api.dafcs(h),
    daffpa: () => api.daffpa(h),
    dafgh: () => api.dafgh(),
    dafgn: () => api.dafgn(h, 2147483647),
    dafgs: () => api.dafgs(h),
    dafhsf: () => api.dafhsf(h),
    dafopw: () => api.dafopw("other.bsp"),
  };
  return { module, handles, api, h, call };
}
for (const name of Object.keys(names) as Array<keyof typeof names>) {
  for (let failAt = 1; failAt <= names[name]; failAt++) {
    it(
      name + " rolls back allocation " + failAt + " and permits retry",
      async () => {
        const { module, handles, api, h, call } = await setup();
        try {
          expect(() => track<unknown>(module, failAt, call[name])).toThrow(
            /WASM malloc failed/,
          );
          expect(handles.size()).toBe(1);
          if (name === "dafopw") {
            const writer = call.dafopw();
            api.dafcls(writer);
          } else call[name]();
        } finally {
          api.dafcls(h);
        }
      },
    );
  }
  it(name + " frees every successful temporary allocation", async () => {
    const { module, handles, api, h, call } = await setup();
    try {
      if (name === "dafopw") {
        const { result, sizes } = track(module, 0, call.dafopw);
        try {
          expect(sizes).toHaveLength(names[name]);
          expect(handles.size()).toBe(2);
        } finally {
          api.dafcls(result);
        }
      } else {
        const { result, sizes } = track<unknown>(module, 0, call[name]);
        expect(sizes).toHaveLength(names[name]);
        if (name === "dafgs") {
          expect(result).toBeInstanceOf(Uint8Array);
          expect(sizes).toContain(1000);
        }
        if (name === "dafgn") {
          expect(typeof result).toBe("string");
          expect(sizes).toContain(1001);
        }
        if (name === "dafgh") expect(result).toBe(h);
      }
    } finally {
      api.dafcls(h);
    }
  });
}

it("bounds paths/claims before allocating and releases buffers after a genuine CSPICE error", async () => {
  const { module, api, h } = await setup();
  try {
    const foreign = createSpiceHandleRegistry().register("DAF", 123);
    const guard = track(module, 0, () => {
      for (const bad of [
        "/tmp/not-virtual.bsp",
        "file:///outside",
        "x\0.bsp",
        "x\ud800",
      ])
        expect(() => api.dafopw(bad)).toThrow();
      for (const len of [1.5, Infinity, -2147483649, 2147483648])
        expect(() => api.dafgn(h, len)).toThrow();
      for (const method of [
        "dafbbs",
        "dafcs",
        "daffpa",
        "dafgn",
        "dafgs",
        "dafhsf",
      ] as const)
        expect(() => api[method](foreign)).toThrow(/invalid or closed/);
    });
    expect(guard.sizes).toEqual([]);
    const error = track(module, 0, () =>
      expect(() => api.dafgn(h, 1)).toThrow(/STRINGTOOSHORT/),
    );
    expect(error.sizes).toContain(1);
    expect(api.dafgn(h)).toBeTruthy();
  } finally {
    api.dafcls(h);
  }
});

it("releases a real scratch writer after an owner registration error and reuses the error buffer", async () => {
  const { module, api, h } = await setup();
  try {
    const refuse = {
      ...createSpiceHandleRegistry(),
      register: () => {
        throw Error("issuer exhausted");
      },
    };
    const broken = createFileIoApi(module, refuse);
    const { sizes } = track(module, 0, () =>
      expect(() => broken.dafopw("/kernels/other.bsp")).toThrow(
        /issuer exhausted/,
      ),
    );
    expect(sizes).toHaveLength(3);
    const reader = api.dafopr("other.bsp");
    try {
      expect(api.dafhsf(reader)).toEqual({ nd: 2, ni: 6 });
    } finally {
      api.dafcls(reader);
    }
  } finally {
    api.dafcls(h);
  }
});
