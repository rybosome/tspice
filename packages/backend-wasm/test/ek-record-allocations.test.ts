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
const operations: {
  name: string;
  sizes: number[];
  run: (api: EkApi, h: SpiceHandle) => unknown;
}[] = [
  { name: "ekops", sizes: [2048, 4], run: (api) => api.ekops() },
  {
    name: "ekbseg",
    sizes: [2048, 4, 2, 17, 4],
    run: (a, h) => a.ekbseg(h, "NEW", ["I"], ["DATATYPE=INTEGER"]),
  },
  { name: "ekappr", sizes: [2048, 4], run: (a, h) => a.ekappr(h, 0) },
  { name: "ekinsr", sizes: [2048], run: (a, h) => a.ekinsr(h, 0, 0) },
  { name: "ekdelr", sizes: [2048], run: (a, h) => a.ekdelr(h, 0, 0) },
];
for (const op of operations)
  for (let fail = 0; fail <= op.sizes.length; fail++) {
    it(op.name + " releases every acquired allocation at " + fail, async () => {
      const m = await actualModule(),
        owner = createSpiceHandleRegistry(),
        raw = createEkApi(m, owner);
      const h = raw.ekops();
      try {
        raw.ekbseg(h, "INITIAL", ["I"], ["DATATYPE=INTEGER"]);
        raw.ekappr(h, 0);
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
        let result: unknown;
        try {
          if (fail) expect(() => op.run(raw, h)).toThrow(/malloc failed/);
          else result = op.run(raw, h);
          expect(sizes).toEqual(fail ? op.sizes.slice(0, fail) : op.sizes);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = alloc;
          m._free = free;
          for (const p of live) free(p);
        }
        if (fail) result = op.run(raw, h);
        if (op.name === "ekops") raw.ekcls(result as SpiceHandle);
        if (op.name === "ekbseg") expect(result).toBe(1);
        if (op.name === "ekappr") expect(result).toBe(1);
        const count = raw.ekappr(h, 0);
        for (let index = count; index >= 0; index--) raw.ekdelr(h, 0, index);
      } finally {
        raw.ekcls(h);
      }
      expect(owner.size()).toBe(0);
    });
  }
it("closes a scratch handle that could not be published to its caller", async () => {
  const m = await actualModule(),
    owner = createSpiceHandleRegistry(),
    raw = createEkApi(m, owner);
  const open = owner.register,
    close = m._tspice_ekcls,
    calls: number[] = [];
  owner.register = () => {
    throw new Error("test registry publication");
  };
  m._tspice_ekcls = (h, e, n) => {
    calls.push(h);
    return close(h, e, n);
  };
  try {
    expect(() => raw.ekops()).toThrow(/publication/);
    expect(calls).toHaveLength(1);
  } finally {
    owner.register = open;
    m._tspice_ekcls = close;
  }
  const h = raw.ekops();
  expect(raw.eknseg(h)).toBe(0);
  raw.ekcls(h);
});
