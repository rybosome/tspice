import type { CoordsVectorsApi, SpiceVector3 } from "@rybosome/tspice-backend-contract";
import { invariant } from "@rybosome/tspice-core";

import type { NativeAddon } from "../runtime/addon.js";

export function createCoordsVectorsApi(native: NativeAddon): CoordsVectorsApi {
  return {
    reclat: (rect) => {
      const out = native.reclat(rect);
      invariant(out && typeof out === "object", "Expected reclat() to return an object");
      invariant(typeof out.radius === "number", "Expected reclat().radius to be a number");
      invariant(typeof out.lon === "number", "Expected reclat().lon to be a number");
      invariant(typeof out.lat === "number", "Expected reclat().lat to be a number");
      return { radius: out.radius, lon: out.lon, lat: out.lat };
    },

    latrec: (radius, lon, lat) => {
      const out = native.latrec(radius, lon, lat);
      invariant(Array.isArray(out) && out.length === 3, "Expected latrec() to return a length-3 array");
      return out as SpiceVector3;
    },

    recsph: (rect) => {
      const out = native.recsph(rect);
      invariant(out && typeof out === "object", "Expected recsph() to return an object");
      invariant(typeof out.radius === "number", "Expected recsph().radius to be a number");
      invariant(typeof out.colat === "number", "Expected recsph().colat to be a number");
      invariant(typeof out.lon === "number", "Expected recsph().lon to be a number");
      return { radius: out.radius, colat: out.colat, lon: out.lon };
    },

    sphrec: (radius, colat, lon) => {
      const out = native.sphrec(radius, colat, lon);
      invariant(Array.isArray(out) && out.length === 3, "Expected sphrec() to return a length-3 array");
      return out as SpiceVector3;
    },

    vnorm: (v) => {
      const out = native.vnorm(v);
      invariant(typeof out === "number", "Expected vnorm() to return a number");
      return out;
    },

    vhat: (v) => {
      const out = native.vhat(v);
      invariant(Array.isArray(out) && out.length === 3, "Expected vhat() to return a length-3 array");
      return out as SpiceVector3;
    },

    vdot: (a, b) => {
      const out = native.vdot(a, b);
      invariant(typeof out === "number", "Expected vdot() to return a number");
      return out;
    },

    vcrss: (a, b) => {
      const out = native.vcrss(a, b);
      invariant(Array.isArray(out) && out.length === 3, "Expected vcrss() to return a length-3 array");
      return out as SpiceVector3;
    },

    mxv: (m, v) => {
      const out = native.mxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mxv() to return a length-3 array");
      return out as SpiceVector3;
    },

    mtxv: (m, v) => {
      const out = native.mtxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mtxv() to return a length-3 array");
      return out as SpiceVector3;
    },
  };
}
