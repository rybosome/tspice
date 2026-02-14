import type {
  GeometryGfApi,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32 } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

const UINT32_MAX = 0xffff_ffff;

// Opaque window handles are represented as branded numbers in the backend
// contract, but we still validate them at runtime to keep error behavior
// consistent across backends.
function assertOpaqueHandle(handle: unknown, context: string): asserts handle is number {
  if (typeof handle !== "number" || !Number.isFinite(handle) || !Number.isInteger(handle)) {
    throw new TypeError(`${context}: expected handle to be an integer number (got ${handle})`);
  }
  if (handle <= 0) {
    throw new RangeError(`${context}: expected handle to be > 0 (got ${handle})`);
  }
  if (!Number.isSafeInteger(handle) || handle > UINT32_MAX) {
    throw new RangeError(`${context}: expected handle to be a non-zero uint32 (got ${handle})`);
  }
}

function assertFiniteNumber(value: unknown, context: string): asserts value is number {
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
      invariant(typeof out === "number" && Number.isFinite(out), "Expected gfstep() to return a finite number");
      return out;
    },

    gfstol: (value) => {
      assertFiniteNumber(value, "gfstol(value)");
      native.gfstol(value);
    },

    gfrefn: (t1, t2, s1, s2) => {
      assertFiniteNumber(t1, "gfrefn(t1)");
      assertFiniteNumber(t2, "gfrefn(t2)");
      const out = native.gfrefn(t1, t2, s1, s2);
      invariant(typeof out === "number" && Number.isFinite(out), "Expected gfrefn() to return a finite number");
      return out;
    },

    gfrepi: (window, begmss, endmss) => {
      assertOpaqueHandle(window as unknown as number, "gfrepi(window)");
      native.gfrepi(window, begmss, endmss);
    },

    gfrepf: () => {
      native.gfrepf();
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
      assertSpiceInt32(nintvls, "gfsep(nintvls)", { min: 1 });
      assertFiniteNumber(refval, "gfsep(refval)");
      assertFiniteNumber(adjust, "gfsep(adjust)");
      assertFiniteNumber(step, "gfsep(step)");
      assertOpaqueHandle(cnfine as unknown as number, "gfsep(cnfine)");
      assertOpaqueHandle(result as unknown as number, "gfsep(result)");

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

    gfdist: (target, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result) => {
      assertSpiceInt32(nintvls, "gfdist(nintvls)", { min: 1 });
      assertFiniteNumber(refval, "gfdist(refval)");
      assertFiniteNumber(adjust, "gfdist(adjust)");
      assertFiniteNumber(step, "gfdist(step)");
      assertOpaqueHandle(cnfine as unknown as number, "gfdist(cnfine)");
      assertOpaqueHandle(result as unknown as number, "gfdist(result)");

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
