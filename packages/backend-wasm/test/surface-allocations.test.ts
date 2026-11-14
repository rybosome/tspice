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

const counts = { latsrf: 6, srfnrm: 6, limbpt: 12, termpt: 13 } as const;
for (const method of Object.keys(counts) as Array<keyof typeof counts>) {
  for (let pos = 1; pos <= counts[method]; pos++) {
    it(`releases prior allocations when ${method} allocation ${pos} fails`, async () => {
      const m = await actualModule(),
        api = createGeometryApi(m);
      const cut = [
        "100101",
        0,
        "AUDIT_GEOMETRY_FIXED",
        "NONE",
        "CENTER",
        "100102",
        [0, 0, 1],
        1,
        2,
        0.1,
        0.001,
        4,
      ] as const;
      const actions = {
        latsrf: () =>
          api.latsrf("ELLIPSOID", "100101", 0, "AUDIT_GEOMETRY_FIXED", [
            [0, 0],
          ]),
        srfnrm: () =>
          api.srfnrm("ELLIPSOID", "100101", 0, "AUDIT_GEOMETRY_FIXED", [
            [1, 0, 0],
          ]),
        limbpt: () => api.limbpt("TANGENT/ELLIPSOID", ...cut),
        termpt: () => api.termpt("UMBRAL/TANGENT/ELLIPSOID", "100103", ...cut),
      };
      expect(() => observe<unknown>(m, pos, actions[method])).toThrow(
        /malloc failed/,
      );
      expect(() =>
        api.srfnrm("ELLIPSOID", "UNKNOWN_E20", 0, "J2000", []),
      ).toThrow(/IDCODENOTFOUND/);
    });
  }
}
