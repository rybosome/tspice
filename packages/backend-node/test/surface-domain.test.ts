import { expect, it } from "vitest";
import { createNodeBackend } from "@rybosome/tspice-backend-node";
import { nodeAddonAvailable } from "./_helpers/nodeAddonAvailable.js";

it.runIf(nodeAddonAvailable())(
  "validates bounded parameters and snapshots even accessor-backed grid rows before dispatch",
  () => {
    const { raw } = createNodeBackend();
    const row: [number, number] = [0, 0];
    let reads = 0;
    Object.defineProperty(row, 0, {
      get() {
        if (++reads > 1) throw new Error("Repeated read");
        return 0;
      },
    });
    expect(() =>
      raw.latsrf("ELLIPSOID", "UNDEFINED_BODY", 0, "J2000", [row]),
    ).toThrow(/IDCODENOTFOUND/);
    expect(reads).toBe(1);
    expect(() =>
      raw.srfnrm("ELLIPSOID", "100101", 0, "J2000", [[1, NaN, 3]]),
    ).toThrow(/finite/);
    expect(() => raw.latsrf("bad\0method", "100101", 0, "J2000", [])).toThrow(
      /NUL/,
    );
    expect(() => raw.srfnrm("ELLIPSOID", "100101", 0, "\ud800", [])).toThrow(
      /UTF/,
    );
    const args = [
      "100101",
      0,
      "J2000",
      "NONE",
      "CENTER",
      "100102",
      [0, 0, 1],
      1,
      2,
      0.1,
      0.001,
    ] as const;
    expect(() => raw.limbpt("TANGENT/ELLIPSOID", ...args, 11184811)).toThrow(
      /bound/,
    );
    expect(() =>
      raw.termpt("UMBRAL/TANGENT/ELLIPSOID", "100103", ...args, 1.3),
    ).toThrow(/int/i);
  },
);
