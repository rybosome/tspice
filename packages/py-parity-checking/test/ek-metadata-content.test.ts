import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const file = fileURLToPath(
  new URL("../fixtures/kernels/audit-query.ek", import.meta.url),
);
const bytes = fs.readFileSync(file);
const query = "SELECT CV,DF FROM AUDIT_QUERY ORDER BY KEY";
for (const backend of ["node", "wasm"] as const) {
  const test = it.runIf(backend === "wasm" || nodeBackendAvailable);
  test(
    backend +
      " retains original schema and source spans across subsequent operations",
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        raw.furnsh({ path: "metadata.ek", bytes });
        const h = raw.eklef("metadata.ek");
        try {
          const summary = raw.ekssum(h, 0);
          const names = ["KEY", "CV", "DV", "IV", "CF", "DF", "IFIX"];
          expect(summary.cnames).toEqual(names);
          for (const [i, column] of names.entries())
            expect(raw.ekcii("AUDIT_QUERY", i)).toEqual({
              column,
              attdsc: summary.cdescrs[i],
            });
          const copy = raw.ekssum(h, 0);
          copy.cnames.reverse();
          copy.cdescrs[0]!.size = 99;
          expect(summary.cnames).toEqual(names);
          expect(summary.cdescrs[0]!.size).toBe(1);
          const sql = " SELECT A.IFIX,  A.CV, A.KEY FROM AUDIT_QUERY A";
          const parsed = raw.ekpsel(sql);
          expect(parsed.ok).toBe(true);
          if (parsed.ok) {
            expect(
              parsed.xbegs.map((start, i) =>
                sql.slice(start, parsed.xends[i]! + 1),
              ),
            ).toEqual(["A.IFIX", "A.CV", "A.KEY"]);
            expect(parsed.xtypes).toEqual([2, 0, 2]);
            expect(parsed.xclass).toEqual([0, 0, 0]);
          }
          expect(raw.ekfind(query)).toEqual({ ok: true, nmrows: 3 });
          expect(raw.ekpsel("SELECT BAD FROM AUDIT_QUERY")).toMatchObject({
            ok: false,
          });
          expect([
            raw.eknelt(0, 0),
            raw.eknelt(0, 1),
            raw.eknelt(0, 2),
          ]).toEqual([1, 1, 2]);
          expect(() => raw.ekcii("AUDIT_QUERY", 8)).toThrow(/INVALIDINDEX/);
          expect(raw.failed()).toBe(false);
        } finally {
          raw.ekuef(h);
        }
      } finally {
        await dispose();
      }
    },
  );
  test(
    backend +
      " distinguishes active query tables, cached file loads and owned reader lifetimes",
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.caching({}).toSync({ backend });
      try {
        raw.furnsh({ path: "metadata.ek", bytes });
        const reader = raw.ekopr("metadata.ek");
        try {
          const key = raw.eklef("metadata.ek");
          expect(raw.eklef("metadata.ek")).toBe(key);
          raw.unload("metadata.ek");
          const next = raw.eklef("metadata.ek");
          expect(next).not.toBe(key);
          expect(() => raw.ekssum(key, 0)).toThrow(/active/);
          raw.ekuef(key);
          expect(raw.eknseg(next)).toBe(1);
          expect(raw.ekccnt("AUDIT_QUERY")).toBe(7);
          raw.ekuef(next);
          expect(raw.ekntab()).toBe(0);
          expect(raw.ekssum(reader, 0).nrows).toBe(3);
          expect(() => raw.ekccnt("AUDIT_QUERY")).toThrow(/TABLENOTLOADED/);
        } finally {
          raw.ekcls(reader);
        }
      } finally {
        await dispose();
      }
    },
  );
  test(
    backend +
      " rejects stale row access and recovers through a fresh query and completed fast write",
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        raw.furnsh({ path: "metadata.ek", bytes });
        const h = raw.eklef("metadata.ek");
        try {
          raw.ekfind(query);
          raw.ekuef(h);
          const next = raw.eklef("metadata.ek");
          try {
            expect(() => raw.eknelt(0, 0)).toThrow(/ekfind/);
            expect(raw.ekfind(query)).toEqual({ ok: true, nmrows: 3 });
            expect(raw.eknelt(0, 2)).toBe(2);
            expect(() => raw.eknelt(2147483647, 0)).toThrow(/one-based/);
            expect(() => raw.ekssum(next, 2147483647)).toThrow(/one-based/);
            const scratch = fs.mkdtempSync(
              path.join(os.tmpdir(), "tspice-c10-fast-"),
            );
            try {
              const writer = raw.ekopn(
                backend === "node"
                  ? path.join(scratch, "write.ek")
                  : "write.ek",
                "FAST",
                0,
              );
              try {
                const { segno, rcptrs } = raw.ekifld(
                  writer,
                  "T",
                  1,
                  ["I"],
                  ["DATATYPE=INTEGER"],
                );
                expect(() => raw.ekssum(next, 0)).toThrow(/fast write/);
                raw.ekacli(writer, segno, "I", [17], [1], [false], rcptrs);
                raw.ekffld(writer, segno, rcptrs);
                expect(raw.ekssum(next, 0).tabnam).toBe("AUDIT_QUERY");
              } finally {
                raw.ekcls(writer);
              }
            } finally {
              fs.rmSync(scratch, { recursive: true, force: true });
            }
          } finally {
            raw.ekuef(next);
          }
        } catch (e) {
          try {
            raw.ekuef(h);
          } catch {
            /* already released */
          }
          throw e;
        }
      } finally {
        await dispose();
      }
    },
  );
}
it.runIf(nodeBackendAvailable)(
  "disposing an async Node client releases only its remaining explicit query registrations",
  async () => {
    const observer = await spiceClients.toSync({ backend: "node" });
    const client = await spiceClients.toAsync({ backend: "node" });
    try {
      await client.spice.raw.eklef(file);
      expect(observer.spice.raw.ekccnt("AUDIT_QUERY")).toBe(7);
      await client.dispose();
      expect(observer.spice.raw.ekntab()).toBe(0);
    } finally {
      await client.dispose();
      await observer.dispose();
    }
  },
);
