import { describe, expect, it } from "vitest";
import { spiceClients } from "@rybosome/tspice";
import { brandMat3RowMajor } from "@rybosome/tspice-core";
import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

const identity = brandMat3RowMajor([1, 0, 0, 0, 1, 0, 0, 0, 1]);

describe("coordinate rotation axis validation", () => {
  for (const backend of ["wasm", "node"] as const) {
    const testBackend =
      backend === "node" ? it.runIf(nodeBackendAvailable) : it;
    testBackend(
      `${backend}: invalid integer axes cannot silently truncate or wrap`,
      async () => {
        const { spice, dispose } = await spiceClients.toSync({ backend });
        try {
          for (const axis of [1.5, NaN, Infinity, 2 ** 32 + 1]) {
            expect(() => spice.raw.rotate(0.3, axis)).toThrow(
              /safe integer|32-bit signed integer/,
            );
            expect(() => spice.raw.rotmat(identity, 0.3, axis)).toThrow(
              /safe integer|32-bit signed integer/,
            );
          }
          // Valid out-of-1..3 indices retain CSPICE's modulo-three behavior.
          expect(spice.raw.rotate(0.3, 0)).toEqual(spice.raw.rotate(0.3, 3));
          expect(spice.raw.rotmat(identity, 0.3, -1)).toEqual(
            spice.raw.rotmat(identity, 0.3, 2),
          );
        } finally {
          await dispose();
        }
      },
    );
  }
});
