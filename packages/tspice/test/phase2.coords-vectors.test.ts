import { describe, expect, it } from "vitest";

import type { Matrix3 } from "@rybosome/tspice-backend-contract";
import { createBackend } from "@rybosome/tspice";

const I: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

describe("Phase 2: coordinates + small vector/matrix helpers", () => {
  const itNode = it.runIf(process.arch !== "arm64");

  itNode("node backend", async () => {
    const backend = await createBackend({ backend: "node" });

    const rl = backend.reclat([1, 0, 0]);
    expect(rl.radius).toBeCloseTo(1, 12);
    expect(rl.lon).toBeCloseTo(0, 12);
    expect(rl.lat).toBeCloseTo(0, 12);

    expect(backend.latrec(1, 0, 0)).toEqual([1, 0, 0]);

    const rs = backend.recsph([1, 0, 0]);
    expect(rs.radius).toBeCloseTo(1, 12);
    expect(rs.colat).toBeCloseTo(Math.PI / 2, 12);
    expect(rs.lon).toBeCloseTo(0, 12);

    const sph = backend.sphrec(1, Math.PI / 2, 0);
    expect(sph[0]).toBeCloseTo(1, 12);
    expect(sph[1]).toBeCloseTo(0, 12);
    expect(sph[2]).toBeCloseTo(0, 12);

    expect(backend.vnorm([3, 4, 0])).toBeCloseTo(5, 12);
    expect(backend.vhat([2, 0, 0])).toEqual([1, 0, 0]);
    expect(backend.vdot([1, 2, 3], [4, 5, 6])).toBeCloseTo(32, 12);
    expect(backend.vcrss([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);

    expect(backend.mxv(I, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(backend.mtxv(I, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("wasm backend", async () => {
    const backend = await createBackend({ backend: "wasm" });

    const rl = backend.reclat([1, 0, 0]);
    expect(rl.radius).toBeCloseTo(1, 12);
    expect(rl.lon).toBeCloseTo(0, 12);
    expect(rl.lat).toBeCloseTo(0, 12);

    expect(backend.latrec(1, 0, 0)).toEqual([1, 0, 0]);

    const rs = backend.recsph([1, 0, 0]);
    expect(rs.radius).toBeCloseTo(1, 12);
    expect(rs.colat).toBeCloseTo(Math.PI / 2, 12);
    expect(rs.lon).toBeCloseTo(0, 12);

    const sph = backend.sphrec(1, Math.PI / 2, 0);
    expect(sph[0]).toBeCloseTo(1, 12);
    expect(sph[1]).toBeCloseTo(0, 12);
    expect(sph[2]).toBeCloseTo(0, 12);

    expect(backend.vnorm([3, 4, 0])).toBeCloseTo(5, 12);
    expect(backend.vhat([2, 0, 0])).toEqual([1, 0, 0]);
    expect(backend.vdot([1, 2, 3], [4, 5, 6])).toBeCloseTo(32, 12);
    expect(backend.vcrss([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);

    expect(backend.mxv(I, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(backend.mtxv(I, [1, 2, 3])).toEqual([1, 2, 3]);
  });
});
