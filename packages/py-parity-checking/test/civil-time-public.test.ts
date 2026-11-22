import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const fixtures = path.resolve(import.meta.dirname, "../fixtures");

for (const backend of ["node", "wasm"] as const) {
  const run = it.runIf(backend === "wasm" || nodeBackendAvailable);

  run(
    `${backend}: restore the caller's date-checking mode and century on both exit paths`,
    async () => {
      const {
        spice: { raw },
        spice,
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        // Compare boundary suffixes on both sides of four different window cuts.
        for (const lower of [1, 1950, 2000, 2107]) {
          for (const error of [true, false]) {
            raw.tsetyr(lower);
            raw.tparch(error ? "YES" : "NO");
            const dates = [0, 99, lower % 100, (lower + 99) % 100].map(
              (suffix) => "JAN 01 '" + String(suffix).padStart(2, "0"),
            );
            const before = dates.map((date) => raw.tparse(date));
            const result = runCaseInTspice(
              spice,
              {
                caseId: "civil-time-parser-cleanup",
                description:
                  "Change both parser controls and observe their restoration",
                workflow: [
                  { op: "time.tsetyr", year: 1823 },
                  { op: "time.tparch", type: error ? "NO" : "YES" },
                  {
                    op: "time.tparse",
                    timstr: error ? "unrecognized time" : "JAN 01 '23",
                  },
                ],
                expectation: { kind: error ? "error" : "success" },
              },
              fixtures,
            );
            expect(result.ok).toBe(!error);
            expect(dates.map((date) => raw.tparse(date))).toEqual(before);
            const invalidDay = () => raw.tparse("1993 April 31 12:00:00");
            if (error) expect(invalidDay).toThrow(/day of the month/i);
            else expect(invalidDay()).toBe(raw.tparse("1993 May 1 12:00:00"));
          }
        }
      } finally {
        raw.tsetyr(1969);
        raw.tparch("NO");
        await dispose();
      }
    },
  );

  run(
    `${backend}: distinguish formal calendar time, UTC leap seconds and local solar clocks`,
    async () => {
      const {
        spice: { raw },
        dispose,
      } = await spiceClients.toSync({ backend });
      try {
        expect(raw.etcal(0)).toBe("2000 JAN 01 12:00:00.000");
        for (const name of [
          "naif0012.tls",
          "audit-geometry.tf",
          "audit-geometry.bsp",
        ]) {
          raw.furnsh({
            path: name,
            bytes: fs.readFileSync(path.join(fixtures, "kernels", name)),
          });
        }
        expect(raw.utc2et("2000 JAN 01 12:00:00")).toBeCloseTo(
          64.18392728473108,
          10,
        );
        const leap = raw.utc2et("2016 DEC 31 23:59:60");
        expect(leap - raw.utc2et("2016 DEC 31 23:59:59")).toBeCloseTo(1, 6);
        expect(raw.utc2et("2017 JAN 01 00:00:00") - leap).toBeCloseTo(1, 6);
        raw.pcpool("OBJECT_100101_FRAME", ["AUDIT_GEOMETRY_FIXED"]);
        raw.pdpool("BODY100101_PM", [0, 125, 0]);
        const graphic = raw.et2lst(0, 100101, 0.25, "PLANETOGRAPHIC");
        const centric = raw.et2lst(0, 100101, 0.25, "PLANETOCENTRIC");
        expect(centric).toEqual({
          hr: 11,
          mn: 11,
          sc: 2,
          time: "11:11:02",
          ampm: "11:11:02 A.M.",
        });
        expect(graphic).toEqual({
          hr: 9,
          mn: 16,
          sc: 26,
          time: "09:16:26",
          ampm: "09:16:26 A.M.",
        });
        expect(raw.et2lst(0, 10, 0, "PLANETOCENTRIC", 2, 3)).toEqual({
          hr: 12,
          mn: 0,
          sc: 0,
          time: "1",
          ampm: "12",
        });
      } finally {
        raw.kclear();
        await dispose();
      }
    },
  );
}
