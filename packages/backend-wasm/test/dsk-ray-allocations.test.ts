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
  const v = [10, 1, 0.25] as const,
    dir = [-1, 0, 0] as const;
  const calls = {
    dskx02: () => api.dskx02(h, descriptor(), v, dir),
    dskxsi: () => api.dskxsi(false, "EARTH", [], 0, "J2000", v, dir),
    dskxv: () => api.dskxv(false, "EARTH", [], 0, "J2000", [v], [dir]),
    dskgtl: () => api.dskgtl(1),
    dskstl: () => api.dskstl(1, 1e-10),
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

const counts = {
  dskx02: 7,
  dskxsi: 8,
  dskxv: 8,
  dskgtl: 2,
  dskstl: 1,
} as const;
for (const name of Object.keys(counts) as Array<keyof typeof counts>) {
  for (let pos = 1; pos <= counts[name]; pos++)
    it(`${name} releases earlier allocations when position ${pos} fails`, async () => {
      const { m, api, h, calls } = await setup();
      try {
        expect(() => observe<unknown>(m, pos, calls[name])).toThrow(
          /malloc failed/,
        );
        expect(api.dskgtl(1)).toBe(1e-10);
      } finally {
        api.dskcls(h, false);
      }
    });
}
