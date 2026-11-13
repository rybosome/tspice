import { describe, expect, it } from "vitest";
import type { IdsNamesApi } from "@rybosome/tspice-backend-contract";
import { createIdsNamesApi } from "../src/domains/ids-names.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";

const calls: {
  name: string;
  allocations: number;
  invoke(api: IdsNamesApi): unknown;
}[] = [
  { name: "bodn2c", allocations: 4, invoke: (api) => api.bodn2c("EARTH") },
  { name: "bods2c", allocations: 4, invoke: (api) => api.bods2c("399") },
  { name: "bodc2n", allocations: 3, invoke: (api) => api.bodc2n(399) },
  { name: "bodc2s", allocations: 2, invoke: (api) => api.bodc2s(399) },
  {
    name: "boddef",
    allocations: 2,
    invoke: (api) => api.boddef("AUDIT", -123456),
  },
  { name: "bodfnd", allocations: 3, invoke: (api) => api.bodfnd(399, "RADII") },
  { name: "bodvar", allocations: 6, invoke: (api) => api.bodvar(399, "RADII") },
];

describe("ID/name allocation rollback", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++) {
      it(`${call.name} releases buffers when allocation ${failAt} fails`, () => {
        let allocations = 0;
        const live = new Set<number>();
        const bytes = new ArrayBuffer(8192);
        const stub = {
          _malloc: () => {
            const index = ++allocations;
            if (index === failAt) return 0;
            live.add(index * 32);
            return index * 32;
          },
          _free: (ptr: number) => {
            expect(live.delete(ptr)).toBe(true);
          },
          HEAPU8: new Uint8Array(bytes),
          HEAP32: new Int32Array(bytes),
          // Model only bodvar's dimension query. No value-producing compiled call
          // may run before the injected failure; that would fail the proxy below.
          _tspice_bodvar: (
            _body: number,
            _item: number,
            maxn: number,
            out: number,
          ) => {
            expect(maxn).toBe(0);
            new Int32Array(bytes)[out >> 2] = 3;
            return 0;
          },
        };
        // This contained mock observes ownership only, not semantic CSPICE values.
        const module = new Proxy(stub, {
          get(target, key) {
            if (
              key === "_malloc" ||
              key === "_free" ||
              key === "HEAPU8" ||
              key === "HEAP32" ||
              key === "_tspice_bodvar"
            )
              return target[key];
            if (
              key === "_tspice_bodn2c" ||
              key === "_tspice_bods2c" ||
              key === "_tspice_bodc2n"
            )
              return () => {
                throw new Error("Unexpected compiled result call");
              };
            throw new Error(`Unexpected module access: ${String(key)}`);
          },
        }) as EmscriptenModule;
        expect(() => call.invoke(createIdsNamesApi(module))).toThrow(
          /WASM malloc failed/,
        );
        expect(live.size).toBe(0);
      });
    }
});
