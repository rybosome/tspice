import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
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

const calls: {
  name: string;
  count: number;
  expected: number;
  invoke(api: CoordsVectorsApi): number;
}[] = [
  {
    name: "bschoc",
    count: 5,
    expected: 3,
    invoke: (api) =>
      api.bschoc("B", ["Z", "B ", "B", "B  ", "A"], [4, 1, 3, 2, 0]),
  },
  {
    name: "bschoi",
    count: 4,
    expected: 3,
    invoke: (api) => api.bschoi(2, [9, 2, 2, 2, -3], [4, 1, 3, 2, 0]),
  },
  {
    name: "bsrchc",
    count: 4,
    expected: 2,
    invoke: (api) => api.bsrchc("B", ["A", "B ", "B", "B  ", "Z"]),
  },
  {
    name: "bsrchd",
    count: 3,
    expected: 2,
    invoke: (api) => api.bsrchd(0, [-Infinity, -0, 0, 0, Infinity]),
  },
  {
    name: "bsrchi",
    count: 3,
    expected: 2,
    invoke: (api) => api.bsrchi(2, [-3, 2, 2, 2, 9]),
  },
  {
    name: "isrchc",
    count: 4,
    expected: 1,
    invoke: (api) => api.isrchc("B", ["Z", "B ", "B", "B  ", "A"]),
  },
  {
    name: "isrchd",
    count: 3,
    expected: 1,
    invoke: (api) => api.isrchd(0, [NaN, -0, 0, Infinity]),
  },
  {
    name: "isrchi",
    count: 3,
    expected: 1,
    invoke: (api) => api.isrchi(2, [9, 2, 2, 2, -3]),
  },
];
describe("array searches on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createCoordsVectorsApi(module);
        const expected = call.expected;
        expect(call.invoke(api)).toBe(expected);
        // Prime Emscripten's lazy malloc/free aliases before instrumentation.
        const warm = module._malloc(8);
        module._free(warm);
        const malloc = module._malloc;
        const free = module._free;
        let allocations = 0;
        const live = new Set<number>();
        module._malloc = (bytes: number) => {
          if (++allocations === failAt) return 0;
          const pointer = malloc(bytes);
          if (pointer) live.add(pointer);
          return pointer;
        };
        module._free = (pointer: number) => {
          expect(live.delete(pointer)).toBe(true);
          free(pointer);
        };
        let leaked = 0;
        try {
          if (failAt)
            expect(() => call.invoke(api)).toThrow(/WASM malloc failed/);
          else expect(call.invoke(api)).toEqual(expected);
          leaked = live.size;
          expect(allocations).toBe(failAt || call.count);
        } finally {
          module._malloc = malloc;
          module._free = free;
          for (const pointer of live) free(pointer);
        }
        expect(leaked).toBe(0);
        // Recovery executes this same genuine raw sorted search on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("uses non-null empty inputs and UTF-8 byte widths for the key, table and order", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(8);
  m._free(warm);
  const malloc = m._malloc,
    sizes: number[] = [];
  m._malloc = (size) => {
    sizes.push(size);
    return malloc(size);
  };
  try {
    expect(api.bschoc("😀", ["😀", "é"], [1, 0])).toBe(0);
    expect(sizes).toEqual([2048, 5, 10, 8, 4]);
    for (const call of calls) {
      const indirect = call.name.startsWith("bscho"),
        ch = call.name.endsWith("c"),
        dbl = call.name.endsWith("d");
      sizes.length = 0;
      const fn = Reflect.get(api, call.name);
      expect(
        Reflect.apply(fn, api, [ch ? "" : 0, [], ...(indirect ? [[]] : [])]),
      ).toBe(-1);
      expect(sizes).toEqual([
        2048,
        ...(ch ? [1, 1] : [dbl ? 8 : 4]),
        ...(indirect ? [4] : []),
        4,
      ]);
    }
  } finally {
    m._malloc = malloc;
  }
});

it("rejects bad permutations and over-budget buffers before acquiring WASM memory", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(8);
  m._free(warm);
  const malloc = m._malloc;
  let attempts = 0;
  m._malloc = () => {
    attempts++;
    throw new Error("Unexpected WASM allocation");
  };
  const large = (length: number) =>
    new Proxy([], {
      get(_, key) {
        if (key === "length") return length;
        throw new Error("Unexpected item traversal");
      },
    });
  try {
    for (const name of ["bschoc", "bschoi"] as const) {
      const ch = name === "bschoc",
        key = ch ? "B" : 2,
        values = ch ? ["B", "A"] : [2, 1];
      for (const invalid of [
        [0],
        [1, 1],
        [2, 0],
        [-1, 0],
        [0, NaN],
        [0, 0.5],
        Array(2),
      ]) {
        expect(() =>
          Reflect.apply(api[name], api, [key, values, invalid]),
        ).toThrow(RangeError);
      }
      expect(() =>
        Reflect.apply(api[name], api, [key, large(67108865), []]),
      ).toThrow(RangeError);
    }
    for (const name of ["bsrchd", "isrchd"] as const)
      expect(() => api[name](0, large(33554433))).toThrow(RangeError);
    for (const name of ["bsrchi", "isrchi"] as const)
      expect(() => api[name](0, large(67108865))).toThrow(RangeError);
    for (const name of ["bsrchc", "isrchc"] as const)
      expect(() => api[name]("", large(134217729))).toThrow(RangeError);
    expect(attempts).toBe(0);
  } finally {
    m._malloc = malloc;
  }
  expect(api.bschoi(2, [8, 2], [1, 0])).toBe(1);
});

it("snapshots input rows and indices exactly once before writing the actual heap", async () => {
  const api = createCoordsVectorsApi(await actualModule());
  function once<T>(items: T[]) {
    const read = new Set<PropertyKey>();
    return new Proxy(items, {
      get(target, key, receiver) {
        if (
          key === "length" ||
          (typeof key === "string" && /^\d+$/.test(key))
        ) {
          if (read.has(key)) throw Error("Repeated input read");
          read.add(key);
        }
        return Reflect.get(target, key, receiver);
      },
    });
  }
  expect(api.bschoc("é ", once(["😀", "é ", "B"]), once([2, 1, 0]))).toBe(1);
  expect(api.bschoi(2, once([8, 2]), once([1, 0]))).toBe(1);
  expect(api.isrchd(NaN, once([NaN, Infinity]))).toBe(-1);
  expect(api.isrchd(0, once([NaN, -0, 0]))).toBe(1);
});
