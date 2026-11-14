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
  "audit-seasonal-pole.tpc",
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
const files = ["100101", "SUN", "100102", "NONE"] as const;
const season = ["100101", "NONE"] as const;
const sep = [
  "100101",
  "SPHERE",
  "測定",
  "100103",
  "SPHERE",
  "unnamed",
  "100104",
  "NONE",
] as const;
for (const [name, strings, expected] of [
  ["phaseq", files, 0.12458734013080974],
  ["lspcn", season, 2.071875507862086],
  ["trgsep", sep, -0.17557087767604718],
] as const) {
  const sizes = [2048, ...strings.map((s) => Buffer.byteLength(s) + 1), 8];
  for (const failAt of Array.from(
    { length: sizes.length + 1 },
    (_, index) => index,
  )) {
    it(`${name} releases every pointer on ${failAt ? "allocation fault " + failAt : "success"}`, async () => {
      const module = await actualModule(),
        api = createGeometryApi(module),
        kernels = createKernelsApi(module, createWasmFs(module));
      try {
        for (const file of fixtures) kernels.furnsh(file);
        const call = () =>
          name === "phaseq"
            ? api.phaseq(0, ...files)
            : name === "lspcn"
              ? api.lspcn(season[0], 0, season[1])
              : api.trgsep(0, ...sep);
        const malloc = module._malloc.bind(module),
          free = module._free.bind(module),
          live = new Set<number>(),
          observed: number[] = [];
        try {
          module._malloc = (bytes) => {
            observed.push(bytes);
            if (failAt === observed.length) return 0;
            const p = malloc(bytes);
            if (p) live.add(p);
            return p;
          };
          module._free = (p) => {
            expect(live.delete(p)).toBe(true);
            free(p);
          };
          if (failAt) expect(call).toThrow(/malloc failed/);
          else expect(call()).toBeCloseTo(expected, 12);
          expect(observed).toEqual(sizes.slice(0, failAt || sizes.length));
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const p of live) free(p);
        }
        expect(call()).toBeCloseTo(expected, 12);
      } finally {
        kernels.kclear();
      }
    });
  }
  it(`${name} frees the diagnostic buffers and resumes after actual toolkit status`, async () => {
    const module = await actualModule(),
      api = createGeometryApi(module),
      kernels = createKernelsApi(module, createWasmFs(module));
    try {
      for (const f of fixtures) kernels.furnsh(f);
      const malloc = module._malloc.bind(module),
        free = module._free.bind(module),
        live = new Set<number>();
      let n = 0;
      try {
        module._malloc = (bytes) => {
          ++n;
          const p = malloc(bytes);
          if (p) live.add(p);
          return p;
        };
        module._free = (p) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        if (name === "phaseq")
          expect(() => api.phaseq(0, "100101", "SUN", "SUN", "NONE")).toThrow(
            /BODIESNOTDISTINCT/,
          );
        else if (name === "lspcn")
          expect(() => api.lspcn("100101", 0, "invalid")).toThrow(
            /INVALIDOPTION/,
          );
        else
          expect(() =>
            api.trgsep(
              0,
              "100101",
              "SPHERE",
              "",
              "100103",
              "SPHERE",
              "x",
              "100104",
              "NONE",
            ),
          ).toThrow(/EMPTYSTRING/);
        // All three structured status fields are read from the original CSPICE error.
        expect(n).toBe(sizes.length + 3);
        expect(live.size).toBe(0);
        expect(api.lspcn("100101", 0, "NONE")).toBeCloseTo(
          2.071875507862086,
          12,
        );
        expect(live.size).toBe(0);
      } finally {
        module._malloc = malloc;
        module._free = free;
        for (const p of live) free(p);
      }
    } finally {
      kernels.kclear();
    }
  });
}
