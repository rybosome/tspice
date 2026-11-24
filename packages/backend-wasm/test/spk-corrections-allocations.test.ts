import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createEphemerisApi } from "../src/domains/ephemeris.js";
import { createVirtualOutputRegistry } from "../src/runtime/virtual-outputs.js";
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

function once<T extends readonly number[]>(original: T): T {
  const reads = new Set<string>();
  return new Proxy(original, {
    get(target, key, receiver) {
      if (typeof key === "string" && (key === "length" || /^\d+$/.test(key))) {
        if (reads.has(key)) throw new Error("Repeated tuple read: " + key);
        reads.add(key);
      }
      return Reflect.get(target, key, receiver);
    },
  });
}
type Api = ReturnType<typeof createEphemerisApi>;
const specs: {
  method: string;
  bytes: number[];
  invoke: (api: Api) => unknown;
  expected: unknown;
}[] = [
  {
    method: "spkacs",
    bytes: [6, 5, 64, 2048],
    invoke: (api) => api.spkacs(0, 0, "J2000", "NONE", 0),
    expected: { state: [0, 0, 0, 0, 0, 0], lt: 0, dlt: 0 },
  },
  {
    method: "spkapo",
    bytes: [6, 48, 5, 32, 2048],
    invoke: (api) =>
      api.spkapo(0, 0, "J2000", once([0, 0, 0, 0, 0, 0] as const), "NONE"),
    expected: { pos: [0, 0, 0], lt: 0 },
  },
  {
    method: "spkapp",
    bytes: [6, 48, 5, 56, 2048],
    invoke: (api) =>
      api.spkapp(0, 0, "J2000", once([0, 0, 0, 0, 0, 0] as const), "NONE"),
    expected: { state: [0, 0, 0, 0, 0, 0], lt: 0 },
  },
  {
    method: "spkaps",
    bytes: [6, 5, 48, 24, 64, 2048],
    invoke: (api) =>
      api.spkaps(
        0,
        0,
        "J2000",
        "NONE",
        once([0, 0, 0, 0, 0, 0] as const),
        once([0, 0, 0] as const),
      ),
    expected: { state: [0, 0, 0, 0, 0, 0], lt: 0, dlt: 0 },
  },
  {
    method: "spkltc",
    bytes: [6, 5, 48, 64, 2048],
    invoke: (api) =>
      api.spkltc(0, 0, "J2000", "NONE", once([0, 0, 0, 0, 0, 0] as const)),
    expected: { state: [0, 0, 0, 0, 0, 0], lt: 0, dlt: 0 },
  },
  {
    method: "stelab",
    bytes: [24, 24, 24, 2048],
    invoke: (api) =>
      api.stelab(once([2, 0, 0] as const), once([0, 0, 0] as const)),
    expected: [2, 0, 0],
  },
  {
    method: "stlabx",
    bytes: [24, 24, 24, 2048],
    invoke: (api) =>
      api.stlabx(once([2, 0, 0] as const), once([0, 0, 0] as const)),
    expected: [2, 0, 0],
  },
  {
    method: "ltime",
    bytes: [3, 16, 2048],
    invoke: (api) => api.ltime(0, 0, "->", 0),
    expected: { ettarg: 0, elapsd: 0 },
  },
];
for (const spec of specs)
  for (let failure = 0; failure <= spec.bytes.length; failure++) {
    it(`${spec.method} releases each temporary on ${failure ? "allocation failure " + failure : "success"}`, async () => {
      const m = await actualModule(),
        api = createEphemerisApi(
          m,
          createSpiceHandleRegistry(),
          createVirtualOutputRegistry(),
        );
      const malloc = m._malloc,
        free = m._free,
        acquired = new Set<number>(),
        sizes: number[] = [];
      m._malloc = (n) => {
        sizes.push(n);
        if (failure === sizes.length) return 0;
        const p = malloc(n);
        if (p) acquired.add(p);
        return p;
      };
      m._free = (p) => {
        expect(acquired.delete(p)).toBe(true);
        free(p);
      };
      let actual: unknown;
      try {
        if (failure) expect(() => spec.invoke(api)).toThrow(/malloc failed/);
        else actual = spec.invoke(api);
        expect(sizes).toEqual(
          failure ? spec.bytes.slice(0, failure) : spec.bytes,
        );
        expect(acquired.size).toBe(0);
      } finally {
        m._malloc = malloc;
        m._free = free;
        for (const p of acquired) free(p);
      }
      actual ??= spec.invoke(api);
      expect(actual).toEqual(spec.expected);
      expect(Object.is(actual, spec.invoke(api))).toBe(false);
    });
  }
it("frees all buffers on a real toolkit error and leaves the module usable", async () => {
  const m = await actualModule(),
    api = createEphemerisApi(
      m,
      createSpiceHandleRegistry(),
      createVirtualOutputRegistry(),
    );
  const malloc = m._malloc,
    free = m._free,
    acquired = new Set<number>();
  m._malloc = (n) => {
    const p = malloc(n);
    if (p) acquired.add(p);
    return p;
  };
  m._free = (p) => {
    expect(acquired.delete(p)).toBe(true);
    free(p);
  };
  try {
    expect(() => api.stelab([1, 0, 0], [0, 300000, 0])).toThrow(
      /VALUEOUTOFRANGE/,
    );
    expect(acquired.size).toBe(0);
    expect(api.stelab([1, 0, 0], [0, 0, 0])).toEqual([1, 0, 0]);
    expect(acquired.size).toBe(0);
  } finally {
    m._malloc = malloc;
    m._free = free;
    for (const p of acquired) free(p);
  }
});
