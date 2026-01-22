import type {
  AbCorr,
  Et2UtcFormat,
  Found,
  KernelKind,
  Matrix3,
  Matrix6,
  SpiceBackend,
  State6,
  Vector3,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

export function spiceVersion(): string {
  const version = getNativeAddon().spiceVersion();
  invariant(typeof version === "string", "Expected native backend spiceVersion() to return a string");
  return version;
}

export function createNodeBackend(): SpiceBackend {
  return {
    kind: "node",

    spiceVersion,

    // Phase 1
    furnsh(path: string) {
      getNativeAddon().furnsh(path);
    },
    unload(path: string) {
      getNativeAddon().unload(path);
    },
    kclear() {
      getNativeAddon().kclear();
    },

    ktotal(kind: KernelKind = "ALL") {
      const total = getNativeAddon().ktotal(kind);
      invariant(typeof total === "number", "Expected native backend ktotal() to return a number");
      return total;
    },

    kdata(which: number, kind: KernelKind = "ALL") {
      const result = getNativeAddon().kdata(which, kind);
      if (!result.found) {
        return { found: false };
      }

      invariant(typeof result.file === "string", "Expected kdata().file to be a string");
      invariant(typeof result.filtyp === "string", "Expected kdata().filtyp to be a string");
      invariant(typeof result.source === "string", "Expected kdata().source to be a string");
      invariant(typeof result.handle === "number", "Expected kdata().handle to be a number");

      return {
        found: true,
        file: result.file!,
        filtyp: result.filtyp!,
        source: result.source!,
        handle: result.handle!,
      } satisfies Found<{ file: string; filtyp: string; source: string; handle: number }>;
    },

    str2et(utc: string) {
      const et = getNativeAddon().str2et(utc);
      invariant(typeof et === "number", "Expected native backend str2et() to return a number");
      return et;
    },

    et2utc(et: number, format: Et2UtcFormat, prec: number) {
      const out = getNativeAddon().et2utc(et, format, prec);
      invariant(typeof out === "string", "Expected native backend et2utc() to return a string");
      return out;
    },

    timout(et: number, picture: string) {
      const out = getNativeAddon().timout(et, picture);
      invariant(typeof out === "string", "Expected native backend timout() to return a string");
      return out;
    },

    // Phase 2
    bodn2c(name: string) {
      const result = getNativeAddon().bodn2c(name);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.code === "number", "Expected bodn2c().code to be a number");
      return { found: true, code: result.code } satisfies Found<{ code: number }>;
    },

    bodc2n(code: number) {
      const result = getNativeAddon().bodc2n(code);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.name === "string", "Expected bodc2n().name to be a string");
      return { found: true, name: result.name } satisfies Found<{ name: string }>;
    },

    namfrm(name: string) {
      const result = getNativeAddon().namfrm(name);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.code === "number", "Expected namfrm().code to be a number");
      return { found: true, code: result.code } satisfies Found<{ code: number }>;
    },

    frmnam(code: number) {
      const result = getNativeAddon().frmnam(code);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.name === "string", "Expected frmnam().name to be a string");
      return { found: true, name: result.name } satisfies Found<{ name: string }>;
    },

    cidfrm(center: number) {
      const result = getNativeAddon().cidfrm(center);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.frcode === "number", "Expected cidfrm().frcode to be a number");
      invariant(typeof result.frname === "string", "Expected cidfrm().frname to be a string");
      return {
        found: true,
        frcode: result.frcode,
        frname: result.frname,
      } satisfies Found<{ frcode: number; frname: string }>;
    },

    cnmfrm(centerName: string) {
      const result = getNativeAddon().cnmfrm(centerName);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.frcode === "number", "Expected cnmfrm().frcode to be a number");
      invariant(typeof result.frname === "string", "Expected cnmfrm().frname to be a string");
      return {
        found: true,
        frcode: result.frcode,
        frname: result.frname,
      } satisfies Found<{ frcode: number; frname: string }>;
    },

    scs2e(sc: number, sclkch: string) {
      const et = getNativeAddon().scs2e(sc, sclkch);
      invariant(typeof et === "number", "Expected native backend scs2e() to return a number");
      return et;
    },

    sce2s(sc: number, et: number) {
      const out = getNativeAddon().sce2s(sc, et);
      invariant(typeof out === "string", "Expected native backend sce2s() to return a string");
      return out;
    },

    ckgp(inst: number, sclkdp: number, tol: number, ref: string) {
      const result = getNativeAddon().ckgp(inst, sclkdp, tol, ref);
      if (!result.found) {
        return { found: false };
      }

      invariant(Array.isArray(result.cmat), "Expected ckgp().cmat to be an array");
      invariant(result.cmat.length === 9, "Expected ckgp().cmat to have length 9");
      invariant(typeof result.clkout === "number", "Expected ckgp().clkout to be a number");

      return {
        found: true,
        cmat: result.cmat as unknown as Matrix3,
        clkout: result.clkout,
      } satisfies Found<{ cmat: Matrix3; clkout: number }>;
    },

    ckgpav(inst: number, sclkdp: number, tol: number, ref: string) {
      const result = getNativeAddon().ckgpav(inst, sclkdp, tol, ref);
      if (!result.found) {
        return { found: false };
      }

      invariant(Array.isArray(result.cmat), "Expected ckgpav().cmat to be an array");
      invariant(result.cmat.length === 9, "Expected ckgpav().cmat to have length 9");
      invariant(Array.isArray(result.av), "Expected ckgpav().av to be an array");
      invariant(result.av.length === 3, "Expected ckgpav().av to have length 3");
      invariant(typeof result.clkout === "number", "Expected ckgpav().clkout to be a number");

      return {
        found: true,
        cmat: result.cmat as unknown as Matrix3,
        av: result.av as unknown as Vector3,
        clkout: result.clkout,
      } satisfies Found<{ cmat: Matrix3; av: Vector3; clkout: number }>;
    },

    // Phase 3
    spkezr(target: string, et: number, ref: string, abcorr: AbCorr, obs: string) {
      const result = getNativeAddon().spkezr(target, et, ref, abcorr, obs);
      invariant(Array.isArray(result.state), "Expected spkezr().state to be an array");
      invariant(result.state.length === 6, "Expected spkezr().state to have length 6");
      invariant(typeof result.lt === "number", "Expected spkezr().lt to be a number");
      return {
        state: result.state as unknown as State6,
        lt: result.lt,
      };
    },

    spkpos(target: string, et: number, ref: string, abcorr: AbCorr, obs: string) {
      const result = getNativeAddon().spkpos(target, et, ref, abcorr, obs);
      invariant(Array.isArray(result.pos), "Expected spkpos().pos to be an array");
      invariant(result.pos.length === 3, "Expected spkpos().pos to have length 3");
      invariant(typeof result.lt === "number", "Expected spkpos().lt to be a number");
      return {
        pos: result.pos as unknown as Vector3,
        lt: result.lt,
      };
    },

    pxform(from: string, to: string, et: number) {
      const out = getNativeAddon().pxform(from, to, et);
      invariant(Array.isArray(out), "Expected pxform() to return an array");
      invariant(out.length === 9, "Expected pxform() to return length 9");
      return out as unknown as Matrix3;
    },

    sxform(from: string, to: string, et: number) {
      const out = getNativeAddon().sxform(from, to, et);
      invariant(Array.isArray(out), "Expected sxform() to return an array");
      invariant(out.length === 36, "Expected sxform() to return length 36");
      return out as unknown as Matrix6;
    },
  };
}
