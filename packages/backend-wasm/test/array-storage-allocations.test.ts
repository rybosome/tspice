import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { withAllocs } from "../src/codec/alloc.js";
import { createErrorApi } from "../src/domains/error.js";
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
  {
    name: "clearc",
    count: 2,
    invoke: (api) => api.clearc(2, 3, [88, 77, 66, 55, 44, 33, 22, 11]),
  },
  {
    name: "cleard",
    count: 2,
    invoke: (api) => api.cleard(2, [0.25, 1.75, 3.5, -11.25]),
  },
  {
    name: "cleari",
    count: 2,
    invoke: (api) => api.cleari(2, [71, -83, 2147483647, -2147483648]),
  },
  {
    name: "filld",
    count: 2,
    invoke: (api) => api.filld(-0.125, 2, [0.25, 1.75, 3.5, -11.25]),
  },
  {
    name: "filli",
    count: 2,
    invoke: (api) =>
      api.filli(-2147483648, 2, [71, -83, 2147483647, -2147483648]),
  },
  {
    name: "moved",
    count: 3,
    invoke: (api) =>
      api.moved([0.25, 1.75, 3.5, -11.25], 2, [101, -11, 83, 71]),
  },
];
describe("array storage on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw array storage operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("releases storage and diagnostics after an actual CLEARC width error", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module),
    error = createErrorApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free,
    live = new Set<number>();
  let count = 0;
  module._malloc = (bytes) => {
    count++;
    const p = malloc(bytes);
    if (p) live.add(p);
    return p;
  };
  module._free = (p) => {
    expect(live.delete(p)).toBe(true);
    free(p);
  };
  try {
    for (const width of [1, 0, -2147483648]) {
      count = 0;
      expect(() => api.clearc(2, width, [91, 82, 73])).toThrow(
        "STRINGTOOSHORT",
      );
      expect(count).toBe(2 + 3); // routine storage plus short, long and traceback
      expect(live.size).toBe(0);
      expect(error.failed()).toBe(false);
      expect(api.clearc(1, 2, [91, 82, 73])).toEqual([32, 0, 73]);
      expect(live.size).toBe(0);
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const p of live) free(p);
    error.reset();
  }
});

it("rejects unsupported counts, byte sizes and mismatched storage before reading elements or allocating", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc;
  let count = 0;
  module._malloc = () => {
    count++;
    throw new Error("Unexpected allocation");
  };
  const unread = (length: number) =>
    new Proxy<number[]>([], {
      get(t, k, r) {
        if (k === "length") return length;
        if (typeof k === "string" && /^\d+$/.test(k))
          throw new Error("Unexpected entry read");
        return Reflect.get(t, k, r);
      },
    });
  try {
    for (const call of [
      () => api.clearc(1, 2, unread(268435457)),
      () => api.clearc(2, 3, unread(5)),
      () => api.clearc(2147483647, 2147483647, unread(0)),
      () => api.cleard(0, unread(33554433)),
      () => api.cleari(1, unread(67108865)),
      () => api.filld(9, 0, unread(33554433)),
      () => api.filli(7, 1, unread(67108865)),
      () => api.moved(unread(33554433), 1, unread(1)),
      () => api.moved(unread(1), 1, unread(33554433)),
      () => api.moved(unread(0), -1, unread(0)),
      () => api.moved(unread(2), 3, unread(5)),
      () => api.moved(unread(5), 3, unread(2)),
    ])
      expect(call).toThrow(RangeError);
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.moved([4, 3], 1, [7, 8])).toEqual([4, 8]);
});

it("captures each supplied storage length and component once before marshalling", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  function once(values: number[]) {
    let length = 0;
    const counts = values.map(() => 0);
    const array = new Proxy([...values], {
      get(target, k, r) {
        if (k === "length") {
          if (++length !== 1) throw new Error("Length reread");
          return values.length;
        }
        if (k === Symbol.iterator) throw new Error("Caller iterator used");
        if (typeof k === "string" && /^\d+$/.test(k)) {
          const i = Number(k);
          if (i >= values.length || counts[i] !== 0)
            throw new Error("Entry reread");
          counts[i] = 1;
        }
        return Reflect.get(target, k, r);
      },
    });
    return {
      array,
      check() {
        expect(length).toBe(1);
        expect(counts).toEqual(values.map(() => 1));
      },
    };
  }
  const run: ((a: number[]) => number[])[] = [
    (a) => api.clearc(1, 2, a),
    (a) => api.cleard(2, a),
    (a) => api.cleari(2, a),
    (a) => api.filld(-0.5, 2, a),
    (a) => api.filli(-7, 2, a),
  ];
  for (const fn of run) {
    const init = [91, 82, 73, 64],
      item = once(init);
    expect(fn(item.array)).toEqual(fn(init));
    item.check();
  }
  const src = once([111, 12, 13, 14]),
    dest = once([91, 82, 73, 64]);
  expect(api.moved(src.array, 3, dest.array)).toEqual([111, 12, 13, 64]);
  src.check();
  dest.check();
});

it("copies populated outputs before freed WASM storage is reused", async () => {
  const module = await actualModule(),
    api = createCoordsVectorsApi(module);
  const source = [11, 22, 33, 44],
    dest = [91, 82, 73, 64];
  const bytes = api.clearc(1, 3, dest),
    doubles = api.cleard(1, dest),
    integers = api.filli(-71, 2, dest),
    move = api.moved(source, 2, dest);
  for (const width of [4, 8, 16, 32]) {
    withAllocs(module, [2048, width, width], (err, a, b) => {
      module.HEAPU8.fill(0x7f, err, err + 2048);
      module.HEAPU8.fill(0x7f, a, a + width);
      module.HEAPU8.fill(0x7f, b, b + width);
    });
  }
  expect(bytes).toEqual([32, 32, 0, 64]);
  expect(doubles).toEqual([0, 82, 73, 64]);
  expect(integers).toEqual([-71, -71, 73, 64]);
  expect(move).toEqual([11, 22, 73, 64]);
  move.fill(0);
  expect(source).toEqual([11, 22, 33, 44]);
  expect(dest).toEqual([91, 82, 73, 64]);
});

it("uses the shared MOVED shim on valid overlapping ranges inside one guarded allocation", async () => {
  const m = await actualModule();
  withAllocs(m, [2048, 48], (err, ptr) => {
    const start = ptr >>> 3,
      initial = [11, 22, 33, 44, 55, 66];
    for (const [from, to, count, expected] of [
      [1, 2, 3, [11, 22, 22, 33, 44, 66]],
      [2, 1, 3, [11, 33, 44, 55, 55, 66]],
      [1, 1, 3, initial],
      [1, 2, 0, initial],
    ] as const) {
      m.HEAPF64.set(initial, start);
      // The outer doubles are guard values. Both pointers stay within the four
      // interior doubles, and each reported capacity ends before the last guard.
      const status = m._tspice_moved(
        ptr + 8 * from,
        5 - from,
        count,
        ptr + 8 * to,
        5 - to,
        err,
        2048,
      );
      expect(status).toBe(0);
      expect(Array.from(m.HEAPF64.subarray(start, start + 6))).toEqual(
        expected,
      );
    }
  });
});
