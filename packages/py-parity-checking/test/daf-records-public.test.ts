import { readFileSync } from "node:fs";
import path from "node:path";
import { spiceClients } from "@rybosome/tspice";
import { describe, expect, it } from "vitest";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixture = readFileSync(
  path.resolve(
    import.meta.dirname,
    "../fixtures/kernels/audit-two-segment.bsp",
  ),
);

describe("public DAF word representation and file records", () => {
  for (const backend of ["node", "wasm"] as const) {
    const test = backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    test(`${backend} preserves signed payloads, defined padding and unaligned views`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        const raw = spice.raw;
        const dc = [-0, Number.POSITIVE_INFINITY],
          ic = [0x1234567, -1, -2147483648];
        raw.dafps(0, 4, [], [98, 34, 21, 7]);
        const bytes = raw.dafps(2, 3, dc, ic);
        const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        );
        expect(bytes.byteLength).toBe(32);
        expect(Object.is(view.getFloat64(0, true), -0)).toBe(true);
        expect(view.getFloat64(8, true)).toBe(Infinity);
        expect(view.getInt32(16, true)).toBe(ic[0]);
        expect(view.getInt32(20, true)).toBe(-1);
        expect(view.getInt32(24, true)).toBe(-2147483648);
        expect(view.getUint32(28, true)).toBe(0);
        const unaligned = new Uint8Array(35);
        unaligned.set(bytes, 1);
        unaligned.fill(255, 29, 33);
        const result = raw.dafus(unaligned.subarray(1), 2, 3);
        expect(result.dc).toEqual(dc);
        expect(result.ic).toEqual(ic);
        result.ic[0] = 42;
        expect(raw.dafus(bytes, 2, 3).ic).toEqual(ic);
        expect(
          raw.dafps(
            125,
            0,
            Array.from({ length: 125 }, (_, i) => i),
            [],
          ),
        ).toHaveLength(1000);
        expect(raw.dafus(new Uint8Array(1000), 125, 0)).toEqual({
          dc: Array(125).fill(0),
          ic: [],
        });
      } finally {
        await dispose();
      }
    });
    test(`${backend} reads exact independent file bytes and retains file and search state`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      const raw = spice.raw;
      try {
        raw.furnsh({ path: "records.bsp", bytes: fixture });
        raw.unload("records.bsp");
        const h = raw.dafopr("records.bsp");
        try {
          const header = raw.dafrfr(h);
          expect(header).toEqual({
            nd: 2,
            ni: 6,
            ifname: "TSPICE AUTHORED STEP7 DAF",
            fward: 2,
            bward: 2,
            free: 429,
          });
          raw.dafbfs(h);
          expect(raw.daffna(h)).toBe(true);
          const summary = raw.dafgs(h);
          const section = raw.dafgsr(h, header.fward, 4, 8);
          if (!section.found) throw Error("Missing first summary record");
          const rawFileBytes = fixture.subarray(1024 + 24, 1024 + 64);
          expect(Array.from(section.data)).toEqual(Array.from(rawFileBytes));
          expect(section.data).toEqual(summary);
          const fields = raw.dafus(summary, header.nd, header.ni);
          const begin = fields.ic[4]!,
            end = fields.ic[5]!;
          expect([begin, end]).toEqual([385, 406]);
          const data = raw.dafgda(h, begin, end);
          const physical = raw.dafrda(h, begin, end);
          const ordinary = fixture.subarray((begin - 1) * 8, end * 8);
          expect(Array.from(physical)).toEqual(Array.from(ordinary));
          expect(data).toEqual(
            Array.from({ length: end - begin + 1 }, (_, i) =>
              ordinary.readDoubleLE(i * 8),
            ),
          );
          section.data.fill(0);
          physical.fill(0);
          expect(raw.dafgs(h)).toEqual(summary);
          expect(raw.dafgsr(h, 20, 5, 3)).toEqual({ found: false });
          expect(raw.dafgsr(h, 2, 5, 3)).toEqual({
            found: true,
            data: new Uint8Array(0),
          });
          expect(() => raw.dafgda(h, 0, 1)).toThrow(/DAFNEGADDR/);
          expect(raw.failed()).toBe(false);
          expect(raw.dafrfr(h, 1).ifname).toBe("");
        } finally {
          raw.dafcls(h);
        }
        expect(() => raw.dafrfr(h)).toThrow(/closed|invalid|unknown/i);
      } finally {
        await dispose();
      }
    });
  }
});
