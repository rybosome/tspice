import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createGeometryGfApi } from "../src/domains/geometry-gf.js";
import {
  createCellsWindowsApi,
  createCellsWindowsKitApi,
} from "../src/domains/cells-windows.js";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createKernelsApi } from "../src/domains/kernels.js";
import { createWasmFs } from "../src/runtime/fs.js";
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
  const init = module._malloc(8);
  module._free(init);
  return module;
}
const fixtures = [
  "audit-geometry.bsp",
  "audit-fov.ti",
  "audit-geometry.tf",
].map((name) => ({
  path: name,
  bytes: fs.readFileSync(
    new URL(
      `../../py-parity-checking/fixtures/kernels/${name}`,
      import.meta.url,
    ),
  ),
}));
for (const [name, count] of [
  ["gfoclt", 10],
  ["gfrfov", 6],
  ["gftfov", 7],
] as const) {
  it(`${name} releases every allocation on success, allocator faults and CSPICE errors`, async () => {
    const module = await actualModule(),
      api = createGeometryGfApi(module),
      kit = createCellsWindowsKitApi(module),
      cells = createCellsWindowsApi(module),
      cnfine = kit.newWindow(3),
      result = kit.newWindow(3),
      kernels = createKernelsApi(module, createWasmFs(module));
    const call = (bad: boolean) => {
      const observer = bad ? "NO OBSERVER" : "100103";
      switch (name) {
        case "gfoclt":
          api.gfoclt(
            "ANY",
            "100101",
            "ELLIPSOID",
            "AUDIT_GEOMETRY_FIXED",
            "100104",
            "POINT",
            "",
            "NONE",
            observer,
            1,
            cnfine,
            result,
          );
          break;
        case "gfrfov":
          api.gfrfov(
            "AUDIT_CIRCLE",
            [1, 0, 0],
            "J2000",
            "NONE",
            observer,
            1,
            cnfine,
            result,
          );
          break;
        case "gftfov":
          api.gftfov(
            "AUDIT_CIRCLE",
            "100101",
            "POINT",
            "",
            "NONE",
            observer,
            1,
            cnfine,
            result,
          );
          break;
      }
    };
    try {
      for (const f of fixtures) kernels.furnsh(f);
      cells.wninsd(-5, 5, cnfine);
      const expected = undefined;
      for (let failAt = 0; failAt <= count + 4; failAt++) {
        const malloc = module._malloc.bind(module),
          free = module._free.bind(module),
          live = new Set<number>();
        let calls = 0;
        try {
          module._malloc = (bytes) => {
            if (++calls === failAt) return 0;
            const ptr = malloc(bytes);
            if (ptr) live.add(ptr);
            return ptr;
          };
          module._free = (ptr) => {
            expect(live.delete(ptr)).toBe(true);
            free(ptr);
          };
          if (failAt === 0) expect(call(false)).toEqual(expected);
          else if (failAt <= count)
            expect(() => call(false)).toThrow(/malloc failed/);
          else if (failAt <= count + 3)
            expect(() => call(true)).toThrow(/malloc failed/);
          else expect(() => call(true)).toThrow(/SPICE\(/);
          expect(calls).toBe(
            failAt === 0 ? count : Math.min(failAt, count + 3),
          );
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
        }
        expect(call(false)).toEqual(expected);
        expect(cells.wnfetd(result, 0)).toEqual([-5, 5]);
      }
    } finally {
      kit.freeWindow(result);
      kit.freeWindow(cnfine);
      kernels.kclear();
    }
  });
}
