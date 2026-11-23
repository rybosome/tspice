import type { EkApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createEkApi } from "../src/domains/ek.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
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
  return module;
}
type EntryCall = (api: EkApi, h: SpiceHandle) => unknown;
const operations: {
  name: string;
  decl: string;
  sizes: number[];
  seed: EntryCall;
  run: EntryCall;
  verify: EntryCall;
}[] = [
  {
    name: "ekacec",
    decl: "DATATYPE=CHARACTER*(3),SIZE=VARIABLE",
    sizes: [2048, 2, 6],
    seed: (api, h) => void [api, h],
    run: (api, h) => api.ekacec(h, 0, 0, "V", ["ab", "Z"], false),
    verify: (api, h) =>
      expect(api.ekrcec(h, 0, 0, "V", 4)).toEqual({
        nvals: 2,
        isNull: false,
        values: ["ab ", "Z  "],
      }),
  },
  {
    name: "ekaced",
    decl: "DATATYPE=DOUBLE PRECISION,SIZE=VARIABLE",
    sizes: [2048, 2, 16],
    seed: (api, h) => void [api, h],
    run: (api, h) => api.ekaced(h, 0, 0, "V", [1.5, -2.75], false),
    verify: (api, h) =>
      expect(api.ekrced(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [1.5, -2.75],
      }),
  },
  {
    name: "ekacei",
    decl: "DATATYPE=INTEGER,SIZE=VARIABLE",
    sizes: [2048, 2, 8],
    seed: (api, h) => void [api, h],
    run: (api, h) => api.ekacei(h, 0, 0, "V", [18, -22], false),
    verify: (api, h) =>
      expect(api.ekrcei(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [18, -22],
      }),
  },
  {
    name: "ekrcec",
    decl: "DATATYPE=CHARACTER*(3),SIZE=VARIABLE",
    sizes: [2048, 2, 4, 4, 8],
    seed: (api, h) => api.ekacec(h, 0, 0, "V", ["ab", "Z"], false),
    run: (api, h) => api.ekrcec(h, 0, 0, "V", 4),
    verify: (api, h) =>
      expect(api.ekrcec(h, 0, 0, "V", 4)).toEqual({
        nvals: 2,
        isNull: false,
        values: ["ab ", "Z  "],
      }),
  },
  {
    name: "ekrced",
    decl: "DATATYPE=DOUBLE PRECISION,SIZE=VARIABLE",
    sizes: [2048, 2, 4, 4, 16],
    seed: (api, h) => api.ekaced(h, 0, 0, "V", [1.5, -2.75], false),
    run: (api, h) => api.ekrced(h, 0, 0, "V"),
    verify: (api, h) =>
      expect(api.ekrced(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [1.5, -2.75],
      }),
  },
  {
    name: "ekrcei",
    decl: "DATATYPE=INTEGER,SIZE=VARIABLE",
    sizes: [2048, 2, 4, 4, 8],
    seed: (api, h) => api.ekacei(h, 0, 0, "V", [18, -22], false),
    run: (api, h) => api.ekrcei(h, 0, 0, "V"),
    verify: (api, h) =>
      expect(api.ekrcei(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [18, -22],
      }),
  },
  {
    name: "ekucec",
    decl: "DATATYPE=CHARACTER*(3),SIZE=VARIABLE",
    sizes: [2048, 2, 6],
    seed: (api, h) => api.ekacec(h, 0, 0, "V", ["ab", "Z"], false),
    run: (api, h) => api.ekucec(h, 0, 0, "V", ["ab", "Z"], false),
    verify: (api, h) =>
      expect(api.ekrcec(h, 0, 0, "V", 4)).toEqual({
        nvals: 2,
        isNull: false,
        values: ["ab ", "Z  "],
      }),
  },
  {
    name: "ekuced",
    decl: "DATATYPE=DOUBLE PRECISION,SIZE=VARIABLE",
    sizes: [2048, 2, 16],
    seed: (api, h) => api.ekaced(h, 0, 0, "V", [1.5, -2.75], false),
    run: (api, h) => api.ekuced(h, 0, 0, "V", [1.5, -2.75], false),
    verify: (api, h) =>
      expect(api.ekrced(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [1.5, -2.75],
      }),
  },
  {
    name: "ekucei",
    decl: "DATATYPE=INTEGER,SIZE=VARIABLE",
    sizes: [2048, 2, 8],
    seed: (api, h) => api.ekacei(h, 0, 0, "V", [18, -22], false),
    run: (api, h) => api.ekucei(h, 0, 0, "V", [18, -22], false),
    verify: (api, h) =>
      expect(api.ekrcei(h, 0, 0, "V")).toEqual({
        nvals: 2,
        isNull: false,
        values: [18, -22],
      }),
  },
];
for (const op of operations)
  for (let fail = 0; fail <= op.sizes.length; fail++) {
    it(op.name + " releases every acquired allocation at " + fail, async () => {
      const m = await actualModule(),
        owner = createSpiceHandleRegistry(),
        raw = createEkApi(m, owner);
      const h = raw.ekops();
      try {
        raw.ekbseg(h, "INITIAL", ["V"], [op.decl]);
        raw.ekappr(h, 0);
        op.seed(raw, h);
        const alloc = m._malloc,
          free = m._free,
          live = new Set<number>(),
          sizes: number[] = [];
        m._malloc = (n) => {
          sizes.push(n);
          if (fail === sizes.length) return 0;
          const ptr = alloc(n);
          if (ptr) live.add(ptr);
          return ptr;
        };
        m._free = (ptr) => {
          expect(live.delete(ptr)).toBe(true);
          free(ptr);
        };

        try {
          if (fail) expect(() => op.run(raw, h)).toThrow(/malloc failed/);
          else op.run(raw, h);
          expect(sizes).toEqual(fail ? op.sizes.slice(0, fail) : op.sizes);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = alloc;
          m._free = free;
          for (const p of live) free(p);
        }
        if (fail) op.run(raw, h);
        op.verify(raw, h);
      } finally {
        raw.ekcls(h);
      }
      expect(owner.size()).toBe(0);
    });
  }
