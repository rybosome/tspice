import { describe, expect, it, vi } from "vitest";
import type { KernelPoolApi } from "@rybosome/tspice-backend-contract";
import { createKernelPoolApi } from "../src/domains/kernel-pool.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

const calls: {
  name: string;
  sizes: number[];
  invoke(api: KernelPoolApi): unknown;
}[] = [
  {
    name: "badkpv",
    sizes: [2048, 4, 2, 2, 4],
    invoke: (a) => a.badkpv("APP", "N", "=", 1, 1, "N"),
  },
  {
    name: "bodvcd",
    sizes: [2048, 2, 4, 24],
    invoke: (a) => a.bodvcd(399, "X", 3),
  },
  {
    name: "bodvrd",
    sizes: [2048, 6, 2, 4, 24],
    invoke: (a) => a.bodvrd("EARTH", "X", 3),
  },
  { name: "clpool", sizes: [2048], invoke: (a) => a.clpool() },
  { name: "dvpool", sizes: [2048, 2], invoke: (a) => a.dvpool("X") },
  { name: "ldpool", sizes: [2048, 15], invoke: (a) => a.ldpool("p.tpc") },
  { name: "lmpool", sizes: [2048, 12], invoke: (a) => a.lmpool(["N = 1", ""]) },
  {
    name: "stpool",
    sizes: [2048, 2, 2, 16, 4, 4],
    invoke: (a) => a.stpool("X", 0, "+", 16),
  },
  { name: "szpool", sizes: [2048, 7, 4, 4], invoke: (a) => a.szpool("MAXVAL") },
];

describe("kernel-pool operation storage", () => {
  for (const call of calls) {
    for (let i = 0; i < call.sizes.length; i++) {
      it(`restores allocations when ${call.name} buffer ${i + 1} fails`, () => {
        const allocated: number[] = [],
          released: number[] = [];
        const module = {
          _malloc: (size: number) => {
            allocated.push(size);
            return allocated.length === i + 1 ? 0 : allocated.length * 8;
          },
          _free: (ptr: number) => released.push(ptr),
        } as EmscriptenModule;
        expect(() => call.invoke(createKernelPoolApi(module))).toThrow(
          /malloc failed/,
        );
        expect(allocated).toEqual(call.sizes.slice(0, i + 1));
        expect(released).toEqual(
          Array.from({ length: i }, (_, j) => (i - j) * 8),
        );
      });
    }
  }
  it("preserves a staged virtual file and releases a private byte file on bridge failure", () => {
    let temp = "";
    const create = vi.fn((p: string) => {
      temp = p;
    });
    const writeFile = vi.fn(),
      unlink = vi.fn();
    const module = {
      FS: { create, writeFile, unlink },
      _malloc: () => 0,
    } as EmscriptenModule;
    const api = createKernelPoolApi(module);
    expect(() =>
      api.ldpool({ path: "p.tpc", bytes: new Uint8Array([1, 2]) }),
    ).toThrow(/malloc failed/);
    expect(temp).toMatch(/^\/tmp\//);
    expect(writeFile).toHaveBeenCalledWith(temp, new Uint8Array([1, 2]));
    expect(unlink).toHaveBeenCalledWith(temp);
  });
  it("fails before row access for unrepresentable rectangular allocations", () => {
    const arr = new Proxy<string[]>([], {
      get: (_t, k) => {
        if (k === "length") return 134217729;
        throw new Error("unexpected row read");
      },
    });
    const api = createKernelPoolApi({} as EmscriptenModule);
    expect(() => api.lmpool(arr)).toThrow(/table is too large/);
  });
  it("uses the scientific presence flag, decodes strict bytes and recovers after a byte-split result", async () => {
    const { raw } = await createWasmBackend();
    expect(() => raw.ldpool("   ")).toThrow(/FILEOPENFAILED/);
    try {
      raw.pcpool("B05_TEXT", ["é+", "x"]);
      expect(raw.stpool("B05_TEXT", 0, "+", 4)).toEqual({
        found: true,
        nthstr: "éx",
        size: 3,
      });
      expect(() => raw.stpool("B05_TEXT", 0, "+", 2)).toThrow();
      expect(raw.stpool("B05_TEXT", 0, "+", 3)).toEqual({
        found: true,
        nthstr: "é",
        size: 3,
      });
      expect(raw.stpool("B05_TEXT", 2147483647, "+", 3)).toEqual({
        found: false,
      });
    } finally {
      raw.dvpool("B05_TEXT");
    }
  });
});
