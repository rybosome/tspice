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

  invariant(typeof native.gdpool === "function", "Expected native addon to export gdpool(name, start, room)");
  invariant(typeof native.gipool === "function", "Expected native addon to export gipool(name, start, room)");
  invariant(typeof native.gcpool === "function", "Expected native addon to export gcpool(name, start, room)");
  invariant(typeof native.gnpool === "function", "Expected native addon to export gnpool(template, start, room)");
  invariant(typeof native.dtpool === "function", "Expected native addon to export dtpool(name)");
  invariant(typeof native.pdpool === "function", "Expected native addon to export pdpool(name, values)");
  invariant(typeof native.pipool === "function", "Expected native addon to export pipool(name, values)");
  invariant(typeof native.pcpool === "function", "Expected native addon to export pcpool(name, values)");
  invariant(typeof native.swpool === "function", "Expected native addon to export swpool(agent, names)");
  invariant(typeof native.cvpool === "function", "Expected native addon to export cvpool(agent)");
  invariant(typeof native.expool === "function", "Expected native addon to export expool(name)");
  invariant(typeof native.str2et === "function", "Expected native addon to export str2et(time)");
  invariant(typeof native.et2utc === "function", "Expected native addon to export et2utc(et, format, prec)");
  invariant(typeof native.timout === "function", "Expected native addon to export timout(et, picture)");
  invariant(typeof native.deltet === "function", "Expected native addon to export deltet(epoch, eptype)");
  invariant(typeof native.unitim === "function", "Expected native addon to export unitim(epoch, insys, outsys)");
  invariant(typeof native.tparse === "function", "Expected native addon to export tparse(timstr)");
  invariant(typeof native.tpictr === "function", "Expected native addon to export tpictr(sample, pictur)");
  invariant(typeof native.timdefGet === "function", "Expected native addon to export timdefGet(item)");
  invariant(typeof native.timdefSet === "function", "Expected native addon to export timdefSet(item, value)");
  invariant(typeof native.failed === "function", "Expected native addon to export failed()");
  invariant(typeof native.reset === "function", "Expected native addon to export reset()");
  invariant(typeof native.getmsg === "function", "Expected native addon to export getmsg(which)");
  invariant(typeof native.setmsg === "function", "Expected native addon to export setmsg(message)");
  invariant(typeof native.sigerr === "function", "Expected native addon to export sigerr(short)");
  invariant(typeof native.chkin === "function", "Expected native addon to export chkin(name)");
  invariant(typeof native.chkout === "function", "Expected native addon to export chkout(name)");

  invariant(typeof native.exists === "function", "Expected native addon to export exists(path)");
  invariant(typeof native.getfat === "function", "Expected native addon to export getfat(path)");

  invariant(typeof native.dafopr === "function", "Expected native addon to export dafopr(path)");
  invariant(typeof native.dafcls === "function", "Expected native addon to export dafcls(handle)");
  invariant(typeof native.dafbfs === "function", "Expected native addon to export dafbfs(handle)");
  invariant(typeof native.daffna === "function", "Expected native addon to export daffna(handle)");

  invariant(typeof native.dasopr === "function", "Expected native addon to export dasopr(path)");
  invariant(typeof native.dascls === "function", "Expected native addon to export dascls(handle)");

  invariant(typeof native.dlaopn === "function", "Expected native addon to export dlaopn(path, ftype, ifname, ncomch)");
  invariant(typeof native.dlabfs === "function", "Expected native addon to export dlabfs(handle)");
  invariant(typeof native.dlafns === "function", "Expected native addon to export dlafns(handle, descr)");

  // --- EK ---
  invariant(typeof native.ekopr === "function", "Expected native addon to export ekopr(path)");
  invariant(typeof native.ekopw === "function", "Expected native addon to export ekopw(path)");
  invariant(typeof native.ekopn === "function", "Expected native addon to export ekopn(path, ifname, ncomch)");
  invariant(typeof native.ekcls === "function", "Expected native addon to export ekcls(handle)");
  invariant(typeof native.ekntab === "function", "Expected native addon to export ekntab()");
  invariant(typeof native.ektnam === "function", "Expected native addon to export ektnam(n)");
  invariant(typeof native.eknseg === "function", "Expected native addon to export eknseg(handle)");

  // --- DSK writer ---
  invariant(typeof native.dskopn === "function", "Expected native addon to export dskopn(path, ifname, ncomch)");
  invariant(typeof native.dskmi2 === "function", "Expected native addon to export dskmi2(nv, vrtces, np, plates, finscl, corscl, worksz, voxpsz, voxlsz, makvtl, spxisz)");
  invariant(typeof native.dskw02 === "function", "Expected native addon to export dskw02(handle, center, surfid, dclass, frame, corsys, corpar, mncor1, mxcor1, mncor2, mxcor2, mncor3, mxcor3, first, last, nv, vrtces, np, plates, spaixd, spaixi)");

  invariant(typeof native.dskobj === "function", "Expected native addon to export dskobj(dsk, bodids)");
  invariant(typeof native.dsksrf === "function", "Expected native addon to export dsksrf(dsk, bodyid, srfids)");
  invariant(typeof native.dskgd === "function", "Expected native addon to export dskgd(handle, dladsc)");
  invariant(typeof native.dskb02 === "function", "Expected native addon to export dskb02(handle, dladsc)");

  invariant(typeof native.bodn2c === "function", "Expected native addon to export bodn2c(name)");
  invariant(typeof native.bodc2n === "function", "Expected native addon to export bodc2n(code)");
  invariant(typeof native.namfrm === "function", "Expected native addon to export namfrm(name)");
  invariant(typeof native.frmnam === "function", "Expected native addon to export frmnam(code)");
  invariant(typeof native.cidfrm === "function", "Expected native addon to export cidfrm(center)");
  invariant(typeof native.cnmfrm === "function", "Expected native addon to export cnmfrm(centerName)");
  invariant(typeof native.scs2e === "function", "Expected native addon to export scs2e(sc, sclkch)");
  invariant(typeof native.sce2s === "function", "Expected native addon to export sce2s(sc, et)");
  invariant(typeof native.scencd === "function", "Expected native addon to export scencd(sc, sclkch)");
  invariant(typeof native.scdecd === "function", "Expected native addon to export scdecd(sc, sclkdp)");
  invariant(typeof native.sct2e === "function", "Expected native addon to export sct2e(sc, sclkdp)");
  invariant(typeof native.sce2c === "function", "Expected native addon to export sce2c(sc, et)");
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

  invariant(typeof native.newIntCell === "function", "Expected native addon to export newIntCell(size)");
  invariant(
    typeof native.newDoubleCell === "function",
    "Expected native addon to export newDoubleCell(size)",
  );
  invariant(
    typeof native.newCharCell === "function",
    "Expected native addon to export newCharCell(size, length)",
  );
  invariant(typeof native.newWindow === "function", "Expected native addon to export newWindow(maxIntervals)");
  invariant(typeof native.freeCell === "function", "Expected native addon to export freeCell(cell)");
  invariant(typeof native.freeWindow === "function", "Expected native addon to export freeWindow(window)");
  invariant(typeof native.ssize === "function", "Expected native addon to export ssize(size, cell)");
  invariant(typeof native.scard === "function", "Expected native addon to export scard(card, cell)");
  invariant(typeof native.card === "function", "Expected native addon to export card(cell)");
  invariant(typeof native.size === "function", "Expected native addon to export size(cell)");
  invariant(typeof native.valid === "function", "Expected native addon to export valid(size, n, cell)");
  invariant(typeof native.insrti === "function", "Expected native addon to export insrti(item, cell)");
  invariant(typeof native.insrtd === "function", "Expected native addon to export insrtd(item, cell)");
  invariant(typeof native.insrtc === "function", "Expected native addon to export insrtc(item, cell)");
  invariant(typeof native.cellGeti === "function", "Expected native addon to export cellGeti(cell, index)");
  invariant(typeof native.cellGetd === "function", "Expected native addon to export cellGetd(cell, index)");
  invariant(typeof native.cellGetc === "function", "Expected native addon to export cellGetc(cell, index)");
  invariant(
    typeof native.wninsd === "function",
    "Expected native addon to export wninsd(left, right, window)",
  );
  invariant(typeof native.wncard === "function", "Expected native addon to export wncard(window)");
  invariant(typeof native.wnfetd === "function", "Expected native addon to export wnfetd(window, index)");
  invariant(typeof native.wnvald === "function", "Expected native addon to export wnvald(size, n, window)");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.spkpos === "function",
    "Expected native addon to export spkpos(target, et, ref, abcorr, observer)",
  );
  invariant(typeof native.spkopn === "function", "Expected native addon to export spkopn(path, ifname, ncomch)");
  invariant(typeof native.spkopa === "function", "Expected native addon to export spkopa(path)");
  invariant(typeof native.spkw08 === "function", "Expected native addon to export spkw08(handle, body, center, frame, first, last, segid, degree, states, epoch1, step)");
  invariant(typeof native.spkcls === "function", "Expected native addon to export spkcls(handle)");
  invariant(
    typeof native.subpnt === "function",
    "Expected native addon to export subpnt(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.subslr === "function",
    "Expected native addon to export subslr(method, target, et, fixref, abcorr, observer)",
  );
  invariant(
    typeof native.illumg === "function",
    "Expected native addon to export illumg(method, target, ilusrc, et, fixref, abcorr, observer, spoint)",
  );
  invariant(
    typeof native.illumf === "function",
    "Expected native addon to export illumf(method, target, ilusrc, et, fixref, abcorr, observer, spoint)",
  );
  invariant(typeof native.nvc2pl === "function", "Expected native addon to export nvc2pl(normal, konst)");
  invariant(typeof native.pl2nvc === "function", "Expected native addon to export pl2nvc(plane)");

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
