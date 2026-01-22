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

    namfrm(frameName: string) {
      const result = getNativeAddon().namfrm(frameName);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.frameId === "number", "Expected namfrm().frameId to be a number");
      return { found: true, frameId: result.frameId } satisfies Found<{ frameId: number }>;
    },

    frmnam(frameId: number) {
      const result = getNativeAddon().frmnam(frameId);
      if (!result.found) {
        return { found: false };
      }
      invariant(typeof result.frameName === "string", "Expected frmnam().frameName to be a string");
      return { found: true, frameName: result.frameName } satisfies Found<{ frameName: string }>;
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
