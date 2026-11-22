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
  invoke(api: CoordsVectorsApi): unknown;
}[] = [
  { name: "isordv", count: 3, invoke: (api) => api.isordv([2, 0, 1]) },
  { name: "orderc", count: 3, invoke: (api) => api.orderc(["B ", "A\t", "é"]) },
  { name: "orderd", count: 3, invoke: (api) => api.orderd([2, 0, 1]) },
  { name: "orderi", count: 3, invoke: (api) => api.orderi([2, 0, 1]) },
  {
    name: "reordc",
    count: 3,
    invoke: (api) => api.reordc([2, 0, 1], ["B ", "A\t", "é"]),
  },
  {
    name: "reordd",
    count: 3,
    invoke: (api) => api.reordd([2, 0, 1], [2, 0, 1]),
  },
  {
    name: "reordi",
    count: 3,
    invoke: (api) => api.reordi([2, 0, 1], [2, 0, 1]),
  },
  {
    name: "reordl",
    count: 3,
    invoke: (api) => api.reordl([2, 0, 1], [true, false, false]),
  },
  { name: "shellc", count: 2, invoke: (api) => api.shellc(["B ", "A\t", "é"]) },
  { name: "shelld", count: 2, invoke: (api) => api.shelld([2, 0, 1]) },
  { name: "shelli", count: 2, invoke: (api) => api.shelli([2, 0, 1]) },
];
describe("array ordering on the actual WASM heap", () => {
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
        // Recovery executes this genuine array operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("checks fixed-width and index buffers before allocating or reading oversized arrays", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(4);
  m._free(warm);
  const malloc = m._malloc;
  let count = 0;
  m._malloc = () => {
    count++;
    throw new Error("Unexpected allocation");
  };
  const unread = (length: number) =>
    new Proxy<number[]>([], {
      get(_, key) {
        if (key === "length") return length;
        throw new Error("Unexpected element read");
      },
    });
  try {
    expect(() => api.orderd(unread(33554433))).toThrow(RangeError);
    expect(() => api.isordv(unread(67108865))).toThrow(RangeError);
    expect(() => api.reordi(unread(500), [1, 2])).toThrow(/length/);
    const oversize = Array<string>(16385).fill("");
    oversize[17] = "é".repeat(8192);
    expect(() => api.shellc(oversize)).toThrow(RangeError);
    expect(() => api.reordc([1, 1], ["x", "y"])).toThrow(/permutation/);
    expect(count).toBe(0);
  } finally {
    m._malloc = malloc;
  }
  expect(api.reordi([1, 0], [10, 20])).toEqual([20, 10]);
});
it("reserves non-null physical sentinels for empty arrays and exact UTF-8 output strides", async () => {
  const m = await actualModule(),
    api = createCoordsVectorsApi(m);
  const warm = m._malloc(4);
  m._free(warm);
  const malloc = m._malloc,
    sizes: number[] = [];
  m._malloc = (bytes) => {
    sizes.push(bytes);
    return malloc(bytes);
  };
  try {
    expect(api.reordc([], [])).toEqual([]);
    expect(sizes).toEqual([4, 1, 2048]);
    sizes.length = 0;
    expect(api.shellc(["😀", "é "])).toEqual(["é", "😀"]);
    expect(sizes).toEqual([10, 2048]);
    sizes.length = 0;
    expect(api.orderd([])).toEqual([]);
    expect(sizes).toEqual([8, 4, 2048]);
  } finally {
    m._malloc = malloc;
  }
});
