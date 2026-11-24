import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createVirtualOutputRegistry } from "../src/runtime/virtual-outputs.js";
import { createKernelsApi } from "../src/domains/kernels.js";
import { createWasmFs } from "../src/runtime/fs.js";
import { copyTleTuple } from "@rybosome/tspice-core";
import fixture from "../../py-parity-checking/fixtures/audit-tle.json" with { type: "json" };
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
  // Resolve Emscripten's self-replacing lazy allocator exports before instrumentation.
  const dummy = module._malloc(8);
  if (!dummy) throw new Error("Cannot initialize actual WASM allocator");
  module._free(dummy);
  return module;
}

const rows = [fixture.lines.survey[0]!, fixture.lines.survey[1]!] as const;
const geophs = copyTleTuple(fixture.geophs, 8, "fixture", true);
const lsk = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/naif0012.tls",
    import.meta.url,
  ),
);
for (const method of ["getelm", "evsgp4"] as const) {
  for (const failure of [0, 1, 2, 3, 4]) {
    it(`${method} real heap ${failure ? "allocation failure " + failure : "successful ownership"}`, async () => {
      const m = await actualModule(),
        api = createEphemerisApi(
          m,
          createSpiceHandleRegistry(),
          createVirtualOutputRegistry(),
        );
      const kernels = createKernelsApi(m, createWasmFs(m));
      kernels.furnsh({ path: "kernels/test-tle.tls", bytes: lsk });
      try {
        const { epoch, elems } = api.getelm(1957, rows);
        const invoke = () =>
          method === "getelm"
            ? api.getelm(1957, rows).elems
            : api.evsgp4(epoch, geophs, elems);
        const expected = invoke(),
          malloc = m._malloc.bind(m),
          free = m._free.bind(m);
        const used = new Set<number>(),
          sizes: number[] = [],
          bytes = method === "getelm" ? [2048, 140, 8, 80] : [2048, 64, 80, 48];
        try {
          m._malloc = (n) => {
            sizes.push(n);
            if (failure === sizes.length) return 0;
            const ptr = malloc(n);
            if (ptr) used.add(ptr);
            return ptr;
          };
          m._free = (p) => {
            expect(used.delete(p)).toBe(true);
            free(p);
          };
          if (failure) expect(invoke).toThrow(/malloc failed/);
          else {
            const first = invoke();
            expect(first).not.toBe(expected);
            expect(first).toEqual(expected);
          }
          expect(sizes).toEqual(bytes.slice(0, failure || 4));
          expect(used.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          for (const p of used) free(p);
        }
        expect(invoke()).toEqual(expected);
      } finally {
        kernels.kclear();
      }
    });
  }
}
it("releases ordinary and diagnostic WASM allocations on BADTLE and SUBORBITAL, then recovers", async () => {
  const m = await actualModule(),
    api = createEphemerisApi(
      m,
      createSpiceHandleRegistry(),
      createVirtualOutputRegistry(),
    ),
    kernels = createKernelsApi(m, createWasmFs(m));
  kernels.furnsh({ path: "kernels/test-tle.tls", bytes: lsk });
  try {
    const parsed = api.getelm(1957, rows),
      el = copyTleTuple(parsed.elems, 10, "elems", true);
    el[5] = 0.7;
    const malloc = m._malloc.bind(m),
      free = m._free.bind(m),
      active = new Set<number>();
    try {
      m._malloc = (n) => {
        const p = malloc(n);
        if (p) active.add(p);
        return p;
      };
      m._free = (p) => {
        expect(active.delete(p)).toBe(true);
        free(p);
      };
      expect(() => api.getelm(1957, ["", ""])).toThrow(/BADTLE/);
      expect(active.size).toBe(0);
      expect(() => api.evsgp4(parsed.epoch, geophs, el)).toThrow(/SUBORBITAL/);
      expect(active.size).toBe(0);
      expect(api.evsgp4(parsed.epoch, geophs, parsed.elems)).toHaveLength(6);
      expect(active.size).toBe(0);
    } finally {
      m._malloc = malloc;
      m._free = free;
      for (const p of active) free(p);
    }
  } finally {
    kernels.kclear();
  }
});
