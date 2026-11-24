import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { fileURLToPath } from "node:url";

import type {
  Found,
  SpiceIntCell,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";

export type NativeAddon = {
  spiceVersion(): string;

  // Error-free CSPICE constants.
  pi(): number;
  twopi(): number;
  halfpi(): number;
  dpr(): number;
  rpd(): number;
  spd(): number;
  j2000(): number;
  j1900(): number;
  b1950(): number;

  // Error-free CSPICE constants.
  clight(): number;
  dpmax(): number;
  dpmin(): number;
  intmax(): number;
  intmin(): number;
  b1900(): number;
  j1950(): number;
  j2100(): number;
  jyear(): number;
  tyear(): number;

  // --- error/status utilities ---
  errdev(op: string, value: string, capacity: number): string;
  errprt(op: string, value: string, capacity: number): string;
  trcoff(): void;
  errch(marker: string, value: string): void;
  errdp(marker: string, value: number): void;
  errint(marker: string, value: number): void;
  qcktrc(tracelen: number): string;
  return(): boolean;
  trcdep(): number;
  trcnam(index: number, namlen: number): string;
  failed(): boolean;
  reset(): void;
  getmsg(which: "SHORT" | "LONG" | "EXPLAIN"): string;
  setmsg(message: string): void;
  sigerr(short: string): void;
  chkin(name: string): void;
  chkout(name: string): void;

  furnsh(path: string): void;
  unload(path: string): void;
  kclear(): void;
  ktotal(kind?: string): number;
  kdata(
    which: number,
    kind?: string,
  ): {
    found: boolean;
    file?: string;
    filtyp?: string;
    source?: string;
    handle?: number;
  };

  // --- kernel management ---
  kinfo(path: string): {
    found: boolean;
    filtyp?: string;
    source?: string;
    handle?: number;
  };
  kxtrct(
    keywd: string,
    terms: readonly string[],
    wordsq: string,
  ): { found: boolean; wordsq?: string; substr?: string };
  kplfrm(frmcls: number, idset: number): void;

  // --- kernel pool ---
  badkpv(
    caller: string,
    name: string,
    comp: string,
    size: number,
    divby: number,
    type: string,
  ): boolean;
  bodvcd(
    body: number,
    item: string,
    maxn: number,
  ): { dim: number; values: number[] };
  bodvrd(
    body: string,
    item: string,
    maxn: number,
  ): { dim: number; values: number[] };
  clpool(): void;
  dvpool(name: string): void;
  ldpool(path: string): void;
  lmpool(lines: readonly string[]): void;
  stpool(
    item: string,
    nth: number,
    contin: string,
    lenout: number,
  ): Found<{ nthstr: string; size: number }>;
  szpool(name: string): Found<{ n: number }>;

  gdpool(
    name: string,
    start: number,
    room: number,
  ): { found: boolean; values?: number[] };
  gipool(
    name: string,
    start: number,
    room: number,
  ): { found: boolean; values?: number[] };
  gcpool(
    name: string,
    start: number,
    room: number,
  ): { found: boolean; values?: string[] };
  gnpool(
    template: string,
    start: number,
    room: number,
  ): { found: boolean; values?: string[] };
  dtpool(name: string): { found: boolean; n?: number; type?: string };

  pdpool(name: string, values: readonly number[]): void;
  pipool(name: string, values: readonly number[]): void;
  pcpool(name: string, values: readonly string[]): void;

  swpool(agent: string, names: readonly string[]): void;
  cvpool(agent: string): boolean;
  expool(name: string): boolean;
  etcal(et: number, callen: number): string;
  utc2et(utcstr: string): number;
  tparch(type: string): void;
  tsetyr(year: number): void;
  et2lst(
    et: number,
    body: number,
    lon: number,
    type: string,
    timlen: number,
    ampmlen: number,
  ): { hr: number; mn: number; sc: number; time: string; ampm: string };
  str2et(utc: string): number;
  et2utc(et: number, format: string, prec: number): string;
  timout(et: number, picture: string): string;

  deltet(epoch: number, eptype: string): number;
  unitim(epoch: number, insys: string, outsys: string): number;
  tparse(timstr: string): number;
  tpictr(sample: string, pictur: string): string;
  timdefGet(item: string): string;
  timdefSet(item: string, value: string): void;

  // --- file i/o primitives ---

  text_owner(): number;
  release_text_owner(owner: number): void;
  rdtext(
    owner: number,
    path: string,
    width: number,
  ): { bytes: Uint8Array; eof: boolean };
  putcml(argc: number, bytes: Uint8Array): Uint8Array;
  exists(path: string): boolean;
  getfat(path: string): { arch: string; type: string };

  dafac(handle: number, rows: number, width: number, table: Uint8Array): void;
  dafdc(handle: number): void;
  dafec(
    handle: number,
    rows: number,
    width: number,
  ): { n: number; bytes: Uint8Array; done: boolean };
  dafrs(handle: number, summary: Uint8Array): void;
  dafps(
    nd: number,
    ni: number,
    dc: readonly number[],
    ic: readonly number[],
  ): Uint8Array;
  dafus(
    summary: Uint8Array,
    nd: number,
    ni: number,
  ): { dc: number[]; ic: number[] };
  dafgsr(
    handle: number,
    recno: number,
    begin: number,
    end: number,
  ): { found: false } | { found: true; data: Uint8Array };
  dafrfr(
    handle: number,
    ifnlen: number,
  ): {
    nd: number;
    ni: number;
    ifname: Uint8Array;
    fward: number;
    bward: number;
    free: number;
  };
  dafrda(handle: number, begin: number, end: number): Uint8Array;
  dafgda(handle: number, begin: number, end: number): number[];
  dafbbs(handle: number): void;
  dafcs(handle: number): void;
  daffpa(handle: number): boolean;
  dafgh(): number;
  dafgn(handle: number, namlen: number): Uint8Array;
  dafgs(handle: number): Uint8Array;
  dafhsf(handle: number): { nd: number; ni: number };
  dafopw(path: string): number;
  dafopr(path: string): number;
  dafcls(handle: number): void;
  dafbfs(handle: number): void;
  daffna(handle: number): boolean;

  dasac(handle: number, n: number, width: number, rows: Uint8Array): void;
  dasdc(handle: number): void;
  dasec(
    handle: number,
    bufsiz: number,
    buffln: number,
  ): { n: number; done: boolean; bytes: Uint8Array };
  dasadc(
    handle: number,
    n: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): void;
  dasadd(handle: number, n: number, data: readonly number[]): void;
  dasadi(handle: number, n: number, data: readonly number[]): void;
  dasrdc(
    handle: number,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): Uint8Array;
  dasrdd(handle: number, first: number, last: number): number[];
  dasrdi(handle: number, first: number, last: number): number[];
  dasudc(
    handle: number,
    first: number,
    last: number,
    bpos: number,
    epos: number,
    datlen: number,
    data: Uint8Array,
  ): void;
  dasudd(
    handle: number,
    first: number,
    last: number,
    data: readonly number[],
  ): void;
  dasudi(
    handle: number,
    first: number,
    last: number,
    data: readonly number[],
  ): void;
  dasonw(path: string, ftype: string, ifname: string, ncomr: number): number;
  dasops(): number;
  dasopw(path: string): number;
  dashfn(handle: number, namlen: number): string;
  dashfs(handle: number): number[];
  daslla(handle: number): number[];
  dasllc(handle: number): void;
  dasrfr(
    handle: number,
    idwlen: number,
    ifnlen: number,
  ): { idword: string; ifname: string; counts: number[] };
  daswbr(handle: number): void;
  dasopr(path: string): number;
  dascls(handle: number): void;

  dlaopn(path: string, ftype: string, ifname: string, ncomch: number): number;
  dlabbs(handle: number): { found: boolean; descr?: Record<string, unknown> };
  dlafps(
    handle: number,
    descr: Record<string, unknown>,
  ): { found: boolean; descr?: Record<string, unknown> };
  dlabns(handle: number): void;
  dlaens(handle: number): void;
  dlabfs(handle: number): { found: boolean; descr?: Record<string, unknown> };
  dlafns(
    handle: number,
    descr: Record<string, unknown>,
  ): { found: boolean; descr?: Record<string, unknown> };
  dlacls(handle: number): void;

  // --- EK ---
  ekccnt(table: string): number;
  ekcii(
    table: string,
    cindex: number,
    collen: number,
  ): import("@rybosome/tspice-core").EkMetadataBuffers;
  eklef(path: string): number;
  eknelt(selidx: number, row: number): number;
  ekpsel(query: string): import("@rybosome/tspice-core").EkMetadataBuffers;
  ekssum(
    id: number,
    loaded: number,
    segment: number,
  ): import("@rybosome/tspice-core").EkMetadataBuffers;
  ekuef(generation: number): void;
  ekload_nseg(generation: number): number;
  ekopr(path: string): number;
  ekopw(path: string): number;
  ekopn(path: string, ifname: string, ncomch: number): number;
  ekcls(handle: number): void;

  ekntab(): number;
  ektnam(n: number): string;
  eknseg(handle: number): number;

  // --- EK query + fast write ---
  ekfind(
    query: string,
  ): { ok: true; nmrows: number } | { ok: false; errmsg: string };
  ekgc(
    selidx: number,
    row: number,
    elment: number,
  ):
    | { found: false }
    | { found: true; isNull: true }
    | { found: true; isNull: false; value: string };
  ekgd(
    selidx: number,
    row: number,
    elment: number,
  ):
    | { found: false }
    | { found: true; isNull: true }
    | { found: true; isNull: false; value: number };
  ekgi(
    selidx: number,
    row: number,
    elment: number,
  ):
    | { found: false }
    | { found: true; isNull: true }
    | { found: true; isNull: false; value: number };
  ekacec(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekaced(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekacei(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekrcec(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    width: number,
  ): { nvals: number; isNull: boolean; bytes: Uint8Array };
  ekrced(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    width: number,
  ): { nvals: number; isNull: boolean; bytes: Uint8Array };
  ekrcei(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    width: number,
  ): { nvals: number; isNull: boolean; bytes: Uint8Array };
  ekucec(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekuced(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekucei(
    handle: number,
    segno: number,
    recno: number,
    column: string,
    count: number,
    width: number,
    bytes: Uint8Array,
    isNull: boolean,
  ): void;
  ekops(): number;
  ekbseg(
    handle: number,
    table: string,
    count: number,
    nameWidth: number,
    names: Uint8Array,
    declWidth: number,
    decls: Uint8Array,
  ): number;
  ekappr(handle: number, segno: number): number;
  ekinsr(handle: number, segno: number, recno: number): void;
  ekdelr(handle: number, segno: number, recno: number): void;
  ekifld(
    handle: number,
    tabnam: string,
    nrows: number,
    cnames: readonly string[],
    decls: readonly string[],
  ): { segno: number; rcptrs: number[] };
  ekacli(
    handle: number,
    segno: number,
    column: string,
    ivals: readonly number[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;
  ekacld(
    handle: number,
    segno: number,
    column: string,
    dvals: readonly number[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;
  ekaclc(
    handle: number,
    segno: number,
    column: string,
    cvals: readonly string[],
    entszs: readonly number[],
    nlflgs: readonly boolean[],
    rcptrs: readonly number[],
  ): void;
  ekffld(handle: number, segno: number, rcptrs: readonly number[]): void;

  // --- DSK writer ---
  dskopn(path: string, ifname: string, ncomch: number): number;
  dskmi2(
    nv: number,
    vrtces: readonly number[],
    np: number,
    plates: readonly number[],
    finscl: number,
    corscl: number,
    worksz: number,
    voxpsz: number,
    voxlsz: number,
    makvtl: boolean,
    spxisz: number,
  ): { spaixd: number[]; spaixi: number[] };
  dskw02(
    handle: number,
    center: number,
    surfid: number,
    dclass: number,
    frame: string,
    corsys: number,
    corpar: readonly number[],
    mncor1: number,
    mxcor1: number,
    mncor2: number,
    mxcor2: number,
    mncor3: number,
    mxcor3: number,
    first: number,
    last: number,
    nv: number,
    vrtces: readonly number[],
    np: number,
    plates: readonly number[],
    spaixd: readonly number[],
    spaixi: readonly number[],
  ): void;

  // --- DSK ---

  dskobj(dsk: string, bodidsCellHandle: number): void;
  dsksrf(dsk: string, bodyid: number, srfidsCellHandle: number): void;
  dskgd(
    handle: number,
    dladsc: Record<string, unknown>,
  ): Record<string, unknown>;
  dskb02(
    handle: number,
    dladsc: Record<string, unknown>,
  ): Record<string, unknown>;

  bodn2c(name: string): { found: boolean; code?: number };
  bodc2n(code: number): { found: boolean; name?: string };
  srfc2s(code: number, bodyId: number, srflen: number): unknown;
  srfcss(code: number, body: string, srflen: number): unknown;
  srfs2c(surface: string, body: string): { found: boolean; code?: number };
  srfscc(surface: string, bodyId: number): { found: boolean; code?: number };
  bodc2s(code: number): string;
  bods2c(name: string): { found: boolean; code?: number };
  boddef(name: string, code: number): void;
  bodfnd(body: number, item: string): boolean;
  bodvar(body: number, item: string): number[];
  namfrm(name: string): { found: boolean; code?: number };
  frmnam(code: number): { found: boolean; name?: string };
  cidfrm(center: number): { found: boolean; frcode?: number; frname?: string };
  cnmfrm(centerName: string): {
    found: boolean;
    frcode?: number;
    frname?: string;
  };
  frinfo(frameId: number): {
    found: boolean;
    center?: number;
    frameClass?: number;
    classId?: number;
  };
  ccifrm(
    frameClass: number,
    classId: number,
  ): { found: boolean; frcode?: number; frname?: string; center?: number };

  scs2e(sc: number, sclkch: string): number;
  sce2t(sc: number, et: number): number;
  scfmt(sc: number, ticks: number, clklen: number): string;
  scpart(sc: number): { pstart: number[]; pstop: number[] };
  sctiks(sc: number, clkstr: string): number;

  sce2s(sc: number, et: number): string;
  scencd(sc: number, sclkch: string): number;
  scdecd(sc: number, sclkdp: number): string;
  sct2e(sc: number, sclkdp: number): number;
  sce2c(sc: number, et: number): number;
  ckgp(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): { found: boolean; cmat?: number[]; clkout?: number };
  ckgpav(
    inst: number,
    sclkdp: number,
    tol: number,
    ref: string,
  ): { found: boolean; cmat?: number[]; av?: number[]; clkout?: number };

  pckcls(handle: number): void;
  pckcov(path: string, classId: number, cover: number): void;
  pckfrm(path: string, ids: number): void;
  pcklof(path: string): number;
  pckopn(path: string, ifname: string, ncomch: number): number;
  pckuof(handle: number): void;
  pckw02(
    handle: number,
    classId: number,
    frame: string,
    first: number,
    last: number,
    segid: string,
    intlen: number,
    n: number,
    degree: number,
    coefficients: readonly number[],
    btime: number,
  ): void;
  ckopn(path: string, ifname: string, ncomch: number): number;
  ckcls(handle: number): void;
  ckw01(
    handle: number,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    n: number,
    data: Float64Array,
  ): void;
  ckw02(
    handle: number,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    segid: string,
    n: number,
    data: Float64Array,
  ): void;
  ckw03(
    handle: number,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    n: number,
    nints: number,
    data: Float64Array,
  ): void;
  ckw05(
    handle: number,
    subtype: number,
    degree: number,
    beg: number,
    end: number,
    inst: number,
    ref: string,
    av: boolean,
    segid: string,
    n: number,
    nints: number,
    rate: number,
    data: Float64Array,
  ): void;
  ckfrot(
    inst: number,
    et: number,
  ): { found: false } | { found: true; ref: number; rotate: number[] };
  ckfxfm(
    inst: number,
    et: number,
  ): { found: false } | { found: true; ref: number; xform: number[] };
  ckgr02(handle: number, descr: Uint8Array, recno: number): number[];
  ckgr03(handle: number, descr: Uint8Array, recno: number): number[];
  ckmeta(ckid: number, meta: string): number;
  cknr02(handle: number, descr: Uint8Array): number;
  cknr03(handle: number, descr: Uint8Array): number;
  cklpf(ck: string): number;
  ckupf(handle: number): void;
  ckobj(ck: string, idsCellHandle: number): void;
  ckcov(
    ck: string,
    idcode: number,
    needav: boolean,
    level: string,
    tol: number,
    timsys: string,
    coverWindowHandle: number,
  ): void;

  conics(elts: readonly number[], et: number): number[];
  eqncpv(
    et: number,
    epoch: number,
    eqel: readonly number[],
    rapol: number,
    decpol: number,
  ): number[];
  oscelt(state: readonly number[], et: number, mu: number): number[];
  oscltx(state: readonly number[], et: number, mu: number): number[];
  prop2b(gm: number, pvinit: readonly number[], dt: number): number[];
  spkezr(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string,
  ): { state: number[]; lt: number };

  spkpos(
    target: string,
    et: number,
    ref: string,
    abcorr: string,
    obs: string,
  ): { pos: number[]; lt: number };

  spkez(
    target: number,
    et: number,
    ref: string,
    abcorr: string,
    obs: number,
  ): { state: number[]; lt: number };

  spkezp(
    target: number,
    et: number,
    ref: string,
    abcorr: string,
    obs: number,
  ): { pos: number[]; lt: number };

  spkgeo(
    target: number,
    et: number,
    ref: string,
    obs: number,
  ): { state: number[]; lt: number };

  spkgps(
    target: number,
    et: number,
    ref: string,
    obs: number,
  ): { pos: number[]; lt: number };

  // Geometry classic
  illumg(
    method: string,
    target: string,
    ilusrc: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    spoint: number[],
  ): {
    trgepc: number;
    srfvec: number[];
    phase: number;
    incdnc: number;
    emissn: number;
  };

  illumf(
    method: string,
    target: string,
    ilusrc: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    spoint: number[],
  ): {
    trgepc: number;
    srfvec: number[];
    phase: number;
    incdnc: number;
    emissn: number;
    visibl: boolean;
    lit: boolean;
  };

  getelm(
    firstYear: number,
    lines: readonly [string, string],
  ): { epoch: number; elems: number[] };
  evsgp4(
    et: number,
    geophs: readonly number[],
    elems: readonly number[],
  ): number[];
  spkssb(target: number, et: number, ref: string): number[];

  spkcov(spk: string, idcode: number, cover: SpiceWindow): void;

  nvc2pl(normal: number[], konst: number): number[];
  pl2nvc(plane: number[]): { normal: number[]; konst: number };
  spkobj(spk: string, ids: SpiceIntCell): void;

  spksfs(
    body: number,
    et: number,
  ): { found: boolean; handle?: number; descr?: Float64Array; ident?: string };

  spkpds(
    body: number,
    center: number,
    frame: string,
    type: number,
    first: number,
    last: number,
  ): Float64Array;
  spkuds(descr: Float64Array): {
    body: number;
    center: number;
    frame: number;
    type: number;
    first: number;
    last: number;
    baddr: number;
    eaddr: number;
  };

  // --- SPK writers ---

  spkopn(path: string, ifname: string, ncomch: number): number;
  spkopa(path: string): number;
  spkcls(handle: number): void;
  spkw08(
    handle: number,
    body: number,
    center: number,
    frame: string,
    first: number,
    last: number,
    segid: string,
    degree: number,
    states: readonly number[] | Float64Array,
    epoch1: number,
    step: number,
  ): void;

  subpnt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
  ): { spoint: number[]; trgepc: number; srfvec: number[] };

  subslr(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
  ): { spoint: number[]; trgepc: number; srfvec: number[] };

  sincpt(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    dref: string,
    dvec: number[],
  ): { found: boolean; spoint?: number[]; trgepc?: number; srfvec?: number[] };

  ilumin(
    method: string,
    target: string,
    et: number,
    fixref: string,
    abcorr: string,
    observer: string,
    spoint: number[],
  ): {
    trgepc: number;
    srfvec: number[];
    phase: number;
    incdnc: number;
    emissn: number;
  };

  occult(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: string,
    observer: string,
    et: number,
  ): number;

  // --- GF (Geometry Finder) ---

  gfsstp(step: number): void;
  gfstep(time: number): number;
  gfstol(value: number): void;
  gfrefn(t1: number, t2: number, s1: boolean, s2: boolean): number;
  gfrepi(window: SpiceWindow, begmss: string, endmss: string): void;
  gfrepf(): void;

  gfsep(
    targ1: string,
    shape1: string,
    frame1: string,
    targ2: string,
    shape2: string,
    frame2: string,
    abcorr: string,
    obsrvr: string,
    relate: string,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;

  gfdist(
    target: string,
    abcorr: string,
    obsrvr: string,
    relate: string,
    refval: number,
    adjust: number,
    step: number,
    nintvls: number,
    cnfine: SpiceWindow,
    result: SpiceWindow,
  ): void;
  bltfrm(frameClass: number, ids: number): void;
  pxfrm2(from: string, to: string, etfrom: number, etto: number): number[];
  tipbod(ref: string, body: number, et: number): number[];
  tisbod(ref: string, body: number, et: number): number[];
  tkfram(typeId: number): { found: boolean; rot?: number[]; frame?: number };
  xfmsta(
    state: readonly number[],
    from: string,
    to: string,
    body: string,
  ): number[];
  pxform(from: string, to: string, et: number): number[];
  frame(x: number[]): { x: unknown; y: unknown; z: unknown };
  twovec(
    axdef: number[],
    indexa: number,
    plndef: number[],
    indexp: number,
  ): unknown;
  twovxf(
    axdef: number[],
    indexa: number,
    plndef: number[],
    indexp: number,
  ): unknown;
  eul2xf(
    eulang: number[],
    axisa: number,
    axisb: number,
    axisc: number,
  ): unknown;
  xf2eul(
    xform: number[],
    axisa: number,
    axisb: number,
    axisc: number,
  ): { eulang: unknown; unique: unknown };
  xf2rav(xform: number[]): { rot: unknown; av: unknown };
  rav2xf(rot: number[], av: number[]): unknown;
  invstm(mat: number[]): unknown;
  xpose6(m1: number[]): unknown;
  sxform(from: string, to: string, et: number): number[];

  cyllat(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; lon: number; lat: number };
  cylrec(radius: number, lon: number, z: number): number[];
  cylsph(
    radius: number,
    lon: number,
    z: number,
  ): { radius: number; colat: number; lon: number };
  latcyl(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; lon: number; z: number };
  latsph(
    radius: number,
    lon: number,
    lat: number,
  ): { radius: number; colat: number; lon: number };
  reccyl(rect: readonly number[]): { radius: number; lon: number; z: number };
  sphcyl(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; z: number };
  sphlat(
    radius: number,
    colat: number,
    lon: number,
  ): { radius: number; lon: number; lat: number };

  vdist(a: readonly number[], b: readonly number[]): number;
  vequ(v: readonly number[]): number[];
  vpack(x: number, y: number, z: number): number[];
  vupack(v: readonly number[]): { x: number; y: number; z: number };
  vzero(v: readonly number[]): boolean;
  unorm(v: readonly number[]): { unit: number[]; norm: number };
  ucrss(a: readonly number[], b: readonly number[]): number[];
  vsep(a: readonly number[], b: readonly number[]): number;

  vlcom(
    a: number,
    v1: readonly number[],
    b: number,
    v2: readonly number[],
  ): number[];
  vlcom3(
    a: number,
    v1: readonly number[],
    b: number,
    v2: readonly number[],
    c: number,
    v3: readonly number[],
  ): number[];
  vperp(a: readonly number[], b: readonly number[]): number[];
  vproj(a: readonly number[], b: readonly number[]): number[];
  vrel(a: readonly number[], b: readonly number[]): number;
  vrotv(v: readonly number[], axis: readonly number[], theta: number): number[];
  rotvec(v: readonly number[], angle: number, axis: number): number[];
  vtmv(
    v1: readonly number[],
    matrix: readonly number[],
    v2: readonly number[],
  ): number;

  azlrec(
    range: number,
    az: number,
    el: number,
    azccw: boolean,
    elplsz: boolean,
  ): number[];
  recazl(
    rect: readonly number[],
    azccw: boolean,
    elplsz: boolean,
  ): { range: number; az: number; el: number };
  pgrrec(
    body: string,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): number[];
  recpgr(
    body: string,
    rect: readonly number[],
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };
  radrec(range: number, ra: number, dec: number): number[];
  recrad(rect: readonly number[]): { range: number; ra: number; dec: number };
  srfrec(body: number, lon: number, lat: number): number[];

  brcktd(value: number, end1: number, end2: number): number;
  brckti(value: number, end1: number, end2: number): number;
  convrt(value: number, inUnit: string, outUnit: string): number;
  sumad(values: readonly number[]): number;
  sumai(values: readonly number[]): number;
  maxd(values: readonly number[]): number;
  maxi(values: readonly number[]): number;
  mind(values: readonly number[]): number;
  mini(values: readonly number[]): number;

  ducrss(a: readonly number[], b: readonly number[]): number[];
  dvcrss(a: readonly number[], b: readonly number[]): number[];
  dvdot(a: readonly number[], b: readonly number[]): number;
  dvhat(state: readonly number[]): number[];
  dvnorm(state: readonly number[]): number;
  dvsep(a: readonly number[], b: readonly number[]): number;

  chbder(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
    nderiv: number,
  ): number[];
  chbigr(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; itgrlp: number };
  chbint(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): { p: number; dpdx: number };
  chbval(
    cp: readonly number[],
    x2s: readonly [number, number],
    x: number,
  ): number;
  polyds(coeffs: readonly number[], nderiv: number, t: number): number[];
  rquad(
    a: number,
    b: number,
    c: number,
  ): { root1: [number, number]; root2: [number, number] };

  hrmesp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };
  hrmint(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { f: number; df: number };
  lgresp(
    first: number,
    step: number,
    yvals: readonly number[],
    x: number,
  ): number;
  lgrind(
    xvals: readonly number[],
    yvals: readonly number[],
    x: number,
  ): { p: number; dp: number };
  lgrint(xvals: readonly number[], yvals: readonly number[], x: number): number;
  qderiv(f0: readonly number[], f2: readonly number[], delta: number): number[];

  clearc(ndim: number, arrlen: number, bytes: readonly number[]): number[];
  cleard(ndim: number, values: readonly number[]): number[];
  cleari(ndim: number, values: readonly number[]): number[];
  filld(value: number, ndim: number, values: readonly number[]): number[];
  filli(value: number, ndim: number, values: readonly number[]): number[];
  moved(
    source: readonly number[],
    ndim: number,
    destination: readonly number[],
  ): number[];

  eul2m(
    angle3: number,
    angle2: number,
    angle1: number,
    axis3: number,
    axis2: number,
    axis1: number,
  ): unknown;
  m2eul(
    m: readonly number[],
    axis3: number,
    axis2: number,
    axis1: number,
  ): { angle3: unknown; angle2: unknown; angle1: unknown };
  m2q(m: readonly number[]): unknown;
  q2m(q: readonly number[]): unknown;
  qxq(q1: readonly number[], q2: readonly number[]): unknown;
  qdq2av(q: readonly number[], dq: readonly number[]): unknown;
  raxisa(m: readonly number[]): { axis: unknown; angle: unknown };
  dazldr(
    x: number,
    y: number,
    z: number,
    azccw: boolean,
    elplsz: boolean,
  ): number[];
  dcyldr(x: number, y: number, z: number): number[];
  dgeodr(x: number, y: number, z: number, re: number, f: number): number[];
  dlatdr(x: number, y: number, z: number): number[];
  dpgrdr(
    body: string,
    x: number,
    y: number,
    z: number,
    re: number,
    f: number,
  ): number[];
  drdazl(
    range: number,
    az: number,
    el: number,
    azccw: boolean,
    elplsz: boolean,
  ): number[];
  drdcyl(radius: number, lon: number, z: number): number[];
  drdgeo(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): number[];
  drdlat(radius: number, lon: number, lat: number): number[];
  drdpgr(
    body: string,
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): number[];
  drdsph(radius: number, colat: number, lon: number): number[];
  dsphdr(x: number, y: number, z: number): number[];
  det(m: readonly number[]): number;
  diags2(symmat: readonly number[]): { diag: number[]; rotate: number[] };
  ident(): number[];
  invert(m: readonly number[]): number[];
  invort(m: readonly number[]): number[];
  isrot(m: readonly number[], ntol: number, dtol: number): boolean;
  mequ(m: readonly number[]): number[];
  mtxm(a: readonly number[], b: readonly number[]): number[];
  mxmt(a: readonly number[], b: readonly number[]): number[];
  trace(m: readonly number[]): number;
  xpose(m: readonly number[]): number[];

  mequg(m1: readonly number[], nr: number, nc: number): unknown;
  mtxmg(
    m1: readonly number[],
    m2: readonly number[],
    nc1: number,
    nr1r2: number,
    nc2: number,
  ): unknown;
  mtxvg(
    m1: readonly number[],
    v2: readonly number[],
    nc1: number,
    nr1r2: number,
  ): unknown;
  mxmg(
    m1: readonly number[],
    m2: readonly number[],
    nr1: number,
    nc1r2: number,
    nc2: number,
  ): unknown;
  mxmtg(
    m1: readonly number[],
    m2: readonly number[],
    nr1: number,
    nc1c2: number,
    nr2: number,
  ): unknown;
  mxvg(
    m1: readonly number[],
    v2: readonly number[],
    nr1: number,
    nc1r2: number,
  ): unknown;
  vtmvg(
    v1: readonly number[],
    matrix: readonly number[],
    v2: readonly number[],
    nrow: number,
    ncol: number,
  ): unknown;
  xposeg(matrix: readonly number[], nrow: number, ncol: number): unknown;
  vaddg(a: readonly number[], b: readonly number[]): number[];
  vdistg(a: readonly number[], b: readonly number[]): number;
  vdotg(a: readonly number[], b: readonly number[]): number;
  vequg(v: readonly number[]): number[];
  vhatg(v: readonly number[]): number[];
  vlcomg(
    a: number,
    v1: readonly number[],
    b: number,
    v2: readonly number[],
  ): number[];
  vminug(v: readonly number[]): number[];
  vnormg(v: readonly number[]): number;
  vprojg(a: readonly number[], b: readonly number[]): number[];
  vrelg(a: readonly number[], b: readonly number[]): number;
  vsclg(s: number, v: readonly number[]): number[];
  vsepg(a: readonly number[], b: readonly number[]): number;
  vsubg(a: readonly number[], b: readonly number[]): number[];
  vzerog(v: readonly number[]): boolean;
  unormg(v: readonly number[]): { unit: number[]; norm: number };

  cpos(text: string, chars: string, start: number): number;
  cposr(text: string, chars: string, start: number): number;
  ncpos(text: string, chars: string, start: number): number;
  ncposr(text: string, chars: string, start: number): number;
  pos(text: string, substr: string, start: number): number;
  posr(text: string, substr: string, start: number): number;
  esrchc(value: string, values: readonly string[]): number;
  dp2hx(value: number, lenout: number): { hxstr: string; hxssiz: number };
  hx2dp(
    input: string,
    lenout: number,
  ):
    | { error: false; number: number; errmsg: string }
    | { error: true; errmsg: string };
  prsdp(input: string): number;
  prsint(input: string): number;
  repmc(input: string, marker: string, value: string, lenout: number): string;
  repmct(
    input: string,
    marker: string,
    value: number,
    rtcase: string,
    lenout: number,
  ): string;
  repmd(
    input: string,
    marker: string,
    value: number,
    sigdig: number,
    lenout: number,
  ): string;
  repmf(
    input: string,
    marker: string,
    value: number,
    sigdig: number,
    format: string,
    lenout: number,
  ): string;
  repmi(input: string, marker: string, value: number, lenout: number): string;
  repml(
    input: string,
    marker: string,
    value: boolean,
    rtcase: string,
    lenout: number,
  ): string;
  repmot(
    input: string,
    marker: string,
    value: number,
    rtcase: string,
    lenout: number,
  ): string;
  nextwd(
    input: string,
    nexlen: number,
    reslen: number,
  ): { next: string; rest: string };
  nthwd(
    input: string,
    nth: number,
    worlen: number,
  ): { word: string; loc: number };
  lparse(
    list: string,
    delim: string,
    nmax: number,
    itemln: number,
  ): { n: number; items: string[] };
  lparsm(
    list: string,
    delims: string,
    nmax: number,
    itemln: number,
  ): { n: number; items: string[] };
  lx4dec(input: string, first: number): { last: number; nchar: number };
  lx4num(input: string, first: number): { last: number; nchar: number };
  lx4sgn(input: string, first: number): { last: number; nchar: number };
  lx4uns(input: string, first: number): { last: number; nchar: number };
  lxqstr(
    input: string,
    qchar: string,
    first: number,
  ): { last: number; nchar: number };
  cmprss(delim: string, n: number, input: string, lenout: number): string;
  eqstr(a: string, b: string): boolean;
  iswhsp(input: string): boolean;
  lastnb(input: string): number;
  lcase(input: string, lenout: number): string;
  ucase(input: string, lenout: number): string;
  matchi(input: string, templ: string, wstr: string, wchr: string): boolean;
  matchw(input: string, templ: string, wstr: string, wchr: string): boolean;

  bschoc(
    key: string,
    values: readonly string[],
    order: readonly number[],
  ): number;
  bschoi(
    key: number,
    values: readonly number[],
    order: readonly number[],
  ): number;
  bsrchc(key: string, values: readonly string[]): number;
  bsrchd(key: number, values: readonly number[]): number;
  bsrchi(key: number, values: readonly number[]): number;
  isrchc(key: string, values: readonly string[]): number;
  isrchd(key: number, values: readonly number[]): number;
  isrchi(key: number, values: readonly number[]): number;
  isordv(values: Int32Array): boolean;
  orderc(width: number, values: Uint8Array): Int32Array;
  orderd(values: Float64Array): Int32Array;
  orderi(values: Int32Array): Int32Array;
  reordc(order: Int32Array, width: number, values: Uint8Array): Uint8Array;
  reordd(order: Int32Array, values: Float64Array): Float64Array;
  reordi(order: Int32Array, values: Int32Array): Int32Array;
  reordl(order: Int32Array, values: Int32Array): Int32Array;
  shellc(width: number, values: Uint8Array): Uint8Array;
  shelld(values: Float64Array): Float64Array;
  shelli(values: Int32Array): Int32Array;
  lstlec(key: string, values: readonly string[]): number;
  lstled(key: number, values: readonly number[]): number;
  lstlei(key: number, values: readonly number[]): number;
  lstltc(key: string, values: readonly string[]): number;
  lstltd(key: number, values: readonly number[]): number;
  lstlti(key: number, values: readonly number[]): number;

  reclat(rect: number[]): { radius: number; lon: number; lat: number };
  latrec(radius: number, lon: number, lat: number): number[];
  recsph(rect: number[]): { radius: number; colat: number; lon: number };
  sphrec(radius: number, colat: number, lon: number): number[];

  vnorm(v: number[]): number;
  vhat(v: number[]): number[];
  vdot(a: number[], b: number[]): number;
  vcrss(a: number[], b: number[]): number[];
  mxv(m: readonly number[], v: readonly number[]): number[];
  mtxv(m: readonly number[], v: readonly number[]): number[];

  vadd(a: readonly number[], b: readonly number[]): number[];
  vsub(a: readonly number[], b: readonly number[]): number[];
  vminus(v: readonly number[]): number[];
  vscl(s: number, v: readonly number[]): number[];

  mxm(a: readonly number[], b: readonly number[]): number[];
  rotate(angle: number, axis: number): number[];
  rotmat(m: readonly number[], angle: number, axis: number): number[];
  axisar(axis: readonly number[], angle: number): number[];

  georec(
    lon: number,
    lat: number,
    alt: number,
    re: number,
    f: number,
  ): number[];
  recgeo(
    rect: readonly number[],
    re: number,
    f: number,
  ): { lon: number; lat: number; alt: number };

  // Cells + windows
  newIntCell(size: number): number;
  newDoubleCell(size: number): number;
  newCharCell(size: number, length: number): number;
  newWindow(maxIntervals: number): number;

  freeCell(cell: number): void;
  freeWindow(window: number): void;

  ssize(size: number, cell: number): void;
  scard(card: number, cell: number): void;
  card(cell: number): number;
  size(cell: number): number;
  valid(size: number, n: number, cell: number): void;

  insrti(item: number, cell: number): void;
  insrtd(item: number, cell: number): void;
  appndc(item: string, cell: number): void;
  appndd(item: number, cell: number): void;
  appndi(item: number, cell: number): void;
  elemc(item: string, cell: number): boolean;
  elemd(item: number, cell: number): boolean;
  elemi(item: number, cell: number): boolean;
  diff(a: number, b: number, result: number): void;
  inter(a: number, b: number, result: number): void;
  sdiff(a: number, b: number, result: number): void;
  union(a: number, b: number, result: number): void;
  set(a: number, op: string, b: number): boolean;
  removc(item: string, cell: number): void;
  removd(item: number, cell: number): void;
  removi(item: number, cell: number): void;
  ordc(item: string, cell: number): number;
  ordd(item: number, cell: number): number;
  ordi(item: number, cell: number): number;
  copy(source: number, destination: number): void;
  lparss(list: string, delims: string, set: number): void;
  insrtc(item: string, cell: number): void;

  cellGeti(cell: number, index: number): number;
  cellGetd(cell: number, index: number): number;
  cellGetc(cell: number, index: number): string;

  wncomd(left: number, right: number, window: number, result: number): void;
  wncond(left: number, right: number, window: number): void;
  wndifd(a: number, b: number, result: number): void;
  wnelmd(point: number, window: number): boolean;
  wnexpd(left: number, right: number, window: number): void;
  wnextd(side: string, window: number): void;
  wnfild(small: number, window: number): void;
  wnfltd(small: number, window: number): void;
  wnincd(left: number, right: number, window: number): boolean;
  wnintd(a: number, b: number, result: number): void;
  wnreld(a: number, op: string, b: number): boolean;
  wnsumd(window: number): {
    meas: number;
    avg: number;
    stddev: number;
    shortest: number;
    longest: number;
  };
  wnunid(a: number, b: number, result: number): void;

  wninsd(left: number, right: number, window: number): void;
  wncard(window: number): number;
  wnfetd(window: number, index: number): number[];
  wnvald(size: number, n: number, window: number): void;

  /** Internal test helper (not part of the backend contract). */
  __ktotalAll(): number;
};

let cachedAddon: NativeAddon | undefined;

const ADDON_TARGET = "tspice_backend_node";
const ADDON_FILE = `${ADDON_TARGET}.node`;

const NATIVE_PLATFORM_PACKAGES = {
  darwin: {
    arm64: "@rybosome/tspice-native-darwin-arm64",
    x64: "@rybosome/tspice-native-darwin-x64",
  },
  linux: {
    x64: "@rybosome/tspice-native-linux-x64-gnu",
  },
} as const;

const BUILD_HINT =
  "Try rebuilding it: pnpm run fetch:cspice && pnpm -C packages/backend-node build:native. " +
  "Or set TSPICE_CSPICE_DIR=/abs/path/to/cspice (containing include/ and lib/). " +
  "Or set TSPICE_BACKEND_NODE_BINDING_PATH to an explicit .node path.";

function getPackageRoot(importMetaUrl: string): string {
  // Works both in the monorepo layout (`.../backend-node/dist/runtime/addon.js`) and
  // in the published `dist-publish/` layout where this code is vendored into
  // `@rybosome/tspice`.
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "..", "..");
}

function loadAddon(require: NodeRequire, bindingPath: string): NativeAddon {
  const resolved = path.resolve(bindingPath);
  try {
    return require(resolved) as NativeAddon;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const { arch, platform } = process;
    throw new Error(
      `Failed to load tspice native backend at "${resolved}" for ${platform}-${arch}. ` +
        `${BUILD_HINT} ` +
        `Original error: ${errorMessage}`,
      { cause: error },
    );
  }
}

function tryGetPlatformBindingPath(require: NodeRequire): string | undefined {
  const platform = process.platform as keyof typeof NATIVE_PLATFORM_PACKAGES;
  const arch = process.arch as string;

  const pkgName =
    NATIVE_PLATFORM_PACKAGES[platform]?.[
      arch as keyof (typeof NATIVE_PLATFORM_PACKAGES)[typeof platform]
    ];

  if (!pkgName) {
    return undefined;
  }

  try {
    const mod = require(pkgName) as unknown;
    if (typeof mod === "string") {
      return mod;
    }
    if (
      typeof mod === "object" &&
      mod !== null &&
      "bindingPath" in mod &&
      typeof (mod as { bindingPath?: unknown }).bindingPath === "string"
    ) {
      return (mod as { bindingPath: string }).bindingPath;
    }
    return undefined;
  } catch (error) {
    // If the platform package isn't installed, that's expected.
    if (
      (error as NodeJS.ErrnoException | undefined)?.code === "MODULE_NOT_FOUND"
    ) {
      return undefined;
    }
    throw error;
  }
}

/**
 * Lazily load (and cache) the native Node addon implementing the SPICE backend.
 */
export function getNativeAddon(): NativeAddon {
  if (cachedAddon) {
    return cachedAddon;
  }

  const require = createRequire(import.meta.url);
  const packageRoot = getPackageRoot(import.meta.url);
  const override = process.env.TSPICE_BACKEND_NODE_BINDING_PATH;
  if (override) {
    const resolvedOverride = path.resolve(packageRoot, override);
    if (!fs.existsSync(resolvedOverride)) {
      const { arch, platform } = process;
      throw new Error(
        `TSPICE_BACKEND_NODE_BINDING_PATH points to a non-existent file: ${resolvedOverride} (platform=${platform}, arch=${arch}). Ensure it points to a built ${ADDON_FILE}.`,
      );
    }

    cachedAddon = loadAddon(require, resolvedOverride);
    return cachedAddon;
  }

  const platformBindingPath = tryGetPlatformBindingPath(require);
  if (platformBindingPath) {
    cachedAddon = loadAddon(require, platformBindingPath);
    return cachedAddon;
  }

  const candidates = [
    path.join(packageRoot, "native", "build", "Release", ADDON_FILE),
  ];

  const existing = candidates.find((p) => fs.existsSync(p));
  if (!existing) {
    const { arch, platform } = process;
    throw new Error(
      `Native addon ${ADDON_FILE} not found for ${platform}-${arch}. Looked for:\n` +
        candidates.map((p) => `- ${p}`).join("\n") +
        `\n\nIf you built a Debug addon locally, set TSPICE_BACKEND_NODE_BINDING_PATH to its path.` +
        `\n\n${BUILD_HINT}`,
    );
  }

  cachedAddon = loadAddon(require, existing);

  return cachedAddon;
}
