import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const bytes = fs.readFileSync(
  new URL("../fixtures/kernels/audit-multi-dsk.bds", import.meta.url),
);
describe("actual DSK query inputs, ownership and same-instance recovery", () => {
  for (const backend of ["wasm", "node"] as const)
    it.runIf(backend === "wasm" || nodeBackendAvailable)(backend, async () => {
      const a = await spiceClients.toSync({ backend }),
        b = await spiceClients.toSync({ backend });
      const raw = a.spice.raw,
        kit = a.spice.kit;
      let local: SpiceHandle | undefined, foreign: SpiceHandle | undefined;
      const cell = kit.newIntCell(10),
        wrong = kit.newDoubleCell(3);
      const contents = () =>
        Array.from({ length: raw.card(cell) }, (_, i) => kit.cellGeti(cell, i));
      try {
        raw.furnsh({ path: "query-a.bds", bytes });
        b.spice.raw.furnsh({ path: "query-b.bds", bytes });
        local = raw.dasopr("query-a.bds");
        foreign = b.spice.raw.dasopr("query-b.bds");
        const first = raw.dlabfs(local);
        if (!first.found) throw new Error("Missing authored first DSK segment");
        const descriptor = first.descr;
        expect(raw.dskgd(local, descriptor)).toEqual({
          surfce: 71,
          center: 399,
          dclass: 2,
          dtype: 2,
          frmcde: 1,
          corsys: 3,
          corpar: new Array<number>(10).fill(0),
          co1min: 1,
          co1max: 4,
          co2min: 2,
          co2max: 6,
          co3min: 3,
          co3max: 8,
          start: 0,
          stop: 75,
        });
        expect(raw.dskb02(local, descriptor)).toMatchObject({
          nv: 4,
          np: 4,
          vtxbds: [
            [1, 4],
            [2, 6],
            [3, 8],
          ],
        });
        for (const query of [raw.dskgd, raw.dskb02]) {
          expect(() => query(foreign!, descriptor)).toThrow(
            /invalid or closed SpiceHandle/i,
          );
          for (const bad of [
            { ...descriptor, isize: -1 },
            { ...descriptor, dbase: -1 },
            { ...descriptor, dsize: 1.5 },
          ])
            expect(() => query(local!, bad)).toThrow(/expected|int32|integer/i);
          expect(() => query(local!, descriptor)).not.toThrow();
        }
        for (const bad of [399.5, 2147483648, NaN])
          expect(() => raw.dsksrf("query-a.bds", bad, cell)).toThrow(/bodyid/);
        expect(() => raw.dskobj("query-a.bds", wrong as never)).toThrow(
          /dtype|SPICE_INT|SpiceIntCell/i,
        );
        raw.insrti(-100, cell);
        raw.insrti(399, cell);
        raw.dskobj("query-a.bds", cell);
        expect(contents()).toEqual([-100, 399, 499]);
        raw.scard(0, cell);
        raw.ssize(1, cell);
        expect(() => raw.dsksrf("query-a.bds", 399, cell)).toThrow(
          /CELLTOOSMALL/,
        );
        // NAIF permits a partially changed cell after error; explicitly reinitialize.
        raw.scard(0, cell);
        raw.ssize(10, cell);
        raw.insrti(-5, cell);
        raw.insrti(72, cell);
        raw.dsksrf("query-a.bds", 399, cell);
        expect(contents()).toEqual([-5, 71, 72]);
        const expired = local;
        raw.dascls(local);
        local = undefined;
        local = raw.dasopr("query-a.bds");
        expect(() => raw.dskgd(expired, descriptor)).toThrow(
          /invalid or closed SpiceHandle/i,
        );
        expect(raw.dskb02(local, descriptor).vtxbds).toEqual([
          [1, 4],
          [2, 6],
          [3, 8],
        ]);
      } finally {
        if (local !== undefined) raw.dascls(local);
        if (foreign !== undefined) b.spice.raw.dascls(foreign);
        kit.freeCell(cell);
        kit.freeCell(wrong);
        await b.dispose();
        await a.dispose();
      }
    });
});
