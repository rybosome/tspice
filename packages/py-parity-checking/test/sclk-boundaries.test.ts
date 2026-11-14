import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import path from "node:path";
import { allCases } from "../src/cases/index.js";
import { runCaseInTspice } from "../src/run-tspice.js";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";
describe("raw UTC/SCLK numeric boundaries", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: recovers from clock and UTC errors on the same instance`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        const fixtures = path.resolve(import.meta.dirname, "../fixtures");
        const getCase = (id: string) => {
          const c = allCases.find((c) => c.caseId === id);
          if (!c) throw new Error(`Missing audited case ${id}`);
          return c;
        };
        try {
          const bad = runCaseInTspice(
            s,
            getCase("time-scencd-audit-bad-partition"),
            fixtures,
          );
          expect(bad.ok).toBe(false);
          if (!bad.ok) expect(bad.error.message).toContain("BADPARTNUMBER");
          expect(s.raw.failed()).toBe(false);
          const good = runCaseInTspice(
            s,
            getCase(
              "time-scencd-audit-partitions-shared-boundary-and-field-rollover",
            ),
            fixtures,
          );
          expect(good.ok).toBe(true);
          if (good.ok)
            expect(
              good.outputs
                .filter((o) => o.op === "time.scencd")
                .map((o) => o.value),
            ).toEqual([0, 320, 1023, 1023, 1024, 4094, 256]);
          const invalidUtc = runCaseInTspice(
            s,
            getCase("time-et2utc-invalid-format-error"),
            fixtures,
          );
          expect(invalidUtc.ok).toBe(false);
          expect(s.raw.failed()).toBe(false);
          expect(
            runCaseInTspice(
              s,
              getCase("time-et2utc-audit-utc-leap-second-rounding"),
              fixtures,
            ).ok,
          ).toBe(true);
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
    testBackend(
      `${backend}: rejects fractional/wrapped spacecraft IDs and precision`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const sc of [-77.5, NaN, Infinity, 2 ** 32 - 77, -2147483649]) {
            const attempts = [
              () => s.raw.scs2e(sc, "1/0:0"),
              () => s.raw.scencd(sc, "1/0:0"),
              () => s.raw.scdecd(sc, 0),
              () => s.raw.sce2c(sc, 0),
              () => s.raw.sce2s(sc, 0),
              () => s.raw.sct2e(sc, 0),
            ];
            for (const attempt of attempts) expect(attempt).toThrow(/\(sc\)/);
          }
          for (const prec of [0.5, NaN, Infinity, 2 ** 32 + 3])
            expect(() => s.raw.et2utc(0, "ISOC", prec)).toThrow(
              /et2utc\(prec\)/,
            );
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
  }
});
