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

const counts = { illum: 6, srfxpt: 8, subpt: 6, subsol: 6, edterm: 8 } as const;
for (const method of Object.keys(counts) as Array<keyof typeof counts>) {
  for (let pos = 1; pos <= counts[method]; pos++) {
    it(`restores the heap after ${method} allocation ${pos} fails`, async () => {
      const module = await actualModule(),
        api = createGeometryApi(module);
      const actions = {
        illum: () => api.illum("100101", 11, "NONE", "100102", [3, 0, 0]),
        srfxpt: () =>
          api.srfxpt(
            "ELLIPSOID",
            "100101",
            11,
            "NONE",
            "100104",
            "J2000",
            [-1, 0, 0],
          ),
        subpt: () => api.subpt("INTERCEPT", "100101", 11, "NONE", "100102"),
        subsol: () => api.subsol("INTERCEPT", "100101", 11, "NONE", "100102"),
        edterm: () =>
          api.edterm(
            "UMBRAL",
            "100103",
            "100101",
            11,
            "AUDIT_GEOMETRY_FIXED",
            "NONE",
            "100102",
            5,
          ),
      };
      expect(() => observe<unknown>(module, pos, actions[method])).toThrow(
        /malloc failed/,
      );
      expect(() =>
        api.illum("UNKNOWN_E14", 0, "NONE", "SUN", [1, 0, 0]),
      ).toThrow(/IDCODENOTFOUND/);
    });
  }
}
