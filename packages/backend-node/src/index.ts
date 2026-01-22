import type {
  AbCorr,
  Et2UtcFormat,
  Found,
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
    furnsh: NOT_IMPL,
    unload: NOT_IMPL,
    kclear: NOT_IMPL,

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
