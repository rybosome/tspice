import { describe, it } from "vitest";

import { createBackend, createSpice } from "@rybosome/tspice";

describe("createBackend() types", () => {
  it("exposes wasm-only helpers only on wasm backend", async () => {
    // This test is about TypeScript types, not runtime behavior.
    //
    // In JS-only CI we intentionally do not build the native backend, so
    // `createBackend({ backend: "node" })` may fail at runtime.
    //
    // Wrap in a dead-code branch so TS still typechecks the overloads.
    if (false) {
      const wasmBackend = await createBackend({ backend: "wasm" });
      // If overloads are correct, this should typecheck.
      wasmBackend.loadKernel;
      wasmBackend.writeFile;

      // --- Phase 3 derived geometry ---
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
      // If overloads are correct, these should *not* typecheck.
      // @ts-expect-error wasm-only helper not present on node backend
      nodeBackend.loadKernel;
      // @ts-expect-error wasm-only helper not present on node backend
      nodeBackend.writeFile;

      const fakeBackend = await createBackend({ backend: "fake" });
      // @ts-expect-error wasm-only helper not present on fake backend
      fakeBackend.loadKernel;
      // @ts-expect-error wasm-only helper not present on fake backend
      fakeBackend.writeFile;
    }
  });
});

describe("createSpice() types", () => {
  it("returns { primitive, tools }", async () => {
    // This test is about TypeScript types, not runtime behavior.
    if (false) {
      const spice = await createSpice({ backend: "wasm" });

      // Tools.
      spice.tools.loadKernel;
      spice.tools.utcToEt;
      spice.tools.getState;

      // Primitives.
      spice.primitive.furnsh;
      spice.primitive.str2et;
      spice.primitive.kclear;

      // No flattening onto the top-level.
      // @ts-expect-error createSpice() no longer flattens primitives
      spice.furnsh;
    }
  });
});
