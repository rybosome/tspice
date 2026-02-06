import { describe, expect, it } from "vitest";

import { createFakeBackend } from "@rybosome/tspice-backend-fake";

function approx(a: number, b: number, eps = 1e-9) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
}

describe("@rybosome/tspice-backend-fake", () => {
  it("is deterministic for spkezr/spkpos", () => {
    const b = createFakeBackend();

    expect(b.kind).toBe("fake");

    const a = b.spkezr("MOON", 123.456, "J2000", "NONE", "EARTH");
    const c = b.spkezr("MOON", 123.456, "J2000", "NONE", "EARTH");

    expect(c).toEqual(a);

    const pos = b.spkpos("MOON", 123.456, "J2000", "NONE", "EARTH");
    expect(pos.lt).toBe(0);
    // Moon relative Earth shouldn't be the zero vector.
    expect(pos.pos[0]).not.toBe(0);
  });

  it("implements simplified UTC<->ET mapping with J2000 epoch", () => {
    const b = createFakeBackend();

    expect(b.str2et("2000-01-01T12:00:00Z")).toBe(0);

    // 1 second after J2000
    approx(b.str2et("2000-01-01T12:00:01Z"), 1);

    expect(b.et2utc(0, "C", 3)).toBe("2000-01-01T12:00:00.000Z");
    expect(b.et2utc(0, "C", 0)).toBe("2000-01-01T12:00:00Z");
  });

  it("tracks loaded kernels with deterministic handles", () => {
    const b = createFakeBackend();

    expect(b.ktotal()).toBe(0);

    b.furnsh("/kernels/a.bsp");
    b.furnsh({ path: "/kernels/b.tls", bytes: new Uint8Array([1, 2, 3]) });

    expect(b.ktotal()).toBe(2);
    expect(b.ktotal("SPK")).toBe(1);
    expect(b.ktotal("LSK")).toBe(1);

    const k0 = b.kdata(0);
    const k1 = b.kdata(1);

    expect(k0).toMatchObject({ found: true, file: "/kernels/a.bsp", filtyp: "SPK", handle: 1 });
    expect(k1).toMatchObject({ found: true, file: "/kernels/b.tls", filtyp: "LSK", handle: 2 });

    expect(b.kdata(2)).toEqual({ found: false });

    b.unload("/kernels/a.bsp");
    expect(b.ktotal()).toBe(1);

    b.kclear();
    expect(b.ktotal()).toBe(0);
  });

  it("returns identity pxform for same-frame transforms", () => {
    const b = createFakeBackend();
    expect(b.pxform("J2000", "J2000", 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("rejects non-integer rotate() axes for CSPICE parity", () => {
    const b = createFakeBackend();
    expect(() => b.rotate(0.123, 1.9)).toThrow(/expected a finite integer/i);
  });

  it("handles near-pole recgeo() inputs without numerical instability", () => {
    const b = createFakeBackend();

    // Use an x/y magnitude small enough to trip the tolerance-based pole guard.
    const re = 6378.137;
    const f = 1 / 298.257223563;
    const rect: [number, number, number] = [1e-20, -1e-20, re];

    const out = b.recgeo(rect, re, f);
    expect(out.lon).toBe(0);
    approx(out.lat, Math.PI / 2);
    expect(Number.isFinite(out.alt)).toBe(true);
  });
});
