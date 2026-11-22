import { expect, it } from "vitest";
import { getNativeAddon } from "../src/runtime/addon.js";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const run = it.runIf(nodeAddonAvailable());
run(
  "native callbacks retain identity and errors across nested numerical measurements",
  () => {
    const raw = getNativeAddon();
    const square = (t: number) => t * t;
    expect(raw.uddf((t) => raw.uddf(square, t, 0.125), -4, 0.125)).toBe(2);
    expect(raw.uddc(square, -2, 0.125)).toBe(true);
    expect(() => raw.uddf(square, 2, 0)).toThrow(/DIVIDEBYZERO/);
    const sentinel = new Error("first callback failed");
    let invocations = 0;
    try {
      raw.uddf(
        () => {
          invocations++;
          throw sentinel;
        },
        1,
        0.125,
      );
      throw Error("Missing callback exception");
    } catch (error) {
      expect(error).toBe(sentinel);
    }
    expect(invocations).toBe(1);
    try {
      raw.uddf(
        () => {
          throw "primitive callback failure";
        },
        1,
        0.125,
      );
      throw Error("Missing callback failure");
    } catch (error) {
      expect(error).toBe("primitive callback failure");
    }
    expect(() => raw.uddf(() => Infinity, 2, 0.125)).toThrow(/finite/);
    expect(raw.failed()).toBe(false);
    expect(raw.udf(-17, 23)).toBe(23);
  },
);
run(
  "native user searches retain private windows and reject a replaced result across callback reentry",
  () => {
    const raw = getNativeAddon(),
      c = raw.newWindow(2),
      r = raw.newWindow(2);
    let replacement: typeof r | undefined,
      freed = false;
    try {
      raw.wninsd(-3, 3, c);
      raw.wninsd(9, 10, r);
      const square = (t: number) => t * t;
      expect(() =>
        raw.gfudb(
          square,
          () => {
            raw.gfudb(square, () => true, 0.5, c, r);
            return false;
          },
          0.5,
          c,
          r,
        ),
      ).toThrow(/Nested/);
      expect(raw.wnfetd(r, 0)).toEqual([9, 10]);
      expect(() =>
        raw.gfudb(
          square,
          (f, t) => {
            expect(f).toBe(square);
            if (!freed) {
              raw.freeWindow(r);
              freed = true;
              replacement = raw.newWindow(2);
              raw.wninsd(40, 50, replacement);
            }
            return f(t) < 1;
          },
          0.5,
          c,
          r,
        ),
      ).toThrow(/expired/);
      expect(replacement).toBeDefined();
      if (replacement !== undefined)
        expect(raw.wnfetd(replacement, 0)).toEqual([40, 50]);
      expect(raw.failed()).toBe(false);
    } finally {
      if (replacement !== undefined) raw.freeWindow(replacement);
      if (!freed) raw.freeWindow(r);
      raw.freeWindow(c);
    }
  },
);

run(
  "rejects all ordinary GF searches inside a user search before they change toolkit state",
  () => {
    const raw = getNativeAddon(),
      c = raw.newWindow(2),
      r = raw.newWindow(3);
    const square = (t: number) => t * t;
    try {
      raw.wninsd(-3, 3, c);
      raw.wninsd(9, 10, r);
      // Distinct real windows and well-formed search arguments reach the shared
      // entry guard. No kernels are needed for the outer Boolean search.
      const searches = [
        () => raw.gfdist("MOON", "NONE", "EARTH", "<", 1, 0, 0.25, 16, c, r),
        () =>
          raw.gfsep(
            "MOON",
            "POINT",
            "",
            "SUN",
            "POINT",
            "",
            "NONE",
            "EARTH",
            "<",
            1,
            0,
            0.25,
            16,
            c,
            r,
          ),
        () =>
          raw.gfoclt(
            "ANY",
            "MOON",
            "ELLIPSOID",
            "IAU_MOON",
            "SUN",
            "POINT",
            "",
            "NONE",
            "EARTH",
            0.25,
            c,
            r,
          ),
        () =>
          raw.gfrfov("CAMERA", [1, 0, 0], "J2000", "NONE", "EARTH", 0.25, c, r),
        () =>
          raw.gftfov(
            "CAMERA",
            "MOON",
            "POINT",
            "",
            "NONE",
            "EARTH",
            0.25,
            c,
            r,
          ),
      ];
      for (const inner of searches) {
        expect(() =>
          raw.gfudb(
            square,
            () => {
              inner();
              return true;
            },
            0.25,
            c,
            r,
          ),
        ).toThrow(/Nested Geometry Finder/);
        expect(raw.wnfetd(r, 0)).toEqual([9, 10]);
        expect(raw.failed()).toBe(false);
      }
      raw.gfudb(square, (scalar, t) => scalar(t) <= 1, 0.25, c, r);
      expect(raw.wncard(r)).toBe(1);
      const [start, end] = raw.wnfetd(r, 0);
      expect(start).toBeCloseTo(-1, 5);
      expect(end).toBeCloseTo(1, 5);
    } finally {
      raw.freeWindow(r);
      raw.freeWindow(c);
    }
  },
);
