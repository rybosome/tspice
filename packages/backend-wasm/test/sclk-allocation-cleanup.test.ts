import { describe, expect, it } from "vitest";
import type { TimeApi } from "@rybosome/tspice-backend-contract";
import { createTimeApi } from "../src/domains/time.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
const calls: {
  name: string;
  allocations: number;
  invoke(api: TimeApi): unknown;
}[] = [
  {
    name: "et2utc",
    allocations: 3,
    invoke: (api) => api.et2utc(1.25, "ISOC", 3),
  },
  { name: "deltet", allocations: 3, invoke: (api) => api.deltet(1.25, "ET") },
  {
    name: "scencd",
    allocations: 3,
    invoke: (api) => api.scencd(-12345, "1/0:0"),
  },
  {
    name: "scs2e",
    allocations: 3,
    invoke: (api) => api.scs2e(-12345, "1/0:0"),
  },
  { name: "scdecd", allocations: 2, invoke: (api) => api.scdecd(-12345, 1.25) },
  { name: "sce2c", allocations: 2, invoke: (api) => api.sce2c(-12345, 1.25) },
  { name: "sce2s", allocations: 2, invoke: (api) => api.sce2s(-12345, 1.25) },
  { name: "sct2e", allocations: 2, invoke: (api) => api.sct2e(-12345, 1.25) },
];
describe("UTC/SCLK allocation rollback", () => {
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
        // Allocation/string-write-only mock: semantic parity always uses the actual
        // compiled backend; unexpected compiled calls or result heap access fail here.
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
});
