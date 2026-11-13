import path from "node:path";
import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { runCaseInTspice } from "../src/run-tspice.js";
import type { ParityCase } from "../src/case-types.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
const fixtures = path.resolve(import.meta.dirname, "../fixtures");
describe("time default workflow cleanup", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(`${backend}: rejects non-string time arguments`, async () => {
      const { spice, dispose } = await spiceClients.toSync({ backend });
      try {
        // Deliberately bypass compile-time string types to exercise JS callers.
        for (const value of [12, null, undefined, {}, []]) {
          expect(() => spice.raw.str2et(value as never)).toThrow();
          expect(() => spice.raw.timout(0, value as never)).toThrow();
          expect(() => spice.raw.tparse(value as never)).toThrow();
          expect(() => spice.raw.timdef("GET", value as never)).toThrow();
          expect(() => spice.raw.tpictr(value as never, "X")).toThrow();
          expect(() =>
            spice.raw.tpictr("24 Mar 2018 16:23:00 UTC", value as never),
          ).toThrow();
          expect(() => spice.raw.unitim(0, value as never, "ET")).toThrow();
          expect(() => spice.raw.unitim(0, "ET", value as never)).toThrow();
        }
      } finally {
        await dispose();
      }
    });
    for (const zoneBaseline of [false, true])
      for (const error of [false, true])
        testBackend(
          `${backend}: restores ${zoneBaseline ? "ZONE" : "SYSTEM"} baseline after ${error ? "failure" : "success"}`,
          async () => {
            const { spice, dispose } = await spiceClients.toSync({ backend });
            const readDefaults = () => ({
              calendar: spice.raw.timdef("GET", "CALENDAR"),
              system: spice.raw.timdef("GET", "SYSTEM"),
              zone: spice.raw.timdef("GET", "ZONE"),
            });
            const original = readDefaults();
            if (zoneBaseline) spice.raw.timdef("SET", "ZONE", "UTC-03:30");
            const before = readDefaults();
            const c: ParityCase = {
              caseId: "time-cleanup-regression",
              description: "mutate persistent TIMDEF defaults",
              workflow: [
                {
                  op: "time.timdef",
                  action: "SET",
                  item: "CALENDAR",
                  value: "JULIAN",
                },
                {
                  op: "time.timdef",
                  action: "SET",
                  item: "ZONE",
                  value: "UTC+05:30",
                },
                ...(error
                  ? [
                      {
                        op: "time.timdef" as const,
                        action: "GET" as const,
                        item: "NOT_AN_ITEM",
                      },
                    ]
                  : []),
              ],
              expectation: { kind: error ? "error" : "success" },
            };
            try {
              expect(runCaseInTspice(spice, c, fixtures).ok).toBe(!error);
              const after = readDefaults();
              expect(after).toEqual(before);
              expect(spice.raw.tparse("2000-01-02T12:00:00")).toBe(86400);
            } finally {
              spice.raw.timdef("SET", "CALENDAR", original.calendar);
              if (original.system)
                spice.raw.timdef("SET", "SYSTEM", original.system);
              else if (original.zone)
                spice.raw.timdef("SET", "ZONE", original.zone);
              await dispose();
            }
          },
        );
  }
});

describe("Julian-day assertion sensitivity", () => {
  it("compares the actual result at seconds scale as well as its large Julian epoch", async () => {
    const { assertCaseParity } = await import("../src/parity-assert.js");
    const c: ParityCase = {
      caseId: "unitim-sensitive",
      description: "Julian epoch comparison",
      workflow: [
        { op: "time.unitim", epoch: 0, insys: "TDB", outsys: "JDTDB" },
      ],
      expectation: { kind: "success" },
    };
    const epoch = 2451545;
    const shifted = epoch + 0.1 / 86400;
    const result = (value: number) => ({
      caseId: c.caseId,
      ok: true as const,
      error: null,
      outputs: [
        {
          op: "time.unitim" as const,
          value: { epoch: value, secondsPastJ2000: (value - epoch) * 86400 },
        },
      ],
    });
    expect(() => assertCaseParity(c, result(epoch), result(shifted))).toThrow(
      /Output mismatch/,
    );
  });
});
