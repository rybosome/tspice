import { describe, expect, it } from "vitest";
import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { createTimeApi, getToolkitVersion } from "../src/domains/time.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
const calls: {
  name: string;
  allocations: number;
  invoke(api: TimeApi): unknown;
}[] = [
  {
    name: "str2et",
    allocations: 3,
    invoke: (api) => api.str2et("2000 JAN 1 TDB"),
  },
  {
    name: "timout",
    allocations: 3,
    invoke: (api) => api.timout(1.25, "YYYY ::TDB"),
  },
  { name: "tparse", allocations: 3, invoke: (api) => api.tparse("2000 JAN 1") },
  {
    name: "tpictr",
    allocations: 4,
    invoke: (api) => api.tpictr("24 Mar 2018 16:23:00 UTC", "X"),
  },
  {
    name: "timdef GET",
    allocations: 3,
    invoke: (api) => api.timdef("GET", "SYSTEM"),
  },
  {
    name: "timdef SET",
    allocations: 3,
    invoke: (api) => api.timdef("SET", "SYSTEM", "TDB"),
  },
  {
    name: "unitim",
    allocations: 4,
    invoke: (api) => api.unitim(1.25, "ET", "TAI"),
  },
];
describe("time parsing/formatting allocation rollback", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++)
      it(`${call.name}: allocation ${failAt}`, () => {
        let count = 0;
        const live = new Set<number>();
        const stub = {
          HEAPU8: new Uint8Array(8192),
          _malloc: () => {
            const ptr = ++count * 64;
            if (count === failAt) return 0;
            live.add(ptr);
            return ptr;
          },
          _free: (ptr: number) => {
            expect(live.delete(ptr)).toBe(true);
          },
        };
        // Allocation/string-write-only mock: unexpected compiled calls or result
        // heap access fail rather than supplying synthetic CSPICE values.
        const module = new Proxy(stub, {
          get(target, key) {
            if (key === "HEAPU8" || key === "_malloc" || key === "_free")
              return target[key];
            throw new Error(`Unexpected module access: ${String(key)}`);
          },
        }) as EmscriptenModule;
        expect(() =>
          call.invoke(createTimeApi(module, "TEST_VERSION")),
        ).toThrow(/WASM malloc failed/);
        expect(live.size).toBe(0);
      });
  for (const failAt of [1, 2])
    it(`version initialization: allocation ${failAt}`, () => {
      let count = 0;
      const live = new Set<number>();
      const module = {
        _malloc: () => {
          const ptr = ++count * 64;
          if (count === failAt) return 0;
          live.add(ptr);
          return ptr;
        },
        _free: (ptr: number) => {
          expect(live.delete(ptr)).toBe(true);
        },
      } as EmscriptenModule;
      expect(() => getToolkitVersion(module)).toThrow(/WASM malloc failed/);
      expect(live.size).toBe(0);
    });
  it("caches the version obtained from each module rather than a hard-coded toolkit string", () => {
    for (const version of ["MODULE_A", "MODULE_B"]) {
      const bytes = new Uint8Array(4096);
      let count = 0;
      let calls = 0;
      const module = {
        _malloc: () => ++count * 512,
        _free: () => undefined,
        _tspice_tkvrsn_toolkit: (out: number) => {
          calls++;
          bytes.set(new TextEncoder().encode(version + "\0"), out);
          return 0;
        },
        UTF8ToString: (out: number) =>
          new TextDecoder().decode(bytes.subarray(out, bytes.indexOf(0, out))),
      } as EmscriptenModule;
      const api = createTimeApi(module, getToolkitVersion(module));
      expect(api.tkvrsn("TOOLKIT")).toBe(version);
      expect(api.tkvrsn("TOOLKIT")).toBe(version);
      expect(calls).toBe(1);
      expect(() => api.tkvrsn("KERNEL" as never)).toThrow(/Unsupported/);
    }
  });
});
