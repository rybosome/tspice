import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("raw kernel-pool boundaries", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: rejects paging values before integer conversion`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          // Deliberately bypass compile-time array types to exercise JS callers.
          expect(() => s.raw.pcpool("AUDIT", "AB" as never)).toThrow();
          expect(() =>
            s.raw.swpool("AUDIT_ARRAY_AGENT", "AB" as never),
          ).toThrow();
          s.raw.pipool("AUDIT", [17]);
          for (const get of [
            s.raw.gdpool,
            s.raw.gipool,
            s.raw.gcpool,
            s.raw.gnpool,
          ]) {
            for (const start of [0.5, 2 ** 32, NaN, Infinity])
              expect(() => get("AUDIT", start, 1)).toThrow(/start/);
            for (const room of [0.5, 2 ** 32 + 1, NaN, Infinity])
              expect(() => get("AUDIT", 0, room)).toThrow(/room/);
          }
          expect(s.raw.gdpool("AUDIT", 0, 1)).toEqual({
            found: true,
            values: [17],
          });
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
    testBackend(
      `${backend}: watches remain correct on repeated registration sequences`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          for (let repeat = 0; repeat < 2; repeat++) {
            s.raw.swpool("AUDIT_REPEAT_AGENT", ["AUDIT_REPEAT_TRACKED"]);
            expect(s.raw.cvpool("AUDIT_REPEAT_AGENT")).toBe(true);
            s.raw.pipool("AUDIT_REPEAT_UNRELATED", [repeat]);
            expect(s.raw.cvpool("AUDIT_REPEAT_AGENT")).toBe(false);
            s.raw.swpool("AUDIT_REPEAT_AGENT", ["AUDIT_REPEAT_ADDED"]);
            expect(s.raw.cvpool("AUDIT_REPEAT_AGENT")).toBe(true);
            s.raw.pipool("AUDIT_REPEAT_TRACKED", [repeat]);
            expect(s.raw.cvpool("AUDIT_REPEAT_AGENT")).toBe(true);
            s.raw.pipool("AUDIT_REPEAT_ADDED", [repeat]);
            expect(s.raw.cvpool("AUDIT_REPEAT_AGENT")).toBe(true);
            s.raw.kclear();
          }
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
    testBackend(
      `${backend}: accepts blank character values and empty writes preserve state`,
      async () => {
        const { spice: s, dispose } = await spiceClients.toSync({ backend });
        try {
          // Deliberately bypass compile-time array types to exercise JS callers.
          expect(() => s.raw.pcpool("AUDIT", "AB" as never)).toThrow();
          expect(() =>
            s.raw.swpool("AUDIT_ARRAY_AGENT", "AB" as never),
          ).toThrow();
          s.raw.pipool("AUDIT", [17]);
          for (const put of [s.raw.pdpool, s.raw.pipool, s.raw.pcpool]) {
            put("AUDIT", []);
            expect(s.raw.gdpool("AUDIT", 0, 1)).toEqual({
              found: true,
              values: [17],
            });
          }
          s.raw.pcpool("AUDIT", ["", "   ", "  leading", "trail  "]);
          expect(s.raw.gcpool("AUDIT", 0, 4)).toEqual({
            found: true,
            values: ["", "", "  leading", "trail"],
          });
          expect(() => s.raw.gcpool("AUDIT", 0, 0)).toThrow(/room/);
          expect(s.raw.gcpool("AUDIT", 2, 1)).toEqual({
            found: true,
            values: ["  leading"],
          });
          expect(s.raw.failed()).toBe(false);
        } finally {
          s.raw.kclear();
          await dispose();
        }
      },
    );
  }
});
