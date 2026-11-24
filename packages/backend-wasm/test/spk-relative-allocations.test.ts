import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createWasmFs } from "../src/runtime/fs.js";
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
  const fsApi = createWasmFs(module);
  for (const name of [
    "audit-ephemeris.bsp",
    "audit-ephemeris-observer.bsp",
    "relative-observers.tf",
    "audit-geometry.bsp",
    "audit-geometry.tf",
  ]) {
    fsApi.loadKernel(
      name,
      fs.readFileSync(
        new URL(
          "../../py-parity-checking/fixtures/kernels/" + name,
          import.meta.url,
        ),
      ),
    );
  }
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
  expected: { state: number[]; lt: number };
}[] = [
  {
    method: "spkcpo",
    bytes: [7, 14, 7, 5, 24, 2, 6, 56, 2048],
    invoke: (api) =>
      api.spkcpo(
        "100001",
        125.25,
        "RELATIVE_SPIN",
        "TARGET",
        "CN+S",
        once([321.5, -224.25, 111.375] as const),
        "0",
        "J2000",
      ),
    expected: {
      state: [
        5016.257732882812, -32059.07928137217, 18307.88153611346,
        21.41255496281744, 16.085097986172787, 24.39824743937185,
      ],
      lt: 0.12427784985432254,
    },
  },
  {
    method: "spkcpt",
    bytes: [24, 2, 6, 14, 7, 5, 7, 56, 2048],
    invoke: (api) =>
      api.spkcpt(
        once([321.5, -224.25, 111.375] as const),
        "0",
        "J2000",
        125.25,
        "RELATIVE_SPIN",
        "CENTER",
        "CN+S",
        "100001",
      ),
    expected: {
      state: [
        -5015.3857139425145, 32059.92756809393, -18306.895732927904,
        -21.41310363080091, -16.083674681254283, -24.398509420466638,
      ],
      lt: 0.124278277290988,
    },
  },
  {
    method: "spkcvo",
    bytes: [7, 14, 7, 6, 48, 2, 6, 56, 2048],
    invoke: (api) =>
      api.spkcvo(
        "100001",
        125.25,
        "RELATIVE_SPIN",
        "CENTER",
        "XCN+S",
        once([321.5, -224.25, 111.375, 0.375, -0.25, 0.1875] as const),
        -211.5,
        "0",
        "J2000",
      ),
    expected: {
      state: [
        4906.233533599287, -31965.076350078147, 18240.57598141275,
        21.01847945953558, 16.211604049163782, 24.06778866253814,
      ],
      lt: 0.12384870766285082,
    },
  },
  {
    method: "spkcvt",
    bytes: [48, 2, 6, 14, 7, 6, 7, 56, 2048],
    invoke: (api) =>
      api.spkcvt(
        once([321.5, -224.25, 111.375, 0.375, -0.25, 0.1875] as const),
        -211.5,
        "0",
        "J2000",
        125.25,
        "RELATIVE_SPIN",
        "TARGET",
        "XCN+S",
        "100001",
      ),
    expected: {
      state: [
        -4905.268233224748, 31965.703386728946, -18239.381454673592,
        -21.0190328695749, -16.209919825048573, -24.06811286439318,
      ],
      lt: 0.12384812548433538,
    },
  },
  {
    method: "azlcpo",
    bytes: [10, 7, 5, 24, 7, 21, 56, 2048],
    invoke: (api) =>
      api.azlcpo(
        "ELLIPSOID",
        "100102",
        21.5,
        "CN+S",
        true,
        true,
        once([3.2, 1.7, -0.75] as const),
        "100101",
        "AUDIT_GEOMETRY_FIXED",
      ),
    expected: {
      state: [
        8.297872015346858, 0.4464431733453681, 0.5000793089428992,
        0.00928906764787876, 0.0007008571390817285, -9.848405800442727e-5,
      ],
      lt: 2.7678721708692406e-5,
    },
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
      if (
        typeof actual !== "object" ||
        actual === null ||
        !("state" in actual) ||
        !("lt" in actual) ||
        !Array.isArray(actual.state) ||
        typeof actual.lt !== "number"
      )
        throw new Error("Missing complete state and light time");
      expect(actual.state).toHaveLength(6);
      for (const [i, expected] of spec.expected.state.entries())
        expect(Math.abs(actual.state[i] - expected)).toBeLessThan(
          1e-12 * Math.max(1, Math.abs(expected)),
        );
      expect(actual.lt).toBeCloseTo(spec.expected.lt, 12);
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
    expect(() =>
      api.spkcvo(
        "0",
        0,
        "J2000",
        "OBSERVER",
        "LT+S",
        [-1, 0, 0, 0, 299792.458, 0],
        0,
        "0",
        "J2000",
      ),
    ).toThrow(/DIVIDEBYZERO/);
    expect(acquired.size).toBe(0);
    expect(
      api.spkcpt([3, 4, 0], "0", "J2000", 0, "J2000", "CENTER", "NONE", "0"),
    ).toEqual({ state: [3, 4, 0, 0, 0, 0], lt: 5 / 299792.458 });
    expect(acquired.size).toBe(0);
  } finally {
    m._malloc = malloc;
    m._free = free;
    for (const p of acquired) free(p);
  }
});
