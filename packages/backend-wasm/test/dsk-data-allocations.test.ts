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
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
import type { DlaDescriptor } from "@rybosome/tspice-backend-contract";
const bytes = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-multi-dsk.bds",
    import.meta.url,
  ),
);
async function setup() {
  const m = await actualModule();
  m.FS.mkdirTree("/kernels");
  m.FS.writeFile("/kernels/data.bds", bytes);
  const handles = createSpiceHandleRegistry(),
    files = createFileIoApi(m, handles),
    api = createDskApi(m, handles);
  const h = files.dasopr("data.bds"),
    first = files.dlabfs(h);
  if (!first.found) throw new Error("Missing fixture descriptor");
  const d = first.descr;
  function descriptor(): DlaDescriptor {
    const seen = new Set<PropertyKey>();
    return new Proxy(d, {
      get(target, key) {
        if (seen.has(key)) throw new Error("duplicate descriptor read");
        seen.add(key);
        return Reflect.get(target, key);
      },
    });
  }
  const calls = {
    dskd02: () => api.dskd02(h, descriptor(), 19, 11, 4),
    dski02: () => api.dski02(h, descriptor(), 9, 11, 4),
    dskv02: () => api.dskv02(h, descriptor(), 4, 4),
    dskp02: () => api.dskp02(h, descriptor(), 4, 4),
    dskn02: () => api.dskn02(h, descriptor(), 1),
    dskz02: () => api.dskz02(h, descriptor()),
    dskcls: () => api.dskcls(h, false),
  };
  return { m, handles, files, api, h, d, calls };
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
  dskd02: [32, 4, 32, 2048],
  dski02: [32, 4, 16, 2048],
  dskv02: [32, 4, 96, 2048],
  dskp02: [32, 4, 48, 2048],
  dskn02: [32, 24, 2048],
  dskz02: [32, 8, 2048],
  dskcls: [2048],
} as const;
for (const name of Object.keys(sizes) as Array<keyof typeof sizes>) {
  for (let i = 1; i <= sizes[name].length; ++i)
    it(
      name + " rolls back acquisition " + i + " with file claim live",
      async () => {
        const { m, handles, api, h, calls } = await setup();
        try {
          expect(() => observe<unknown>(m, i, calls[name])).toThrow(
            /malloc failed/,
          );
          expect(handles.size()).toBe(1);
          expect(() => calls[name]()).not.toThrow();
        } finally {
          if (handles.size()) api.dskcls(h, true);
        }
      },
    );
  it(
    name + " frees each successful allocation and retains owned data",
    async () => {
      const { m, handles, api, h, d, calls } = await setup();
      try {
        const { value, sizes: used } = observe<unknown>(m, 0, calls[name]);
        expect(used).toEqual(sizes[name]);
        if (name !== "dskcls") {
          const snapshot = structuredClone(value);
          api.dskd02(h, d, 15, 0, 24);
          expect(value).toEqual(snapshot);
        }
      } finally {
        if (handles.size()) api.dskcls(h, true);
      }
    },
  );
}
it("genuine toolkit failure frees the three structured error outputs and leaves valid file and heap state", async () => {
  const { m, api, h, d } = await setup();
  try {
    expect(
      observe(m, 0, () =>
        expect(() => api.dskp02(h, d, 0, 1)).toThrow(/INDEXOUTOFRANGE/),
      ).sizes,
    ).toEqual([32, 4, 12, 2048, 2048, 2048, 2048]);
    expect(api.dskp02(h, d, 1, 1)).toEqual([[1, 3, 2]]);
    expect(
      observe(m, 0, () =>
        expect(() =>
          api.dskv02(h, { ...d, dsize: 2147483647 }, 1, 2147483647),
        ).toThrow(/byte limit/),
      ).sizes,
    ).toEqual([]);
  } finally {
    api.dskcls(h, true);
  }
});
