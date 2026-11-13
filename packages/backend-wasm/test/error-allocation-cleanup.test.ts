import { describe, expect, it } from "vitest";
import type { ErrorApi } from "@rybosome/tspice-backend-contract";
import { createErrorApi } from "../src/domains/error.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";

const calls: {
  name: string;
  allocations: number;
  invoke(api: ErrorApi): unknown;
}[] = [
  { name: "failed", allocations: 2, invoke: (api) => api.failed() },
  { name: "reset", allocations: 1, invoke: (api) => api.reset() },
  { name: "getmsg", allocations: 3, invoke: (api) => api.getmsg("LONG") },
  { name: "setmsg", allocations: 2, invoke: (api) => api.setmsg("prepared") },
  {
    name: "sigerr",
    allocations: 2,
    invoke: (api) => api.sigerr("SPICE(TEST)"),
  },
  { name: "chkin", allocations: 2, invoke: (api) => api.chkin("TEST") },
  { name: "chkout", allocations: 2, invoke: (api) => api.chkout("TEST") },
];

describe("error utility allocation rollback", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++) {
      it(`${call.name} rolls back when allocation ${failAt} fails`, () => {
        let allocated = 0;
        const freed: number[] = [];
        const stub = {
          _malloc: () => (++allocated === failAt ? 0 : allocated * 2048),
          _free: (ptr: number) => freed.push(ptr),
          HEAPU8: new Uint8Array(16384),
        };
        // A contained allocation-only fixture: entering any compiled routine fails.
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
        expect(() => call.invoke(createErrorApi(module))).toThrow(
          /WASM malloc failed/,
        );
        expect(freed).toEqual(
          Array.from({ length: failAt - 1 }, (_, i) => (failAt - 1 - i) * 2048),
        );
      });
    }
});
