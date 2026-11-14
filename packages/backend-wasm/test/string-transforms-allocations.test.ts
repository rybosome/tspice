import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { StringsApi } from "@rybosome/tspice-backend-contract";
import { withAllocs } from "../src/codec/alloc.js";
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
  return module;
}

const calls: {
  name: string;
  count: number;
  invoke(api: StringsApi): unknown;
}[] = [
  { name: "cpos", count: 4, invoke: (api) => api.cpos("ıé abc", "é ", 2) },
  { name: "cposr", count: 4, invoke: (api) => api.cposr("ıé abc", "é ", 2) },
  { name: "ncpos", count: 4, invoke: (api) => api.ncpos("ıé abc", "é ", 2) },
  { name: "ncposr", count: 4, invoke: (api) => api.ncposr("ıé abc", "é ", 2) },
  { name: "pos", count: 4, invoke: (api) => api.pos("ıé abc", "é ", 2) },
  { name: "posr", count: 4, invoke: (api) => api.posr("ıé abc", "é ", 2) },
  {
    name: "esrchc",
    count: 4,
    invoke: (api) => api.esrchc("é A", ["", "ÉA", "éa"]),
  },
  { name: "cmprss", count: 3, invoke: (api) => api.cmprss(":", 1, "é::::A  ") },
  { name: "eqstr", count: 4, invoke: (api) => api.eqstr("éa b", "éAB") },
  { name: "iswhsp", count: 3, invoke: (api) => api.iswhsp(" \t\r\n") },
  { name: "lastnb", count: 3, invoke: (api) => api.lastnb("A😀  ") },
  { name: "lcase", count: 3, invoke: (api) => api.lcase("ÉAb  ") },
  { name: "ucase", count: 3, invoke: (api) => api.ucase("éAb  ") },
  {
    name: "matchi",
    count: 4,
    invoke: (api) => api.matchi("éAb", "éa?", "*", "?"),
  },
  {
    name: "matchw",
    count: 4,
    invoke: (api) => api.matchw("éAb", "éA?", "*", "?"),
  },
];
describe("string transforms on the actual WASM heap", () => {
  for (const call of calls) {
    // failAt 0 observes successful cleanup; other values fail each allocation.
    for (let failAt = 0; failAt <= call.count; failAt++) {
      it(`${call.name}: ${failAt ? `allocation ${failAt} failure` : "success cleanup"}`, async () => {
        const module = await actualModule();
        const api = createStringsApi(module);
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
        // Recovery executes this same genuine raw string operation on the same heap.
        expect(call.invoke(api)).toEqual(expected);
      });
    }
  }
});

it("releases all routine and diagnostic buffers after SPICE errors, and all routine buffers after strict output decoding fails", async () => {
  const module = await actualModule(),
    api = createStringsApi(module),
    error = createErrorApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const live = new Set<number>();
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
    for (const [call, expected, allocations] of [
      [() => api.cmprss(":", 1, "A", 0), "STRINGTOOSHORT", 6],
      [() => api.lcase("A", 1), "STRINGTOOSHORT", 6],
      [() => api.ucase("A", -1), "STRINGTOOSHORT", 6],
      [() => api.matchi("", "*", "*", "?"), "EMPTYSTRING", 7],
      [() => api.matchw("A", "", "*", "?"), "EMPTYSTRING", 7],
      [() => api.cmprss(":", 1, "é", 2), TypeError, 3],
      [() => api.lcase("é", 2), TypeError, 3],
      [() => api.ucase("é", 2), TypeError, 3],
    ] as const) {
      count = 0;
      expect(call).toThrow(expected);
      // Real SPICE errors allocate three extra short/long/trace buffers.
      expect(count).toBe(allocations);
      expect(live.size).toBe(0);
      expect(error.failed()).toBe(false);
      expect(api.ucase("a  ")).toBe("A  ");
      expect(live.size).toBe(0);
    }
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const p of live) free(p);
    error.reset();
  }
});

it("uses byte-sized buffers, caps oversized output capacity at the full result and retains owned text", async () => {
  const module = await actualModule(),
    api = createStringsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    sizes: number[] = [];
  module._malloc = (bytes) => {
    sizes.push(bytes);
    return malloc(bytes);
  };
  const stored: string[] = [];
  try {
    for (const call of [
      () => api.lcase("😀A  ", 2147483647),
      () => api.ucase("😀A  ", 2147483647),
      () => api.cmprss(" ", 1, "😀A  ", 2147483647),
    ]) {
      sizes.length = 0;
      stored.push(call());
      expect(sizes).toEqual([2048, 8, 8]);
    }
    sizes.length = 0;
    expect(api.cmprss(":", 1, "", 1)).toBe("");
    expect(sizes).toEqual([2048, 1, 1]);
    sizes.length = 0;
    expect(api.lcase("")).toBe("");
    expect(sizes).toEqual([2048, 1, 2]);
    sizes.length = 0;
    expect(api.ucase("")).toBe("");
    expect(sizes).toEqual([2048, 1, 2]);
    sizes.length = 0;
    expect(api.lastnb("😀 ")).toBe(3);
    expect(sizes).toEqual([2048, 6, 4]);
    sizes.length = 0;
    expect(api.matchw("é", "??", "*", "?")).toBe(true);
    expect(sizes).toEqual([2048, 3, 3, 4]);
  } finally {
    module._malloc = malloc;
  }
  withAllocs(module, [2048, 8, 8], (err, input, output) => {
    module.HEAPU8.fill(0x7f, err, err + 2048);
    module.HEAPU8.fill(0x7f, input, input + 8);
    module.HEAPU8.fill(0x7f, output, output + 8);
  });
  expect(stored).toEqual(["😀a  ", "😀A  ", "😀A "]);
});

it("rejects malformed text, invalid single-byte arguments and out-of-range integers before allocating", async () => {
  const module = await actualModule(),
    api = createStringsApi(module);
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc;
  let count = 0;
  module._malloc = () => {
    count++;
    throw new Error("Unexpected allocation");
  };
  try {
    for (const call of [
      () => api.cmprss("é", 1, "x"),
      () => api.cmprss(" ", 2147483648, "x"),
      () => api.cmprss(" ", 1, "x", -2147483649),
      () => api.eqstr("x", "a\0b"),
      () => api.iswhsp("\ud800"),
      () => api.lastnb("a\udfff"),
      () => api.lcase("valid", 1.5),
      () => api.ucase("a\0b"),
      () => api.matchi("a", "b", "ab", "?"),
      () => api.matchw("a", "b", "*", "😀"),
    ]) {
      expect(call).toThrow();
    }
    expect(count).toBe(0);
  } finally {
    module._malloc = malloc;
  }
  expect(api.ucase("ok")).toBe("OK");
});

it("preserves UTF-8 search bytes and the pinned directional bounds on compiled WASM", async () => {
  const module = await actualModule(),
    api = createStringsApi(module);
  for (const name of [
    "cpos",
    "cposr",
    "ncpos",
    "ncposr",
    "pos",
    "posr",
  ] as const) {
    const expected = {
      cpos: -1,
      cposr: 4,
      ncpos: -1,
      ncposr: 3,
      pos: -1,
      posr: 4,
    };
    expect(api[name]("ababa", "a", 2147483647)).toBe(expected[name]);
    expect(api[name]("ababa", "a", 2147483646)).toBe(expected[name]);
    expect(api[name]("abc", "", 0)).toBe(-1);
    expect(api[name]("", "a", 0)).toBe(-1);
    for (const args of [
      ["abc", "a", 0.5],
      ["abc", "a", 2147483648],
      ["", "\0", 0],
      ["\ud800", "a", 0],
    ]) {
      expect(() => Reflect.apply(api[name], undefined, args)).toThrow();
    }
  }
  expect(api.cpos("ı", "ñ", 0)).toBe(1);
  expect(api.ncposr("é", "ê", 1)).toBe(1);
  expect(api.posr("ababa", "aba", 1)).toBe(0);
  expect(api.esrchc("", [" ", "", ""])).toBe(1);
  expect(api.esrchc("\t", ["", " ", "\t"])).toBe(1);
  expect(api.esrchc("é A", ["ÉA", "éa", "é A"])).toBe(1);
  expect(api.esrchc("x", [])).toBe(-1);
});

it("packs esrchc into byte-sized NUL-terminated rows while reading each caller property once", async () => {
  const module = await actualModule(),
    api = createStringsApi(module);
  const rows = Object.freeze(["", "  ", "😀", "é "]);
  const seen: PropertyKey[] = [];
  const input = new Proxy(rows, {
    get(target, key, receiver) {
      if (seen.includes(key)) throw Error("repeated row property");
      seen.push(key);
      return Reflect.get(target, key, receiver);
    },
  });
  // Prime the Emscripten alias before observing the actual call.
  expect(api.esrchc("x", [])).toBe(-1);
  const original = module._tspice_esrchc;
  let observed: number[] = [];
  module._tspice_esrchc = (key, count, width, table, out, err, errMaxBytes) => {
    expect(count).toBe(4);
    expect(width).toBe(5);
    const begin = table >>> 0;
    observed = Array.from(module.HEAPU8.subarray(begin, begin + count * width));
    return original(key, count, width, table, out, err, errMaxBytes);
  };
  try {
    expect(api.esrchc("é", input)).toBe(3);
    expect(observed).toEqual([
      0, 0, 0, 0, 0, 32, 32, 0, 0, 0, 240, 159, 152, 128, 0, 195, 169, 32, 0, 0,
    ]);
    expect(seen).toEqual(["length", "0", "1", "2", "3"]);
  } finally {
    module._tspice_esrchc = original;
  }
});

it("rejects out-of-bounds esrchc layouts and malformed rows before WASM allocation", async () => {
  const module = await actualModule(),
    api = createStringsApi(module);
  const malloc = module._malloc;
  module._malloc = () => {
    throw Error("unexpected allocation");
  };
  try {
    const tooMany = new Proxy([], {
      get(_, key) {
        if (key === "length") return 134217729;
        throw Error("unexpected entry read");
      },
    });
    expect(() => api.esrchc("x", tooMany)).toThrow(/byte limit/);
    const tooWide = new Proxy(["é"], {
      get(target, key, receiver) {
        return key === "length"
          ? 134217728
          : Reflect.get(target, key, receiver);
      },
    });
    expect(() => api.esrchc("x", tooWide)).toThrow(/byte limit/);
    expect(() => api.esrchc("x", ["a\0b"])).toThrow(/NUL/);
    expect(() => api.esrchc("x", ["\udc00"])).toThrow(/surrogate/);
  } finally {
    module._malloc = malloc;
  }
});
