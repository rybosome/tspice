import { describe, expect, it } from "vitest";
import type { KernelPoolApi } from "@rybosome/tspice-backend-contract";
import { createKernelPoolApi } from "../src/domains/kernel-pool.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";

const calls: {
  name: string;
  allocations: number;
  invoke(api: KernelPoolApi): unknown;
}[] = [
  ...(["gdpool", "gipool", "gcpool", "gnpool"] as const).map((name) => ({
    name,
    allocations: 5,
    invoke: (api: KernelPoolApi) => api[name]("AUDIT", 0, 2),
  })),
  { name: "dtpool", allocations: 5, invoke: (api) => api.dtpool("AUDIT") },
  {
    name: "pdpool",
    allocations: 3,
    invoke: (api) => api.pdpool("AUDIT", [1.25]),
  },
  { name: "pipool", allocations: 3, invoke: (api) => api.pipool("AUDIT", [7]) },
  {
    name: "pcpool",
    allocations: 3,
    invoke: (api) => api.pcpool("AUDIT", ["  leading", ""]),
  },
  {
    name: "swpool",
    allocations: 3,
    invoke: (api) => api.swpool("AGENT", ["AUDIT"]),
  },
  { name: "cvpool", allocations: 3, invoke: (api) => api.cvpool("AGENT") },
  { name: "expool", allocations: 3, invoke: (api) => api.expool("AUDIT") },
];

describe("kernel-pool allocation rollback", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++) {
      it(`${call.name} releases earlier buffers when allocation ${failAt} fails`, () => {
        let allocations = 0;
        const freed: number[] = [];
        const stub = {
          _malloc: () => (++allocations === failAt ? 0 : allocations * 8),
          _free: (ptr: number) => freed.push(ptr),
          HEAPU8: new Uint8Array(4096),
        };
        // This allocation-only mock allows the first input string write. Any
        // unexpected compiled call or result heap access fails the regression.
        const module = new Proxy(stub, {
          get(target, property) {
            if (
              property === "_malloc" ||
              property === "_free" ||
              property === "HEAPU8"
            )
              return target[property];
            throw new Error(`Unexpected module access: ${String(property)}`);
          },
        }) as EmscriptenModule;
        expect(() => call.invoke(createKernelPoolApi(module))).toThrow(
          /WASM malloc failed/,
        );
        expect(freed).toEqual(
          Array.from({ length: failAt - 1 }, (_, i) => (failAt - 1 - i) * 8),
        );
      });
    }
});
