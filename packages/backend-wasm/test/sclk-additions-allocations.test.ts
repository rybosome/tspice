import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { createKernelsApi } from "../src/domains/kernels.js";
import { createTimeApi } from "../src/domains/time.js";
import {
  assertEmscriptenModule,
  type EmscriptenModule,
} from "../src/lowlevel/exports.js";
import { createWasmFs } from "../src/runtime/fs.js";

async function actualModule() {
  const assets = new URL("../emscripten/", import.meta.url);
  const imported: unknown = await import(
    new URL("tspice_backend_wasm.node.js", assets).href
  );
  if (typeof imported !== "object" || imported === null)
    throw new Error("Missing WASM module");
  const factory: unknown = Reflect.get(imported, "default");
  if (typeof factory !== "function")
    throw new Error("Missing WASM module factory");
  const module: unknown = await Reflect.apply(factory, undefined, [
    {
      wasmBinary: fs.readFileSync(new URL("tspice_backend_wasm.wasm", assets)),
      locateFile: (name: string) => fileURLToPath(new URL(name, assets)),
    },
  ]);
  assertEmscriptenModule(module);
  return module;
}

function allocations(
  module: EmscriptenModule,
  failAt: number,
  run: () => void,
): number[] {
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const sizes: number[] = [];
  const live = new Set<number>();
  module._malloc = (size: number) => {
    sizes.push(size);
    if (sizes.length === failAt) return 0;
    const ptr = malloc(size);
    if (ptr) live.add(ptr);
    return ptr;
  };
  module._free = (ptr: number) => {
    expect(live.delete(ptr)).toBe(true);
    free(ptr);
  };
  try {
    run();
    expect(live.size).toBe(0);
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
  }
  return sizes;
}

const clock = {
  path: "audit-two-partition.tsc",
  bytes: fs.readFileSync(
    new URL(
      "../../py-parity-checking/fixtures/kernels/audit-two-partition.tsc",
      import.meta.url,
    ),
  ),
};
const sc = -12345;
const calls: {
  name: string;
  sizes: number[];
  invoke: (api: TimeApi) => unknown;
  expected: unknown;
}[] = [
  {
    name: "sce2t",
    sizes: [2048, 8],
    invoke: (api) => api.sce2t(sc, 1.25),
    expected: 320,
  },
  {
    name: "scfmt",
    sizes: [2048, 2048],
    invoke: (api) => api.scfmt(sc, 258),
    expected: "000001.002",
  },
  {
    name: "scpart",
    sizes: [2048, 4, 9999 * 8, 9999 * 8],
    invoke: (api) => api.scpart(sc),
    expected: { pstart: [0, 1024], pstop: [1023, 4095] },
  },
  {
    name: "sctiks",
    sizes: [2048, 4, 8],
    invoke: (api) => api.sctiks(sc, "1:2"),
    expected: 258,
  },
];
for (const test of calls) {
  for (let failAt = 0; failAt <= test.sizes.length; failAt++) {
    it(`${test.name} releases actual buffers at allocation ${failAt || "success"} and reuses the clock`, async () => {
      const module = await actualModule();
      const kernels = createKernelsApi(module, createWasmFs(module));
      const api = createTimeApi(module, "CSPICE_N0067");
      try {
        kernels.furnsh(clock);
        const sizes = allocations(module, failAt, () => {
          if (failAt)
            expect(() => test.invoke(api)).toThrow(/WASM malloc failed/);
          else expect(test.invoke(api)).toEqual(test.expected);
        });
        expect(sizes).toEqual(test.sizes.slice(0, failAt || test.sizes.length));
        expect(test.invoke(api)).toEqual(test.expected);
      } finally {
        kernels.kclear();
      }
    });
  }
}

it("releases real diagnostic temporaries and bounds large requested clock output storage", async () => {
  const module = await actualModule();
  const kernels = createKernelsApi(module, createWasmFs(module));
  const api = createTimeApi(module, "CSPICE_N0067");
  try {
    kernels.furnsh(clock);
    const large = allocations(module, 0, () =>
      expect(api.scfmt(sc, 258, 2147483647)).toBe("000001.002"),
    );
    expect(large).toEqual([2048, 3100]);
    for (const logical of [10, 0, -3]) {
      const sizes = allocations(module, 0, () =>
        expect(() => api.scfmt(sc, 258, logical)).toThrow(
          logical === 10 ? /SCLKTRUNCATED/ : /STRINGTOOSHORT/,
        ),
      );
      expect(sizes.slice(0, 2)).toEqual([2048, Math.max(1, logical)]);
      // Structured toolkit error extraction has separate short/long/trace buffers.
      expect(sizes).toHaveLength(5);
      expect(api.scfmt(sc, 258, 11)).toBe("000001.002");
    }
  } finally {
    kernels.kclear();
  }
});

it("rejects unrepresentable scalar arguments and C strings before WASM allocation", async () => {
  const module = await actualModule(),
    api = createTimeApi(module, "CSPICE_N0067");
  const sizes = allocations(module, 0, () => {
    for (const id of [-2147483648, 2147483648, 1.5, Infinity]) {
      for (const call of [
        () => api.sce2t(id, 0),
        () => api.scfmt(id, 0),
        () => api.scpart(id),
        () => api.sctiks(id, "0"),
      ]) {
        expect(call).toThrow();
      }
    }
    for (const nonfinite of [NaN, Infinity, -Infinity]) {
      expect(() => api.sce2t(sc, nonfinite)).toThrow();
      expect(() => api.scfmt(sc, nonfinite)).toThrow();
    }
    for (const length of [1.5, 2147483648, NaN])
      expect(() => api.scfmt(sc, 0, length)).toThrow();
    for (const text of ["1\0:2", "\ud800", "\udfff"])
      expect(() => api.sctiks(sc, text)).toThrow();
  });
  expect(sizes).toEqual([]);
});
