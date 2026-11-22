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
  dafac: [2048, 10],
  dafdc: [2048],
  dafec: [2048, 32, 4, 4],
  dafrs: [2048, 40],
} as const;
async function setup() {
  const module = await actualModule();
  module.FS.mkdirTree("/kernels");
  module.FS.writeFile("/kernels/scratch.bsp", fixture);
  const handles = createSpiceHandleRegistry(),
    api = createFileIoApi(module, handles),
    h = api.dafopw("scratch.bsp");
  api.dafac(h, [" one", "two"]);
  api.dafbfs(h);
  api.daffna(h);
  const summary = api.dafgs(h);
  const calls = {
    dafac: () => api.dafac(h, ["more", "rows"]),
    dafdc: () => api.dafdc(h),
    dafec: () => api.dafec(h, 2, 16),
    dafrs: () => api.dafrs(h, summary),
  };
  return { module, api, h, calls, handles };
}
for (const name of Object.keys(sizes) as Array<keyof typeof sizes>) {
  for (let i = 1; i <= sizes[name].length; i++)
    it(
      name +
        " releases each acquired allocation when allocation " +
        i +
        " fails",
      async () => {
        const { module, api, h, calls } = await setup();
        try {
          expect(() => track<unknown>(module, i, calls[name])).toThrow(
            /WASM malloc failed/,
          );
          expect(api.dafec(h, 9, 16)).toEqual({
            n: 2,
            lines: [" one", "two"],
            done: true,
          });
          calls[name]();
        } finally {
          api.dafcls(h);
        }
      },
    );
  it(
    name +
      " calls the generated shim with the actual sized buffers and frees them on success",
    async () => {
      const { module, api, h, calls } = await setup();
      try {
        const result = track<unknown>(module, 0, calls[name]);
        expect(result.sizes).toEqual(sizes[name]);
        if (name === "dafec") {
          api.dafdc(h);
          api.dafac(h, ["replacement"]);
          expect(api.dafec(h, 1, 16).lines).toEqual(["replacement"]);
          expect(result.result).toEqual({
            n: 2,
            lines: [" one", "two"],
            done: true,
          });
        }
      } finally {
        api.dafcls(h);
      }
    },
  );
}
it("releases all native-status buffers, preserves cursor position, and recovers after each genuine toolkit error", async () => {
  const { module, api, h } = await setup();
  try {
    const observed = track(module, 0, () => {
      expect(() => api.dafac(h, ["bad\t"])).toThrow(/ILLEGALCHARACTER/);
      expect(() => api.dafec(h, 2, 2)).toThrow(/COMMENTTOOLONG/);
      expect(() => api.dafec(h, -2, 2)).toThrow(/INVALIDARGUMENT/);
      expect(() => api.dafec(h, 1, 1)).toThrow(/STRINGTOOSHORT/);
      return api.dafec(h, 2, 16);
    });
    expect(observed.result).toEqual({
      n: 2,
      lines: [" one", "two"],
      done: true,
    });
    expect(observed.sizes).toHaveLength(2 + 3 + 3 * (4 + 3) + 4);
  } finally {
    api.dafcls(h);
  }
});
it("rejects invalid page extent, row encoding and foreign tokens before any WASM memory allocation", async () => {
  const { module, api, h, handles } = await setup();
  try {
    const foreign = createSpiceHandleRegistry().register("DAF", 17);
    const wrong = handles.register("DAS", 17);
    const got = track(module, 0, () => {
      expect(() => api.dafec(h, 268435457, 2)).toThrow(/256 MiB/);
      expect(() => api.dafac(h, ["abc\0rest"])).toThrow();
      expect(() => api.dafac(h, ["\ud800"])).toThrow();
      expect(() => api.dafrs(h, new Uint8Array(7))).toThrow();
      for (const bad of [foreign, wrong]) {
        expect(() => api.dafac(bad, ["valid"])).toThrow();
        expect(() => api.dafdc(bad)).toThrow();
        expect(() => api.dafec(bad, 1)).toThrow();
        expect(() => api.dafrs(bad, new Uint8Array(40))).toThrow();
      }
    });
    expect(got.sizes).toEqual([]);
  } finally {
    api.dafcls(h);
  }
});
