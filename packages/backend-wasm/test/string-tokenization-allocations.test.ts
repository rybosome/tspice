import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { StringsApi } from "@rybosome/tspice-backend-contract";
import {
  createCellsWindowsApi,
  createCellsWindowsKitApi,
} from "../src/domains/cells-windows.js";
import { createErrorApi } from "../src/domains/error.js";
import { createStringsApi } from "../src/domains/strings.js";
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
  // Emscripten replaces lazy aliases on first use. Capture only the resolved functions.
  module._free(module._malloc(8));
  return module;
}

const calls: {
  name: string;
  sizes: number[];
  expected: unknown;
  run: (api: StringsApi) => unknown;
}[] = [
  {
    name: "nextwd",
    sizes: [2048, 9, 3, 6],
    expected: { next: "é", rest: "beta" },
    run: (a) => a.nextwd(" é beta", 3, 6),
  },
  {
    name: "nthwd",
    sizes: [2048, 8, 4, 4],
    expected: { word: "bet", loc: 3 },
    run: (a) => a.nthwd("é beta", 1, 4),
  },
  {
    name: "lparse",
    sizes: [2048, 6, 2, 4, 12],
    expected: { n: 3, items: ["a", "", "bc"] },
    run: (a) => a.lparse("a,,bc", ",", 3, 4),
  },
  {
    name: "lparsm",
    sizes: [2048, 6, 3, 4, 12],
    expected: { n: 3, items: ["a", "b", "c"] },
    run: (a) => a.lparsm("a;b c", "; ", 4, 3),
  },
  {
    name: "lx4dec",
    sizes: [2048, 7, 8, 4],
    expected: { last: 4, nchar: 5 },
    run: (a) => a.lx4dec("-3.25!", 0),
  },
  {
    name: "lx4num",
    sizes: [2048, 8, 8, 4],
    expected: { last: 5, nchar: 6 },
    run: (a) => a.lx4num("1.2D-3!", 0),
  },
  {
    name: "lx4sgn",
    sizes: [2048, 6, 8, 4],
    expected: { last: 3, nchar: 3 },
    run: (a) => a.lx4sgn("x-37!", 1),
  },
  {
    name: "lx4uns",
    sizes: [2048, 5, 8, 4],
    expected: { last: 2, nchar: 2 },
    run: (a) => a.lx4uns("x42!", 1),
  },
  {
    name: "lxqstr",
    sizes: [2048, 8, 8, 4],
    expected: { last: 5, nchar: 6 },
    run: (a) => a.lxqstr("'a''b'!", "'", 0),
  },
];

describe("tokenization on the compiled WASM heap", () => {
  for (const spec of calls) {
    for (let failAt = 0; failAt <= spec.sizes.length; failAt++) {
      it(spec.name + " at allocation " + failAt, async () => {
        const module = await actualModule(),
          api = createStringsApi(module);
        const malloc = module._malloc,
          free = module._free;
        const warm = malloc(8);
        free(warm);
        const live = new Set<number>(),
          sizes: number[] = [];
        module._malloc = (size: number) => {
          sizes.push(size);
          if (sizes.length === failAt) return 0;
          const ptr = malloc(size);
          if (ptr) live.add(ptr);
          return ptr;
        };
        module._free = (ptr: number) => {
          expect(live.delete(ptr)).toBe(true);
          free(ptr);
        };
        try {
          if (failAt) expect(() => spec.run(api)).toThrow(/WASM malloc failed/);
          else expect(spec.run(api)).toEqual(spec.expected);
          expect(sizes).toEqual(
            spec.sizes.slice(0, failAt || spec.sizes.length),
          );
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const ptr of live) free(ptr);
        }
        expect(spec.run(api)).toEqual(spec.expected);
      });
    }
  }
  it("releases temporary and diagnostic buffers before recovery from CSPICE or decoding errors", async () => {
    const module = await actualModule(),
      api = createStringsApi(module),
      error = createErrorApi(module);
    const malloc = module._malloc,
      free = module._free;
    const warm = malloc(8);
    free(warm);
    const live = new Set<number>();
    let count = 0;
    module._malloc = (bytes: number) => {
      count++;
      const ptr = malloc(bytes);
      if (ptr) live.add(ptr);
      return ptr;
    };
    module._free = (ptr: number) => {
      expect(live.delete(ptr)).toBe(true);
      free(ptr);
    };
    try {
      for (const [call, err, num] of [
        [() => api.nextwd("", 1, 2), /STRINGTOOSHORT/, 7],
        [() => api.nextwd("a", 2, 0), /STRINGTOOSHORT/, 7],
        [() => api.nthwd("", 1, 1), /STRINGTOOSHORT/, 7],
        [() => api.lparse("a", "", 1, 2), /EMPTYSTRING/, 8],
        [() => api.lparsm("", "", 1, 1), /STRINGTOOSHORT/, 8],
        [() => api.nextwd("é x", 2, 4), /UTF-8/, 4],
        [() => api.nextwd("x é", 3, 2), /UTF-8/, 4],
        [() => api.nthwd("é", 0, 2), /UTF-8/, 4],
        [() => api.lparse("é", ",", 2, 2), /UTF-8/, 5],
        [() => api.lparsm("é", ";", 2, 2), /UTF-8/, 5],
      ] as const) {
        count = 0;
        expect(call).toThrow(err);
        expect(count).toBe(num);
        expect(live.size).toBe(0);
        expect(error.failed()).toBe(false);
      }
    } finally {
      module._malloc = malloc;
      module._free = free;
      for (const ptr of live) free(ptr);
    }
    expect(api.nextwd("a b")).toEqual({ next: "a", rest: "b" });
  });
  it("rejects oversized rectangular tables before allocating, owns returned rows, handles empty lists and bounds", async () => {
    const module = await actualModule(),
      api = createStringsApi(module);
    const malloc = module._malloc;
    let allocations = 0;
    module._malloc = (size: number) => {
      allocations++;
      return malloc(size);
    };
    try {
      expect(() => api.lparse("a".repeat(17000), ",", 2147483647)).toThrow(
        /256 MiB/,
      );
      expect(() => api.lparsm("a".repeat(17000), ",", 2147483647)).toThrow(
        /256 MiB/,
      );
      expect(allocations).toBe(0);
    } finally {
      module._malloc = malloc;
    }
    const items = api.lparse("a,b", ",", 20);
    api.lparsm("different", ";", 100);
    expect(items).toEqual({ n: 2, items: ["a", "b"] });
    expect(api.lparse("", "", 0, -1)).toEqual({ n: 0, items: [] });
    expect(api.lparsm("", "", 2147483647, 2147483647)).toEqual({
      n: 1,
      items: [""],
    });
    for (const first of [-2147483648, 2147483646, 2147483647]) {
      for (const n of ["lx4dec", "lx4num", "lx4sgn", "lx4uns"] as const) {
        expect(api[n]("99", first)).toEqual({ last: first - 1, nchar: 0 });
        expect(api[n]("", first)).toEqual({
          last: n === "lx4uns" ? first - 1 : -1,
          nchar: 0,
        });
      }
      expect(api.lxqstr("", '"', first)).toEqual({ last: first - 1, nchar: 0 });
      expect(api.nthwd("x", first)).toEqual({ word: "", loc: -1 });
    }
  });
});

describe("LPARSS caller-owned cell on the compiled WASM heap", () => {
  for (const failedOrdinal of [1, 2, 3]) {
    it(`releases all temporary buffers when allocation ${failedOrdinal} fails`, async () => {
      const module = await actualModule(),
        raw = createCellsWindowsApi(module),
        kit = createCellsWindowsKitApi(module);
      const set = kit.newCharCell(2, 8);
      const malloc = module._malloc,
        free = module._free;
      const live = new Set<number>();
      let calls = 0;
      try {
        raw.insrtc("seed", set);
        module._malloc = (size: number) => {
          if (++calls === failedOrdinal) return 0;
          const pointer = malloc(size);
          if (pointer) live.add(pointer);
          return pointer;
        };
        module._free = (p: number) => {
          live.delete(p);
          free(p);
        };
        try {
          expect(() => raw.lparss("A,B", ",", set)).toThrow();
          expect(calls).toBe(failedOrdinal);
          expect(live.size).toBe(0);
        } finally {
          module._malloc = malloc;
          module._free = free;
        }
        expect(kit.cellGetc(set, 0)).toBe("seed");
        raw.lparss("B,A", ",", set);
        expect([kit.cellGetc(set, 0), kit.cellGetc(set, 1)]).toEqual([
          "A",
          "B",
        ]);
      } finally {
        kit.freeCell(set);
      }
    });
  }
});
