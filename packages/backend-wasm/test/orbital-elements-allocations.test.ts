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

type Api = ReturnType<typeof createEphemerisApi>;
const state = [1, 0, 0, 0, 1, 0] as const,
  elts = [1, 0, 0, 0, 0, 0, 0, 1] as const;
const eq = [1, 0, 0, 0, 0, 0, 0, 1, 0] as const;
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
const specs: readonly {
  method: string;
  bytes: number[];
  invoke: (api: Api) => number[];
  expected: readonly number[];
}[] = [
  {
    method: "conics",
    bytes: [64, 48, 2048],
    invoke: (api) => api.conics(once(elts), 0),
    expected: state,
  },
  {
    method: "eqncpv",
    bytes: [72, 48, 2048],
    invoke: (api) => api.eqncpv(0, 0, once(eq), -Math.PI / 2, Math.PI / 2),
    expected: state,
  },
  {
    method: "oscelt",
    bytes: [48, 64, 2048],
    invoke: (api) => api.oscelt(once(state), 0, 1),
    expected: elts,
  },
  {
    method: "oscltx",
    bytes: [48, 88, 2048],
    invoke: (api) => api.oscltx(once(state), 0, 1),
    expected: [...elts, 0, 1, 2 * Math.PI],
  },
  {
    method: "prop2b",
    bytes: [48, 48, 2048],
    invoke: (api) => api.prop2b(1, once(state), 0),
    expected: state,
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
      let actual: number[] | undefined;
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
      expect(actual).toHaveLength(spec.expected.length);
      for (const [i, x] of spec.expected.entries())
        expect(actual[i]).toBeCloseTo(x, 14);
      actual[0] = 99;
      expect(spec.invoke(api)[0]).toBeCloseTo(spec.expected[0]!, 14);
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
    expect(() => api.oscltx([1, 0, 0, 0, 0, 0], 0, 1)).toThrow(
      /DEGENERATECASE/,
    );
    expect(acquired.size).toBe(0);
    expect(api.prop2b(1, state, 0)).toEqual(state);
    expect(acquired.size).toBe(0);
  } finally {
    m._malloc = malloc;
    m._free = free;
    for (const p of acquired) free(p);
  }
});

it("validates tuple dimensions, finite entries and scalar positions before allocating", async () => {
  const m = await actualModule(),
    api = createEphemerisApi(
      m,
      createSpiceHandleRegistry(),
      createVirtualOutputRegistry(),
    );
  const malloc = m._malloc;
  let calls = 0;
  m._malloc = (n) => {
    calls++;
    return malloc(n);
  };
  try {
    for (const [name, args] of [
      ["conics", [elts, 0]],
      ["eqncpv", [0, 0, eq, 0, 0]],
      ["oscelt", [state, 0, 1]],
      ["oscltx", [state, 0, 1]],
      ["prop2b", [1, state, 0]],
    ] as const) {
      for (const [i, arg] of args.entries()) {
        const bad =
          typeof arg === "number"
            ? [NaN, Infinity, "0"]
            : [
                arg.slice(1),
                [...arg, 0],
                Array(arg.length),
                arg.map((v, j) => (j ? v : -Infinity)),
              ];
        for (const value of bad) {
          const invalid: unknown[] = [...args];
          invalid[i] = value;
          expect(() => Reflect.apply(api[name], undefined, invalid)).toThrow();
        }
      }
    }
    expect(calls).toBe(0);
  } finally {
    m._malloc = malloc;
  }
});
