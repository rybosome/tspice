import { describe, it } from "vitest";

import { createBackend, createSpice } from "@rybosome/tspice";

describe("createBackend() types", () => {
  it("does not expose WASM-only helpers on the public backend type", async () => {
    // This test is about TypeScript types, not runtime behavior.
    //
    // In JS-only CI we intentionally do not build the native backend, so
    // `createBackend({ backend: "node" })` may fail at runtime.
    //
    // Wrap in a dead-code branch so TS still typechecks.
    if (false) {
      const wasmBackend = await createBackend({ backend: "wasm" });

      // WASM-only helpers should not be on the public backend contract.
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      wasmBackend.loadKernel;
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      wasmBackend.writeFile;

      // --- derived geometry ---
      const sub = wasmBackend.subpnt(
        "Near point: ellipsoid",
        "EARTH",
        0,
        "IAU_EARTH",
        "NONE",
        "SUN",
      );
      sub.spoint;
      sub.trgepc;
      sub.srfvec;

      const sin = wasmBackend.sincpt(
        "Ellipsoid",
        "EARTH",
        0,
        "IAU_EARTH",
        "NONE",
        "SUN",
        "J2000",
        [1, 0, 0],
      );
      if (sin.found) {
        sin.spoint;
        sin.trgepc;
        sin.srfvec;
      }

      const illum = wasmBackend.ilumin(
        "Ellipsoid",
        "EARTH",
        0,
        "IAU_EARTH",
        "NONE",
        "SUN",
        [1, 2, 3],
      );
      illum.phase;
      illum.incdnc;
      illum.emissn;

      const ocltid = wasmBackend.occult(
        "MOON",
        "ELLIPSOID",
        "IAU_MOON",
        "SUN",
        "ELLIPSOID",
        "IAU_SUN",
        "NONE",
        "EARTH",
        0,
      );
      ocltid;

      const nodeBackend = await createBackend({ backend: "node" });
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      nodeBackend.loadKernel;
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      nodeBackend.writeFile;

      // @ts-expect-error `createBackend()` only supports { backend: "node" | "wasm" }
      const fakeBackend = await createBackend({ backend: "fake" });
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      fakeBackend.loadKernel;
      // @ts-expect-error wasm-only helper is not part of SpiceBackend
      fakeBackend.writeFile;
    }
  });
});

describe("createSpice() types", () => {
  it("returns { raw, kit }", async () => {
    // This test is about TypeScript types, not runtime behavior.
    if (false) {
      const spice = await createSpice({ backend: "wasm" });

      // Kit.
      spice.kit.loadKernel;
      spice.kit.utcToEt;
      spice.kit.getState;

      // Raw backend surface.
      spice.raw.furnsh;
      spice.raw.str2et;
      spice.raw.kclear;

      // No flattening onto the top-level.
      // @ts-expect-error createSpice() no longer flattens primitives
      spice.furnsh;
    }
  });
});
