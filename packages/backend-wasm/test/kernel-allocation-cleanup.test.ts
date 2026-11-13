import { describe, expect, it } from "vitest";
import type { KernelsApi } from "@rybosome/tspice-backend-contract";
import { createKernelsApi } from "../src/domains/kernels.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";
import type { WasmFsApi } from "../src/runtime/fs.js";

const calls: {
  name: string;
  allocations: number;
  invoke(api: KernelsApi): unknown;
}[] = [
  { name: "ktotal", allocations: 3, invoke: (api) => api.ktotal("ALL") },
  { name: "kdata", allocations: 7, invoke: (api) => api.kdata(0, "ALL") },
];
describe("kernel query allocation rollback", () => {
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
        // Only allocation rollback is mocked; compiled calls must not be reached.
        const module = new Proxy(stub, {
          get(target, key) {
            if (key === "HEAPU8" || key === "_malloc" || key === "_free")
              return target[key];
            throw new Error(`Unexpected module access: ${String(key)}`);
          },
        }) as EmscriptenModule;
        expect(() =>
          call.invoke(createKernelsApi(module, {} as WasmFsApi)),
        ).toThrow(/WASM malloc failed/);
        expect(live.size).toBe(0);
      });
});
