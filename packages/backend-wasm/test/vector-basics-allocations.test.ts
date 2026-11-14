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
  {
    name: "vdist",
    count: 4,
    invoke: (api) => api.vdist([1, -2, 3], [4, 5, -6]),
  },
  { name: "vequ", count: 3, invoke: (api) => api.vequ([1, -2, 3]) },
  { name: "vpack", count: 2, invoke: (api) => api.vpack(1, -2, 3) },
  { name: "vupack", count: 3, invoke: (api) => api.vupack([1, -2, 3]) },
  { name: "vzero", count: 3, invoke: (api) => api.vzero([1, -2, 3]) },
  { name: "unorm", count: 4, invoke: (api) => api.unorm([1, -2, 3]) },
  {
    name: "ucrss",
    count: 4,
    invoke: (api) => api.ucrss([1, -2, 3], [4, 5, -6]),
  },
  { name: "vsep", count: 4, invoke: (api) => api.vsep([1, -2, 3], [4, 5, -6]) },
];

describe("vector basics on the actual WASM heap", () => {
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
        // Recovery executes this same genuine raw vector operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

// Shape stays fixed and every value is finite. A second read throws in JS,
// so even a regression cannot pass an invalid buffer length to C.
function readOnceInput(values: readonly number[]) {
  const entries = values.map(() => 0);
  let lengths = 0;
  const input = new Proxy([...values], {
    get(target, key, receiver) {
      if (key === "length") {
        if (++lengths > 1) throw new Error("Input length reread");
        return values.length;
      }
      if (key === Symbol.iterator)
        throw new Error("Unexpected caller iterator");
      if (typeof key === "string" && /^\d+$/.test(key)) {
        const index = Number(key);
        if (index >= values.length || entries[index] !== 0)
          throw new Error("Input component reread");
        entries[index] = 1;
      }
      return Reflect.get(target, key, receiver);
    },
  });
  return {
    input,
    check() {
      expect(lengths).toBe(1);
      expect(entries).toEqual(values.map(() => 1));
    },
  };
}

it("writes only the fixed components read during input validation to the real WASM heap", async () => {
  const api = createCoordsVectorsApi(await actualModule());
  for (const { fn, args } of [
    { fn: api.vequ, args: [[1, -2, 3]] },
    {
      fn: api.vdist,
      args: [
        [1, -2, 3],
        [4, 5, -6],
      ],
    },
  ]) {
    const expected: unknown = Reflect.apply(fn, api, args);
    const tracked = args.map((arg) =>
      Array.isArray(arg) ? readOnceInput(arg) : undefined,
    );
    const input = args.map((arg, i) => tracked[i]?.input ?? arg);
    expect(Reflect.apply(fn, api, input)).toEqual(expected);
    for (const item of tracked) item?.check();
  }
});
