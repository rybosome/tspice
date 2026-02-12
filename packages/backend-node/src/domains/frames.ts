import type {
  FramesApi,
  SpiceMatrix6x6,
  SpiceVector3,
} from "@rybosome/tspice-backend-contract";
import { brandMat3RowMajor } from "@rybosome/tspice-backend-contract";
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

    frinfo: (frameId) => {
      const out = native.frinfo(frameId);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.center === "number", "Expected frinfo().center to be a number");
      invariant(typeof out.frameClass === "number", "Expected frinfo().frameClass to be a number");
      invariant(typeof out.classId === "number", "Expected frinfo().classId to be a number");
      return { found: true, center: out.center, frameClass: out.frameClass, classId: out.classId };
    },

    ccifrm: (frameClass, classId) => {
      const out = native.ccifrm(frameClass, classId);
      if (!out.found) {
        return { found: false };
      }
      invariant(typeof out.frcode === "number", "Expected ccifrm().frcode to be a number");
      invariant(typeof out.frname === "string", "Expected ccifrm().frname to be a string");
      invariant(typeof out.center === "number", "Expected ccifrm().center to be a number");
      return { found: true, frcode: out.frcode, frname: out.frname, center: out.center };
    },

    ckgp: (inst, sclkdp, tol, ref) => {
      const out = native.ckgp(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      const cmat = brandMat3RowMajor(out.cmat, { label: "ckgp().cmat" });
      invariant(typeof out.clkout === "number", "Expected ckgp().clkout to be a number");
      return { found: true, cmat, clkout: out.clkout };
    },

    ckgpav: (inst, sclkdp, tol, ref) => {
      const out = native.ckgpav(inst, sclkdp, tol, ref);
      if (!out.found) {
        return { found: false };
      }
      const cmat = brandMat3RowMajor(out.cmat, { label: "ckgpav().cmat" });
      invariant(Array.isArray(out.av) && out.av.length === 3, "Expected ckgpav().av to be a length-3 array");
      invariant(typeof out.clkout === "number", "Expected ckgpav().clkout to be a number");
      return {
        found: true,
        cmat,
        av: out.av as SpiceVector3,
        clkout: out.clkout,
      };
    },

    cklpf: (ck) => {
      const handle = native.cklpf(ck);
      invariant(typeof handle === "number" && Number.isInteger(handle), "Expected cklpf() to return an integer handle");
      return handle;
    },

    ckupf: (handle) => {
      native.ckupf(handle);
    },

    ckobj: (ck, ids) => {
      native.ckobj(ck, ids as unknown as number);
    },

    ckcov: (ck, idcode, needav, level, tol, timsys, cover) => {
      native.ckcov(
        ck,
        idcode,
        needav,
        level,
        tol,
        timsys,
        cover as unknown as number,
      );
    },

    pxform: (from, to, et) => {
      const m = native.pxform(from, to, et);
      return brandMat3RowMajor(m, { label: "pxform()" });
    },

    sxform: (from, to, et) => {
      const m = native.sxform(from, to, et);
      invariant(Array.isArray(m) && m.length === 36, "Expected sxform() to return a length-36 array");
      return m as SpiceMatrix6x6;
    },
  };
}
