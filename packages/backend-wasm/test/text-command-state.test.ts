import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createFileIoApi } from "../src/domains/file-io.js";
import { createSpiceHandleRegistry } from "@rybosome/tspice-core";
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

describe("text reader and command actual WASM heap ownership", () => {
  for (const [routine, count] of [
    ["rdtext", 6],
    ["putcml", 3],
  ] as const) {
    for (let ordinal = 1; ordinal <= count; ordinal++)
      it(routine + " allocation " + ordinal, async () => {
        const m = await actualModule(),
          api = createFileIoApi(m, createSpiceHandleRegistry());
        const warm = m._malloc(1);
        m._free(warm);
        const allocate = m._malloc,
          release = m._free,
          live = new Set<number>();
        let allocations = 0;
        m._malloc = (bytes) => {
          if (++allocations === ordinal) return 0;
          const ptr = allocate(bytes);
          if (ptr) live.add(ptr);
          return ptr;
        };
        m._free = (ptr) => {
          expect(live.delete(ptr)).toBe(true);
          release(ptr);
        };
        const read = () =>
          api.rdtext({ path: "owned", bytes: Uint8Array.of(65, 10) }, 8);
        const run = () =>
          routine === "rdtext" ? read() : api.putcml(["program", ""]);
        try {
          expect(run).toThrow(/WASM malloc failed/);
          expect(live.size).toBe(0);
        } finally {
          m._malloc = allocate;
          m._free = release;
        }
        if (routine === "rdtext") {
          expect(read()).toEqual({ line: "A", eof: false });
          expect(read()).toEqual({ line: "", eof: true });
        } else {
          expect(run()).toBeUndefined();
          expect(run).toThrow(/PUTCMLCALLEDTWICE/);
        }
      });
  }
  it("frees temporary and diagnostic buffers after real CSPICE errors", async () => {
    const m = await actualModule(),
      api = createFileIoApi(m, createSpiceHandleRegistry());
    const warm = m._malloc(1);
    m._free(warm);
    const allocate = m._malloc,
      release = m._free,
      live = new Set<number>();
    m._malloc = (bytes) => {
      const ptr = allocate(bytes);
      if (ptr) live.add(ptr);
      return ptr;
    };
    m._free = (ptr) => {
      expect(live.delete(ptr)).toBe(true);
      release(ptr);
    };
    try {
      expect(() => api.rdtext("", 0)).toThrow(/EMPTYSTRING/);
      expect(api.putcml(["a"])).toBeUndefined();
      expect(() => api.putcml(["b"])).toThrow(/PUTCMLCALLEDTWICE/);
      expect(live.size).toBe(0);
      expect(api.rdtext({ path: "empty", bytes: new Uint8Array() })).toEqual({
        eof: true,
        line: "",
      });
      expect(live.size).toBe(0);
    } finally {
      m._malloc = allocate;
      m._free = release;
    }
  });
});
