import type {
  AbCorr,
  Et2UtcFormat,
  Found,
  KernelKind,
  Matrix3,
  Matrix6,
  SpiceBackend,
  State6,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "./native.js";

const NOT_IMPL = () => {
  throw new Error("Not implemented yet");
};

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

    str2et: NOT_IMPL,
    et2utc: NOT_IMPL as unknown as (et: number, format: Et2UtcFormat, prec: number) => string,

    // Phase 2
    bodn2c: NOT_IMPL as unknown as (name: string) => Found<{ code: number }>,
    bodc2n: NOT_IMPL as unknown as (code: number) => Found<{ name: string }>,
    namfrm: NOT_IMPL as unknown as (frameName: string) => Found<{ frameId: number }>,
    frmnam: NOT_IMPL as unknown as (frameId: number) => Found<{ frameName: string }>,

    // Phase 3
    spkezr: NOT_IMPL as unknown as (
      target: string,
      et: number,
      ref: string,
      abcorr: AbCorr,
      obs: string,
    ) => { state: State6; lt: number },

    pxform: NOT_IMPL as unknown as (from: string, to: string, et: number) => Matrix3,
    sxform: NOT_IMPL as unknown as (from: string, to: string, et: number) => Matrix6,
  };
}
