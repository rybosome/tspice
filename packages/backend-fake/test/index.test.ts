import { describe, expect, it } from "vitest";

import { createFakeBackend } from "@rybosome/tspice-backend-fake";

function approx(a: number, b: number, eps = 1e-9) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
}

describe("@rybosome/tspice-backend-fake", () => {
  it("is deterministic for spkezr/spkpos", () => {
    const b = createFakeBackend();

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
});
