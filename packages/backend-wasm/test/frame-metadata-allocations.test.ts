import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import type {
  FramesApi,
  SpiceIntCell,
} from "@rybosome/tspice-backend-contract";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createFramesApi } from "../src/domains/frames.js";
import { createCellsWindowsKitApi } from "../src/domains/cells-windows.js";
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
const specs: {
  name: string;
  bytes: number[];
  invoke: (api: FramesApi, cell: SpiceIntCell) => unknown;
  error?: RegExp;
}[] = [
  { name: "bltfrm", bytes: [2048], invoke: (a, c) => a.bltfrm(1, c) },
  {
    name: "pxfrm2",
    bytes: [2048, 6, 6, 72],
    invoke: (a) => a.pxfrm2("J2000", "J2000", -1, 2),
  },
  {
    name: "tipbod",
    bytes: [2048, 6, 72, 2048, 2048, 2048],
    invoke: (a) => a.tipbod("J2000", 399, 1),
    error: /FRAMEDATANOTFOUND/,
  },
  {
    name: "tisbod",
    bytes: [2048, 6, 288, 2048, 2048, 2048],
    invoke: (a) => a.tisbod("J2000", 399, 1),
    error: /FRAMEDATANOTFOUND/,
  },
  {
    name: "tkfram",
    bytes: [2048, 72, 4, 4, 2048, 2048, 2048],
    invoke: (a) => a.tkfram(0),
    error: /ZEROFRAMEID/,
  },
  {
    name: "xfmsta",
    bytes: [2048, 12, 12, 2, 48, 48],
    invoke: (a) =>
      a.xfmsta([1, 2, 3, 4, 5, 6], "RECTANGULAR", "RECTANGULAR", " "),
  },
];
for (const spec of specs)
  for (let failure = 0; failure <= spec.bytes.length; failure++) {
    it(
      spec.name + " frees every acquired allocation at position " + failure,
      async () => {
        const m = await actualModule(),
          api = createFramesApi(m),
          cells = createCellsWindowsKitApi(m),
          cell = cells.newIntCell(145);
        const malloc = m._malloc,
          free = m._free,
          live = new Set<number>(),
          sizes: number[] = [];
        m._malloc = (n) => {
          sizes.push(n);
          if (failure === sizes.length) return 0;
          const p = malloc(n);
          if (p) live.add(p);
          return p;
        };
        m._free = (p) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        try {
          if (failure)
            expect(() => spec.invoke(api, cell)).toThrow(/malloc failed/);
          else if (spec.error)
            expect(() => spec.invoke(api, cell)).toThrow(spec.error);
          else spec.invoke(api, cell);
          expect(sizes).toEqual(
            failure ? spec.bytes.slice(0, failure) : spec.bytes,
          );
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          for (const p of live) free(p);
          cells.freeCell(cell);
        }
        expect(api.pxfrm2("J2000", "J2000", 0, 1)).toEqual([
          1, 0, 0, 0, 1, 0, 0, 0, 1,
        ]);
      },
    );
  }
it("rejects foreign, freed and wrong-kind output handles", async () => {
  const first = await actualModule(),
    second = await actualModule(),
    a = createFramesApi(first),
    b = createFramesApi(second),
    c = createCellsWindowsKitApi(first);
  const ids = c.newIntCell(145),
    wrong = c.newDoubleCell(145);
  try {
    expect(() => b.bltfrm(1, ids)).toThrow(/unknown|expired/i);
    expect(() => Reflect.apply(a.bltfrm, undefined, [1, wrong])).toThrow(
      /dtype/,
    );
    a.bltfrm(1, ids);
  } finally {
    c.freeCell(ids);
    c.freeCell(wrong);
  }
  expect(() => a.bltfrm(1, ids)).toThrow(/unknown|expired/i);
});
