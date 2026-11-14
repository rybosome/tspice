import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createGeometryApi } from "../src/domains/geometry.js";
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
  ["getfov", 6],
  ["getfvn", 7],
  ["fovray", 7],
  ["fovtrg", 8],
] as const) {
  it(`${name} releases every allocation on success, allocator faults and CSPICE errors`, async () => {
    const module = await actualModule(),
      api = createGeometryApi(module),
      kernels = createKernelsApi(module, createWasmFs(module));
    const call = (bad: boolean) => {
      const badId = bad ? -123456 : -817101,
        inst = bad ? "UNLISTED CAMERA" : "AUDIT_CIRCLE";
      switch (name) {
        case "getfov":
          return api.getfov(badId, 1).bounds;
        case "getfvn":
          return api.getfvn(inst, 1).bounds;
        case "fovray":
          return api.fovray(inst, [1, 0, 0], "J2000", "NONE", "100103", 0);
        case "fovtrg":
          return api.fovtrg(inst, "100101", "POINT", "", "NONE", "100103", 0);
      }
    };
    try {
      for (const f of fixtures) kernels.furnsh(f);
      const expected = name.startsWith("get") ? [[3, 0.75, 0]] : true;
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
      }
    } finally {
      kernels.kclear();
    }
  });
}
