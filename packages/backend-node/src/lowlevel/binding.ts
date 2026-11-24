import { invariant } from "@rybosome/tspice-core";

import { getNativeAddon } from "../runtime/addon.js";
import type { NativeAddon } from "../runtime/addon.js";

/**
 * Get the loaded native addon binding and assert it provides the expected entrypoints.
 */
export function getNodeBinding(): NativeAddon {
  const native = getNativeAddon();
  invariant(
    typeof native.dasac === "function",
    "Expected native addon to export dasac",
  );
  invariant(
    typeof native.dasdc === "function",
    "Expected native addon to export dasdc",
  );
  invariant(
    typeof native.dasec === "function",
    "Expected native addon to export dasec",
  );
  invariant(
    typeof native.dasadc === "function",
    "Expected native addon to export dasadc",
  );
  invariant(
    typeof native.dasadd === "function",
    "Expected native addon to export dasadd",
  );
  invariant(
    typeof native.dasadi === "function",
    "Expected native addon to export dasadi",
  );
  invariant(
    typeof native.dasrdc === "function",
    "Expected native addon to export dasrdc",
  );
  invariant(
    typeof native.dasrdd === "function",
    "Expected native addon to export dasrdd",
  );
  invariant(
    typeof native.dasrdi === "function",
    "Expected native addon to export dasrdi",
  );
  invariant(
    typeof native.dasudc === "function",
    "Expected native addon to export dasudc",
  );
  invariant(
    typeof native.dasudd === "function",
    "Expected native addon to export dasudd",
  );
  invariant(
    typeof native.dasudi === "function",
    "Expected native addon to export dasudi",
  );
  invariant(
    typeof native.dasonw === "function",
    "Expected native addon to export dasonw",
  );
  invariant(
    typeof native.dasops === "function",
    "Expected native addon to export dasops",
  );
  invariant(
    typeof native.dasopw === "function",
    "Expected native addon to export dasopw",
  );
  invariant(
    typeof native.dashfn === "function",
    "Expected native addon to export dashfn",
  );
  invariant(
    typeof native.dashfs === "function",
    "Expected native addon to export dashfs",
  );
  invariant(
    typeof native.daslla === "function",
    "Expected native addon to export daslla",
  );
  invariant(
    typeof native.dasllc === "function",
    "Expected native addon to export dasllc",
  );
  invariant(
    typeof native.dasrfr === "function",
    "Expected native addon to export dasrfr",
  );
  invariant(
    typeof native.daswbr === "function",
    "Expected native addon to export daswbr",
  );

  invariant(
    typeof native.pi === "function",
    "Expected native addon to export pi()",
  );
  invariant(
    typeof native.twopi === "function",
    "Expected native addon to export twopi()",
  );
  invariant(
    typeof native.halfpi === "function",
    "Expected native addon to export halfpi()",
  );
  invariant(
    typeof native.dpr === "function",
    "Expected native addon to export dpr()",
  );
  invariant(
    typeof native.rpd === "function",
    "Expected native addon to export rpd()",
  );
  invariant(
    typeof native.spd === "function",
    "Expected native addon to export spd()",
  );
  invariant(
    typeof native.j2000 === "function",
    "Expected native addon to export j2000()",
  );
  invariant(
    typeof native.j1900 === "function",
    "Expected native addon to export j1900()",
  );
  invariant(
    typeof native.b1950 === "function",
    "Expected native addon to export b1950()",
  );

  invariant(
    typeof native.clight === "function",
    "Expected native addon to export clight()",
  );
  invariant(
    typeof native.dpmax === "function",
    "Expected native addon to export dpmax()",
  );
  invariant(
    typeof native.dpmin === "function",
    "Expected native addon to export dpmin()",
  );
  invariant(
    typeof native.intmax === "function",
    "Expected native addon to export intmax()",
  );
  invariant(
    typeof native.intmin === "function",
    "Expected native addon to export intmin()",
  );
  invariant(
    typeof native.b1900 === "function",
    "Expected native addon to export b1900()",
  );
  invariant(
    typeof native.j1950 === "function",
    "Expected native addon to export j1950()",
  );
  invariant(
    typeof native.j2100 === "function",
    "Expected native addon to export j2100()",
  );
  invariant(
    typeof native.jyear === "function",
    "Expected native addon to export jyear()",
  );
  invariant(
    typeof native.tyear === "function",
    "Expected native addon to export tyear()",
  );

  invariant(
    typeof native.cyllat === "function",
    "Expected native addon to export cyllat()",
  );
  invariant(
    typeof native.cylrec === "function",
    "Expected native addon to export cylrec()",
  );
  invariant(
    typeof native.cylsph === "function",
    "Expected native addon to export cylsph()",
  );
  invariant(
    typeof native.latcyl === "function",
    "Expected native addon to export latcyl()",
  );
  invariant(
    typeof native.latsph === "function",
    "Expected native addon to export latsph()",
  );
  invariant(
    typeof native.reccyl === "function",
    "Expected native addon to export reccyl()",
  );
  invariant(
    typeof native.sphcyl === "function",
    "Expected native addon to export sphcyl()",
  );
  invariant(
    typeof native.sphlat === "function",
    "Expected native addon to export sphlat()",
  );

  invariant(
    typeof native.vdist === "function",
    "Expected native addon to export vdist()",
  );
  invariant(
    typeof native.vequ === "function",
    "Expected native addon to export vequ()",
  );
  invariant(
    typeof native.vpack === "function",
    "Expected native addon to export vpack()",
  );
  invariant(
    typeof native.vupack === "function",
    "Expected native addon to export vupack()",
  );
  invariant(
    typeof native.vzero === "function",
    "Expected native addon to export vzero()",
  );
  invariant(
    typeof native.unorm === "function",
    "Expected native addon to export unorm()",
  );
  invariant(
    typeof native.ucrss === "function",
    "Expected native addon to export ucrss()",
  );
  invariant(
    typeof native.vsep === "function",
    "Expected native addon to export vsep()",
  );

  invariant(
    typeof native.furnsh === "function",
    "Expected native addon to export furnsh(path)",
  );
  invariant(
    typeof native.unload === "function",
    "Expected native addon to export unload(path)",
  );
  invariant(
    typeof native.kclear === "function",
    "Expected native addon to export kclear()",
  );
  invariant(
    typeof native.ktotal === "function",
    "Expected native addon to export ktotal(kind?)",
  );
  invariant(
    typeof native.kdata === "function",
    "Expected native addon to export kdata(which, kind?)",
  );

  invariant(
    typeof native.gdpool === "function",
    "Expected native addon to export gdpool(name, start, room)",
  );
  invariant(
    typeof native.gipool === "function",
    "Expected native addon to export gipool(name, start, room)",
  );
  invariant(
    typeof native.gcpool === "function",
    "Expected native addon to export gcpool(name, start, room)",
  );
  invariant(
    typeof native.gnpool === "function",
    "Expected native addon to export gnpool(template, start, room)",
  );
  invariant(
    typeof native.dtpool === "function",
    "Expected native addon to export dtpool(name)",
  );
  invariant(
    typeof native.pdpool === "function",
    "Expected native addon to export pdpool(name, values)",
  );
  invariant(
    typeof native.pipool === "function",
    "Expected native addon to export pipool(name, values)",
  );
  invariant(
    typeof native.pcpool === "function",
    "Expected native addon to export pcpool(name, values)",
  );
  invariant(
    typeof native.swpool === "function",
    "Expected native addon to export swpool(agent, names)",
  );
  invariant(
    typeof native.cvpool === "function",
    "Expected native addon to export cvpool(agent)",
  );
  invariant(
    typeof native.expool === "function",
    "Expected native addon to export expool(name)",
  );
  invariant(
    typeof native.str2et === "function",
    "Expected native addon to export str2et(time)",
  );
  invariant(
    typeof native.et2utc === "function",
    "Expected native addon to export et2utc(et, format, prec)",
  );
  invariant(
    typeof native.timout === "function",
    "Expected native addon to export timout(et, picture)",
  );
  invariant(
    typeof native.deltet === "function",
    "Expected native addon to export deltet(epoch, eptype)",
  );
  invariant(
    typeof native.unitim === "function",
    "Expected native addon to export unitim(epoch, insys, outsys)",
  );
  invariant(
    typeof native.etcal === "function",
    "Expected native addon to export etcal",
  );
  invariant(
    typeof native.utc2et === "function",
    "Expected native addon to export utc2et",
  );
  invariant(
    typeof native.tparch === "function",
    "Expected native addon to export tparch",
  );
  invariant(
    typeof native.tsetyr === "function",
    "Expected native addon to export tsetyr",
  );
  invariant(
    typeof native.et2lst === "function",
    "Expected native addon to export et2lst",
  );
  invariant(
    typeof native.tparse === "function",
    "Expected native addon to export tparse(timstr)",
  );
  invariant(
    typeof native.tpictr === "function",
    "Expected native addon to export tpictr(sample, pictur)",
  );
  invariant(
    typeof native.timdefGet === "function",
    "Expected native addon to export timdefGet(item)",
  );
  invariant(
    typeof native.timdefSet === "function",
    "Expected native addon to export timdefSet(item, value)",
  );
  invariant(
    typeof native.errdev === "function",
    "Expected native addon to export errdev()",
  );
  invariant(
    typeof native.errprt === "function",
    "Expected native addon to export errprt()",
  );
  invariant(
    typeof native.trcoff === "function",
    "Expected native addon to export trcoff()",
  );
  invariant(
    typeof native.errch === "function",
    "Expected native addon to export errch()",
  );
  invariant(
    typeof native.errdp === "function",
    "Expected native addon to export errdp()",
  );
  invariant(
    typeof native.errint === "function",
    "Expected native addon to export errint()",
  );
  invariant(
    typeof native.qcktrc === "function",
    "Expected native addon to export qcktrc()",
  );
  invariant(
    typeof native.return === "function",
    "Expected native addon to export return()",
  );
  invariant(
    typeof native.trcdep === "function",
    "Expected native addon to export trcdep()",
  );
  invariant(
    typeof native.trcnam === "function",
    "Expected native addon to export trcnam()",
  );
  invariant(
    typeof native.failed === "function",
    "Expected native addon to export failed()",
  );
  invariant(
    typeof native.reset === "function",
    "Expected native addon to export reset()",
  );
  invariant(
    typeof native.getmsg === "function",
    "Expected native addon to export getmsg(which)",
  );
  invariant(
    typeof native.setmsg === "function",
    "Expected native addon to export setmsg(message)",
  );
  invariant(
    typeof native.sigerr === "function",
    "Expected native addon to export sigerr(short)",
  );
  invariant(
    typeof native.chkin === "function",
    "Expected native addon to export chkin(name)",
  );
  invariant(
    typeof native.chkout === "function",
    "Expected native addon to export chkout(name)",
  );

  invariant(typeof native.rdtext === "function", "Expected native rdtext");
  invariant(typeof native.putcml === "function", "Expected native putcml");
  invariant(
    typeof native.text_owner === "function",
    "Expected native text_owner",
  );
  invariant(
    typeof native.release_text_owner === "function",
    "Expected native release_text_owner",
  );
  invariant(
    typeof native.exists === "function",
    "Expected native addon to export exists(path)",
  );
  invariant(
    typeof native.getfat === "function",
    "Expected native addon to export getfat(path)",
  );

  invariant(
    typeof native.dafac === "function",
    "Expected native addon to export dafac",
  );
  invariant(
    typeof native.dafdc === "function",
    "Expected native addon to export dafdc",
  );
  invariant(
    typeof native.dafec === "function",
    "Expected native addon to export dafec",
  );
  invariant(
    typeof native.dafrs === "function",
    "Expected native addon to export dafrs",
  );
  invariant(
    typeof native.dafps === "function",
    "Expected native addon to export dafps",
  );
  invariant(
    typeof native.dafus === "function",
    "Expected native addon to export dafus",
  );
  invariant(
    typeof native.dafgsr === "function",
    "Expected native addon to export dafgsr",
  );
  invariant(
    typeof native.dafrfr === "function",
    "Expected native addon to export dafrfr",
  );
  invariant(
    typeof native.dafrda === "function",
    "Expected native addon to export dafrda",
  );
  invariant(
    typeof native.dafgda === "function",
    "Expected native addon to export dafgda",
  );
  invariant(
    typeof native.dafbbs === "function",
    "Expected native addon to export dafbbs",
  );
  invariant(
    typeof native.dafcs === "function",
    "Expected native addon to export dafcs",
  );
  invariant(
    typeof native.daffpa === "function",
    "Expected native addon to export daffpa",
  );
  invariant(
    typeof native.dafgh === "function",
    "Expected native addon to export dafgh",
  );
  invariant(
    typeof native.dafgn === "function",
    "Expected native addon to export dafgn",
  );
  invariant(
    typeof native.dafgs === "function",
    "Expected native addon to export dafgs",
  );
  invariant(
    typeof native.dafhsf === "function",
    "Expected native addon to export dafhsf",
  );
  invariant(
    typeof native.dafopw === "function",
    "Expected native addon to export dafopw",
  );
  invariant(
    typeof native.dafopr === "function",
    "Expected native addon to export dafopr(path)",
  );
  invariant(
    typeof native.dafcls === "function",
    "Expected native addon to export dafcls(handle)",
  );
  invariant(
    typeof native.dafbfs === "function",
    "Expected native addon to export dafbfs(handle)",
  );
  invariant(
    typeof native.daffna === "function",
    "Expected native addon to export daffna(handle)",
  );

  invariant(
    typeof native.dasopr === "function",
    "Expected native addon to export dasopr(path)",
  );
  invariant(
    typeof native.dascls === "function",
    "Expected native addon to export dascls(handle)",
  );

  invariant(
    typeof native.dlaopn === "function",
    "Expected native addon to export dlaopn(path, ftype, ifname, ncomch)",
  );
  invariant(
    typeof native.dlabbs === "function",
    "Expected native addon to export dlabbs",
  );
  invariant(
    typeof native.dlabns === "function",
    "Expected native addon to export dlabns",
  );
  invariant(
    typeof native.dlaens === "function",
    "Expected native addon to export dlaens",
  );
  invariant(
    typeof native.dlafps === "function",
    "Expected native addon to export dlafps",
  );
  invariant(
    typeof native.dlabfs === "function",
    "Expected native addon to export dlabfs(handle)",
  );
  invariant(
    typeof native.dlafns === "function",
    "Expected native addon to export dlafns(handle, descr)",
  );

  // --- EK ---
  invariant(typeof native.ekccnt === "function", "Expected native ekccnt");
  invariant(typeof native.ekcii === "function", "Expected native ekcii");
  invariant(typeof native.eklef === "function", "Expected native eklef");
  invariant(typeof native.eknelt === "function", "Expected native eknelt");
  invariant(typeof native.ekpsel === "function", "Expected native ekpsel");
  invariant(typeof native.ekssum === "function", "Expected native ekssum");
  invariant(typeof native.ekuef === "function", "Expected native ekuef");
  invariant(
    typeof native.ekload_nseg === "function",
    "Expected native ekload_nseg",
  );
  invariant(
    typeof native.ekopr === "function",
    "Expected native addon to export ekopr(path)",
  );
  invariant(
    typeof native.ekopw === "function",
    "Expected native addon to export ekopw(path)",
  );
  invariant(
    typeof native.ekopn === "function",
    "Expected native addon to export ekopn(path, ifname, ncomch)",
  );
  invariant(
    typeof native.ekcls === "function",
    "Expected native addon to export ekcls(handle)",
  );
  invariant(
    typeof native.ekntab === "function",
    "Expected native addon to export ekntab()",
  );
  invariant(
    typeof native.ektnam === "function",
    "Expected native addon to export ektnam(n)",
  );
  invariant(
    typeof native.eknseg === "function",
    "Expected native addon to export eknseg(handle)",
  );
  invariant(
    typeof native.ekfind === "function",
    "Expected native addon to export ekfind(query)",
  );
  invariant(
    typeof native.ekgc === "function",
    "Expected native addon to export ekgc(selidx, row, elment)",
  );
  invariant(
    typeof native.ekgd === "function",
    "Expected native addon to export ekgd(selidx, row, elment)",
  );
  invariant(
    typeof native.ekgi === "function",
    "Expected native addon to export ekgi(selidx, row, elment)",
  );
  invariant(typeof native.ekacec === "function", "Expected native ekacec");
  invariant(typeof native.ekaced === "function", "Expected native ekaced");
  invariant(typeof native.ekacei === "function", "Expected native ekacei");
  invariant(typeof native.ekrcec === "function", "Expected native ekrcec");
  invariant(typeof native.ekrced === "function", "Expected native ekrced");
  invariant(typeof native.ekrcei === "function", "Expected native ekrcei");
  invariant(typeof native.ekucec === "function", "Expected native ekucec");
  invariant(typeof native.ekuced === "function", "Expected native ekuced");
  invariant(typeof native.ekucei === "function", "Expected native ekucei");
  invariant(typeof native.ekops === "function", "Expected native ekops");
  invariant(typeof native.ekbseg === "function", "Expected native ekbseg");
  invariant(typeof native.ekappr === "function", "Expected native ekappr");
  invariant(typeof native.ekinsr === "function", "Expected native ekinsr");
  invariant(typeof native.ekdelr === "function", "Expected native ekdelr");
  invariant(
    typeof native.ekifld === "function",
    "Expected native addon to export ekifld(handle, tabnam, nrows, cnames, decls)",
  );
  invariant(
    typeof native.ekacli === "function",
    "Expected native addon to export ekacli(handle, segno, column, ivals, entszs, nlflgs, rcptrs)",
  );
  invariant(
    typeof native.ekacld === "function",
    "Expected native addon to export ekacld(handle, segno, column, dvals, entszs, nlflgs, rcptrs)",
  );
  invariant(
    typeof native.ekaclc === "function",
    "Expected native addon to export ekaclc(handle, segno, column, cvals, entszs, nlflgs, rcptrs)",
  );
  invariant(
    typeof native.ekffld === "function",
    "Expected native addon to export ekffld(handle, segno, rcptrs)",
  );

  // --- DSK writer ---
  invariant(
    typeof native.dskopn === "function",
    "Expected native addon to export dskopn(path, ifname, ncomch)",
  );
  invariant(
    typeof native.dskmi2 === "function",
    "Expected native addon to export dskmi2(nv, vrtces, np, plates, finscl, corscl, worksz, voxpsz, voxlsz, makvtl, spxisz)",
  );
  invariant(
    typeof native.dskw02 === "function",
    "Expected native addon to export dskw02(handle, center, surfid, dclass, frame, corsys, corpar, mncor1, mxcor1, mncor2, mxcor2, mncor3, mxcor3, first, last, nv, vrtces, np, plates, spaixd, spaixi)",
  );

  invariant(
    typeof native.dskobj === "function",
    "Expected native addon to export dskobj(dsk, bodids)",
  );
  invariant(
    typeof native.dsksrf === "function",
    "Expected native addon to export dsksrf(dsk, bodyid, srfids)",
  );
  invariant(
    typeof native.dskgd === "function",
    "Expected native addon to export dskgd(handle, dladsc)",
  );
  invariant(
    typeof native.dskb02 === "function",
    "Expected native addon to export dskb02(handle, dladsc)",
  );

  invariant(
    typeof native.bodn2c === "function",
    "Expected native addon to export bodn2c(name)",
  );
  invariant(
    typeof native.bodc2n === "function",
    "Expected native addon to export bodc2n(code)",
  );
  invariant(
    typeof native.namfrm === "function",
    "Expected native addon to export namfrm(name)",
  );
  invariant(
    typeof native.frmnam === "function",
    "Expected native addon to export frmnam(code)",
  );
  invariant(
    typeof native.cidfrm === "function",
    "Expected native addon to export cidfrm(center)",
  );
  invariant(
    typeof native.cnmfrm === "function",
    "Expected native addon to export cnmfrm(centerName)",
  );
  invariant(
    typeof native.scs2e === "function",
    "Expected native addon to export scs2e(sc, sclkch)",
  );
  invariant(typeof native.sce2t === "function", "Native addon missing sce2t()");
  invariant(typeof native.scfmt === "function", "Native addon missing scfmt()");
  invariant(
    typeof native.scpart === "function",
    "Native addon missing scpart()",
  );
  invariant(
    typeof native.sctiks === "function",
    "Native addon missing sctiks()",
  );
  invariant(
    typeof native.sce2s === "function",
    "Expected native addon to export sce2s(sc, et)",
  );
  invariant(
    typeof native.scencd === "function",
    "Expected native addon to export scencd(sc, sclkch)",
  );
  invariant(
    typeof native.scdecd === "function",
    "Expected native addon to export scdecd(sc, sclkdp)",
  );
  invariant(
    typeof native.sct2e === "function",
    "Expected native addon to export sct2e(sc, sclkdp)",
  );
  invariant(
    typeof native.sce2c === "function",
    "Expected native addon to export sce2c(sc, et)",
  );
  invariant(
    typeof native.ckfrot === "function",
    "Expected native addon to export ckfrot",
  );
  invariant(
    typeof native.ckfxfm === "function",
    "Expected native addon to export ckfxfm",
  );
  invariant(
    typeof native.ckgr02 === "function",
    "Expected native addon to export ckgr02",
  );
  invariant(
    typeof native.ckgr03 === "function",
    "Expected native addon to export ckgr03",
  );
  invariant(
    typeof native.ckmeta === "function",
    "Expected native addon to export ckmeta",
  );
  invariant(
    typeof native.cknr02 === "function",
    "Expected native addon to export cknr02",
  );
  invariant(
    typeof native.cknr03 === "function",
    "Expected native addon to export cknr03",
  );
  invariant(
    typeof native.ckgp === "function",
    "Expected native addon to export ckgp(inst, sclkdp, tol, ref)",
  );
  invariant(
    typeof native.ckgpav === "function",
    "Expected native addon to export ckgpav(inst, sclkdp, tol, ref)",
  );
  invariant(
    typeof native.bltfrm === "function",
    "Expected native addon to export bltfrm",
  );
  invariant(
    typeof native.pxfrm2 === "function",
    "Expected native addon to export pxfrm2",
  );
  invariant(
    typeof native.tipbod === "function",
    "Expected native addon to export tipbod",
  );
  invariant(
    typeof native.tisbod === "function",
    "Expected native addon to export tisbod",
  );
  invariant(
    typeof native.tkfram === "function",
    "Expected native addon to export tkfram",
  );
  invariant(
    typeof native.xfmsta === "function",
    "Expected native addon to export xfmsta",
  );
  invariant(
    typeof native.pxform === "function",
    "Expected native addon to export pxform(from, to, et)",
  );
  invariant(typeof native.frame === "function", "Native addon missing frame()");
  invariant(
    typeof native.twovec === "function",
    "Native addon missing twovec()",
  );
  invariant(
    typeof native.twovxf === "function",
    "Native addon missing twovxf()",
  );
  invariant(
    typeof native.eul2xf === "function",
    "Native addon missing eul2xf()",
  );
  invariant(
    typeof native.xf2eul === "function",
    "Native addon missing xf2eul()",
  );
  invariant(
    typeof native.xf2rav === "function",
    "Native addon missing xf2rav()",
  );
  invariant(
    typeof native.rav2xf === "function",
    "Native addon missing rav2xf()",
  );
  invariant(
    typeof native.invstm === "function",
    "Native addon missing invstm()",
  );
  invariant(
    typeof native.xpose6 === "function",
    "Native addon missing xpose6()",
  );
  invariant(
    typeof native.sxform === "function",
    "Expected native addon to export sxform(from, to, et)",
  );
  invariant(typeof native.cpos === "function", "Native addon missing cpos()");
  invariant(typeof native.cposr === "function", "Native addon missing cposr()");
  invariant(typeof native.ncpos === "function", "Native addon missing ncpos()");
  invariant(
    typeof native.ncposr === "function",
    "Native addon missing ncposr()",
  );
  invariant(typeof native.pos === "function", "Native addon missing pos()");
  invariant(typeof native.posr === "function", "Native addon missing posr()");
  invariant(
    typeof native.esrchc === "function",
    "Native addon missing esrchc()",
  );
  invariant(
    typeof native.nextwd === "function",
    "Native addon missing nextwd()",
  );
  invariant(typeof native.nthwd === "function", "Native addon missing nthwd()");
  invariant(
    typeof native.lparse === "function",
    "Native addon missing lparse()",
  );
  invariant(
    typeof native.lparsm === "function",
    "Native addon missing lparsm()",
  );
  invariant(
    typeof native.lx4dec === "function",
    "Native addon missing lx4dec()",
  );
  invariant(
    typeof native.lx4num === "function",
    "Native addon missing lx4num()",
  );
  invariant(
    typeof native.lx4sgn === "function",
    "Native addon missing lx4sgn()",
  );
  invariant(
    typeof native.lx4uns === "function",
    "Native addon missing lx4uns()",
  );
  invariant(
    typeof native.lxqstr === "function",
    "Native addon missing lxqstr()",
  );
  invariant(
    typeof native.cmprss === "function",
    "Native addon missing cmprss()",
  );
  invariant(typeof native.eqstr === "function", "Native addon missing eqstr()");
  invariant(
    typeof native.iswhsp === "function",
    "Native addon missing iswhsp()",
  );
  invariant(
    typeof native.lastnb === "function",
    "Native addon missing lastnb()",
  );
  invariant(typeof native.lcase === "function", "Native addon missing lcase()");
  invariant(typeof native.ucase === "function", "Native addon missing ucase()");
  invariant(
    typeof native.matchi === "function",
    "Native addon missing matchi()",
  );
  invariant(
    typeof native.matchw === "function",
    "Native addon missing matchw()",
  );
  invariant(
    typeof native.vlcom === "function",
    "Expected native addon to export vlcom()",
  );
  invariant(
    typeof native.vlcom3 === "function",
    "Expected native addon to export vlcom3()",
  );
  invariant(
    typeof native.vperp === "function",
    "Expected native addon to export vperp()",
  );
  invariant(
    typeof native.vproj === "function",
    "Expected native addon to export vproj()",
  );
  invariant(
    typeof native.vrel === "function",
    "Expected native addon to export vrel()",
  );
  invariant(
    typeof native.vrotv === "function",
    "Expected native addon to export vrotv()",
  );
  invariant(
    typeof native.rotvec === "function",
    "Expected native addon to export rotvec()",
  );
  invariant(
    typeof native.vtmv === "function",
    "Expected native addon to export vtmv()",
  );
  invariant(
    typeof native.azlrec === "function",
    "Expected native addon to export azlrec()",
  );
  invariant(
    typeof native.recazl === "function",
    "Expected native addon to export recazl()",
  );
  invariant(
    typeof native.pgrrec === "function",
    "Expected native addon to export pgrrec()",
  );
  invariant(
    typeof native.recpgr === "function",
    "Expected native addon to export recpgr()",
  );
  invariant(
    typeof native.radrec === "function",
    "Expected native addon to export radrec()",
  );
  invariant(
    typeof native.recrad === "function",
    "Expected native addon to export recrad()",
  );
  invariant(
    typeof native.srfrec === "function",
    "Expected native addon to export srfrec()",
  );
  invariant(
    typeof native.brcktd === "function",
    "Expected native addon to export brcktd()",
  );
  invariant(
    typeof native.brckti === "function",
    "Expected native addon to export brckti()",
  );
  invariant(
    typeof native.convrt === "function",
    "Expected native addon to export convrt()",
  );
  invariant(
    typeof native.sumad === "function",
    "Expected native addon to export sumad()",
  );
  invariant(
    typeof native.sumai === "function",
    "Expected native addon to export sumai()",
  );
  invariant(
    typeof native.maxd === "function",
    "Expected native addon to export maxd()",
  );
  invariant(
    typeof native.maxi === "function",
    "Expected native addon to export maxi()",
  );
  invariant(
    typeof native.mind === "function",
    "Expected native addon to export mind()",
  );
  invariant(
    typeof native.mini === "function",
    "Expected native addon to export mini()",
  );
  invariant(
    typeof native.ducrss === "function",
    "Expected native addon to export ducrss()",
  );
  invariant(
    typeof native.dvcrss === "function",
    "Expected native addon to export dvcrss()",
  );
  invariant(
    typeof native.dvdot === "function",
    "Expected native addon to export dvdot()",
  );
  invariant(
    typeof native.dvhat === "function",
    "Expected native addon to export dvhat()",
  );
  invariant(
    typeof native.dvnorm === "function",
    "Expected native addon to export dvnorm()",
  );
  invariant(
    typeof native.dvsep === "function",
    "Expected native addon to export dvsep()",
  );
  invariant(
    typeof native.chbder === "function",
    "Native addon missing chbder()",
  );
  invariant(
    typeof native.chbigr === "function",
    "Native addon missing chbigr()",
  );
  invariant(
    typeof native.chbint === "function",
    "Native addon missing chbint()",
  );
  invariant(
    typeof native.chbval === "function",
    "Native addon missing chbval()",
  );
  invariant(
    typeof native.polyds === "function",
    "Native addon missing polyds()",
  );
  invariant(typeof native.rquad === "function", "Native addon missing rquad()");
  invariant(
    typeof native.hrmesp === "function",
    "Native addon missing hrmesp()",
  );
  invariant(
    typeof native.hrmint === "function",
    "Native addon missing hrmint()",
  );
  invariant(
    typeof native.lgresp === "function",
    "Native addon missing lgresp()",
  );
  invariant(
    typeof native.lgrind === "function",
    "Native addon missing lgrind()",
  );
  invariant(
    typeof native.lgrint === "function",
    "Native addon missing lgrint()",
  );
  invariant(
    typeof native.qderiv === "function",
    "Native addon missing qderiv()",
  );
  invariant(
    typeof native.clearc === "function",
    "Native addon missing clearc()",
  );
  invariant(
    typeof native.cleard === "function",
    "Native addon missing cleard()",
  );
  invariant(
    typeof native.cleari === "function",
    "Native addon missing cleari()",
  );
  invariant(typeof native.filld === "function", "Native addon missing filld()");
  invariant(typeof native.filli === "function", "Native addon missing filli()");
  invariant(typeof native.moved === "function", "Native addon missing moved()");
  invariant(
    typeof native.dazldr === "function",
    "Expected native addon to export dazldr()",
  );
  invariant(
    typeof native.dcyldr === "function",
    "Expected native addon to export dcyldr()",
  );
  invariant(
    typeof native.dgeodr === "function",
    "Expected native addon to export dgeodr()",
  );
  invariant(
    typeof native.dlatdr === "function",
    "Expected native addon to export dlatdr()",
  );
  invariant(
    typeof native.dpgrdr === "function",
    "Expected native addon to export dpgrdr()",
  );
  invariant(
    typeof native.drdazl === "function",
    "Expected native addon to export drdazl()",
  );
  invariant(
    typeof native.drdcyl === "function",
    "Expected native addon to export drdcyl()",
  );
  invariant(
    typeof native.drdgeo === "function",
    "Expected native addon to export drdgeo()",
  );
  invariant(
    typeof native.drdlat === "function",
    "Expected native addon to export drdlat()",
  );
  invariant(
    typeof native.drdpgr === "function",
    "Expected native addon to export drdpgr()",
  );
  invariant(
    typeof native.drdsph === "function",
    "Expected native addon to export drdsph()",
  );
  invariant(
    typeof native.dsphdr === "function",
    "Expected native addon to export dsphdr()",
  );
  invariant(
    typeof native.det === "function",
    "Expected native addon to export det()",
  );
  invariant(
    typeof native.diags2 === "function",
    "Expected native addon to export diags2()",
  );
  invariant(
    typeof native.ident === "function",
    "Expected native addon to export ident()",
  );
  invariant(
    typeof native.invert === "function",
    "Expected native addon to export invert()",
  );
  invariant(
    typeof native.invort === "function",
    "Expected native addon to export invort()",
  );
  invariant(
    typeof native.isrot === "function",
    "Expected native addon to export isrot()",
  );
  invariant(
    typeof native.mequ === "function",
    "Expected native addon to export mequ()",
  );
  invariant(
    typeof native.mtxm === "function",
    "Expected native addon to export mtxm()",
  );
  invariant(
    typeof native.mxmt === "function",
    "Expected native addon to export mxmt()",
  );
  invariant(
    typeof native.trace === "function",
    "Expected native addon to export trace()",
  );
  invariant(
    typeof native.xpose === "function",
    "Expected native addon to export xpose()",
  );
  invariant(
    typeof native.vaddg === "function",
    "Expected native addon to export vaddg()",
  );
  invariant(
    typeof native.vdistg === "function",
    "Expected native addon to export vdistg()",
  );
  invariant(
    typeof native.vdotg === "function",
    "Expected native addon to export vdotg()",
  );
  invariant(
    typeof native.vequg === "function",
    "Expected native addon to export vequg()",
  );
  invariant(
    typeof native.vhatg === "function",
    "Expected native addon to export vhatg()",
  );
  invariant(
    typeof native.vlcomg === "function",
    "Expected native addon to export vlcomg()",
  );
  invariant(
    typeof native.vminug === "function",
    "Expected native addon to export vminug()",
  );
  invariant(
    typeof native.vnormg === "function",
    "Expected native addon to export vnormg()",
  );
  invariant(
    typeof native.vprojg === "function",
    "Expected native addon to export vprojg()",
  );
  invariant(
    typeof native.vrelg === "function",
    "Expected native addon to export vrelg()",
  );
  invariant(
    typeof native.vsclg === "function",
    "Expected native addon to export vsclg()",
  );
  invariant(
    typeof native.vsepg === "function",
    "Expected native addon to export vsepg()",
  );
  invariant(
    typeof native.vsubg === "function",
    "Expected native addon to export vsubg()",
  );
  invariant(
    typeof native.vzerog === "function",
    "Expected native addon to export vzerog()",
  );
  invariant(
    typeof native.unormg === "function",
    "Expected native addon to export unormg()",
  );
  invariant(
    typeof native.bschoc === "function",
    "Native addon missing bschoc()",
  );
  invariant(
    typeof native.bschoi === "function",
    "Native addon missing bschoi()",
  );
  invariant(
    typeof native.bsrchc === "function",
    "Native addon missing bsrchc()",
  );
  invariant(
    typeof native.bsrchd === "function",
    "Native addon missing bsrchd()",
  );
  invariant(
    typeof native.bsrchi === "function",
    "Native addon missing bsrchi()",
  );
  invariant(
    typeof native.isrchc === "function",
    "Native addon missing isrchc()",
  );
  invariant(
    typeof native.isrchd === "function",
    "Native addon missing isrchd()",
  );
  invariant(
    typeof native.isrchi === "function",
    "Native addon missing isrchi()",
  );
  invariant(
    typeof native.isordv === "function",
    "Native addon missing isordv()",
  );
  invariant(
    typeof native.orderc === "function",
    "Native addon missing orderc()",
  );
  invariant(
    typeof native.orderd === "function",
    "Native addon missing orderd()",
  );
  invariant(
    typeof native.orderi === "function",
    "Native addon missing orderi()",
  );
  invariant(
    typeof native.reordc === "function",
    "Native addon missing reordc()",
  );
  invariant(
    typeof native.reordd === "function",
    "Native addon missing reordd()",
  );
  invariant(
    typeof native.reordi === "function",
    "Native addon missing reordi()",
  );
  invariant(
    typeof native.reordl === "function",
    "Native addon missing reordl()",
  );
  invariant(
    typeof native.shellc === "function",
    "Native addon missing shellc()",
  );
  invariant(
    typeof native.shelld === "function",
    "Native addon missing shelld()",
  );
  invariant(
    typeof native.shelli === "function",
    "Native addon missing shelli()",
  );
  invariant(
    typeof native.lstlec === "function",
    "Native addon missing lstlec()",
  );
  invariant(
    typeof native.lstled === "function",
    "Native addon missing lstled()",
  );
  invariant(
    typeof native.lstlei === "function",
    "Native addon missing lstlei()",
  );
  invariant(
    typeof native.lstltc === "function",
    "Native addon missing lstltc()",
  );
  invariant(
    typeof native.lstltd === "function",
    "Native addon missing lstltd()",
  );
  invariant(
    typeof native.lstlti === "function",
    "Native addon missing lstlti()",
  );
  invariant(
    typeof native.reclat === "function",
    "Expected native addon to export reclat(rect)",
  );
  invariant(
    typeof native.latrec === "function",
    "Expected native addon to export latrec(radius, lon, lat)",
  );
  invariant(
    typeof native.recsph === "function",
    "Expected native addon to export recsph(rect)",
  );
  invariant(
    typeof native.sphrec === "function",
    "Expected native addon to export sphrec(radius, colat, lon)",
  );
  invariant(
    typeof native.vnorm === "function",
    "Expected native addon to export vnorm(v)",
  );
  invariant(
    typeof native.vhat === "function",
    "Expected native addon to export vhat(v)",
  );
  invariant(
    typeof native.vdot === "function",
    "Expected native addon to export vdot(a, b)",
  );
  invariant(
    typeof native.vcrss === "function",
    "Expected native addon to export vcrss(a, b)",
  );
  invariant(
    typeof native.mxv === "function",
    "Expected native addon to export mxv(m, v)",
  );
  invariant(
    typeof native.mtxv === "function",
    "Expected native addon to export mtxv(m, v)",
  );
  invariant(
    typeof native.vadd === "function",
    "Expected native addon to export vadd(a, b)",
  );
  invariant(
    typeof native.vsub === "function",
    "Expected native addon to export vsub(a, b)",
  );
  invariant(
    typeof native.vminus === "function",
    "Expected native addon to export vminus(v)",
  );
  invariant(
    typeof native.vscl === "function",
    "Expected native addon to export vscl(s, v)",
  );
  invariant(
    typeof native.mxm === "function",
    "Expected native addon to export mxm(a, b)",
  );
  invariant(
    typeof native.rotate === "function",
    "Expected native addon to export rotate(angle, axis)",
  );
  invariant(
    typeof native.rotmat === "function",
    "Expected native addon to export rotmat(m, angle, axis)",
  );
  invariant(
    typeof native.axisar === "function",
    "Expected native addon to export axisar(axis, angle)",
  );
  invariant(
    typeof native.georec === "function",
    "Expected native addon to export georec(lon, lat, alt, re, f)",
  );
  invariant(
    typeof native.recgeo === "function",
    "Expected native addon to export recgeo(rect, re, f)",
  );

  invariant(
    typeof native.newIntCell === "function",
    "Expected native addon to export newIntCell(size)",
  );
  invariant(
    typeof native.newDoubleCell === "function",
    "Expected native addon to export newDoubleCell(size)",
  );
  invariant(
    typeof native.newCharCell === "function",
    "Expected native addon to export newCharCell(size, length)",
  );
  invariant(
    typeof native.newWindow === "function",
    "Expected native addon to export newWindow(maxIntervals)",
  );
  invariant(
    typeof native.freeCell === "function",
    "Expected native addon to export freeCell(cell)",
  );
  invariant(
    typeof native.freeWindow === "function",
    "Expected native addon to export freeWindow(window)",
  );
  invariant(
    typeof native.ssize === "function",
    "Expected native addon to export ssize(size, cell)",
  );
  invariant(
    typeof native.scard === "function",
    "Expected native addon to export scard(card, cell)",
  );
  invariant(
    typeof native.card === "function",
    "Expected native addon to export card(cell)",
  );
  invariant(
    typeof native.size === "function",
    "Expected native addon to export size(cell)",
  );
  invariant(
    typeof native.valid === "function",
    "Expected native addon to export valid(size, n, cell)",
  );
  invariant(
    typeof native.insrti === "function",
    "Expected native addon to export insrti(item, cell)",
  );
  invariant(
    typeof native.insrtd === "function",
    "Expected native addon to export insrtd(item, cell)",
  );
  invariant(
    typeof native.appndc === "function",
    "Native addon missing appndc()",
  );
  invariant(
    typeof native.appndd === "function",
    "Native addon missing appndd()",
  );
  invariant(
    typeof native.appndi === "function",
    "Native addon missing appndi()",
  );
  invariant(typeof native.elemc === "function", "Native addon missing elemc()");
  invariant(typeof native.elemd === "function", "Native addon missing elemd()");
  invariant(typeof native.elemi === "function", "Native addon missing elemi()");
  invariant(typeof native.diff === "function", "Native addon missing diff()");
  invariant(typeof native.inter === "function", "Native addon missing inter()");
  invariant(typeof native.sdiff === "function", "Native addon missing sdiff()");
  invariant(typeof native.union === "function", "Native addon missing union()");
  invariant(typeof native.set === "function", "Native addon missing set()");
  invariant(
    typeof native.removc === "function",
    "Native addon missing removc()",
  );
  invariant(
    typeof native.removd === "function",
    "Native addon missing removd()",
  );
  invariant(
    typeof native.removi === "function",
    "Native addon missing removi()",
  );
  invariant(typeof native.ordc === "function", "Native addon missing ordc()");
  invariant(typeof native.ordd === "function", "Native addon missing ordd()");
  invariant(typeof native.ordi === "function", "Native addon missing ordi()");
  invariant(typeof native.copy === "function", "Native addon missing copy()");
  invariant(
    typeof native.lparss === "function",
    "Expected native addon to export lparss",
  );
  invariant(
    typeof native.insrtc === "function",
    "Expected native addon to export insrtc(item, cell)",
  );
  invariant(
    typeof native.cellGeti === "function",
    "Expected native addon to export cellGeti(cell, index)",
  );
  invariant(
    typeof native.cellGetd === "function",
    "Expected native addon to export cellGetd(cell, index)",
  );
  invariant(
    typeof native.cellGetc === "function",
    "Expected native addon to export cellGetc(cell, index)",
  );
  invariant(
    typeof native.pckcls === "function",
    "Expected native addon to export pckcls",
  );
  invariant(
    typeof native.pckcov === "function",
    "Expected native addon to export pckcov",
  );
  invariant(
    typeof native.pckfrm === "function",
    "Expected native addon to export pckfrm",
  );
  invariant(
    typeof native.pcklof === "function",
    "Expected native addon to export pcklof",
  );
  invariant(
    typeof native.pckopn === "function",
    "Expected native addon to export pckopn",
  );
  invariant(
    typeof native.pckuof === "function",
    "Expected native addon to export pckuof",
  );
  invariant(
    typeof native.pckw02 === "function",
    "Expected native addon to export pckw02",
  );
  invariant(
    typeof native.wncomd === "function",
    "Native addon missing wncomd()",
  );
  invariant(
    typeof native.wncond === "function",
    "Native addon missing wncond()",
  );
  invariant(
    typeof native.wndifd === "function",
    "Native addon missing wndifd()",
  );
  invariant(
    typeof native.wnelmd === "function",
    "Native addon missing wnelmd()",
  );
  invariant(
    typeof native.wnexpd === "function",
    "Native addon missing wnexpd()",
  );
  invariant(
    typeof native.wnextd === "function",
    "Native addon missing wnextd()",
  );
  invariant(
    typeof native.wnfild === "function",
    "Native addon missing wnfild()",
  );
  invariant(
    typeof native.wnfltd === "function",
    "Native addon missing wnfltd()",
  );
  invariant(
    typeof native.wnincd === "function",
    "Native addon missing wnincd()",
  );
  invariant(
    typeof native.wnintd === "function",
    "Native addon missing wnintd()",
  );
  invariant(
    typeof native.wnreld === "function",
    "Native addon missing wnreld()",
  );
  invariant(
    typeof native.wnsumd === "function",
    "Native addon missing wnsumd()",
  );
  invariant(
    typeof native.wnunid === "function",
    "Native addon missing wnunid()",
  );
  invariant(
    typeof native.wninsd === "function",
    "Expected native addon to export wninsd(left, right, window)",
  );
  invariant(
    typeof native.wncard === "function",
    "Expected native addon to export wncard(window)",
  );
  invariant(
    typeof native.wnfetd === "function",
    "Expected native addon to export wnfetd(window, index)",
  );
  invariant(
    typeof native.wnvald === "function",
    "Expected native addon to export wnvald(size, n, window)",
  );
  invariant(
    typeof native.conics === "function",
    "Native addon missing conics()",
  );
  invariant(
    typeof native.eqncpv === "function",
    "Native addon missing eqncpv()",
  );
  invariant(
    typeof native.oscelt === "function",
    "Native addon missing oscelt()",
  );
  invariant(
    typeof native.oscltx === "function",
    "Native addon missing oscltx()",
  );
  invariant(
    typeof native.prop2b === "function",
    "Native addon missing prop2b()",
  );
  invariant(
    typeof native.getelm === "function",
    "Expected native addon to export getelm",
  );
  invariant(
    typeof native.evsgp4 === "function",
    "Expected native addon to export evsgp4",
  );
  invariant(
    typeof native.spkcpo === "function",
    "Native addon missing spkcpo()",
  );
  invariant(
    typeof native.spkcpt === "function",
    "Native addon missing spkcpt()",
  );
  invariant(
    typeof native.spkcvo === "function",
    "Native addon missing spkcvo()",
  );
  invariant(
    typeof native.spkcvt === "function",
    "Native addon missing spkcvt()",
  );
  invariant(
    typeof native.azlcpo === "function",
    "Native addon missing azlcpo()",
  );
  invariant(
    typeof native.spkacs === "function",
    "Native addon missing spkacs()",
  );
  invariant(
    typeof native.spkapo === "function",
    "Native addon missing spkapo()",
  );
  invariant(
    typeof native.spkapp === "function",
    "Native addon missing spkapp()",
  );
  invariant(
    typeof native.spkaps === "function",
    "Native addon missing spkaps()",
  );
  invariant(
    typeof native.spkltc === "function",
    "Native addon missing spkltc()",
  );
  invariant(
    typeof native.stelab === "function",
    "Native addon missing stelab()",
  );
  invariant(
    typeof native.stlabx === "function",
    "Native addon missing stlabx()",
  );
  invariant(typeof native.ltime === "function", "Native addon missing ltime()");
  invariant(
    typeof native.spkezr === "function",
    "Expected native addon to export spkezr(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.spkpos === "function",
    "Expected native addon to export spkpos(target, et, ref, abcorr, observer)",
  );
  invariant(
    typeof native.ckopn === "function",
    "Expected native addon to export ckopn",
  );
  invariant(
    typeof native.ckcls === "function",
    "Expected native addon to export ckcls",
  );
  invariant(
    typeof native.ckw01 === "function",
    "Expected native addon to export ckw01",
  );
  invariant(
    typeof native.ckw02 === "function",
    "Expected native addon to export ckw02",
  );
  invariant(
    typeof native.ckw03 === "function",
    "Expected native addon to export ckw03",
  );
  invariant(
    typeof native.ckw05 === "function",
    "Expected native addon to export ckw05",
  );
  invariant(
    typeof native.spkopn === "function",
    "Expected native addon to export spkopn(path, ifname, ncomch)",
  );
  invariant(
    typeof native.spkopa === "function",
    "Expected native addon to export spkopa(path)",
  );
  invariant(
    typeof native.spkw02 === "function",
    "Expected native addon to export spkw02",
  );
  invariant(
    typeof native.spkw03 === "function",
    "Expected native addon to export spkw03",
  );
  invariant(
    typeof native.spkw20 === "function",
    "Expected native addon to export spkw20",
  );
  invariant(
    typeof native.spkw09 === "function",
    "Expected native addon to export spkw09",
  );
  invariant(
    typeof native.spkw12 === "function",
    "Expected native addon to export spkw12",
  );
  invariant(
    typeof native.spkw13 === "function",
    "Expected native addon to export spkw13",
  );
  invariant(
    typeof native.spkw18 === "function",
    "Expected native addon to export spkw18",
  );
  invariant(
    typeof native.spkw05 === "function",
    "Expected native addon to export spkw05",
  );
  invariant(
    typeof native.spkw10 === "function",
    "Expected native addon to export spkw10",
  );
  invariant(
    typeof native.spkw15 === "function",
    "Expected native addon to export spkw15",
  );
  invariant(
    typeof native.spkw17 === "function",
    "Expected native addon to export spkw17",
  );
  invariant(
    typeof native.spk14b === "function",
    "Expected native addon to export spk14b",
  );
  invariant(
    typeof native.spk14a === "function",
    "Expected native addon to export spk14a",
  );
  invariant(
    typeof native.spk14e === "function",
    "Expected native addon to export spk14e",
  );
  invariant(
    typeof native.spk14FinishIfActive === "function",
    "Expected native addon to export spk14FinishIfActive",
  );
  invariant(
    typeof native.spkw08 === "function",
    "Expected native addon to export spkw08(handle, body, center, frame, first, last, segid, degree, states, epoch1, step)",
  );
  invariant(
    typeof native.spkcls === "function",
    "Expected native addon to export spkcls(handle)",
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
    typeof native.illumg === "function",
    "Expected native addon to export illumg(method, target, ilusrc, et, fixref, abcorr, observer, spoint)",
  );
  invariant(
    typeof native.illumf === "function",
    "Expected native addon to export illumf(method, target, ilusrc, et, fixref, abcorr, observer, spoint)",
  );
  invariant(
    typeof native.nvc2pl === "function",
    "Expected native addon to export nvc2pl(normal, konst)",
  );
  invariant(
    typeof native.pl2nvc === "function",
    "Expected native addon to export pl2nvc(plane)",
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

  // --- GF (Geometry Finder) ---
  invariant(
    typeof native.gfsstp === "function",
    "Expected native addon to export gfsstp(step)",
  );
  invariant(
    typeof native.gfstep === "function",
    "Expected native addon to export gfstep(time)",
  );
  invariant(
    typeof native.gfstol === "function",
    "Expected native addon to export gfstol(value)",
  );
  invariant(
    typeof native.gfrefn === "function",
    "Expected native addon to export gfrefn(t1, t2, s1, s2)",
  );
  invariant(
    typeof native.gfrepi === "function",
    "Expected native addon to export gfrepi(window, begmss, endmss)",
  );
  invariant(
    typeof native.gfrepf === "function",
    "Expected native addon to export gfrepf()",
  );
  invariant(
    typeof native.gfsep === "function",
    "Expected native addon to export gfsep(targ1, shape1, frame1, targ2, shape2, frame2, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result)",
  );
  invariant(
    typeof native.gfdist === "function",
    "Expected native addon to export gfdist(target, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result)",
  );

  invariant(
    typeof native.eul2m === "function",
    "Expected native addon to export eul2m",
  );
  invariant(
    typeof native.m2eul === "function",
    "Expected native addon to export m2eul",
  );
  invariant(
    typeof native.m2q === "function",
    "Expected native addon to export m2q",
  );
  invariant(
    typeof native.q2m === "function",
    "Expected native addon to export q2m",
  );
  invariant(
    typeof native.qxq === "function",
    "Expected native addon to export qxq",
  );
  invariant(
    typeof native.qdq2av === "function",
    "Expected native addon to export qdq2av",
  );
  invariant(
    typeof native.raxisa === "function",
    "Expected native addon to export raxisa",
  );
  invariant(
    typeof native.mequg === "function",
    "Expected native addon to export mequg",
  );
  invariant(
    typeof native.mtxmg === "function",
    "Expected native addon to export mtxmg",
  );
  invariant(
    typeof native.mtxvg === "function",
    "Expected native addon to export mtxvg",
  );
  invariant(
    typeof native.mxmg === "function",
    "Expected native addon to export mxmg",
  );
  invariant(
    typeof native.mxmtg === "function",
    "Expected native addon to export mxmtg",
  );
  invariant(
    typeof native.mxvg === "function",
    "Expected native addon to export mxvg",
  );
  invariant(
    typeof native.vtmvg === "function",
    "Expected native addon to export vtmvg",
  );
  invariant(
    typeof native.xposeg === "function",
    "Expected native addon to export xposeg",
  );
  invariant(
    typeof native.srfc2s === "function",
    "Expected native addon to export srfc2s",
  );
  invariant(
    typeof native.srfcss === "function",
    "Expected native addon to export srfcss",
  );
  invariant(
    typeof native.srfs2c === "function",
    "Expected native addon to export srfs2c",
  );
  invariant(
    typeof native.srfscc === "function",
    "Expected native addon to export srfscc",
  );
  return native;
}
