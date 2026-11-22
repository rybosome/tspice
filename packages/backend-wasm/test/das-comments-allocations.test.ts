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
  dasac: [2048, 10],
  dasdc: [2048],
  dasec: [2048, 32, 4, 4],
} as const;
async function setup() {
  const module = await actualModule();
  module.FS.mkdirTree("/kernels");
  const handles = createSpiceHandleRegistry(),
    api = createFileIoApi(module, handles, createVirtualOutputRegistry()),
    h = api.dasonw(
      { kind: "virtual-output", path: "scratch.das" },
      "C06",
      "C06 TEST",
      1,
    );
  api.dasac(h, [" one", "two"]);
  const calls = {
    dasac: () => api.dasac(h, ["more", "rows"]),
    dasdc: () => api.dasdc(h),
    dasec: () => api.dasec(h, 2, 16),
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
          expect(api.dasec(h, 9, 16)).toEqual({
            n: 2,
            lines: [" one", "two"],
            done: true,
          });
          calls[name]();
        } finally {
          api.dascls(h);
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
        if (name === "dasec") {
          api.dasdc(h);
          api.dasac(h, ["replacement"]);
          expect(api.dasec(h, 1, 16).lines).toEqual(["replacement"]);
          expect(result.result).toEqual({
            n: 2,
            lines: [" one", "two"],
            done: true,
          });
        }
      } finally {
        api.dascls(h);
      }
    },
  );
}
it("releases all native-status buffers, preserves cursor position, and recovers after each genuine toolkit error", async () => {
  const { module, api, h } = await setup();
  try {
    const observed = track(module, 0, () => {
      expect(() => api.dasac(h, ["bad\t"])).toThrow(/ILLEGALCHARACTER/);
      expect(() => api.dasec(h, 2, 2)).toThrow(/COMMENTTOOLONG/);
      expect(() => api.dasec(h, -2, 2)).toThrow(/INVALIDARGUMENT/);
      expect(() => api.dasec(h, 1, 1)).toThrow(/STRINGTOOSHORT/);
      return api.dasec(h, 2, 16);
    });
    expect(observed.result).toEqual({
      n: 2,
      lines: [" one", "two"],
      done: true,
    });
    expect(observed.sizes).toHaveLength(2 + 3 + 3 * (4 + 3) + 4);
  } finally {
    api.dascls(h);
  }
});
it("rejects invalid page extent, row encoding and foreign tokens before any WASM memory allocation", async () => {
  const { module, api, h, handles } = await setup();
  try {
    const foreign = createSpiceHandleRegistry().register("DAS", 17);
    const wrong = handles.register("DAF", 17);
    const got = track(module, 0, () => {
      expect(() => api.dasec(h, 268435457, 2)).toThrow(/256 MiB/);
      expect(() => api.dasac(h, ["abc\0rest"])).toThrow();
      expect(() => api.dasac(h, ["\ud800"])).toThrow();
      for (const bad of [foreign, wrong]) {
        expect(() => api.dasac(bad, ["valid"])).toThrow();
        expect(() => api.dasdc(bad)).toThrow();
        expect(() => api.dasec(bad, 1)).toThrow();
      }
    });
    expect(got.sizes).toEqual([]);
  } finally {
    api.dascls(h);
  }
});
