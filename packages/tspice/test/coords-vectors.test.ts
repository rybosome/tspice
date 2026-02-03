import { describe, expect, it } from "vitest";

import { createBackend } from "@rybosome/tspice";
import type { Mat3RowMajor } from "@rybosome/tspice";

import { nodeBackendAvailable } from "./_helpers/nodeBackendAvailable.js";

function expectVec3Close(actual: [number, number, number], expected: [number, number, number], precision = 12) {
  for (let i = 0; i < 3; i++) {
    expect(actual[i]!).toBeCloseTo(expected[i]!, precision);
  }
}

describe("coordinate conversions + vector/matrix helpers", () => {
  const itNode = it.runIf(nodeBackendAvailable && process.arch !== "arm64");

  function runSharedTests(backend: Awaited<ReturnType<typeof createBackend>>) {
    const rect: [number, number, number] = [1, 2, 3];

    // reclat/latrec round-trip
    {
      const { radius, lon, lat } = backend.reclat(rect);
      const roundTrip = backend.latrec(radius, lon, lat);
      expectVec3Close(roundTrip, rect);
    }

    // recsph/sphrec round-trip
    {
      const { radius, colat, lon } = backend.recsph(rect);
      const roundTrip = backend.sphrec(radius, colat, lon);
      expectVec3Close(roundTrip, rect);
    }

    // vector helpers
    expect(backend.vnorm([3, 4, 0])).toBeCloseTo(5, 12);
    expectVec3Close(backend.vhat([3, 0, 0]), [1, 0, 0]);

    // vhat: NAIF defines vhat([0, 0, 0]) = [0, 0, 0] (no throw)
    expectVec3Close(backend.vhat([0, 0, 0]), [0, 0, 0]);
    expect(backend.vdot([1, 2, 3], [4, 5, 6])).toBe(32);
    expectVec3Close(backend.vcrss([1, 0, 0], [0, 1, 0]), [0, 0, 1]);

    // matrix-vector helpers (row-major)
    const m = [
      1, 2, 3,
      4, 5, 6,
      7, 8, 9,
    ] as Mat3RowMajor;
    expectVec3Close(backend.mxv(m, [1, 0, 0]), [1, 4, 7]);
    expectVec3Close(backend.mtxv(m, [1, 0, 0]), [1, 2, 3]);
  }

  itNode("node backend", async () => {
    const backend = await createBackend({ backend: "node" });
    runSharedTests(backend);
  });

  it("wasm backend", async () => {
    const backend = await createBackend({ backend: "wasm" });
    runSharedTests(backend);
  });
});
