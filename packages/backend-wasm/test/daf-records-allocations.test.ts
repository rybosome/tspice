import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import { createFileIoApi } from "../src/domains/file-io.js";
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
const fixture = fs.readFileSync(
  new URL(
    "../../py-parity-checking/fixtures/kernels/audit-two-segment.bsp",
    import.meta.url,
  ),
);
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
const sizes = {
  dafps: [8, 8, 16, 2048],
  dafus: [16, 8, 8, 2048],
  dafgsr: [16, 4, 2048],
  dafrfr: [61, 20, 2048],
  dafrda: [16, 2048],
  dafgda: [16, 2048],
} as const;
async function setup() {
  const module = await actualModule();
  module.FS.mkdirTree("/kernels");
  module.FS.writeFile("/kernels/data.bsp", fixture);
  const handles = createSpiceHandleRegistry(),
    api = createFileIoApi(module, handles),
    h = api.dafopr("data.bsp");
  const summary = api.dafps(1, 2, [-0], [123, -1]),
    header = api.dafrfr(h);
  const calls = {
    dafps: () => api.dafps(1, 2, [-0], [123, -1]),
    dafus: () => api.dafus(summary, 1, 2),
    dafgsr: () => api.dafgsr(h, header.fward, 3, 4),
    dafrfr: () => api.dafrfr(h),
    dafrda: () => api.dafrda(h, 385, 386),
    dafgda: () => api.dafgda(h, 385, 386),
  };
  return { module, api, handles, h, calls, header };
}
for (const n of Object.keys(sizes) as Array<keyof typeof sizes>) {
  for (let i = 1; i <= sizes[n].length; i++)
    it(n + " releases acquired storage on failed allocation " + i, async () => {
      const { module, api, h, calls } = await setup();
      try {
        expect(() => track<unknown>(module, i, calls[n])).toThrow(
          /WASM malloc failed/,
        );
        expect(calls[n]()).toBeDefined();
      } finally {
        api.dafcls(h);
      }
    });
  it(
    n +
      " releases its correctly sized buffers and retains an independent result",
    async () => {
      const { module, api, h, calls } = await setup();
      try {
        const { result, sizes: used } = track<unknown>(module, 0, calls[n]);
        expect(used).toEqual(sizes[n]);
        const saved = structuredClone(result);
        calls.dafgsr();
        api.dafps(5, 1, [1, 2, 3, 4, 5], [7]);
        expect(result).toEqual(saved);
      } finally {
        api.dafcls(h);
      }
    },
  );
}
it("preflights f2c seek and output caps, preserves record presence even at empty ranges and recovers native diagnostics", async () => {
  const { module, api, h, header } = await setup();
  try {
    const guard = track(module, 0, () => {
      expect(() => api.dafgsr(h, 2097153, 1, 1)).toThrow();
      expect(() => api.dafgda(h, 268435457, 268435457)).toThrow(/range/);
      expect(() => api.dafrda(h, 1, 33554433)).toThrow(/range/);
      expect(() => api.dafus(new Uint8Array(7), 0, 1)).toThrow();
      expect(() => api.dafrfr(h, -2147483648)).toThrow();
      const other = createSpiceHandleRegistry().register("DAF", 1);
      expect(() => api.dafgsr(other, 2, 1, 1)).toThrow();
    });
    expect(guard.sizes).toEqual([]);
    expect(api.dafgsr(h, header.fward, 2147483647, -2147483648)).toEqual({
      found: true,
      data: new Uint8Array(),
    });
    expect(api.dafgsr(h, 2097152, 1, 1)).toEqual({ found: false });
    expect(api.dafgda(h, 268435456, 268435456)).toEqual([0]);
    expect(() => api.dafgda(h, 0, -1)).toThrow(/DAFNEGADDR/);
    expect(() => api.dafrda(h, 4, 1)).toThrow(/DAFBEGGTEND/);
    expect(api.dafrfr(h, 1).ifname).toBe("");
  } finally {
    api.dafcls(h);
  }
});
it("copies packed byte payloads, zeros odd padding and supplies a private extra word at zero integer count", async () => {
  const { module, api, h } = await setup();
  try {
    api.dafps(0, 2, [], [7, 123456789]);
    expect([...api.dafps(0, 1, [], [1]).slice(4)]).toEqual([0, 0, 0, 0]);
    const spec = api.dafps(
      4,
      2,
      [-0, NaN, Infinity, -Infinity],
      [123456789, -1],
    );
    expect(api.dafus(spec, 4, 2)).toEqual({
      dc: [-0, NaN, Infinity, -Infinity],
      ic: [123456789, -1],
    });
    const dc = Array.from({ length: 125 }, (_, i) => i + 0.5);
    const packed = api.dafps(2147483647, 2147483647, dc, []);
    expect(packed).toHaveLength(1000);
    expect(api.dafus(packed, 2147483647, 2147483647)).toEqual({ dc, ic: [] });
    const zero = track(module, 0, () => api.dafps(-3, -1, [], []));
    expect(zero.sizes).toEqual([8, 4, 8, 2048]);
    expect(zero.result).toHaveLength(0);
    expect(api.dafus(new Uint8Array(), 0, 0)).toEqual({ dc: [], ic: [] });
  } finally {
    api.dafcls(h);
  }
});

it("rejects a non-native record whose summary count cannot fit, with owned cleanup and recovery", async () => {
  const { module, api, h } = await setup();
  try {
    const copy = fs.readFileSync(
      new URL(
        "../../py-parity-checking/fixtures/kernels/mgs_hga_hinge_v2.bc",
        import.meta.url,
      ),
    );
    module.FS.writeFile("/kernels/original.bc", copy);
    const original = api.dafopr("original.bc");
    let rec: number;
    try {
      rec = api.dafrfr(original).fward;
    } finally {
      api.dafcls(original);
    }
    copy.writeDoubleBE(127, 1024 * (rec - 1) + 16);
    module.FS.writeFile("/kernels/bad-count.bc", copy);
    const changed = api.dafopr("bad-count.bc");
    try {
      track(module, 0, () =>
        expect(() => api.dafgsr(changed, rec, 1, 3)).toThrow(
          /Invalid non-native DAF summary record count/,
        ),
      );
      expect(api.dafrfr(changed).fward).toBe(rec);
    } finally {
      api.dafcls(changed);
    }
  } finally {
    api.dafcls(h);
  }
});
