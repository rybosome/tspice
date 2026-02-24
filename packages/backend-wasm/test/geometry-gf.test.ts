import { describe, expect, it } from "vitest";

import { createWasmBackend } from "@rybosome/tspice-backend-wasm";

describe("@rybosome/tspice-backend-wasm geometry GF", () => {
  it("runs a short gfdist search and returns a non-empty, well-formed result window", async () => {
    const backend = await createWasmBackend();

    // Sanity-check the tranche-1 GF utilities.
    backend.raw.gfsstp(123);
    expect(backend.raw.gfstep(0)).toBe(123);
    expect(backend.raw.gfrefn(0, 10, true, false)).toBe(5);
    backend.raw.gfstol(0.001);

    // Build a tiny SPK in-process so the test is self-contained.
    // Body 1000: linear motion along +X at 1 km/s.
    const output = { kind: "virtual-output", path: "geometry-gf-test.bsp" } as const;
    const handle = backend.raw.spkopn(output, "TSPICE", 0);

    const states = [
      // t=0
      0, 0, 0, 1, 0, 0,
      // t=60
      60, 0, 0, 1, 0, 0,
    ];

    backend.raw.spkw08(
      handle,
      1000, // body
      0, // center
      "J2000",
      0, // first
      60, // last
      "TSPICE_GF_DIST_TEST",
      1, // degree
      states,
      0, // epoch1
      60, // step
    );
    backend.raw.spkcls(handle);

    backend.raw.furnsh(output.path);

    const cnfine = backend.kit.newWindow(1);
    const result = backend.kit.newWindow(10);

    try {
      backend.raw.wninsd(0, 60, cnfine);

      // Search for times where dist(0 -> 1000) > 30km.
      backend.raw.gfdist(
        "1000",
        "NONE",
        "0",
        ">",
        30, // refval
        0, // adjust
        1, // step (seconds)
        10, // nintvls
        cnfine,
        result,
      );

      const card = backend.raw.wncard(result);
      expect(card).toBeGreaterThan(0);

      for (let i = 0; i < card; i++) {
        const [left, right] = backend.raw.wnfetd(result, i);
        expect(left).toBeLessThan(right);
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(60);
      }

      const [left0, right0] = backend.raw.wnfetd(result, 0);
      expect(left0).toBeCloseTo(30, 0);
      expect(right0).toBeCloseTo(60, 0);
    } finally {
      backend.kit.freeWindow(result);
      backend.kit.freeWindow(cnfine);
    }
  });
});
