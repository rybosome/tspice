import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import type {
  CellsWindowsApi,
  SpiceIntCell,
  SpiceCharCell,
  SpiceDoubleCell,
} from "@rybosome/tspice-backend-contract";
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
  return module;
}

type Cells = {
  c: SpiceCharCell;
  d: SpiceDoubleCell;
  a: SpiceIntCell;
  b: SpiceIntCell;
  r: SpiceIntCell;
};
type Call = (api: CellsWindowsApi, cells: Cells) => unknown;
const operations: readonly [string, number[], Call, unknown][] = [
  ["diff", [2048], (api, x) => api.diff(x.a, x.b, x.r), undefined],
  ["inter", [2048], (api, x) => api.inter(x.a, x.b, x.r), undefined],
  ["sdiff", [2048], (api, x) => api.sdiff(x.a, x.b, x.r), undefined],
  ["union", [2048], (api, x) => api.union(x.a, x.b, x.r), undefined],
  ["set", [2048, 2, 4], (api, x) => api.set(x.a, "&", x.b), true],
  ["removc", [2048, 3], (api, x) => api.removc("A\t", x.c), undefined],
  ["removd", [2048], (api, x) => api.removd(-Infinity, x.d), undefined],
  ["removi", [2048], (api, x) => api.removi(-2, x.a), undefined],
  ["ordc", [2048, 3, 4], (api, x) => api.ordc("A\t", x.c), 0],
  ["ordd", [2048, 4], (api, x) => api.ordd(-Infinity, x.d), 0],
  ["ordi", [2048, 4], (api, x) => api.ordi(-2, x.a), 0],
];
for (const [name, sizes, invoke, value] of operations) {
  for (let failAt = 0; failAt <= sizes.length; ++failAt) {
    it(`${name} balances all allocations on ${failAt ? "rejected allocation " + failAt : "success"}`, async () => {
      const m = await actualModule(),
        api = createCellsWindowsApi(m),
        kit = createCellsWindowsKitApi(m);
      const c = kit.newCharCell(4, 8),
        d = kit.newDoubleCell(4);
      const a = kit.newIntCell(4),
        b = kit.newIntCell(4),
        r = kit.newIntCell(4);
      const cells = { c, d, a, b, r };
      try {
        api.appndc("A\t", c);
        api.appndd(-Infinity, d);
        api.appndi(-2, a);
        api.appndi(4, a);
        api.appndi(4, b);
        api.appndi(9, b);
        api.appndi(21, r);
        const malloc = m._malloc,
          free = m._free,
          live = new Set<number>(),
          requests: number[] = [];
        m._malloc = (n) => {
          requests.push(n);
          if (requests.length === failAt) return 0;
          const ptr = malloc(n);
          if (ptr) live.add(ptr);
          return ptr;
        };
        m._free = (ptr) => {
          expect(live.delete(ptr)).toBe(true);
          free(ptr);
        };
        try {
          if (failAt) expect(() => invoke(api, cells)).toThrow(/malloc failed/);
          else expect(invoke(api, cells)).toBe(value);
          expect(requests).toEqual(failAt ? sizes.slice(0, failAt) : sizes);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          for (const ptr of live) free(ptr);
        }
        if (failAt) {
          expect([
            api.card(c),
            api.card(d),
            api.card(a),
            kit.cellGeti(r, 0),
          ]).toEqual([1, 1, 2, 21]);
          expect(invoke(api, cells)).toBe(value);
        }
        const result: Record<string, number[]> = {
          diff: [-2],
          inter: [4],
          sdiff: [-2, 9],
          union: [-2, 4, 9],
        };
        expect(
          Array.from({ length: api.card(r) }, (_, i) => kit.cellGeti(r, i)),
        ).toEqual(result[name] ?? [21]);
        expect([api.card(c), api.card(d), api.card(a)]).toEqual([
          name === "removc" ? 0 : 1,
          name === "removd" ? 0 : 1,
          name === "removi" ? 1 : 2,
        ]);
      } finally {
        for (const cell of Object.values(cells)) kit.freeCell(cell);
      }
    });
  }
}

it("releases structured error buffers, recovers from SETEXCESS and rejects window, stale and foreign tokens", async () => {
  const m = await actualModule(),
    other = await actualModule(),
    api = createCellsWindowsApi(m),
    kit = createCellsWindowsKitApi(m),
    kit2 = createCellsWindowsKitApi(other);
  const a = kit.newIntCell(4),
    b = kit.newIntCell(4),
    r = kit.newIntCell(1),
    stale = kit.newIntCell(1),
    foreign = kit2.newIntCell(1),
    win = kit.newWindow(1);
  kit.freeCell(stale);
  try {
    api.appndi(1, a);
    api.appndi(2, b);
    for (const token of [win, stale, foreign])
      expect(() => Reflect.apply(api.union, undefined, [a, b, token])).toThrow(
        /handle/,
      );
    for (const op of ["diff", "inter", "sdiff", "union"] as const)
      for (const result of [a, b])
        expect(() => api[op](a, b, result)).toThrow(/distinct/);
    const malloc = m._malloc,
      free = m._free,
      live = new Set<number>();
    let n = 0;
    m._malloc = (bytes) => {
      const ptr = malloc(bytes);
      if (ptr) {
        live.add(ptr);
        ++n;
      }
      return ptr;
    };
    m._free = (ptr) => {
      expect(live.delete(ptr)).toBe(true);
      free(ptr);
    };
    try {
      expect(() => api.union(a, b, r)).toThrow(/SETEXCESS/);
      expect(n).toBe(4);
      expect(live.size).toBe(0);
    } finally {
      m._malloc = malloc;
      m._free = free;
      for (const p of live) free(p);
    }
    api.scard(0, r);
    api.diff(a, b, r);
    expect(api.ordi(1, r)).toBe(0);
  } finally {
    kit.freeWindow(win);
    kit2.freeCell(foreign);
    for (const h of [a, b, r]) kit.freeCell(h);
  }
});
