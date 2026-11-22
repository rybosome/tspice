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
  wasmWindowPointer,
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
  i: SpiceIntCell;
  d: SpiceDoubleCell;
  target: SpiceIntCell;
};
const cases: readonly {
  name: string;
  sizes: readonly number[];
  invoke: (api: CellsWindowsApi, cells: Cells) => void | boolean;
  result?: boolean;
  added?: "c" | "d" | "i";
}[] = [
  {
    name: "appndc",
    sizes: [2048, 3],
    invoke: (a, h) => a.appndc("é", h.c),
    added: "c",
  },
  {
    name: "appndd",
    sizes: [2048],
    invoke: (a, h) => a.appndd(Infinity, h.d),
    added: "d",
  },
  {
    name: "appndi",
    sizes: [2048],
    invoke: (a, h) => a.appndi(2147483647, h.i),
    added: "i",
  },
  {
    name: "elemc",
    sizes: [2048, 3, 4],
    invoke: (a, h) => a.elemc("A\t", h.c),
    result: true,
  },
  {
    name: "elemd",
    sizes: [2048, 4],
    invoke: (a, h) => a.elemd(-Infinity, h.d),
    result: true,
  },
  {
    name: "elemi",
    sizes: [2048, 4],
    invoke: (a, h) => a.elemi(-2147483648, h.i),
    result: true,
  },
  { name: "copy", sizes: [2048], invoke: (a, h) => a.copy(h.i, h.target) },
];

for (const spec of cases)
  for (let failAt = 0; failAt <= spec.sizes.length; failAt++) {
    it(`${spec.name} releases its temporaries on ${failAt ? "failed allocation " + failAt : "success"}`, async () => {
      const m = await actualModule(),
        api = createCellsWindowsApi(m),
        kit = createCellsWindowsKitApi(m);
      const cells = {
        c: kit.newCharCell(2, 8),
        d: kit.newDoubleCell(2),
        i: kit.newIntCell(2),
        target: kit.newIntCell(2),
      };
      try {
        api.appndc("A\t", cells.c);
        api.appndd(-Infinity, cells.d);
        api.appndi(-2147483648, cells.i);
        api.appndi(35, cells.target);
        const malloc = m._malloc,
          free = m._free,
          active = new Set<number>(),
          requests: number[] = [];
        m._malloc = (bytes) => {
          requests.push(bytes);
          if (requests.length === failAt) return 0;
          const p = malloc(bytes);
          if (p) active.add(p);
          return p;
        };
        m._free = (p) => {
          expect(active.delete(p)).toBe(true);
          free(p);
        };
        try {
          if (failAt)
            expect(() => spec.invoke(api, cells)).toThrow(/malloc failed/);
          else expect(spec.invoke(api, cells)).toBe(spec.result);
          expect(requests).toEqual(
            failAt ? spec.sizes.slice(0, failAt) : spec.sizes,
          );
          expect(active.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          for (const p of active) free(p);
        }
        for (const k of ["c", "d", "i"] as const)
          expect(api.card(cells[k])).toBe(!failAt && spec.added === k ? 2 : 1);
        expect(kit.cellGeti(cells.target, 0)).toBe(
          !failAt && spec.name === "copy" ? -2147483648 : 35,
        );
        if (failAt) expect(spec.invoke(api, cells)).toBe(spec.result);
        if (spec.added === "c") expect(kit.cellGetc(cells.c, 1)).toBe("é");
        if (spec.added === "d") expect(kit.cellGetd(cells.d, 1)).toBe(Infinity);
        if (spec.added === "i")
          expect(kit.cellGeti(cells.i, 1)).toBe(2147483647);
      } finally {
        for (const handle of Object.values(cells)) kit.freeCell(handle);
      }
    });
  }

it("rejects malformed items, foreign, expired and window tokens without touching either live cell", async () => {
  const m = await actualModule(),
    other = await actualModule(),
    api = createCellsWindowsApi(m);
  const kit = createCellsWindowsKitApi(m),
    otherKit = createCellsWindowsKitApi(other);
  const c = kit.newCharCell(2, 3),
    d = kit.newDoubleCell(2),
    i = kit.newIntCell(2),
    foreign = otherKit.newIntCell(2);
  const w = kit.newWindow(1),
    expired = kit.newIntCell(2);
  kit.freeCell(expired);
  try {
    for (const method of [
      "appndi",
      "elemi",
      "appndd",
      "elemd",
      "appndc",
      "elemc",
      "copy",
    ] as const) {
      for (const bad of [expired, foreign, w, Number(i) + 2 ** 32])
        expect(() =>
          Reflect.apply(api[method], undefined, [
            method === "copy" ? i : method.endsWith("c") ? "" : 0,
            bad,
          ]),
        ).toThrow(/handle/);
    }
    expect(() => api.appndc("xé", c)).toThrow(/splits a UTF-8/);
    for (const name of ["appndc", "elemc"] as const)
      for (const bad of ["\0", "\ud800", "\udfff", 4])
        expect(() => Reflect.apply(api[name], undefined, [bad, c])).toThrow();
    for (const name of ["appndi", "elemi"] as const)
      for (const bad of [2147483648, -2147483649, 0.1, "0"])
        expect(() => Reflect.apply(api[name], undefined, [bad, i])).toThrow();
    for (const name of ["appndd", "elemd"] as const)
      for (const bad of [NaN, "0", null])
        expect(() => Reflect.apply(api[name], undefined, [bad, d])).toThrow();
    expect(() => Reflect.apply(api.copy, undefined, [i, d])).toThrow(
      /TYPEMISMATCH/,
    );
    expect([api.card(c), api.card(i), api.card(d)]).toEqual([0, 0, 0]);

    // The low-level export receives a genuine window pointer, exercising the shared
    // registry-kind check independently of the WASM token guard.
    const err = m._malloc(2048);
    expect(err).not.toBe(0);
    try {
      expect(
        m._tspice_appndd(1, wasmWindowPointer(m, w, "test"), err, 2048),
      ).not.toBe(0);
      expect(m.UTF8ToString(err, 2048)).toMatch(/ordinary cell/);
      expect(api.wncard(w)).toBe(0);
    } finally {
      m._free(err);
    }
  } finally {
    kit.freeCell(c);
    kit.freeCell(d);
    kit.freeCell(i);
    kit.freeWindow(w);
    otherKit.freeCell(foreign);
  }
});

it("releases every adapter and structured diagnostic allocation after a genuine toolkit error and recovers", async () => {
  const m = await actualModule(),
    api = createCellsWindowsApi(m),
    kit = createCellsWindowsKitApi(m);
  const c = kit.newCharCell(1, 6);
  try {
    api.appndc("A", c);
    const malloc = m._malloc,
      free = m._free,
      active = new Set<number>();
    m._malloc = (bytes) => {
      const p = malloc(bytes);
      if (p) active.add(p);
      return p;
    };
    m._free = (p) => {
      expect(active.delete(p)).toBe(true);
      free(p);
    };
    try {
      expect(() => api.appndc("B", c)).toThrow(/CELLTOOSMALL/);
      expect(active.size).toBe(0);
    } finally {
      m._malloc = malloc;
      m._free = free;
      for (const p of active) free(p);
    }
    expect(api.elemc("A", c)).toBe(true);
    expect(api.card(c)).toBe(1);
  } finally {
    kit.freeCell(c);
  }
});
