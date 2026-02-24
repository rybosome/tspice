import { describe, expect, it } from "vitest";

import { createFakeBackend } from "@rybosome/tspice-backend-fake";

function approx(a: number, b: number, eps = 1e-9) {
  expect(Math.abs(a - b)).toBeLessThanOrEqual(eps);
}

describe("@rybosome/tspice-backend-fake", () => {
  it("is deterministic for spkezr/spkpos", () => {
    const b = createFakeBackend();

    expect(b.kind).toBe("fake");

    const a = b.raw.spkezr("MOON", 123.456, "J2000", "NONE", "EARTH");
    const c = b.raw.spkezr("MOON", 123.456, "J2000", "NONE", "EARTH");

    expect(c).toEqual(a);

    const pos = b.raw.spkpos("MOON", 123.456, "J2000", "NONE", "EARTH");
    expect(pos.lt).toBe(0);
    // Moon relative Earth shouldn't be the zero vector.
    expect(pos.pos[0]).not.toBe(0);
  });

  it("implements simplified UTC<->ET mapping with J2000 epoch", () => {
    const b = createFakeBackend();

    expect(b.raw.str2et("2000-01-01T12:00:00Z")).toBe(0);

    // 1 second after J2000
    approx(b.raw.str2et("2000-01-01T12:00:01Z"), 1);

    expect(b.raw.et2utc(0, "C", 3)).toBe("2000-01-01T12:00:00.000Z");
    expect(b.raw.et2utc(0, "C", 0)).toBe("2000-01-01T12:00:00Z");
  });

  it("tracks loaded kernels with deterministic handles", () => {
    const b = createFakeBackend();

    expect(b.raw.ktotal()).toBe(0);

    b.raw.furnsh("/kernels/a.bsp");
    b.raw.furnsh({ path: "/kernels/b.tls", bytes: new Uint8Array([1, 2, 3]) });
    b.raw.furnsh("/kernels/c.bc");

    expect(b.raw.ktotal()).toBe(3);
    expect(b.raw.ktotal("ALL")).toBe(3);
    expect(b.raw.ktotal("SPK")).toBe(1);
    expect(b.raw.ktotal("LSK")).toBe(1);
    expect(b.raw.ktotal("TEXT")).toBe(1);

    const k0 = b.raw.kdata(0);
    const k1 = b.raw.kdata(1);
    const k2 = b.raw.kdata(2);

    expect(k0).toMatchObject({ found: true, file: "/kernels/a.bsp", filtyp: "SPK", handle: 1 });
    expect(k1).toMatchObject({ found: true, file: "/kernels/b.tls", filtyp: "TEXT", handle: 2 });
    expect(k2).toMatchObject({ found: true, file: "/kernels/c.bc", filtyp: "CK", handle: 3 });

    expect(b.raw.kdata(3)).toEqual({ found: false });

    // `kinfo()` should accept equivalent virtual id forms (WASM parity).
    expect(b.raw.kinfo("kernels/a.bsp").found).toBe(true);

    // `unload()` should use the same normalization.
    b.raw.unload("kernels//a.bsp");
    expect(b.raw.ktotal()).toBe(2);
    expect(b.raw.ktotal("SPK")).toBe(0);
    expect(b.raw.ktotal("CK")).toBe(1);

    b.raw.kclear();
    expect(b.raw.ktotal()).toBe(0);
    expect(b.raw.ktotal("CK")).toBe(0);
  });

  it("throws on unsupported kernel extensions by default", () => {
    const b = createFakeBackend();
    expect(() => b.raw.furnsh("/kernels/unknown.foo")).toThrow(RangeError);
  });

  it("can assume TEXT for unknown extensions when configured", () => {
    const b = createFakeBackend({ unknownExtension: "assume-text" });
    b.raw.furnsh("/kernels/unknown.foo");
    expect(b.raw.ktotal("TEXT")).toBe(1);
  });

  it("returns identity pxform for same-frame transforms", () => {
    const b = createFakeBackend();
    expect(b.raw.pxform("J2000", "J2000", 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("rejects non-integer rotate() axes for CSPICE parity", () => {
    const b = createFakeBackend();
    expect(() => b.raw.rotate(0.123, 1.9)).toThrow(/expected a finite integer/i);
  });

  it("throws on invalid kernel-pool start/room args", () => {
    const b = createFakeBackend();
    b.raw.pdpool("NUM", [1, 2, 3]);
    b.raw.pcpool("STR", ["A", "B"]);

    // start must be a finite integer >= 0
    expect(() => b.raw.gdpool("NUM", -1, 1)).toThrow(/start/i);
    expect(() => b.raw.gipool("NUM", -1, 1)).toThrow(/start/i);
    expect(() => b.raw.gcpool("STR", -1, 1)).toThrow(/start/i);
    expect(() => b.raw.gnpool("NO_MATCHES", -1, 1)).toThrow(/start/i);

    expect(() => b.raw.gdpool("NUM", Number.NaN, 1)).toThrow(/start/i);
    expect(() => b.raw.gdpool("NUM", Infinity, 1)).toThrow(/start/i);
    expect(() => b.raw.gdpool("NUM", 0.5, 1)).toThrow(/start/i);

    // room must be a finite integer > 0
    expect(() => b.raw.gdpool("NUM", 0, 0)).toThrow(/room/i);
    expect(() => b.raw.gipool("NUM", 0, 0)).toThrow(/room/i);
    expect(() => b.raw.gcpool("STR", 0, 0)).toThrow(/room/i);
    expect(() => b.raw.gnpool("NO_MATCHES", 0, 0)).toThrow(/room/i);

    expect(() => b.raw.gdpool("NUM", 0, Number.NaN)).toThrow(/room/i);
    expect(() => b.raw.gdpool("NUM", 0, Infinity)).toThrow(/room/i);
    expect(() => b.raw.gdpool("NUM", 0, 1.5)).toThrow(/room/i);
  });

  it("rejects empty/blank kernel-pool string identifiers", () => {
    const b = createFakeBackend();

    for (const name of ["", "   "]) {
      expect(() => b.raw.gdpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.gipool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.gcpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.raw.dtpool(name)).toThrow(RangeError);

      expect(() => b.raw.pdpool(name, [1])).toThrow(RangeError);
      expect(() => b.raw.pipool(name, [1])).toThrow(RangeError);
      expect(() => b.raw.pcpool(name, ["A"])).toThrow(RangeError);

      expect(() => b.raw.expool(name)).toThrow(RangeError);
    }

    for (const template of ["", "   "]) {
      expect(() => b.raw.gnpool(template, 0, 1)).toThrow(RangeError);
    }

    for (const agent of ["", "   "]) {
      expect(() => b.raw.swpool(agent, [])).toThrow(RangeError);
      expect(() => b.raw.cvpool(agent)).toThrow(RangeError);
    }

    // swpool(): names entries must be non-empty strings (but [] is allowed)
    for (const blank of ["", "   "]) {
      expect(() => b.raw.swpool("AGENT", [blank])).toThrow(RangeError);
    }
  });

  it("rejects non-finite pdpool() values", () => {
    const b = createFakeBackend();

    for (const v of [Number.NaN, Infinity, -Infinity]) {
      try {
        b.raw.pdpool("NUM", [v]);
        throw new Error("expected pdpool() to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(RangeError);
        expect((err as Error).message).toMatch(/values\[0\].*finite/i);
      }
    }
  });

  it("validates pipool/gipool integer ranges (no JS bitwise wrapping)", () => {
    const b = createFakeBackend();

    // pipool(): rejects non-integers
    expect(() => b.raw.pipool("I", [1.5])).toThrow(TypeError);

    // pipool(): rejects out-of-range int32
    expect(() => b.raw.pipool("I", [2147483648])).toThrow(RangeError);
    expect(() => b.raw.pipool("I", [-2147483649])).toThrow(RangeError);

    // pipool(): accepts int32 edge values and preserves them
    b.raw.pipool("I", [-2147483648, 2147483647]);
    expect(b.raw.gipool("I", 0, 10)).toEqual({
      found: true,
      values: [-2147483648, 2147483647],
    });

    // gipool(): throws if the stored numeric variable isn't representable as int32
    b.raw.pdpool("NUM", [1.1]);
    expect(() => b.raw.gipool("NUM", 0, 10)).toThrow(TypeError);
  });

  it("supports escaping wildcards in gnpool templates", () => {
    const b = createFakeBackend();
    b.raw.pdpool("A*B", [1]);
    b.raw.pdpool("AXYB", [1]);
    b.raw.pdpool("A%B", [1]);
    b.raw.pdpool("AQB", [1]);
    const nameBackslash = "A" + "\\" + "B";
    b.raw.pdpool(nameBackslash, [1]);


    const tplEscStar = "A" + "\\" + "*B";
    const tplEscPct = "A" + "\\" + "%B";
    const tplEscBackslash = "A" + "\\" + "\\" + "B";

    expect([...tplEscStar]).toEqual(["A", "\\", "*", "B"]);
    expect([...tplEscPct]).toEqual(["A", "\\", "%", "B"]);
    expect([...tplEscBackslash]).toEqual(["A", "\\", "\\", "B"]);

    expect(b.raw.gnpool(tplEscStar, 0, 10)).toEqual({ found: true, values: ["A*B"] });
    expect(b.raw.gnpool(tplEscPct, 0, 10)).toEqual({ found: true, values: ["A%B"] });
    expect(b.raw.gnpool(tplEscBackslash, 0, 10)).toEqual({ found: true, values: [nameBackslash] });
  });


  it("handles near-pole recgeo() inputs without numerical instability", () => {
    const b = createFakeBackend();

    // Use an x/y magnitude small enough to trip the tolerance-based pole guard.
    const re = 6378.137;
    const f = 1 / 298.257223563;
    const rect: [number, number, number] = [1e-20, -1e-20, re];

    const out = b.raw.recgeo(rect, re, f);
    expect(out.lon).toBe(0);
    approx(out.lat, Math.PI / 2);
    expect(Number.isFinite(out.alt)).toBe(true);
  });

  it("matches CSPICE-style error message conventions (setmsg + sigerr)", () => {
    const b = createFakeBackend();

    b.raw.setmsg("something went wrong");
    b.raw.sigerr("SPICE(FAKE)");

    expect(b.raw.failed()).toBe(true);
    expect(b.raw.getmsg("SHORT")).toBe("SPICE(FAKE)");
    expect(b.raw.getmsg("LONG")).toBe("something went wrong");
    expect(b.raw.getmsg("EXPLAIN")).toContain("something went wrong");

    // `sigerr(short)` should not overwrite the long message.
    expect(b.raw.getmsg("LONG")).toBe("something went wrong");
  });

  it("includes trace info in EXPLAIN when available", () => {
    const b = createFakeBackend();
    b.raw.chkin("A");
    b.raw.chkin("B");
    b.raw.setmsg("long message");
    b.raw.sigerr("SPICE(TRACE)");
    expect(b.raw.getmsg("EXPLAIN")).toContain("Trace:");
    expect(b.raw.getmsg("EXPLAIN")).toContain("A -> B");
  });

  it("rejects invalid getmsg(which) selectors", () => {
    const b = createFakeBackend();
    expect(() => b.raw.getmsg("NOPE" as never)).toThrow(/getmsg\(which\)/i);
  });
});
