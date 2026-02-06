import type { CoordsVectorsApi, SpiceVector3 } from "@rybosome/tspice-backend-contract";
import { assertMat3ArrayLike9, brandMat3RowMajor } from "@rybosome/tspice-backend-contract";
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
      assertMat3ArrayLike9(m, { label: "mxv().m" });
      const out = native.mxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mxv() to return a length-3 array");
      return out as SpiceVector3;
    },

    mtxv: (m, v) => {
      assertMat3ArrayLike9(m, { label: "mtxv().m" });
      const out = native.mtxv(m, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected mtxv() to return a length-3 array");
      return out as SpiceVector3;
    },

    vadd: (a, b) => {
      const out = native.vadd(a, b);
      invariant(Array.isArray(out) && out.length === 3, "Expected vadd() to return a length-3 array");
      return out as SpiceVector3;
    },

    vsub: (a, b) => {
      const out = native.vsub(a, b);
      invariant(Array.isArray(out) && out.length === 3, "Expected vsub() to return a length-3 array");
      return out as SpiceVector3;
    },

    vminus: (v) => {
      const out = native.vminus(v);
      invariant(Array.isArray(out) && out.length === 3, "Expected vminus() to return a length-3 array");
      return out as SpiceVector3;
    },

    vscl: (s, v) => {
      const out = native.vscl(s, v);
      invariant(Array.isArray(out) && out.length === 3, "Expected vscl() to return a length-3 array");
      return out as SpiceVector3;
    },

    mxm: (a, b) => {
      assertMat3ArrayLike9(a, { label: "mxm().a" });
      assertMat3ArrayLike9(b, { label: "mxm().b" });
      const out = native.mxm(a, b);
      invariant(Array.isArray(out) && out.length === 9, "Expected mxm() to return a length-9 array");
      return brandMat3RowMajor(out, { label: "mxm()" });
    },

    rotate: (angle, axis) => {
      const out = native.rotate(angle, axis);
      invariant(Array.isArray(out) && out.length === 9, "Expected rotate() to return a length-9 array");
      return brandMat3RowMajor(out, { label: "rotate()" });
    },

    rotmat: (m, angle, axis) => {
      assertMat3ArrayLike9(m, { label: "rotmat().m" });
      const out = native.rotmat(m, angle, axis);
      invariant(Array.isArray(out) && out.length === 9, "Expected rotmat() to return a length-9 array");
      return brandMat3RowMajor(out, { label: "rotmat()" });
    },

    axisar: (axis, angle) => {
      const out = native.axisar(axis, angle);
      invariant(Array.isArray(out) && out.length === 9, "Expected axisar() to return a length-9 array");
      return brandMat3RowMajor(out, { label: "axisar()" });
    },

    georec: (lon, lat, alt, re, f) => {
      const out = native.georec(lon, lat, alt, re, f);
      invariant(Array.isArray(out) && out.length === 3, "Expected georec() to return a length-3 array");
      return out as SpiceVector3;
    },

    recgeo: (rect, re, f) => {
      const out = native.recgeo(rect, re, f);
      invariant(out && typeof out === "object", "Expected recgeo() to return an object");
      invariant(typeof (out as any).lon === "number", "Expected recgeo().lon to be a number");
      invariant(typeof (out as any).lat === "number", "Expected recgeo().lat to be a number");
      invariant(typeof (out as any).alt === "number", "Expected recgeo().alt to be a number");
      return { lon: (out as any).lon, lat: (out as any).lat, alt: (out as any).alt };
    },
  };
}
