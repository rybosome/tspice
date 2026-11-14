import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { withAllocs } from "../src/codec/alloc.js";
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
  invoke(api: CoordsVectorsApi, empty?: boolean): unknown;
}[] = [
  {
    name: "vaddg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vaddg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vdistg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vdistg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vdotg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vdotg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vprojg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vprojg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vrelg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vrelg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vsepg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vsepg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vsubg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vsubg(empty ? [] : [1, -2, 4, -8], empty ? [] : [3, 5, -7, 11]),
  },
  {
    name: "vequg",
    count: 3,
    invoke: (api, empty = false) => api.vequg(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "vhatg",
    count: 3,
    invoke: (api, empty = false) => api.vhatg(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "vminug",
    count: 3,
    invoke: (api, empty = false) => api.vminug(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "vnormg",
    count: 3,
    invoke: (api, empty = false) => api.vnormg(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "vzerog",
    count: 3,
    invoke: (api, empty = false) => api.vzerog(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "unormg",
    count: 4,
    invoke: (api, empty = false) => api.unormg(empty ? [] : [3, -4, 0, 12]),
  },
  {
    name: "vlcomg",
    count: 4,
    invoke: (api, empty = false) =>
      api.vlcomg(
        2,
        empty ? [] : [1, -2, 4, -8],
        -3,
        empty ? [] : [3, 5, -7, 11],
      ),
  },
  {
    name: "vsclg",
    count: 3,
    invoke: (api, empty = false) => api.vsclg(-2, empty ? [] : [1, -2, 4, -8]),
  },
];
describe("general vectors on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw general-vector operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("uses nonzero dummy allocations for every actual dimension-zero call", async () => {
  const module = await actualModule();
  const api = createCoordsVectorsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const bytes: number[] = [],
    live = new Set<number>();
  module._malloc = (size: number) => {
    bytes.push(size);
    const ptr = malloc(size);
    live.add(ptr);
    return ptr;
  };
  module._free = (ptr: number) => {
    expect(live.delete(ptr)).toBe(true);
    free(ptr);
  };
  try {
    for (const call of calls) {
      bytes.length = 0;
      const result = call.invoke(api, true);
      expect(bytes).toHaveLength(call.count);
      expect(bytes[0]).toBe(2048);
      expect(bytes.slice(1)).toEqual(
        Array(call.count - 1)
          .fill(8)
          .map((size, i) => (call.name === "vzerog" && i === 1 ? 4 : size)),
      );
      expect(live.size).toBe(0);
      expect(result).toEqual(
        call.name === "vzerog"
          ? false
          : call.name === "unormg"
            ? { unit: [], norm: 0 }
            : ["vdistg", "vdotg", "vnormg", "vrelg", "vsepg"].includes(
                  call.name,
                )
              ? 0
              : [],
      );
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
  }
});

it("rejects oversized dimensions and malformed vectors before any heap allocation", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc;
  let allocations = 0;
  module._malloc = () => {
    allocations++;
    throw new Error("Unexpected allocation");
  };
  const oversized = new Proxy<number[]>([], {
    get(target, key, receiver) {
      if (key === "length") return 33554433;
      if (typeof key === "string" && /^\d+$/.test(key))
        throw new Error("Unexpected component read");
      return Reflect.get(target, key, receiver);
    },
  });
  try {
    for (const name of [
      "vaddg",
      "vdistg",
      "vdotg",
      "vprojg",
      "vrelg",
      "vsepg",
      "vsubg",
    ] as const) {
      expect(() => api[name](oversized, oversized)).toThrow(/buffer exceeds/);
      expect(() => api[name]([1, 2], [3])).toThrow(/equal lengths/);
    }
    for (const name of [
      "vequg",
      "vhatg",
      "vminug",
      "vnormg",
      "vzerog",
      "unormg",
    ] as const)
      expect(() => api[name](oversized)).toThrow(/buffer exceeds/);
    expect(() => api.vlcomg(2, oversized, -3, oversized)).toThrow(
      /buffer exceeds/,
    );
    expect(() => api.vsclg(-2, oversized)).toThrow(/buffer exceeds/);
    expect(() => api.vhatg([1, 2, 3, Infinity])).toThrow(/finite/);
    expect(allocations).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.vaddg([1, 2], [3, 4])).toEqual([4, 6]);
});

it("shared-C count guards reject unsafe dimensions with valid sentinel storage", async () => {
  const module = await actualModule();
  withAllocs(
    module,
    [2048, 16, 16, 16, 8],
    (errPtr, aPtr, bPtr, outPtr, normPtr) => {
      module.HEAPF64.set([101, 202], aPtr >>> 3);
      module.HEAPF64.set([303, 404], bPtr >>> 3);
      module.HEAPF64.set([505, 606], outPtr >>> 3);
      module.HEAPF64[normPtr >>> 3] = 707;
      for (const dimension of [-1, 2147483647]) {
        expect(
          module._tspice_vprojg(aPtr, bPtr, dimension, outPtr, errPtr, 2048),
        ).not.toBe(0);
        expect(
          module._tspice_unormg(aPtr, dimension, outPtr, normPtr, errPtr, 2048),
        ).not.toBe(0);
        expect(
          Array.from(module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + 2)),
        ).toEqual([505, 606]);
        expect(module.HEAPF64[normPtr >>> 3]).toBe(707);
      }
      expect(
        module._tspice_vaddg(aPtr, bPtr, -1, outPtr, errPtr, 2048),
      ).not.toBe(0);
    },
  );
  expect(createCoordsVectorsApi(module).unormg([])).toEqual({
    unit: [],
    norm: 0,
  });
});

it("copies every returned array before actual freed heap buffers are overwritten", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const input = [3, -4, 0, 12];
  const outputs = [
    api.vaddg(input, [1, 2, 3, 4]),
    api.vequg(input),
    api.vhatg(input),
    api.vlcomg(2, input, -3, [1, 2, 3, 4]),
    api.vminug(input),
    api.vprojg(input, [1, 2, 3, 4]),
    api.vsclg(-2, input),
    api.vsubg(input, [1, 2, 3, 4]),
    api.unormg(input).unit,
  ];
  const expected = outputs.map((value) => [...value]);
  for (let repeat = 0; repeat < 8; repeat++)
    withAllocs(module, [2048, 32, 32, 32, 8], (...pointers) => {
      for (let i = 0; i < pointers.length; i++)
        module.HEAPU8.fill(
          0x7f,
          pointers[i]!,
          pointers[i]! + (i === 0 ? 2048 : i === 4 ? 8 : 32),
        );
    });
  expect(outputs).toEqual(expected);
  for (const output of outputs) output.fill(0);
  expect(input).toEqual([3, -4, 0, 12]);
  expect(api.vequg(input)).toEqual(input);
});
