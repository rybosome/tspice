import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("raw ID/name boundaries and recovery", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: rejects non-string JavaScript name/item inputs`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          // Deliberately bypass compile-time types for runtime input validation.
          for (const value of [12, null, undefined, {}, []]) {
            expect(() => s.raw.bodn2c(value as never)).toThrow();
            expect(() => s.raw.bods2c(value as never)).toThrow();
            expect(() => s.raw.boddef(value as never, -123455)).toThrow();
            expect(() => s.raw.bodfnd(399, value as never)).toThrow();
            expect(() => s.raw.bodvar(399, value as never)).toThrow();
          }
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
    testBackend(
      `${backend}: rejects invalid SpiceInt codes before conversion`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const code of [0.5, NaN, Infinity, 2 ** 32 + 399, -2147483649]) {
            expect(() => s.raw.bodc2n(code)).toThrow(/code/);
            expect(() => s.raw.bodc2s(code)).toThrow(/code/);
            expect(() => s.raw.boddef("Audit Invalid Code", code)).toThrow(
              /code/,
            );
            expect(() => s.raw.bodfnd(code, "RADII")).toThrow(/body/);
            expect(() => s.raw.bodvar(code, "RADII")).toThrow(/body/);
          }
          expect(s.raw.bodc2n(399)).toEqual({ found: true, name: "EARTH" });
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
    testBackend(
      `${backend}: rejects empty normalized items and recovers after mapping errors`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const item of ["", " \t\n"]) {
            expect(() => s.raw.bodfnd(399, item)).toThrow(/item/);
            expect(() => s.raw.bodvar(399, item)).toThrow(/item/);
          }
          expect(() => s.raw.bodn2c("")).toThrow(/EMPTYSTRING/);
          expect(s.raw.failed()).toBe(false);
          expect(s.raw.bodn2c("EARTH")).toEqual({ found: true, code: 399 });
          s.raw.pdpool("BODY-123458_X", [1.25, -2.5]);
          expect(s.raw.bodvar(-123458, " x ")).toEqual([1.25, -2.5]);
          expect(s.raw.bodfnd(-123458, " x ")).toBe(true);
          s.raw.pcpool("NAIF_BODY_NAME", ["AUDIT A", "AUDIT B"]);
          s.raw.pipool("NAIF_BODY_CODE", [-123459]);
          expect(() => s.raw.bodn2c("EARTH")).toThrow(/BADDIMENSIONS/);
          expect(s.raw.failed()).toBe(false);
          s.raw.kclear();
          expect(s.raw.bodn2c("EARTH")).toEqual({ found: true, code: 399 });
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
  }
});
