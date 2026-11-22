import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
import type { FileIoApi, SpiceHandle } from "@rybosome/tspice-backend-contract";
import { assertEmscriptenModule } from "../src/lowlevel/exports.js";
import { createFileIoApi, createFileIoKitApi } from "../src/domains/file-io.js";
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
const output = { kind: "virtual-output", path: "c04.das" } as const;
type Op = {
  name: string;
  bytes: number[];
  start?: "open" | "closed";
  opens?: boolean;
  closes?: boolean;
  run: (api: FileIoApi, h: SpiceHandle) => unknown;
};
const operations: Op[] = [
  {
    name: "dasonw",
    bytes: [2048, 17, 5, 5, 4],
    opens: true,
    run: (a) => a.dasonw(output, "abcd", "name", 0),
  },
  { name: "dasops", bytes: [2048, 4], opens: true, run: (a) => a.dasops() },
  {
    name: "dasopw",
    bytes: [2048, 17, 4],
    start: "closed",
    opens: true,
    run: (a) => a.dasopw(output),
  },
  {
    name: "dashfn",
    bytes: [2048, 256],
    start: "open",
    run: (a, h) => a.dashfn(h),
  },
  {
    name: "dashfs",
    bytes: [2048, 56],
    start: "open",
    run: (a, h) => a.dashfs(h),
  },
  {
    name: "daslla",
    bytes: [2048, 12],
    start: "open",
    run: (a, h) => a.daslla(h),
  },
  {
    name: "dasllc",
    bytes: [2048],
    start: "open",
    closes: true,
    run: (a, h) => a.dasllc(h),
  },
  {
    name: "dasrfr",
    bytes: [2048, 9, 61, 16],
    start: "open",
    run: (a, h) => a.dasrfr(h),
  },
  { name: "daswbr", bytes: [2048], start: "open", run: (a, h) => a.daswbr(h) },
];
for (const spec of operations)
  for (let fail = 0; fail <= spec.bytes.length; fail++) {
    it(
      spec.name +
        " preserves ownership and frees all acquired bytes at allocation " +
        fail,
      async () => {
        const m = await actualModule(),
          owner = createSpiceHandleRegistry(),
          outputs = createVirtualOutputRegistry(),
          api = createFileIoApi(m, owner, outputs);
        // The operation closures for opens never consume this placeholder.
        let h: SpiceHandle = 0 as SpiceHandle;
        if (spec.start) {
          h = api.dasonw(output, "abcd", "name", 0);
          if (spec.start === "closed") api.dasllc(h);
        }
        const malloc = m._malloc,
          free = m._free,
          live = new Set<number>(),
          sizes: number[] = [];
        m._malloc = (n) => {
          sizes.push(n);
          if (fail === sizes.length) return 0;
          const p = malloc(n);
          if (p) live.add(p);
          return p;
        };
        m._free = (p) => {
          expect(live.delete(p)).toBe(true);
          free(p);
        };
        let result: unknown;
        try {
          if (fail) expect(() => spec.run(api, h)).toThrow(/malloc failed/);
          else result = spec.run(api, h);
          expect(sizes).toEqual(fail ? spec.bytes.slice(0, fail) : spec.bytes);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = malloc;
          m._free = free;
          for (const p of live) free(p);
        }
        if (fail) result = spec.run(api, h);
        if (spec.opens) {
          expect(typeof result).toBe("number");
          api.dasllc(result as SpiceHandle);
        } else if (!spec.closes) api.dasllc(h);
        expect(owner.size()).toBe(0);
      },
    );
  }
it("retains output namespace and prevents readback during either string or VirtualOutput reopen", async () => {
  const m = await actualModule(),
    owner = createSpiceHandleRegistry(),
    o = createVirtualOutputRegistry(),
    api = createFileIoApi(m, owner, o),
    kit = createFileIoKitApi(m, o);
  const h = api.dasonw(output, "test", "N", 0);
  expect(() => kit.readVirtualOutput(output)).toThrow(/open/);
  api.dascls(h);
  const bytes = kit.readVirtualOutput(output);
  expect(bytes.length).toBeGreaterThanOrEqual(2048);
  m.FS.writeFile("/kernels/only-input.das", bytes);
  expect(() =>
    api.dasopw({ kind: "virtual-output", path: "only-input.das" }),
  ).toThrow(/created/);
  const reader = api.dasopr("only-input.das");
  try {
    expect(() => api.daswbr(reader)).toThrow(/SPICE/);
    expect(api.dashfs(reader).free).toBe(3);
  } finally {
    api.dascls(reader);
  }
  const w = api.dasopw("/kernels/c04.das");
  try {
    expect(() => kit.readVirtualOutput(output)).toThrow(/open/);
    expect(api.dasrfr(w).idword).toBe("DAS/test");
  } finally {
    api.dasllc(w);
  }
  expect(kit.readVirtualOutput(output)).toEqual(bytes);
});
it("rejects unsafe wasm32 seek bounds without creating a file and recovers", async () => {
  const m = await actualModule(),
    owner = createSpiceHandleRegistry(),
    api = createFileIoApi(m, owner);
  expect(() => api.dasonw("large.das", "test", "N", 2097150)).toThrow(
    /addressable/,
  );
  expect(owner.size()).toBe(0);
  const file = api.dasonw("large.das", "test", "N", 0);
  api.dascls(file);
});
