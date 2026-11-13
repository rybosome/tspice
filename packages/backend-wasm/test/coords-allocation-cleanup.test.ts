import { describe, expect, it } from "vitest";
import type { CoordsVectorsApi } from "@rybosome/tspice-backend-contract";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { createCoordsVectorsApi } from "../src/domains/coords-vectors.js";
import type { EmscriptenModule } from "../src/lowlevel/exports.js";

const matrix = brandMat3RowMajor([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const calls: {
  name: string;
  allocations: number;
  invoke(api: CoordsVectorsApi): unknown;
}[] = [
  { name: "reclat", allocations: 5, invoke: (api) => api.reclat([1, 2, 3]) },
  { name: "latrec", allocations: 2, invoke: (api) => api.latrec(1, 0.2, 0.3) },
  { name: "recsph", allocations: 5, invoke: (api) => api.recsph([1, 2, 3]) },
  { name: "sphrec", allocations: 2, invoke: (api) => api.sphrec(1, 0.2, 0.3) },
  { name: "mxm", allocations: 4, invoke: (api) => api.mxm(matrix, matrix) },
  { name: "mxv", allocations: 4, invoke: (api) => api.mxv(matrix, [1, 2, 3]) },
  {
    name: "mtxv",
    allocations: 4,
    invoke: (api) => api.mtxv(matrix, [1, 2, 3]),
  },
  { name: "rotate", allocations: 2, invoke: (api) => api.rotate(0.2, 1) },
  {
    name: "rotmat",
    allocations: 3,
    invoke: (api) => api.rotmat(matrix, 0.2, 1),
  },
  {
    name: "axisar",
    allocations: 3,
    invoke: (api) => api.axisar([1, 2, 3], 0.2),
  },
  {
    name: "georec",
    allocations: 2,
    invoke: (api) => api.georec(0.2, 0.3, 0.4, 1, 0),
  },
  {
    name: "recgeo",
    allocations: 5,
    invoke: (api) => api.recgeo([1, 2, 3], 1, 0),
  },
];

describe("coordinate/matrix allocation rollback", () => {
  for (const call of calls)
    for (let failAt = 1; failAt <= call.allocations; failAt++) {
      it(`${call.name} frees every earlier allocation when allocation ${failAt} fails`, () => {
        let allocated = 0;
        const freed: number[] = [];
        const stub = {
          _malloc: () => (++allocated === failAt ? 0 : allocated * 8),
          _free: (pointer: number) => freed.push(pointer),
        };
        // This contained mock only supports allocation: any unexpected entry into
        // CSPICE or heap access fails, rather than silently supplying fake results.
        const module = new Proxy(stub, {
          get(target, property) {
            if (property === "_malloc" || property === "_free")
              return target[property];
            throw new Error(
              `Unexpected module access before allocation succeeds: ${String(property)}`,
            );
          },
        }) as EmscriptenModule;
        expect(() => call.invoke(createCoordsVectorsApi(module))).toThrow(
          /WASM malloc failed/,
        );
        expect(freed).toEqual(
          Array.from(
            { length: failAt - 1 },
            (_, index) => (failAt - 1 - index) * 8,
          ),
        );
      });
    }
});
