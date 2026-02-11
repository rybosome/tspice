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
    b.furnsh("/kernels/c.bc");

    expect(b.ktotal()).toBe(3);
    expect(b.ktotal("ALL")).toBe(3);
    expect(b.ktotal("SPK")).toBe(1);
    expect(b.ktotal("LSK")).toBe(1);
    expect(b.ktotal("TEXT")).toBe(1);

    const k0 = b.kdata(0);
    const k1 = b.kdata(1);
    const k2 = b.kdata(2);

    expect(k0).toMatchObject({ found: true, file: "/kernels/a.bsp", filtyp: "SPK", handle: 1 });
    expect(k1).toMatchObject({ found: true, file: "/kernels/b.tls", filtyp: "TEXT", handle: 2 });
    expect(k2).toMatchObject({ found: true, file: "/kernels/c.bc", filtyp: "CK", handle: 3 });

    expect(b.kdata(3)).toEqual({ found: false });

    b.unload("/kernels/a.bsp");
    expect(b.ktotal()).toBe(2);
    expect(b.ktotal("SPK")).toBe(0);
    expect(b.ktotal("CK")).toBe(1);

    b.kclear();
    expect(b.ktotal()).toBe(0);
    expect(b.ktotal("CK")).toBe(0);
  });

  it("throws on unsupported kernel extensions by default", () => {
    const b = createFakeBackend();
    expect(() => b.furnsh("/kernels/unknown.foo")).toThrow(RangeError);
  });

  it("can assume TEXT for unknown extensions when configured", () => {
    const b = createFakeBackend({ unknownExtension: "assume-text" });
    b.furnsh("/kernels/unknown.foo");
    expect(b.ktotal("TEXT")).toBe(1);
  });

  it("returns identity pxform for same-frame transforms", () => {
    const b = createFakeBackend();
    expect(b.pxform("J2000", "J2000", 0)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("rejects non-integer rotate() axes for CSPICE parity", () => {
    const b = createFakeBackend();
    expect(() => b.rotate(0.123, 1.9)).toThrow(/expected a finite integer/i);
  });

  it("throws on invalid kernel-pool start/room args", () => {
    const b = createFakeBackend();
    b.pdpool("NUM", [1, 2, 3]);
    b.pcpool("STR", ["A", "B"]);

    // start must be a finite integer >= 0
    expect(() => b.gdpool("NUM", -1, 1)).toThrow(/start/i);
    expect(() => b.gipool("NUM", -1, 1)).toThrow(/start/i);
    expect(() => b.gcpool("STR", -1, 1)).toThrow(/start/i);
    expect(() => b.gnpool("NO_MATCHES", -1, 1)).toThrow(/start/i);

    expect(() => b.gdpool("NUM", Number.NaN, 1)).toThrow(/start/i);
    expect(() => b.gdpool("NUM", Infinity, 1)).toThrow(/start/i);
    expect(() => b.gdpool("NUM", 0.5, 1)).toThrow(/start/i);

    // room must be a finite integer > 0
    expect(() => b.gdpool("NUM", 0, 0)).toThrow(/room/i);
    expect(() => b.gipool("NUM", 0, 0)).toThrow(/room/i);
    expect(() => b.gcpool("STR", 0, 0)).toThrow(/room/i);
    expect(() => b.gnpool("NO_MATCHES", 0, 0)).toThrow(/room/i);

    expect(() => b.gdpool("NUM", 0, Number.NaN)).toThrow(/room/i);
    expect(() => b.gdpool("NUM", 0, Infinity)).toThrow(/room/i);
    expect(() => b.gdpool("NUM", 0, 1.5)).toThrow(/room/i);
  });

  it("rejects empty/blank kernel-pool string identifiers", () => {
    const b = createFakeBackend();

    for (const name of ["", "   "]) {
      expect(() => b.gdpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.gipool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.gcpool(name, 0, 1)).toThrow(RangeError);
      expect(() => b.dtpool(name)).toThrow(RangeError);

      expect(() => b.pdpool(name, [1])).toThrow(RangeError);
      expect(() => b.pipool(name, [1])).toThrow(RangeError);
      expect(() => b.pcpool(name, ["A"])).toThrow(RangeError);

      expect(() => b.expool(name)).toThrow(RangeError);
    }

    for (const template of ["", "   "]) {
      expect(() => b.gnpool(template, 0, 1)).toThrow(RangeError);
    }

    for (const agent of ["", "   "]) {
      expect(() => b.swpool(agent, [])).toThrow(RangeError);
      expect(() => b.cvpool(agent)).toThrow(RangeError);
    }

    // swpool(): names entries must be non-empty strings (but [] is allowed)
    for (const blank of ["", "   "]) {
      expect(() => b.swpool("AGENT", [blank])).toThrow(RangeError);
    }
  });

  it("rejects non-finite pdpool() values", () => {
    const b = createFakeBackend();

    for (const v of [Number.NaN, Infinity, -Infinity]) {
      try {
        b.pdpool("NUM", [v]);
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
    expect(() => b.pipool("I", [1.5])).toThrow(TypeError);

    // pipool(): rejects out-of-range int32
    expect(() => b.pipool("I", [2147483648])).toThrow(RangeError);
    expect(() => b.pipool("I", [-2147483649])).toThrow(RangeError);

    // pipool(): accepts int32 edge values and preserves them
    b.pipool("I", [-2147483648, 2147483647]);
    expect(b.gipool("I", 0, 10)).toEqual({
      found: true,
      values: [-2147483648, 2147483647],
    });

    // gipool(): throws if the stored numeric variable isn't representable as int32
    b.pdpool("NUM", [1.1]);
    expect(() => b.gipool("NUM", 0, 10)).toThrow(TypeError);
  });

  it("supports escaping wildcards in gnpool templates", () => {
    const b = createFakeBackend();
    b.pdpool("A*B", [1]);
    b.pdpool("AXYB", [1]);
    b.pdpool("A%B", [1]);
    b.pdpool("AQB", [1]);
    const nameBackslash = "A" + "\\" + "B";
    b.pdpool(nameBackslash, [1]);


    const tplEscStar = "A" + "\\" + "*B";
    const tplEscPct = "A" + "\\" + "%B";
    const tplEscBackslash = "A" + "\\" + "\\" + "B";

    expect([...tplEscStar]).toEqual(["A", "\\", "*", "B"]);
    expect([...tplEscPct]).toEqual(["A", "\\", "%", "B"]);
    expect([...tplEscBackslash]).toEqual(["A", "\\", "\\", "B"]);

    expect(b.gnpool(tplEscStar, 0, 10)).toEqual({ found: true, values: ["A*B"] });
    expect(b.gnpool(tplEscPct, 0, 10)).toEqual({ found: true, values: ["A%B"] });
    expect(b.gnpool(tplEscBackslash, 0, 10)).toEqual({ found: true, values: [nameBackslash] });
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

  it("matches CSPICE-style error message conventions (setmsg + sigerr)", () => {
    const b = createFakeBackend();

    b.setmsg("something went wrong");
    b.sigerr("SPICE(FAKE)");

    expect(b.failed()).toBe(true);
    expect(b.getmsg("SHORT")).toBe("SPICE(FAKE)");
    expect(b.getmsg("LONG")).toBe("something went wrong");
    expect(b.getmsg("EXPLAIN")).toContain("something went wrong");

    // `sigerr(short)` should not overwrite the long message.
    expect(b.getmsg("LONG")).toBe("something went wrong");
  });

  it("includes trace info in EXPLAIN when available", () => {
    const b = createFakeBackend();
    b.chkin("A");
    b.chkin("B");
    b.setmsg("long message");
    b.sigerr("SPICE(TRACE)");
    expect(b.getmsg("EXPLAIN")).toContain("Trace:");
    expect(b.getmsg("EXPLAIN")).toContain("A -> B");
  });

  it("rejects invalid getmsg(which) selectors", () => {
    const b = createFakeBackend();
    expect(() => b.getmsg("NOPE" as never)).toThrow(/getmsg\(which\)/i);
  });
});
