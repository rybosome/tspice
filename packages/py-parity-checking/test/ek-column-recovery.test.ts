import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import type { SpiceHandle } from "@rybosome/tspice-backend-contract";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
for (const backend of ["node", "wasm"] as const)
  it.runIf(backend === "wasm" || nodeBackendAvailable)(
    `${backend}: rejected storage and type errors preserve an actual fast-write`,
    async () => {
      const root = fs.mkdtempSync(
        path.join(os.tmpdir(), "tspice-ek-recovery-"),
      );
      const setup = await spiceClients.toSync({ backend });
      const raw = setup.spice.raw;
      const file =
        backend === "node" ? path.join(root, "recovery.ek") : "recovery.ek";
      let handle: SpiceHandle | undefined;
      try {
        handle = raw.ekopn(file, "AUTHORED_RECOVERY", 0);
        const h = handle;
        const seg = raw.ekifld(
          h,
          "AUDIT_RECOVERY",
          3,
          ["I", "D", "C"],
          [
            "DATATYPE=INTEGER,SIZE=2",
            "DATATYPE=DOUBLE PRECISION,SIZE=2",
            "DATATYPE=CHARACTER*(20),SIZE=2",
          ],
        );
        for (const [method, column, values] of [
          [raw.ekacli, "I", [1, 2, 3, 4, 5, 6]],
          [raw.ekacld, "D", [1.25, 2.5, 3.75, 4.125, 5.5, 6.25]],
          [raw.ekaclc, "C", ["A", "B", "C", "D", "E", "F"]],
        ] as const) {
          expect(() =>
            Reflect.apply(method, raw, [
              h,
              seg.segno,
              column,
              values.slice(0, 2),
              [2],
              [false],
              seg.rcptrs.slice(0, 1),
            ]),
          ).toThrow(/actual segment row count/);
          expect(() =>
            Reflect.apply(method, raw, [
              h,
              seg.segno,
              column,
              values.slice(0, 3),
              [1, 1, 1],
              [false, false, false],
              seg.rcptrs,
            ]),
          ).toThrow(/fixed-size column entry/);
          expect(() =>
            Reflect.apply(method, raw, [
              h,
              seg.segno,
              column,
              values,
              [1, 2, 3],
              [false, false, false],
              seg.rcptrs,
            ]),
          ).toThrow(/fixed-size entszs/);
          expect(() =>
            Reflect.apply(method, raw, [
              h,
              seg.segno,
              column,
              values,
              [2, 2, 2],
              [false, false, false],
              new Int32Array(seg.rcptrs),
            ]),
          ).toThrow(/array|Array/);
          expect(() =>
            Reflect.apply(method, raw, [
              h,
              seg.segno,
              17,
              values,
              [2, 2, 2],
              [false, false, false],
              seg.rcptrs,
            ]),
          ).toThrow(/string/);
        }
        expect(() =>
          raw.ekacld(
            h,
            seg.segno,
            "I",
            [1, 2, 3, 4, 5, 6],
            [2, 2, 2],
            [false, false, false],
            seg.rcptrs,
          ),
        ).toThrow(/WRONGDATATYPE/);
        raw.ekacli(
          h,
          seg.segno,
          "I",
          [1, 2, 3, 4, 5, 6],
          [2, 2, 2],
          [false, false, false],
          seg.rcptrs,
        );
        raw.ekacld(
          h,
          seg.segno,
          "D",
          [1.25, 2.5, 3.75, 4.125, 5.5, 6.25],
          [2, 2, 2],
          [false, false, false],
          seg.rcptrs,
        );
        raw.ekaclc(
          h,
          seg.segno,
          "C",
          ["A", "B", "C", "D", "E", "F"],
          [2, 2, 2],
          [false, false, false],
          seg.rcptrs,
        );
        expect(() => raw.ekffld(h, seg.segno, seg.rcptrs.slice(0, 1))).toThrow(
          /actual segment row count/,
        );
        expect(() => raw.ekffld(h, 99, seg.rcptrs)).toThrow();
        raw.ekffld(h, seg.segno, seg.rcptrs);
        raw.ekcls(h);
        handle = undefined;
        raw.furnsh(file);
        expect(raw.ekfind("SELECT I,D,C FROM AUDIT_RECOVERY")).toEqual({
          ok: true,
          nmrows: 3,
        });
        expect(raw.ekgi(0, 2, 1)).toEqual({
          found: true,
          isNull: false,
          value: 6,
        });
        expect(raw.ekgd(1, 2, 1)).toEqual({
          found: true,
          isNull: false,
          value: 6.25,
        });
        expect(raw.ekgc(2, 2, 1)).toEqual({
          found: true,
          isNull: false,
          value: "F",
        });
        for (const method of [raw.ekgi, raw.ekgd, raw.ekgc])
          expect(() => Reflect.apply(method, raw, [9, 0, 0])).toThrow(
            /INVALIDINDEX/,
          );
        expect(raw.ekgi(0, 0, 2)).toEqual({ found: false });
        expect(raw.ekgi(0, 0, 0)).toEqual({
          found: true,
          isNull: false,
          value: 1,
        });
        expect(() => Reflect.apply(raw.ekfind, raw, [17])).toThrow(/string/);
        expect(raw.ekfind("SELECT I FROM AUDIT_RECOVERY")).toEqual({
          ok: true,
          nmrows: 3,
        });
      } finally {
        if (handle !== undefined) raw.ekcls(handle);
        await setup.dispose();
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  );
