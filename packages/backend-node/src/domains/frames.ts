import type {
  Found,
  FramesApi,
  Mat3RowMajor,
  SpiceMatrix6x6,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createFramesApi(native: NativeAddon): FramesApi {
  return {
    namfrm: (name) => {
      const out = native.namfrm(name);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.code === "number", "Expected namfrm().code to be a number");
      return { found: true, code: out.code };
    },

    frmnam: (code) => {
      const out = native.frmnam(code);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.name === "string", "Expected frmnam().name to be a string");
      return { found: true, name: out.name };
    },

    cidfrm: (center) => {
      const out = native.cidfrm(center);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frcode === "number", "Expected cidfrm().frcode to be a number");
      invariant(typeof out.frname === "string", "Expected cidfrm().frname to be a string");
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    cnmfrm: (centerName) => {
      const out = native.cnmfrm(centerName);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frcode === "number", "Expected cnmfrm().frcode to be a number");
      invariant(typeof out.frname === "string", "Expected cnmfrm().frname to be a string");
      return { found: true, frcode: out.frcode, frname: out.frname };
    },

    ckgp: (inst, sclkdp, tol, ref) => {
      const out = native.ckgp(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      invariant(Array.isArray(out.cmat) && out.cmat.length === 9, "Expected ckgp().cmat to be a length-9 array");
      invariant(typeof out.clkout === "number", "Expected ckgp().clkout to be a number");
      return { found: true, cmat: out.cmat as Mat3RowMajor, clkout: out.clkout };
    },

    ckgpav: (inst, sclkdp, tol, ref) => {
      const out = native.ckgpav(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      invariant(
        Array.isArray(out.cmat) && out.cmat.length === 9,
        "Expected ckgpav().cmat to be a length-9 array",
      );
      invariant(Array.isArray(out.av) && out.av.length === 3, "Expected ckgpav().av to be a length-3 array");
      invariant(typeof out.clkout === "number", "Expected ckgpav().clkout to be a number");
      return {
        found: true,
        cmat: out.cmat as Mat3RowMajor,
        av: out.av as SpiceVector3,
        clkout: out.clkout,
      };
    },

    pxform: (from, to, et) => {
      const m = native.pxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 9, "Expected pxform() to return a length-9 array");
      return m as Mat3RowMajor;
    },

    sxform: (from, to, et) => {
      const m = native.sxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 36, "Expected sxform() to return a length-36 array");
      return m as SpiceMatrix6x6;
    },
  };
}
