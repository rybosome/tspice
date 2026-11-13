import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

describe("geodetic raw error recovery", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: georec/recgeo errors reset SPICE before subsequent calls`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          expect(() => spice.raw.georec(0, 0, 0, 1, 1)).toThrow(
            /VALUEOUTOFRANGE/,
          );
          expect(spice.raw.failed()).toBe(false);
          expect(spice.raw.georec(0, 0, 0, 1, 0)).toEqual([1, 0, 0]);
          expect(() => spice.raw.recgeo([1, 0, 0], 0, 0)).toThrow(
            /VALUEOUTOFRANGE/,
          );
          expect(spice.raw.failed()).toBe(false);
          expect(spice.raw.recgeo([1, 0, 0], 1, 0)).toEqual({
            lon: 0,
            lat: 0,
            alt: 0,
          });
        } finally {
          await dispose();
        }
      },
    );
  }
});
