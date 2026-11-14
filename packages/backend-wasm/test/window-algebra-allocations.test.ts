import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type {
  CellsWindowsApi,
  SpiceWindow,
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

type Windows = { a: SpiceWindow; b: SpiceWindow; r: SpiceWindow };
type Output = ReturnType<CellsWindowsApi["wnsumd"]> | boolean | void;
const calls: {
  name: string;
  sizes: number[];
  invoke: (api: CellsWindowsApi, w: Windows) => Output;
  output?: "a" | "r";
  expected: Output | number[][];
}[] = [
  {
    name: "wncomd",
    sizes: [2048],
    invoke: (api, w) => api.wncomd(-1, 8, w.a, w.r),
    output: "r",
    expected: [
      [-1, 0],
      [3, 5],
      [7, 8],
    ],
  },
  {
    name: "wncond",
    sizes: [2048],
    invoke: (api, w) => api.wncond(1, 0.5, w.a),
    output: "a",
    expected: [
      [1, 2.5],
      [6, 6.5],
    ],
  },
  {
    name: "wndifd",
    sizes: [2048],
    invoke: (api, w) => api.wndifd(w.a, w.b, w.r),
    output: "r",
    expected: [
      [0, 2],
      [6, 7],
    ],
  },
  {
    name: "wnelmd",
    sizes: [2048, 4],
    invoke: (api, w) => api.wnelmd(3, w.a),
    expected: true,
  },
  {
    name: "wnexpd",
    sizes: [2048],
    invoke: (api, w) => api.wnexpd(1, 2, w.a),
    output: "a",
    expected: [[-1, 9]],
  },
  {
    name: "wnextd",
    sizes: [2048],
    invoke: (api, w) => api.wnextd("r", w.a),
    output: "a",
    expected: [
      [3, 3],
      [7, 7],
    ],
  },
  {
    name: "wnfild",
    sizes: [2048],
    invoke: (api, w) => api.wnfild(2, w.a),
    output: "a",
    expected: [[0, 7]],
  },
  {
    name: "wnfltd",
    sizes: [2048],
    invoke: (api, w) => api.wnfltd(2, w.a),
    output: "a",
    expected: [[0, 3]],
  },
  {
    name: "wnincd",
    sizes: [2048, 4],
    invoke: (api, w) => api.wnincd(2, 6, w.a),
    expected: false,
  },
  {
    name: "wnintd",
    sizes: [2048],
    invoke: (api, w) => api.wnintd(w.a, w.b, w.r),
    output: "r",
    expected: [
      [2, 3],
      [5, 6],
    ],
  },
  {
    name: "wnreld",
    sizes: [2048, 4, 4],
    invoke: (api, w) => api.wnreld(w.a, "<> ", w.b),
    expected: true,
  },
  {
    name: "wnsumd",
    sizes: [2048, 8, 8, 8, 4, 4],
    invoke: (api, w) => api.wnsumd(w.a),
    expected: { meas: 5, avg: 2.5, stddev: 0.5, shortest: 2, longest: 0 },
  },
  {
    name: "wnunid",
    sizes: [2048],
    invoke: (api, w) => api.wnunid(w.a, w.b, w.r),
    output: "r",
    expected: [[0, 7]],
  },
];
function snapshot(api: CellsWindowsApi, window: SpiceWindow) {
  return Array.from({ length: api.wncard(window) }, (_, i) =>
    api.wnfetd(window, i),
  );
}
const first = [
  [0, 3],
  [5, 7],
] as const;
async function withWindows(
  run: (
    m: Awaited<ReturnType<typeof actualModule>>,
    api: CellsWindowsApi,
    w: Windows,
  ) => Promise<void> | void,
) {
  const m = await actualModule(),
    api = createCellsWindowsApi(m),
    kit = createCellsWindowsKitApi(m),
    handles: SpiceWindow[] = [];
  function create() {
    const w = kit.newWindow(8);
    handles.push(w);
    return w;
  }
  try {
    const w = { a: create(), b: create(), r: create() };
    for (const [left, right] of first) api.wninsd(left, right, w.a);
    api.wninsd(2, 6, w.b);
    api.wninsd(101, 103, w.r);
    await run(m, api, w);
  } finally {
    for (const w of handles.reverse()) kit.freeWindow(w);
  }
}
describe("actual WASM allocations and caller-owned window storage", () => {
  for (const call of calls)
    for (let failAt = 0; failAt <= call.sizes.length; failAt++) {
      it(`${call.name} ${failAt ? "fails acquisition " + failAt : "success"} releases every temporary`, async () => {
        await withWindows((m, api, w) => {
          const malloc = m._malloc,
            free = m._free,
            acquired = new Set<number>(),
            sizes: number[] = [];
          m._malloc = (bytes) => {
            sizes.push(bytes);
            if (failAt === sizes.length) return 0;
            const p = malloc(bytes);
            if (p) acquired.add(p);
            return p;
          };
          m._free = (p) => {
            expect(acquired.delete(p)).toBe(true);
            free(p);
          };
          let result: Output = undefined;
          try {
            if (failAt)
              expect(() => call.invoke(api, w)).toThrow(/WASM malloc failed/);
            else result = call.invoke(api, w);
            expect(sizes).toEqual(
              failAt ? call.sizes.slice(0, failAt) : call.sizes,
            );
            expect(acquired.size).toBe(0);
          } finally {
            m._malloc = malloc;
            m._free = free;
            for (const p of acquired) free(p);
          }
          if (failAt) {
            expect(snapshot(api, w.a)).toEqual(first);
            expect(snapshot(api, w.r)).toEqual([[101, 103]]);
            result = call.invoke(api, w);
          }
          expect(call.output ? snapshot(api, w[call.output]) : result).toEqual(
            call.expected,
          );
          expect(snapshot(api, w.b)).toEqual([[2, 6]]);
        });
      });
    }
});
it("releases the summary temporaries and structured error diagnostic buffers on the genuine odd-cardinality check", async () => {
  await withWindows((m, api, w) => {
    api.scard(3, w.a);
    const malloc = m._malloc,
      free = m._free,
      acquired = new Set<number>();
    let n = 0;
    m._malloc = (bytes) => {
      n++;
      const p = malloc(bytes);
      if (p) acquired.add(p);
      return p;
    };
    m._free = (p) => {
      expect(acquired.delete(p)).toBe(true);
      free(p);
    };
    try {
      expect(() => api.wnsumd(w.a)).toThrow(/INVALIDCARDINALITY/);
      // One error buffer, five result fields, then short/long/trace diagnostics.
      expect(n).toBe(9);
      expect(acquired.size).toBe(0);
    } finally {
      m._malloc = malloc;
      m._free = free;
      for (const p of acquired) free(p);
    }
    api.scard(0, w.a);
    api.wninsd(-3, 4, w.a);
    expect(api.wnsumd(w.a)).toEqual({
      meas: 7,
      avg: 7,
      stddev: 0,
      shortest: 0,
      longest: 0,
    });
  });
});
it("rejects live handles from another module in every input and result position", async () => {
  await withWindows(async (_m, api, w) => {
    const other = await actualModule(),
      kit = createCellsWindowsKitApi(other),
      foreign = kit.newWindow(4);
    try {
      for (const invoke of [
        () => api.wnsumd(foreign),
        () => api.wncond(0, 0, foreign),
        () => api.wnelmd(0, foreign),
        () => api.wncomd(0, 10, foreign, w.r),
        () => api.wncomd(0, 10, w.a, foreign),
        () => api.wnreld(w.a, "=", foreign),
        ...(["wndifd", "wnintd", "wnunid"] as const).flatMap((n) => [
          () => api[n](foreign, w.b, w.r),
          () => api[n](w.a, foreign, w.r),
          () => api[n](w.a, w.b, foreign),
        ]),
      ])
        expect(invoke).toThrow(/unknown|expired|owner|module/i);
      expect(snapshot(api, w.a)).toEqual(first);
      expect(snapshot(api, w.r)).toEqual([[101, 103]]);
    } finally {
      kit.freeWindow(foreign);
    }
  });
});
