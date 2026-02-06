import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "../runtime/addon.js";
import type { NativeAddon } from "../runtime/addon.js";

export function getNodeBinding(): NativeAddon {
  const native = getNativeAddon();

  invariant(typeof native.furnsh === "function", "Expected native addon to export furnsh(path)");
  invariant(typeof native.unload === "function", "Expected native addon to export unload(path)");
  invariant(typeof native.kclear === "function", "Expected native addon to export kclear()");
  invariant(typeof native.ktotal === "function", "Expected native addon to export ktotal(kind?)");
  invariant(typeof native.kdata === "function", "Expected native addon to export kdata(which, kind?)");
  invariant(typeof native.str2et === "function", "Expected native addon to export str2et(time)");
  invariant(typeof native.et2utc === "function", "Expected native addon to export et2utc(et, format, prec)");
  invariant(typeof native.timout === "function", "Expected native addon to export timout(et, picture)");
  invariant(typeof native.bodn2c === "function", "Expected native addon to export bodn2c(name)");
  invariant(typeof native.bodc2n === "function", "Expected native addon to export bodc2n(code)");
  invariant(typeof native.namfrm === "function", "Expected native addon to export namfrm(name)");
  invariant(typeof native.frmnam === "function", "Expected native addon to export frmnam(code)");
  invariant(typeof native.cidfrm === "function", "Expected native addon to export cidfrm(center)");
  invariant(typeof native.cnmfrm === "function", "Expected native addon to export cnmfrm(centerName)");
  invariant(typeof native.scs2e === "function", "Expected native addon to export scs2e(sc, sclkch)");
  invariant(typeof native.sce2s === "function", "Expected native addon to export sce2s(sc, et)");
  invariant(typeof native.ckgp === "function", "Expected native addon to export ckgp(inst, sclkdp, tol, ref)");
  invariant(typeof native.ckgpav === "function", "Expected native addon to export ckgpav(inst, sclkdp, tol, ref)");
  invariant(typeof native.pxform === "function", "Expected native addon to export pxform(from, to, et)");
  invariant(typeof native.sxform === "function", "Expected native addon to export sxform(from, to, et)");
  invariant(typeof native.reclat === "function", "Expected native addon to export reclat(rect)");
  invariant(typeof native.latrec === "function", "Expected native addon to export latrec(radius, lon, lat)");
  invariant(typeof native.recsph === "function", "Expected native addon to export recsph(rect)");
  invariant(typeof native.sphrec === "function", "Expected native addon to export sphrec(radius, colat, lon)");
  invariant(typeof native.vnorm === "function", "Expected native addon to export vnorm(v)");
  invariant(typeof native.vhat === "function", "Expected native addon to export vhat(v)");
  invariant(typeof native.vdot === "function", "Expected native addon to export vdot(a, b)");
  invariant(typeof native.vcrss === "function", "Expected native addon to export vcrss(a, b)");
  invariant(typeof native.mxv === "function", "Expected native addon to export mxv(m, v)");
  invariant(typeof native.mtxv === "function", "Expected native addon to export mtxv(m, v)");
  invariant(typeof native.vadd === "function", "Expected native addon to export vadd(a, b)");
  invariant(typeof native.vsub === "function", "Expected native addon to export vsub(a, b)");
  invariant(typeof native.vminus === "function", "Expected native addon to export vminus(v)");
  invariant(typeof native.vscl === "function", "Expected native addon to export vscl(s, v)");
  invariant(typeof native.mxm === "function", "Expected native addon to export mxm(a, b)");
  invariant(typeof native.rotate === "function", "Expected native addon to export rotate(angle, axis)");
  invariant(typeof native.rotmat === "function", "Expected native addon to export rotmat(m, angle, axis)");
  invariant(typeof native.axisar === "function", "Expected native addon to export axisar(axis, angle)");
  invariant(typeof native.georec === "function", "Expected native addon to export georec(lon, lat, alt, re, f)");
  invariant(typeof native.recgeo === "function", "Expected native addon to export recgeo(rect, re, f)");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.spkpos === "function",
    "Expected native addon to export spkpos(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.subpnt === "function",
    "Expected native addon to export subpnt(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.subslr === "function",
    "Expected native addon to export subslr(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.sincpt === "function",
    "Expected native addon to export sincpt(method, target, et, fixref, abcorr, observer, dref, dvec)",
  );
  invariant(
    typeof native.ilumin === "function",
    "Expected native addon to export ilumin(method, target, et, fixref, abcorr, observer, spoint)",
  );
  invariant(
    typeof native.occult === "function",
    "Expected native addon to export occult(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et)",
  );

  return native;
}
