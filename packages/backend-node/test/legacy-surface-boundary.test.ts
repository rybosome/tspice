import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

const test = it.runIf(nodeAddonAvailable());
test("rejects illegal types and bounds before a scientific dispatch", () => {
  const { raw } = createNodeBackend();
  expect(() => raw.illum("EARTH", 0, "NONE", "SUN", [0, Infinity, 1])).toThrow(
    /finite/,
  );
  expect(() => raw.subsol("NEAR POINT", "EARTH", NaN, "NONE", "SUN")).toThrow(
    /finite/,
  );
  expect(() => raw.subpt("NEAR POINT", "EARTH", 0, "NONE", "S\0UN")).toThrow(
    /NUL/,
  );
  expect(() =>
    raw.srfxpt("ELLIPSOID", "EARTH", 0, "NONE", "SUN", "\ud800", [1, 0, 0]),
  ).toThrow(/surrogate/);
  for (const count of [11184810, 2147483648, 1.25])
    expect(() =>
      raw.edterm(
        "UMBRAL",
        "SUN",
        "EARTH",
        0,
        "IAU_EARTH",
        "NONE",
        "MOON",
        count,
      ),
    ).toThrow(/bound|integer|32/i);
});
test("reads readonly ray/point inputs once and rejects minimum body hash before lookup", () => {
  const { raw } = createNodeBackend();
  for (const method of ["illum", "srfxpt"] as const) {
    const vec: [number, number, number] = [1, 0, 0];
    let reads = 0;
    Object.defineProperty(vec, 0, {
      get: () => {
        if (++reads > 1) throw new Error("repeated read");
        return 1;
      },
    });
    expect(() =>
      method === "illum"
        ? raw.illum("-2147483648", 0, "NONE", "SUN", vec)
        : raw.srfxpt(
            "ELLIPSOID",
            "-2147483648",
            0,
            "NONE",
            "SUN",
            "J2000",
            vec,
          ),
    ).toThrow(/hash/);
    expect(reads).toBe(1);
  }
});
