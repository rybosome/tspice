import type { GeometryGfApi } from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  invariant,
  finiteGeometryVector,
  fovRayDirection,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

const UINT32_MAX = 0xffff_ffff;

// Opaque window handles are represented as branded numbers in the backend
// contract, but we still validate them at runtime to keep error behavior
// consistent across backends.
function assertOpaqueHandle(
  handle: unknown,
  context: string,
): asserts handle is number {
  if (
    typeof handle !== "number" ||
    !Number.isFinite(handle) ||
    !Number.isInteger(handle)
  ) {
    throw new TypeError(
      `${context}: expected handle to be an integer number (got ${handle})`,
    );
  }
  if (handle <= 0) {
    throw new RangeError(
      `${context}: expected handle to be > 0 (got ${handle})`,
    );
  }
  if (!Number.isSafeInteger(handle) || handle > UINT32_MAX) {
    throw new RangeError(
      `${context}: expected handle to be a non-zero uint32 (got ${handle})`,
    );
  }
}

function assertGfStrings(values: readonly unknown[], context: string): void {
  for (const value of values)
    if (typeof value !== "string")
      throw new TypeError(`${context}: expected strings`);
}
function assertGfBoolean(value: unknown, context: string): void {
  if (typeof value !== "boolean")
    throw new TypeError(`${context}: expected boolean`);
}

function validateScalarSearch(
  refval: number,
  adjust: number,
  step: number,
  nintvls: number,
): void {
  assertFiniteNumber(refval, "refval");
  assertFiniteNumber(adjust, "adjust");
  assertFiniteNumber(step, "step");
  assertSpiceInt32(nintvls, "nintvls");
}

function assertFiniteNumber(
  value: unknown,
  context: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${context}: expected a finite number (got ${value})`);
  }
}

/** Create a {@link GeometryGfApi} implementation backed by the native Node addon. */
export function createGeometryGfApi(native: NativeAddon): GeometryGfApi {
  return {
    gfsstp: (step) => {
      assertFiniteNumber(step, "gfsstp(step)");
      native.gfsstp(step);
    },

    gfstep: (time) => {
      assertFiniteNumber(time, "gfstep(time)");
      const out = native.gfstep(time);
      invariant(
        typeof out === "number" && Number.isFinite(out),
        "Expected gfstep() to return a finite number",
      );
      return out;
    },

    gfstol: (value) => {
      assertFiniteNumber(value, "gfstol(value)");
      native.gfstol(value);
    },

    gfrefn: (t1, t2, s1, s2) => {
      assertGfBoolean(s1, "gfrefn(s1)");
      assertGfBoolean(s2, "gfrefn(s2)");
      assertFiniteNumber(t1, "gfrefn(t1)");
      assertFiniteNumber(t2, "gfrefn(t2)");
      const out = native.gfrefn(t1, t2, s1, s2);
      invariant(
        typeof out === "number" && Number.isFinite(out),
        "Expected gfrefn() to return a finite number",
      );
      return out;
    },

    gfrepi: (window, begmss, endmss) => {
      assertGfStrings([begmss, endmss], "gfrepi");
      assertOpaqueHandle(window, "gfrepi(window)");
      native.gfrepi(window, begmss, endmss);
    },

    gfrepf: () => {
      native.gfrepf();
    },

    gfpa: (
      target,
      illmn,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [target, illmn, abcorr, obsrvr, relate])
        spiceStringByteLength(text, "gfpa");
      assertOpaqueHandle(cnfine, "gfpa(cnfine)");
      assertOpaqueHandle(result, "gfpa(result)");
      native.gfpa(
        target,
        illmn,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfposc: (
      target,
      frame,
      abcorr,
      obsrvr,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [target, frame, abcorr, obsrvr, crdsys, coord, relate])
        spiceStringByteLength(text, "gfposc");
      assertOpaqueHandle(cnfine, "gfposc(cnfine)");
      assertOpaqueHandle(result, "gfposc(result)");
      native.gfposc(
        target,
        frame,
        abcorr,
        obsrvr,
        crdsys,
        coord,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfrr: (
      target,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [target, abcorr, obsrvr, relate])
        spiceStringByteLength(text, "gfrr");
      assertOpaqueHandle(cnfine, "gfrr(cnfine)");
      assertOpaqueHandle(result, "gfrr(result)");
      native.gfrr(
        target,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfsntc: (
      target,
      fixref,
      method,
      abcorr,
      obsrvr,
      dref,
      dvec,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [
        target,
        fixref,
        method,
        abcorr,
        obsrvr,
        dref,
        crdsys,
        coord,
        relate,
      ])
        spiceStringByteLength(text, "gfsntc");
      assertOpaqueHandle(cnfine, "gfsntc(cnfine)");
      assertOpaqueHandle(result, "gfsntc(result)");
      native.gfsntc(
        target,
        fixref,
        method,
        abcorr,
        obsrvr,
        dref,
        finiteGeometryVector(dvec, "dvec"),
        crdsys,
        coord,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfsubc: (
      target,
      fixref,
      method,
      abcorr,
      obsrvr,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [
        target,
        fixref,
        method,
        abcorr,
        obsrvr,
        crdsys,
        coord,
        relate,
      ])
        spiceStringByteLength(text, "gfsubc");
      assertOpaqueHandle(cnfine, "gfsubc(cnfine)");
      assertOpaqueHandle(result, "gfsubc(result)");
      native.gfsubc(
        target,
        fixref,
        method,
        abcorr,
        obsrvr,
        crdsys,
        coord,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfilum: (
      method,
      angtyp,
      target,
      illmn,
      fixref,
      abcorr,
      obsrvr,
      spoint,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      for (const text of [
        method,
        angtyp,
        target,
        illmn,
        fixref,
        abcorr,
        obsrvr,
        relate,
      ])
        spiceStringByteLength(text, "gfilum");
      assertOpaqueHandle(cnfine, "gfilum(cnfine)");
      assertOpaqueHandle(result, "gfilum(result)");
      native.gfilum(
        method,
        angtyp,
        target,
        illmn,
        fixref,
        abcorr,
        obsrvr,
        finiteGeometryVector(spoint, "spoint"),
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
    gfoclt: (
      occtyp,
      front,
      fshape,
      fframe,
      back,
      bshape,
      bframe,
      abcorr,
      obsrvr,
      step,
      cnfine,
      result,
    ) => {
      for (const text of [
        occtyp,
        front,
        fshape,
        fframe,
        back,
        bshape,
        bframe,
        abcorr,
        obsrvr,
      ])
        spiceStringByteLength(text, "gfoclt");
      assertFiniteNumber(step, "gfoclt(step)");
      assertOpaqueHandle(cnfine, "gfoclt(cnfine)");
      assertOpaqueHandle(result, "gfoclt(result)");
      native.gfoclt(
        occtyp,
        front,
        fshape,
        fframe,
        back,
        bshape,
        bframe,
        abcorr,
        obsrvr,
        step,
        cnfine,
        result,
      );
    },
    gfrfov: (inst, raydir, rframe, abcorr, obsrvr, step, cnfine, result) => {
      for (const text of [inst, rframe, abcorr, obsrvr])
        spiceStringByteLength(text, "gfrfov");
      assertFiniteNumber(step, "gfrfov(step)");
      assertOpaqueHandle(cnfine, "gfrfov(cnfine)");
      assertOpaqueHandle(result, "gfrfov(result)");
      native.gfrfov(
        inst,
        fovRayDirection(raydir),
        rframe,
        abcorr,
        obsrvr,
        step,
        cnfine,
        result,
      );
    },
    gftfov: (
      inst,
      target,
      tshape,
      tframe,
      abcorr,
      obsrvr,
      step,
      cnfine,
      result,
    ) => {
      for (const text of [inst, target, tshape, tframe, abcorr, obsrvr])
        spiceStringByteLength(text, "gftfov");
      assertFiniteNumber(step, "gftfov(step)");
      assertOpaqueHandle(cnfine, "gftfov(cnfine)");
      assertOpaqueHandle(result, "gftfov(result)");
      native.gftfov(
        inst,
        target,
        tshape,
        tframe,
        abcorr,
        obsrvr,
        step,
        cnfine,
        result,
      );
    },
    gfsep: (
      targ1,
      shape1,
      frame1,
      targ2,
      shape2,
      frame2,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      assertGfStrings(
        [targ1, shape1, frame1, targ2, shape2, frame2, abcorr, obsrvr, relate],
        "gfsep",
      );
      assertSpiceInt32(nintvls, "gfsep(nintvls)");
      assertFiniteNumber(refval, "gfsep(refval)");
      assertFiniteNumber(adjust, "gfsep(adjust)");
      assertFiniteNumber(step, "gfsep(step)");
      assertOpaqueHandle(cnfine, "gfsep(cnfine)");
      assertOpaqueHandle(result, "gfsep(result)");

      native.gfsep(
        targ1,
        shape1,
        frame1,
        targ2,
        shape2,
        frame2,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },

    gfdist: (
      target,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      assertGfStrings([target, abcorr, obsrvr, relate], "gfdist");
      assertSpiceInt32(nintvls, "gfdist(nintvls)");
      assertFiniteNumber(refval, "gfdist(refval)");
      assertFiniteNumber(adjust, "gfdist(adjust)");
      assertFiniteNumber(step, "gfdist(step)");
      assertOpaqueHandle(cnfine, "gfdist(cnfine)");
      assertOpaqueHandle(result, "gfdist(result)");

      native.gfdist(
        target,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
  };
}
