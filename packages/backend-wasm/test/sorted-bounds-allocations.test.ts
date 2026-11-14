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
  invoke(api: CoordsVectorsApi): number;
}[] = [
  {
    name: "lstlec",
    count: 4,
    invoke: (api) => api.lstlec("B\t", ["A", "B\t", "B", "Z"]),
  },
  {
    name: "lstltc",
    count: 4,
    invoke: (api) => api.lstltc("B\t", ["A", "B\t", "B", "Z"]),
  },
  {
    name: "lstled",
    count: 3,
    invoke: (api) => api.lstled(0.125, [-1, 0.125, 0.125, 7]),
  },
  {
    name: "lstltd",
    count: 3,
    invoke: (api) => api.lstltd(0.125, [-1, 0.125, 0.125, 7]),
  },
  { name: "lstlei", count: 3, invoke: (api) => api.lstlei(2, [-1, 2, 2, 7]) },
  { name: "lstlti", count: 3, invoke: (api) => api.lstlti(2, [-1, 2, 2, 7]) },
];
describe("sorted bounds on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createCoordsVectorsApi(module);
        const expected = call.invoke(api);
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

it("sizes actual search buffers by encoded bytes and supplies valid empty storage", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(8);
  m._free(warm);
  const malloc = m._malloc,
    sizes: number[] = [];
  m._malloc = (bytes) => {
    sizes.push(bytes);
    return malloc(bytes);
  };
  try {
    for (const n of ["lstlec", "lstltc"] as const) {
      sizes.length = 0;
      expect(api[n]("😀", ["é", "雪", "😀"])).toBe(n === "lstlec" ? 2 : 1);
      // Five bytes for the key. Three rows of four payload bytes plus final NUL.
      expect(sizes).toEqual([2048, 5, 15, 4]);
      sizes.length = 0;
      expect(api[n]("", [])).toBe(-1);
      expect(sizes).toEqual([2048, 1, 1, 4]);
    }
    for (const n of ["lstled", "lstltd", "lstlei", "lstlti"] as const) {
      const width = n.endsWith("d") ? 8 : 4;
      sizes.length = 0;
      expect(api[n](1, [])).toBe(-1);
      expect(sizes).toEqual([2048, width, 4]);
      sizes.length = 0;
      expect(api[n](2, [-31, 1, 2, 2, 7])).toBe(n.startsWith("lstle") ? 3 : 1);
      expect(sizes).toEqual([2048, 5 * width, 4]);
    }
  } finally {
    m._malloc = malloc;
  }
});

it("rejects unrepresentable numeric buffers and oversized rectangular tables before allocating", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(8);
  m._free(warm);
  const malloc = m._malloc;
  let allocations = 0;
  m._malloc = () => {
    allocations++;
    throw new Error("Unexpected allocation");
  };
  const unread = (length: number) =>
    new Proxy<number[]>([], {
      get(t, k, r) {
        if (k === "length") return length;
        if (typeof k === "string" && /^\d+$/.test(k))
          throw new Error("Unexpected row read");
        return Reflect.get(t, k, r);
      },
    });
  try {
    for (const n of ["lstled", "lstltd", "lstlei", "lstlti"] as const) {
      const length = n.endsWith("d") ? 33554433 : 67108865;
      expect(() => api[n](0, unread(length))).toThrow(RangeError);
      expect(() => api[n](0, unread(2147483648))).toThrow(RangeError);
    }
    // A rectangular 16,385-by-16,385-byte table would exceed the per-buffer
    // cap. The source itself stays small and ordered, with just one long row.
    const rows = Array<string>(16385).fill("A");
    rows[16384] = "Z".repeat(16384);
    for (const n of ["lstlec", "lstltc"] as const)
      expect(() => api[n]("", rows)).toThrow(RangeError);
    expect(allocations).toBe(0);
  } finally {
    m._malloc = malloc;
  }
  expect(api.lstlec("B", ["A", "B", "B", "C"])).toBe(2);
});
