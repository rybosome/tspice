import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createTimeApi } from "../src/domains/time.js";
import {
  assertEmscriptenModule,
  type EmscriptenModule,
} from "../src/lowlevel/exports.js";
import { tspiceCall1Path } from "../src/codec/calls.js";
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
function track<T>(module: EmscriptenModule, failAt: number, action: () => T) {
  const warm = module._malloc(8);
  module._free(warm);
  const malloc = module._malloc,
    free = module._free;
  const live = new Set<number>(),
    sizes: number[] = [];
  module._malloc = (size) => {
    sizes.push(size);
    if (sizes.length === failAt) return 0;
    const p = malloc(size);
    if (p) live.add(p);
    return p;
  };
  module._free = (p) => {
    expect(live.delete(p)).toBe(true);
    free(p);
  };
  try {
    return { result: action(), sizes };
  } finally {
    module._malloc = malloc;
    module._free = free;
    const leaked = live.size;
    for (const p of live) free(p);
    expect(leaked).toBe(0);
  }
}

const lsk = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/naif0012.tls",
    import.meta.url,
  ),
);
async function setup() {
  const module = await actualModule(),
    api = createTimeApi(module, "N0067");
  module.FS.mkdirTree("/kernels");
  module.FS.writeFile("/kernels/time.tls", lsk);
  tspiceCall1Path(
    module,
    (path, err, cap) => module._tspice_furnsh(path, err, cap),
    "/kernels/time.tls",
  );
  return { module, api };
}
const calls = [
  ["etcal", 2, (api: ReturnType<typeof createTimeApi>) => api.etcal(0)],
  [
    "utc2et",
    3,
    (api: ReturnType<typeof createTimeApi>) => api.utc2et("2000 JAN 01"),
  ],
  ["tparch", 2, (api: ReturnType<typeof createTimeApi>) => api.tparch("YES")],
  ["tsetyr", 1, (api: ReturnType<typeof createTimeApi>) => api.tsetyr(1980)],
  [
    "et2lst",
    5,
    (api: ReturnType<typeof createTimeApi>) =>
      api.et2lst(0, 10, 0, "PLANETOCENTRIC"),
  ],
] as const;
for (const [name, count, call] of calls) {
  for (let fail = 1; fail <= count; fail++)
    it(
      name + " releases all earlier buffers when allocation " + fail + " fails",
      async () => {
        const { module, api } = await setup();
        expect(() => track<unknown>(module, fail, () => call(api))).toThrow(
          /WASM malloc failed/,
        );
        expect(() => call(api)).not.toThrow();
      },
    );
  it(name + " succeeds without retaining any heap allocation", async () => {
    const { module, api } = await setup();
    expect(track<unknown>(module, 0, () => call(api)).sizes).toHaveLength(
      count,
    );
  });
}
it("bounds huge requested capacities, cleans error buffers and recovers in the same module", async () => {
  const { module, api } = await setup();
  expect(track(module, 0, () => api.etcal(0, 2147483647)).sizes).toEqual([
    181, 2048,
  ]);
  const result = track(module, 0, () =>
    api.et2lst(0, 10, 0, "PLANETOCENTRIC", 2147483647, 2147483647),
  );
  expect(result.sizes).toEqual([15, 12, 9, 14, 2048]);
  result.result.hr = 9;
  expect(
    track(module, 0, () => api.et2lst(0, 10, 0, "PLANETOCENTRIC", 4, 5)).result,
  ).toEqual({ hr: 12, mn: 0, sc: 0, time: "12:", ampm: "12:0" });
  expect(() =>
    track(module, 0, () => api.et2lst(0, 10, 0, "PLANETOGRAPHIC")),
  ).toThrow(expect.objectContaining({ spiceShort: "SPICE(MISSINGDATA)" }));
  expect(() => track(module, 0, () => api.utc2et("JD 99999999999"))).toThrow(
    /calendar integer arithmetic/,
  );
  expect(api.utc2et("2000 JAN 01 12:00")).toBeGreaterThan(64);
});
it("detects malformed inputs and excessive parser windows before allocation", async () => {
  const { module, api } = await setup();
  expect(
    track(module, 0, () => {
      expect(() => api.et2lst(0, 10, 0, "a\0b")).toThrow(/NUL/);
      expect(() => api.tparch("\ud800")).toThrow(/surrogate/);
      expect(() => api.tsetyr(5851356)).toThrow(/calendar integer range/);
    }).sizes,
  ).toEqual([]);
});
