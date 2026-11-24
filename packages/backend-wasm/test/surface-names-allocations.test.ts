import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { IdsNamesApi } from "@rybosome/tspice-backend-contract";
import { createIdsNamesApi } from "../src/domains/ids-names.js";
import { createKernelPoolApi } from "../src/domains/kernel-pool.js";
import {
  assertEmscriptenModule,
  type EmscriptenModule,
} from "../src/lowlevel/exports.js";

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
  const pending: unknown = Reflect.apply(factory, undefined, [
    {
      wasmBinary: fs.readFileSync(new URL("tspice_backend_wasm.wasm", assets)),
      locateFile: (file: string) => fileURLToPath(new URL(file, assets)),
    },
  ]);
  const module = await pending;
  assertEmscriptenModule(module);
  return module;
}

const cases: readonly {
  name: string;
  sizes: readonly number[];
  invoke: (api: IdsNamesApi) => unknown;
  result: unknown;
}[] = [
  {
    name: "srfc2s",
    sizes: [37, 4, 2048],
    invoke: (api) => api.srfc2s(-17, 399, 2147483647),
    result: { surface: "-17", isName: false },
  },
  {
    name: "srfcss",
    sizes: [6, 3, 4, 2048],
    invoke: (api) => api.srfcss(827, "EARTH", 3),
    result: { surface: "82", isName: false },
  },
  {
    name: "srfs2c",
    sizes: [5, 6, 4, 4, 2048],
    invoke: (api) => api.srfs2c(" €", "EARTH"),
    result: { found: false },
  },
  {
    name: "srfscc",
    sizes: [4, 4, 4, 2048],
    invoke: (api) => api.srfscc("-17", 399),
    result: { found: true, code: -17 },
  },
];

function trackAllocations(
  module: EmscriptenModule,
  failAt: number,
  run: () => void,
) {
  // Resolve Emscripten's lazy malloc/free exports before replacing them.
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const live = new Set<number>();
  const sizes: number[] = [];
  let unknownFree = false;
  module._malloc = (size: number) => {
    sizes.push(size);
    if (sizes.length === failAt) return 0;
    const pointer = malloc(size);
    if (pointer) live.add(pointer);
    return pointer;
  };
  module._free = (pointer: number) => {
    if (!live.delete(pointer)) {
      unknownFree = true;
      return;
    }
    free(pointer);
  };
  try {
    run();
    expect(unknownFree).toBe(false);
    expect(live.size).toBe(0);
  } finally {
    module._malloc = malloc;
    module._free = free;
    for (const ptr of live) free(ptr);
  }
  return sizes;
}

describe.each(cases)("$name actual WASM allocation boundaries", (spec) => {
  for (let failAt = 0; failAt <= spec.sizes.length; failAt++) {
    it(
      failAt
        ? `recovers when allocation ${failAt} fails`
        : "uses bounded buffers for a complete output",
      async () => {
        const module = await actualModule();
        const api = createIdsNamesApi(module);
        // Warm the scientific export and CSPICE's per-instance caches.
        expect(spec.invoke(api)).toEqual(spec.result);
        const sizes = trackAllocations(module, failAt, () => {
          if (failAt) expect(() => spec.invoke(api)).toThrow(/malloc failed/);
          else expect(spec.invoke(api)).toEqual(spec.result);
        });
        expect(sizes).toEqual(
          failAt ? spec.sizes.slice(0, failAt) : spec.sizes,
        );
        expect(spec.invoke(api)).toEqual(spec.result);
      },
    );
  }
});

describe("surface text and errors on the actual WASM heap", () => {
  it("keeps genuine too-small logical lengths with non-NULL physical storage and frees diagnostic allocations", async () => {
    const module = await actualModule(),
      api = createIdsNamesApi(module);
    for (const length of [-2147483648, 0, 1]) {
      for (const invoke of [
        () => api.srfc2s(-17, 399, length),
        () => api.srfcss(-17, "EARTH", length),
      ]) {
        const sizes = trackAllocations(module, 0, () =>
          expect(invoke).toThrow(/STRINGTOOSHORT/),
        );
        expect(sizes).toContain(1);
        expect(sizes.filter((size) => size === 2048).length).toBeGreaterThan(1);
        for (let failAt = 1; failAt <= sizes.length; failAt++) {
          trackAllocations(module, failAt, () =>
            expect(invoke).toThrow(/malloc failed/),
          );
        }
        expect(api.srfc2s(-17, 399)).toEqual({ surface: "-17", isName: false });
      }
    }
  });
  it("retains a decimal spelling with either flag, rejects partial UTF-8 and recovers", async () => {
    const module = await actualModule(),
      api = createIdsNamesApi(module),
      pool = createKernelPoolApi(module);
    pool.pcpool("NAIF_SURFACE_NAME", ["MiXé", "-17"]);
    pool.pipool("NAIF_SURFACE_CODE", [517, 518]);
    pool.pipool("NAIF_SURFACE_BODY", [399, 399]);
    for (const call of [
      (id: number, len: number) => api.srfc2s(id, 399, len),
      (id: number, len: number) => api.srfcss(id, "EARTH", len),
    ]) {
      expect(call(-17, 37)).toEqual({ surface: "-17", isName: false });
      expect(call(518, 37)).toEqual({ surface: "-17", isName: true });
      expect(call(517, 4)).toEqual({ surface: "MiX", isName: true });
      trackAllocations(module, 0, () =>
        expect(() => call(517, 5)).toThrow(TypeError),
      );
      expect(call(517, 6)).toEqual({ surface: "MiXé", isName: true });
    }
    expect(api.srfs2c("-17", "EARTH")).toEqual({ found: true, code: 518 });
    expect(api.srfscc("unknown", 399)).toEqual({ found: false });
  });
  it("guards the mapped surface-ID hash range, frees error buffers and reuses the same heap after replacement", async () => {
    const module = await actualModule(),
      api = createIdsNamesApi(module),
      pool = createKernelPoolApi(module);
    pool.pcpool("NAIF_SURFACE_NAME", ["Guard test"]);
    pool.pipool("NAIF_SURFACE_BODY", [399]);
    pool.pdpool("NAIF_SURFACE_CODE", [-2147483647.75]);
    for (const call of [
      () => api.srfc2s(517, 399),
      () => api.srfcss(517, "EARTH"),
      () => api.srfs2c("Guard test", "EARTH"),
      () => api.srfscc("Guard test", 399),
    ]) {
      trackAllocations(module, 0, () =>
        expect(call).toThrow(/surface hash range/),
      );
    }
    pool.pipool("NAIF_SURFACE_CODE", [517]);
    expect(api.srfc2s(517, 399)).toEqual({
      surface: "Guard test",
      isName: true,
    });
    expect(api.srfs2c("Guard test", "EARTH")).toEqual({
      found: true,
      code: 517,
    });
    expect(api.srfs2c("-2147483648", "EARTH")).toEqual({
      found: true,
      code: -2147483648,
    });
  });

  it("rejects invalid integers and text at every argument position before WASM allocation", async () => {
    const module = await actualModule(),
      api = createIdsNamesApi(module);
    const calls: readonly (() => unknown)[] = [
      () => api.srfc2s(-2147483648, 399),
      () => api.srfcss(-2147483648, "EARTH"),
      () => api.srfc2s(2147483648, 399),
      () => api.srfc2s(1, 0.5),
      () => api.srfc2s(1, 399, NaN),
      () => api.srfcss(Infinity, "EARTH"),
      () => api.srfcss(1, "x\0y"),
      () => api.srfcss(1, "EARTH", 2147483648),
      () => api.srfs2c("\ud800", "EARTH"),
      () => api.srfs2c("X", "\udfff"),
      () => api.srfscc("X\0Y", 399),
      () => api.srfscc("X", -2147483649),
    ];
    expect(
      trackAllocations(module, 0, () => {
        for (const call of calls) expect(call).toThrow();
      }),
    ).toEqual([]);
  });
});
