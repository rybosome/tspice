import type {
  Found,
  GeometryApi,
  IluminResult,
  SpiceVector3,
  SubPointResult,
} from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createGeometryApi(native: NativeAddon): GeometryApi {
  return {
    subpnt: (method, target, et, fixref, abcorr, observer) => {
      const out = native.subpnt(method, target, et, fixref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected subpnt() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subpnt().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected subpnt().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subpnt().srfvec to be a length-3 array",
      );
      return {
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies SubPointResult;
    },

    subslr: (method, target, et, fixref, abcorr, observer) => {
      const out = native.subslr(method, target, et, fixref, abcorr, observer);
      invariant(out && typeof out === "object", "Expected subslr() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected subslr().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected subslr().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected subslr().srfvec to be a length-3 array",
      );
      return {
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies SubPointResult;
    },

    sincpt: (method, target, et, fixref, abcorr, observer, dref, dvec) => {
      const out = native.sincpt(method, target, et, fixref, abcorr, observer, dref, dvec);
      if (!out.found) {
        return { found: false };
      }

      invariant(out && typeof out === "object", "Expected sincpt() to return an object");
      invariant(
        Array.isArray(out.spoint) && out.spoint.length === 3,
        "Expected sincpt().spoint to be a length-3 array",
      );
      invariant(typeof out.trgepc === "number", "Expected sincpt().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected sincpt().srfvec to be a length-3 array",
      );
      return {
        found: true,
        spoint: out.spoint as SpiceVector3,
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
      } satisfies Found<SubPointResult>;
    },

    ilumin: (method, target, et, fixref, abcorr, observer, spoint) => {
      const out = native.ilumin(method, target, et, fixref, abcorr, observer, spoint);
      invariant(out && typeof out === "object", "Expected ilumin() to return an object");
      invariant(typeof out.trgepc === "number", "Expected ilumin().trgepc to be a number");
      invariant(
        Array.isArray(out.srfvec) && out.srfvec.length === 3,
        "Expected ilumin().srfvec to be a length-3 array",
      );
      invariant(typeof out.phase === "number", "Expected ilumin().phase to be a number");
      invariant(typeof out.incdnc === "number", "Expected ilumin().incdnc to be a number");
      invariant(typeof out.emissn === "number", "Expected ilumin().emissn to be a number");
      return {
        trgepc: out.trgepc,
        srfvec: out.srfvec as SpiceVector3,
        phase: out.phase,
        incdnc: out.incdnc,
        emissn: out.emissn,
      } satisfies IluminResult;
    },

    occult: (targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et) => {
      const out = native.occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et);
      invariant(typeof out === "number", "Expected occult() to return a number");
      return out;
    },
  };
}
