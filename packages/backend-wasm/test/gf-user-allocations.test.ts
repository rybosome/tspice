import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createGeometryGfApi } from "../src/domains/geometry-gf.js";
import {
  createCellsWindowsApi,
  createCellsWindowsKitApi,
} from "../src/domains/cells-windows.js";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";

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

for (const [name, count] of [
  ["udf", 2],
  ["uddf", 2],
  ["uddc", 2],
  ["gfudb", 1],
  ["gfuds", 2],
] as const) {
  it(
    name + " releases all callback and scratch allocations across errors",
    async () => {
      const module = await actualModule(),
        raw = createGeometryGfApi(module),
        cells = createCellsWindowsApi(module),
        kit = createCellsWindowsKitApi(module);
      const c = kit.newWindow(4),
        r = kit.newWindow(4);
      cells.wninsd(-3, 3, c);
      const run = (invalid: boolean) => {
        const scalar = (t: number) => {
          if (invalid) throw Error("callback stopped");
          return t * t;
        };
        switch (name) {
          case "udf":
            return raw.udf(1, invalid ? Infinity : 2);
          case "uddf":
            return raw.uddf(scalar, 1, 0.25);
          case "uddc":
            return raw.uddc(scalar, 1, 0.25);
          case "gfudb":
            return raw.gfudb(scalar, (f, t) => f(t) > 1, 0.25, c, r);
          case "gfuds":
            return raw.gfuds(
              scalar,
              (_f, t) => t < 0,
              "<",
              1,
              0,
              0.25,
              16,
              c,
              r,
            );
        }
      };
      try {
        for (let fail = 0; fail <= count + 1; fail++) {
          const alloc = module._malloc.bind(module),
            free = module._free.bind(module),
            live = new Set<number>();
          let i = 0;
          try {
            module._malloc = (n) => {
              if (++i === fail && fail <= count) return 0;
              const p = alloc(n);
              if (p) live.add(p);
              return p;
            };
            module._free = (p) => {
              expect(live.delete(p)).toBe(true);
              free(p);
            };
            if (fail === 0) run(false);
            else if (fail <= count) expect(() => run(false)).toThrow(/malloc/);
            else
              expect(() => run(true)).toThrow(
                name === "udf" ? /finite/ : /callback stopped/,
              );
            expect(live.size).toBe(0);
          } finally {
            module._malloc = alloc;
            module._free = free;
            for (const p of live) free(p);
          }
          expect(() => run(false)).not.toThrow();
        }
      } finally {
        kit.freeWindow(r);
        kit.freeWindow(c);
      }
    },
  );
}

it("releases nested GF buffers when an ordinary search is rejected from a WASM callback", async () => {
  const module = await actualModule(),
    raw = createGeometryGfApi(module),
    kit = createCellsWindowsKitApi(module),
    cells = createCellsWindowsApi(module);
  const c = kit.newWindow(2),
    r = kit.newWindow(2);
  try {
    cells.wninsd(-3, 3, c);
    cells.wninsd(9, 10, r);
    let rejection: unknown;
    const square = (t: number) => t * t;
    raw.gfudb(
      square,
      (f, t) => {
        if (!rejection) {
          try {
            raw.gfdist("MOON", "NONE", "EARTH", "<", 1, 0, 0.25, 16, c, r);
          } catch (error) {
            rejection = error;
          }
        }
        return f(t) <= 1;
      },
      0.25,
      c,
      r,
    );
    expect(rejection).toBeInstanceOf(Error);
    expect(String(rejection)).toMatch(/Nested Geometry Finder/);
    expect(cells.wncard(r)).toBe(1);
    const [left, right] = cells.wnfetd(r, 0);
    expect(left).toBeCloseTo(-1, 5);
    expect(right).toBeCloseTo(1, 5);
  } finally {
    kit.freeWindow(r);
    kit.freeWindow(c);
  }
});
