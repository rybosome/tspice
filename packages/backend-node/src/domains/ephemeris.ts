import type {
  EphemerisApi,
  SpiceStateVector,
  SpiceVector3,
  SpkezrResult,
  SpkposResult,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createEphemerisApi(native: NativeAddon): EphemerisApi {
  return {
    spkezr: (target, et, ref, abcorr, observer) => {
      const out = native.spkezr(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkezr() to return an object");
      invariant(Array.isArray(out.state) && out.state.length === 6, "Expected spkezr().state to be a length-6 array");
      invariant(typeof out.lt === "number", "Expected spkezr().lt to be a number");
      const state = out.state as SpiceStateVector;
      const result: SpkezrResult = { state, lt: out.lt };
      return result;
    },

    spkpos: (target, et, ref, abcorr, observer) => {
      const out = native.spkpos(target, et, ref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected spkpos() to return an object");
      invariant(Array.isArray(out.pos) && out.pos.length === 3, "Expected spkpos().pos to be a length-3 array");
      invariant(typeof out.lt === "number", "Expected spkpos().lt to be a number");
      const pos = out.pos as SpiceVector3;
      const result: SpkposResult = { pos, lt: out.lt };
      return result;
    },
  };
}
