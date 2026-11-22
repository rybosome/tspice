import type {
  FoundDlaDescriptor,
  KernelKindInput,
} from "@rybosome/tspice-backend-contract";

export type TimdefItem = string;

export type ErrorGetmsgWhich = "SHORT" | "LONG" | "EXPLAIN";

/**
 * Logical runtime path reference used by parity workflows.
 *
 * - `fixture`: package fixture file under `packages/py-parity-checking/fixtures`
 * - `scratch`: case-scoped disposable file under per-case scratch root
 */
export type PathRef = {
  kind: "fixture" | "scratch";
  rel: string;
};

/** Preferred path contract (`PathRef`) with string fixture compatibility for existing case JSON. */
export type PathRefLike = PathRef | string;

export type StepTimeStr2Et = {
  op: "time.str2et";
  time: string;
};

export type StepTimeEt2Utc = {
  op: "time.et2utc";
  et: number;
  format: string;
  prec: number;
};

export type StepTimeSpd = {
  op: "time.spd";
};

export type StepTimeJ2000 = {
  op: "time.j2000";
};

export type StepTimeJ1900 = {
  op: "time.j1900";
};

export type StepTimeB1950 = {
  op: "time.b1950";
};

export type StepTimeB1900 = {
  op: "time.b1900";
};

export type StepTimeJ1950 = {
  op: "time.j1950";
};

export type StepTimeJ2100 = {
  op: "time.j2100";
};

export type StepTimeJyear = {
  op: "time.jyear";
};

export type StepTimeTyear = {
  op: "time.tyear";
};

export type StepTimeTkvrsn = {
  op: "time.tkvrsn";
  item: "TOOLKIT";
};

export type StepTimeTimout = {
  op: "time.timout";
  et: number;
  picture: string;
};

export type StepTimeDeltet = {
  op: "time.deltet";
  epoch: number;
  eptype: "ET" | "UTC";
};

export type StepTimeUnitim = {
  op: "time.unitim";
  epoch: number;
  insys: string;
  outsys: string;
};

export type StepTimeTparse = {
  op: "time.tparse";
  timstr: string;
};

export type StepTimeTpictr = {
  op: "time.tpictr";
  sample: string;
  pictur: string;
};

export type StepTimeScs2e = {
  op: "time.scs2e";
  sc: number;
  sclkch: string;
};

export type StepTimeSce2s = {
  op: "time.sce2s";
  sc: number;
  et: number;
};

export type StepTimeScencd = {
  op: "time.scencd";
  sc: number;
  sclkch: string;
};

export type StepTimeScdecd = {
  op: "time.scdecd";
  sc: number;
  sclkdp: number;
};

export type StepTimeSct2e = {
  op: "time.sct2e";
  sc: number;
  sclkdp: number;
};

export type StepTimeSce2c = {
  op: "time.sce2c";
  sc: number;
  et: number;
};

export type StepTimeTimdefGet = {
  op: "time.timdef";
  action: "GET";
  item: TimdefItem;
};

export type StepTimeTimdefSet = {
  op: "time.timdef";
  action: "SET";
  item: TimdefItem;
  value: string;
};

export type StepIdsNamesBodn2c = {
  op: "ids-names.bodn2c";
  name: string;
};

export type StepIdsNamesBodc2n = {
  op: "ids-names.bodc2n";
  code: number;
};

export type StepIdsNamesBodc2s = {
  op: "ids-names.bodc2s";
  code: number;
};

export type StepIdsNamesBoddef = {
  op: "ids-names.boddef";
  name: string;
  code: number;
};

export type StepIdsNamesBodfnd = {
  op: "ids-names.bodfnd";
  body: number;
  item: string;
};

export type StepIdsNamesBods2c = {
  op: "ids-names.bods2c";
  name: string;
};

export type StepIdsNamesBodvar = {
  op: "ids-names.bodvar";
  body: number;
  item: string;
};

export type Quaternion = readonly [number, number, number, number];
export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type Matrix6x6 = [
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
  [number, number, number, number, number, number],
];

export type Vector6 = [number, number, number, number, number, number];

export type Vector2 = [number, number];

export type Vector3 = [number, number, number];

export type StepCoordsVectorsDucrss = {
  op: "coords-vectors.ducrss";
  a: Vector6;
  b: Vector6;
};

export type StepCoordsVectorsDvcrss = {
  op: "coords-vectors.dvcrss";
  a: Vector6;
  b: Vector6;
};

export type StepCoordsVectorsDvdot = {
  op: "coords-vectors.dvdot";
  a: Vector6;
  b: Vector6;
};

export type StepCoordsVectorsDvhat = {
  op: "coords-vectors.dvhat";
  state: Vector6;
};

export type StepCoordsVectorsDvnorm = {
  op: "coords-vectors.dvnorm";
  state: Vector6;
};

export type StepCoordsVectorsDvsep = {
  op: "coords-vectors.dvsep";
  a: Vector6;
  b: Vector6;
};

export type StepCoordsVectorsBrcktd = {
  op: "coords-vectors.brcktd";
  value: number;
  end1: number;
  end2: number;
};

export type StepCoordsVectorsBrckti = {
  op: "coords-vectors.brckti";
  value: number;
  end1: number;
  end2: number;
};

export type StepCoordsVectorsConvrt = {
  op: "coords-vectors.convrt";
  value: number;
  inUnit: string;
  outUnit: string;
};

export type StepCoordsVectorsSumad = {
  op: "coords-vectors.sumad";
  values: number[];
};

export type StepCoordsVectorsSumai = {
  op: "coords-vectors.sumai";
  values: number[];
};

export type StepCoordsVectorsMaxd = {
  op: "coords-vectors.maxd";
  values: number[];
};

export type StepCoordsVectorsMaxi = {
  op: "coords-vectors.maxi";
  values: number[];
};

export type StepCoordsVectorsMind = {
  op: "coords-vectors.mind";
  values: number[];
};

export type StepCoordsVectorsMini = {
  op: "coords-vectors.mini";
  values: number[];
};

export type StepCoordsVectorsAzlrec = {
  op: "coords-vectors.azlrec";
  range: number;
  az: number;
  el: number;
  azccw: boolean;
  elplsz: boolean;
};

export type StepCoordsVectorsRecazl = {
  op: "coords-vectors.recazl";
  rect: Vector3;
  azccw: boolean;
  elplsz: boolean;
};

export type StepCoordsVectorsPgrrec = {
  op: "coords-vectors.pgrrec";
  body: string;
  lon: number;
  lat: number;
  alt: number;
  re: number;
  f: number;
};

export type StepCoordsVectorsRecpgr = {
  op: "coords-vectors.recpgr";
  body: string;
  rect: Vector3;
  re: number;
  f: number;
};

export type StepCoordsVectorsRadrec = {
  op: "coords-vectors.radrec";
  range: number;
  ra: number;
  dec: number;
};

export type StepCoordsVectorsRecrad = {
  op: "coords-vectors.recrad";
  rect: Vector3;
};

export type StepCoordsVectorsSrfrec = {
  op: "coords-vectors.srfrec";
  body: number;
  lon: number;
  lat: number;
};

export type StepCoordsVectorsVlcom = {
  op: "coords-vectors.vlcom";
  a: number;
  v1: Vector3;
  b: number;
  v2: Vector3;
};

export type StepCoordsVectorsVlcom3 = {
  op: "coords-vectors.vlcom3";
  a: number;
  v1: Vector3;
  b: number;
  v2: Vector3;
  c: number;
  v3: Vector3;
};

export type StepCoordsVectorsVperp = {
  op: "coords-vectors.vperp";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVproj = {
  op: "coords-vectors.vproj";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVrel = {
  op: "coords-vectors.vrel";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVrotv = {
  op: "coords-vectors.vrotv";
  v: Vector3;
  axis: Vector3;
  theta: number;
};

export type StepCoordsVectorsRotvec = {
  op: "coords-vectors.rotvec";
  v: Vector3;
  angle: number;
  axis: number;
};

export type StepCoordsVectorsVtmv = {
  op: "coords-vectors.vtmv";
  v1: Vector3;
  matrix: Matrix3x3;
  v2: Vector3;
};

export type StepCoordsVectorsVdist = {
  op: "coords-vectors.vdist";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVequ = {
  op: "coords-vectors.vequ";
  v: Vector3;
};

export type StepCoordsVectorsVpack = {
  op: "coords-vectors.vpack";
  x: number;
  y: number;
  z: number;
};

export type StepCoordsVectorsVupack = {
  op: "coords-vectors.vupack";
  v: Vector3;
};

export type StepCoordsVectorsVzero = {
  op: "coords-vectors.vzero";
  v: Vector3;
};

export type StepCoordsVectorsUnorm = {
  op: "coords-vectors.unorm";
  v: Vector3;
};

export type StepCoordsVectorsUcrss = {
  op: "coords-vectors.ucrss";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVsep = {
  op: "coords-vectors.vsep";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsCyllat = {
  op: "coords-vectors.cyllat";
  radius: number;
  lon: number;
  z: number;
};

export type StepCoordsVectorsCylrec = {
  op: "coords-vectors.cylrec";
  radius: number;
  lon: number;
  z: number;
};

export type StepCoordsVectorsCylsph = {
  op: "coords-vectors.cylsph";
  radius: number;
  lon: number;
  z: number;
};

export type StepCoordsVectorsLatcyl = {
  op: "coords-vectors.latcyl";
  radius: number;
  lon: number;
  lat: number;
};

export type StepCoordsVectorsLatsph = {
  op: "coords-vectors.latsph";
  radius: number;
  lon: number;
  lat: number;
};

export type StepCoordsVectorsReccyl = {
  op: "coords-vectors.reccyl";
  rectan: Vector3;
};

export type StepCoordsVectorsSphcyl = {
  op: "coords-vectors.sphcyl";
  radius: number;
  colat: number;
  lon: number;
};

export type StepCoordsVectorsSphlat = {
  op: "coords-vectors.sphlat";
  radius: number;
  colat: number;
  lon: number;
};

export type StepCoordsVectorsChbder = {
  op: "coords-vectors.chbder";
  cp: number[];
  x2s: Vector2;
  x: number;
  nderiv: number;
};

export type StepCoordsVectorsChbigr = {
  op: "coords-vectors.chbigr";
  cp: number[];
  x2s: Vector2;
  x: number;
};

export type StepCoordsVectorsChbint = {
  op: "coords-vectors.chbint";
  cp: number[];
  x2s: Vector2;
  x: number;
};

export type StepCoordsVectorsChbval = {
  op: "coords-vectors.chbval";
  cp: number[];
  x2s: Vector2;
  x: number;
};

export type StepCoordsVectorsPolyds = {
  op: "coords-vectors.polyds";
  coeffs: number[];
  nderiv: number;
  t: number;
};

export type StepCoordsVectorsRquad = {
  op: "coords-vectors.rquad";
  a: number;
  b: number;
  c: number;
};

export type StepCoordsVectorsHrmesp = {
  op: "coords-vectors.hrmesp";
  first: number;
  step: number;
  yvals: number[];
  x: number;
};

export type StepCoordsVectorsHrmint = {
  op: "coords-vectors.hrmint";
  xvals: number[];
  yvals: number[];
  x: number;
};

export type StepCoordsVectorsLgresp = {
  op: "coords-vectors.lgresp";
  first: number;
  step: number;
  yvals: number[];
  x: number;
};

export type StepCoordsVectorsLgrind = {
  op: "coords-vectors.lgrind";
  xvals: number[];
  yvals: number[];
  x: number;
};

export type StepCoordsVectorsLgrint = {
  op: "coords-vectors.lgrint";
  xvals: number[];
  yvals: number[];
  x: number;
};

export type StepCoordsVectorsQderiv = {
  op: "coords-vectors.qderiv";
  f0: number[];
  f2: number[];
  delta: number;
};

export type StepCoordsVectorsClearc = {
  op: "coords-vectors.clearc";
  ndim: number;
  arrlen: number;
  bytes: number[];
};

export type StepCoordsVectorsCleard = {
  op: "coords-vectors.cleard";
  ndim: number;
  values: number[];
};

export type StepCoordsVectorsCleari = {
  op: "coords-vectors.cleari";
  ndim: number;
  values: number[];
};

export type StepCoordsVectorsFilld = {
  op: "coords-vectors.filld";
  value: number;
  ndim: number;
  values: number[];
};

export type StepCoordsVectorsFilli = {
  op: "coords-vectors.filli";
  value: number;
  ndim: number;
  values: number[];
};

export type StepCoordsVectorsMoved = {
  op: "coords-vectors.moved";
  source: number[];
  ndim: number;
  destination: number[];
};

export type Matrix2RowMajor = [number, number, number, number];

export type StepCoordsVectorsEul2m = {
  op: "coords-vectors.eul2m";
  angle3: number;
  angle2: number;
  angle1: number;
  axis3: number;
  axis2: number;
  axis1: number;
};
export type StepCoordsVectorsM2eul = {
  op: "coords-vectors.m2eul";
  m: Matrix3x3;
  axis3: number;
  axis2: number;
  axis1: number;
};
export type StepCoordsVectorsM2q = { op: "coords-vectors.m2q"; m: Matrix3x3 };
export type StepCoordsVectorsQ2m = { op: "coords-vectors.q2m"; q: Quaternion };
export type StepCoordsVectorsQxq = {
  op: "coords-vectors.qxq";
  q1: Quaternion;
  q2: Quaternion;
};
export type StepCoordsVectorsQdq2av = {
  op: "coords-vectors.qdq2av";
  q: Quaternion;
  dq: Quaternion;
};
export type StepCoordsVectorsRaxisa = {
  op: "coords-vectors.raxisa";
  m: Matrix3x3;
};
export type StepCoordsVectorsDet = {
  op: "coords-vectors.det";
  m: Matrix3x3;
};

export type StepCoordsVectorsDiags2 = {
  op: "coords-vectors.diags2";
  symmat: Matrix2RowMajor;
};

export type StepCoordsVectorsIdent = {
  op: "coords-vectors.ident";
};

export type StepCoordsVectorsInvert = {
  op: "coords-vectors.invert";
  m: Matrix3x3;
};

export type StepCoordsVectorsInvort = {
  op: "coords-vectors.invort";
  m: Matrix3x3;
};

export type StepCoordsVectorsIsrot = {
  op: "coords-vectors.isrot";
  m: Matrix3x3;
  ntol: number;
  dtol: number;
};

export type StepCoordsVectorsMequ = {
  op: "coords-vectors.mequ";
  m: Matrix3x3;
};

export type StepCoordsVectorsMtxm = {
  op: "coords-vectors.mtxm";
  a: Matrix3x3;
  b: Matrix3x3;
};

export type StepCoordsVectorsMxmt = {
  op: "coords-vectors.mxmt";
  a: Matrix3x3;
  b: Matrix3x3;
};

export type StepCoordsVectorsTrace = {
  op: "coords-vectors.trace";
  m: Matrix3x3;
};

export type StepCoordsVectorsXpose = {
  op: "coords-vectors.xpose";
  m: Matrix3x3;
};

export type StepCoordsVectorsMequg = {
  op: "coords-vectors.mequg";
  m1: number[];
  nr: number;
  nc: number;
};

export type StepCoordsVectorsMtxmg = {
  op: "coords-vectors.mtxmg";
  m1: number[];
  m2: number[];
  nc1: number;
  nr1r2: number;
  nc2: number;
};

export type StepCoordsVectorsMtxvg = {
  op: "coords-vectors.mtxvg";
  m1: number[];
  v2: number[];
  nc1: number;
  nr1r2: number;
};

export type StepCoordsVectorsMxmg = {
  op: "coords-vectors.mxmg";
  m1: number[];
  m2: number[];
  nr1: number;
  nc1r2: number;
  nc2: number;
};

export type StepCoordsVectorsMxmtg = {
  op: "coords-vectors.mxmtg";
  m1: number[];
  m2: number[];
  nr1: number;
  nc1c2: number;
  nr2: number;
};

export type StepCoordsVectorsMxvg = {
  op: "coords-vectors.mxvg";
  m1: number[];
  v2: number[];
  nr1: number;
  nc1r2: number;
};

export type StepCoordsVectorsVtmvg = {
  op: "coords-vectors.vtmvg";
  v1: number[];
  matrix: number[];
  v2: number[];
  nrow: number;
  ncol: number;
};

export type StepCoordsVectorsXposeg = {
  op: "coords-vectors.xposeg";
  matrix: number[];
  nrow: number;
  ncol: number;
};

export type StepCoordsVectorsVaddg = {
  op: "coords-vectors.vaddg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVdistg = {
  op: "coords-vectors.vdistg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVdotg = {
  op: "coords-vectors.vdotg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVequg = {
  op: "coords-vectors.vequg";
  v: number[];
};

export type StepCoordsVectorsVhatg = {
  op: "coords-vectors.vhatg";
  v: number[];
};

export type StepCoordsVectorsVlcomg = {
  op: "coords-vectors.vlcomg";
  a: number;
  v1: number[];
  b: number;
  v2: number[];
};

export type StepCoordsVectorsVminug = {
  op: "coords-vectors.vminug";
  v: number[];
};

export type StepCoordsVectorsVnormg = {
  op: "coords-vectors.vnormg";
  v: number[];
};

export type StepCoordsVectorsVprojg = {
  op: "coords-vectors.vprojg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVrelg = {
  op: "coords-vectors.vrelg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVsclg = {
  op: "coords-vectors.vsclg";
  s: number;
  v: number[];
};

export type StepCoordsVectorsVsepg = {
  op: "coords-vectors.vsepg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVsubg = {
  op: "coords-vectors.vsubg";
  a: number[];
  b: number[];
};

export type StepCoordsVectorsVzerog = {
  op: "coords-vectors.vzerog";
  v: number[];
};

export type StepCoordsVectorsUnormg = {
  op: "coords-vectors.unormg";
  v: number[];
};

export type StepCoordsVectorsReclat = {
  op: "coords-vectors.reclat";
  rectan: Vector3;
};

export type StepCoordsVectorsLatrec = {
  op: "coords-vectors.latrec";
  radius: number;
  lon: number;
  lat: number;
};

export type StepCoordsVectorsRecsph = {
  op: "coords-vectors.recsph";
  rectan: Vector3;
};

export type StepCoordsVectorsSphrec = {
  op: "coords-vectors.sphrec";
  radius: number;
  colat: number;
  lon: number;
};

export type StepCoordsVectorsPi = {
  op: "coords-vectors.pi";
};

export type StepCoordsVectorsTwopi = {
  op: "coords-vectors.twopi";
};

export type StepCoordsVectorsHalfpi = {
  op: "coords-vectors.halfpi";
};

export type StepCoordsVectorsDpr = {
  op: "coords-vectors.dpr";
};

export type StepCoordsVectorsRpd = {
  op: "coords-vectors.rpd";
};

export type StepCoordsVectorsClight = {
  op: "coords-vectors.clight";
};

export type StepCoordsVectorsDpmax = {
  op: "coords-vectors.dpmax";
};

export type StepCoordsVectorsDpmin = {
  op: "coords-vectors.dpmin";
};

export type StepCoordsVectorsIntmax = {
  op: "coords-vectors.intmax";
};

export type StepCoordsVectorsIntmin = {
  op: "coords-vectors.intmin";
};

export type StepCoordsVectorsVnorm = {
  op: "coords-vectors.vnorm";
  v: Vector3;
};

export type StepCoordsVectorsVhat = {
  op: "coords-vectors.vhat";
  v: Vector3;
};

export type StepCoordsVectorsVdot = {
  op: "coords-vectors.vdot";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVcrss = {
  op: "coords-vectors.vcrss";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVadd = {
  op: "coords-vectors.vadd";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVsub = {
  op: "coords-vectors.vsub";
  a: Vector3;
  b: Vector3;
};

export type StepCoordsVectorsVminus = {
  op: "coords-vectors.vminus";
  v: Vector3;
};

export type StepCoordsVectorsVscl = {
  op: "coords-vectors.vscl";
  s: number;
  v: Vector3;
};

export type StepCoordsVectorsMxm = {
  op: "coords-vectors.mxm";
  m1: Matrix3x3;
  m2: Matrix3x3;
};

export type StepCoordsVectorsRotate = {
  op: "coords-vectors.rotate";
  angle: number;
  axis: number;
};

export type StepCoordsVectorsRotmat = {
  op: "coords-vectors.rotmat";
  m: Matrix3x3;
  angle: number;
  axis: number;
};

export type StepCoordsVectorsAxisar = {
  op: "coords-vectors.axisar";
  axis: Vector3;
  angle: number;
};

export type StepCoordsVectorsGeorec = {
  op: "coords-vectors.georec";
  lon: number;
  lat: number;
  alt: number;
  re: number;
  f: number;
};

export type StepCoordsVectorsRecgeo = {
  op: "coords-vectors.recgeo";
  rectan: Vector3;
  re: number;
  f: number;
};

export type StepCoordsVectorsMxv = {
  op: "coords-vectors.mxv";
  m: Matrix3x3;
  v: Vector3;
};

export type StepCoordsVectorsMtxv = {
  op: "coords-vectors.mtxv";
  m: Matrix3x3;
  v: Vector3;
};

export type Vec3 = Vector3;
export type SpicePlane = [number, number, number, number];

export type CellsWindowsTargetKind = "int" | "double" | "char" | "window";

export type StepCellsWindowsCard = {
  op: "cells-windows.card";
  targetKind: CellsWindowsTargetKind;
  targetId: string;
};

export type StepCellsWindowsInsrtc = {
  op: "cells-windows.insrtc";
  cellId: string;
  item: string;
  maxCardinality?: number;
  length?: number;
};

export type StepCellsWindowsInsrtd = {
  op: "cells-windows.insrtd";
  cellId: string;
  item: number;
  maxCardinality?: number;
};

export type StepCellsWindowsInsrti = {
  op: "cells-windows.insrti";
  cellId: string;
  item: number;
  maxCardinality?: number;
};

export type StepCellsWindowsScard = {
  op: "cells-windows.scard";
  card: number;
  targetKind: CellsWindowsTargetKind;
  targetId: string;
};

export type StepCellsWindowsSize = {
  op: "cells-windows.size";
  targetKind: CellsWindowsTargetKind;
  targetId: string;
};

export type StepCellsWindowsSsize = {
  op: "cells-windows.ssize";
  size: number;
  targetKind: CellsWindowsTargetKind;
  targetId: string;
};

export type StepCellsWindowsValid = {
  op: "cells-windows.valid";
  size: number;
  n: number;
  targetKind: CellsWindowsTargetKind;
  targetId: string;
};

export type StepCellsWindowsWncard = {
  op: "cells-windows.wncard";
  windowId: string;
};

export type IndexTriple = [number, number, number];

export type DlaDescriptorPayload = {
  bwdptr: number;
  fwdptr: number;
  ibase: number;
  isize: number;
  dbase: number;
  dsize: number;
  cbase: number;
  csize: number;
};

export type DskDescriptorPayload = {
  surfce: number;
  center: number;
  dclass: number;
  dtype: number;
  frmcde: number;
  corsys: number;
  corpar: number[];
  co1min: number;
  co1max: number;
  co2min: number;
  co2max: number;
  co3min: number;
  co3max: number;
  start: number;
  stop: number;
};

export type DskType2BookkeepingPayload = {
  nv: number;
  np: number;
  nvxtot: number;
  vtxbds: [[number, number], [number, number], [number, number]];
  voxsiz: number;
  voxori: Vec3;
  vgrext: Vec3;
  cgscal: number;
  vtxnpl: number;
  voxnpt: number;
  voxnpl: number;
};

export type StepCellsWindowsWninsd = {
  op: "cells-windows.wninsd";
  windowId: string;
  left: number;
  right: number;
  maxIntervals?: number;
};

export type StepCellsWindowsWnfetd = {
  op: "cells-windows.wnfetd";
  windowId: string;
  index: number;
};

export type StepCellsWindowsWnvald = {
  op: "cells-windows.wnvald";
  size: number;
  n: number;
  windowId: string;
};

export type StepKernelPoolGdpool = {
  op: "kernel-pool.gdpool";
  name: string;
  start: number;
  room: number;
};

export type StepKernelPoolGipool = {
  op: "kernel-pool.gipool";
  name: string;
  start: number;
  room: number;
};

export type StepKernelPoolGcpool = {
  op: "kernel-pool.gcpool";
  name: string;
  start: number;
  room: number;
};

export type StepKernelPoolGnpool = {
  op: "kernel-pool.gnpool";
  template: string;
  start: number;
  room: number;
};

export type StepKernelPoolDtpool = {
  op: "kernel-pool.dtpool";
  name: string;
};

export type StepKernelPoolPdpool = {
  op: "kernel-pool.pdpool";
  name: string;
  values: number[];
};

export type StepKernelPoolPipool = {
  op: "kernel-pool.pipool";
  name: string;
  values: number[];
};

export type StepKernelPoolPcpool = {
  op: "kernel-pool.pcpool";
  name: string;
  values: string[];
};

export type StepKernelPoolSwpool = {
  op: "kernel-pool.swpool";
  agent: string;
  names: string[];
};

export type StepKernelPoolCvpool = {
  op: "kernel-pool.cvpool";
  agent: string;
};

export type StepKernelPoolExpool = {
  op: "kernel-pool.expool";
  name: string;
};

export type StepKernelsFurnsh = {
  op: "kernels.furnsh";
  file: PathRefLike;
  alias?: string;
};

export type StepKernelsKclear = {
  op: "kernels.kclear";
};

export type StepKernelsKinfo = {
  op: "kernels.kinfo";
  path: string;
  alias?: string;
};

export type StepKernelsKplfrm = {
  op: "kernels.kplfrm";
  frmcls: number;
  capacity?: number;
};

export type StepKernelsKtotal = {
  op: "kernels.ktotal";
  kind?: KernelKindInput;
};

export type StepKernelsKdata = {
  op: "kernels.kdata";
  which: number;
  kind?: KernelKindInput;
};

export type StepKernelsKxtrct = {
  op: "kernels.kxtrct";
  keywd: string;
  terms: string[];
  string: string;
};

export type StepKernelsUnload = {
  op: "kernels.unload";
  path: string;
  alias?: string;
};

export type StepEphemerisSpkcls = {
  op: "ephemeris.spkcls";
  handleId: string;
  /** Require/capture a real structured toolkit error without discarding the handle. */
  captureError?: boolean;
};

export type StepEphemerisSpkcov = {
  op: "ephemeris.spkcov";
  spk: PathRefLike;
  idcode: number;
  coverWindowId: string;
  maxIntervals?: number;
};

export type StepEphemerisSpkez = {
  op: "ephemeris.spkez";
  target: number;
  et: number;
  ref: string;
  abcorr: string;
  observer: number;
};

export type StepEphemerisSpkezp = {
  op: "ephemeris.spkezp";
  target: number;
  et: number;
  ref: string;
  abcorr: string;
  observer: number;
};

export type StepEphemerisSpkezr = {
  op: "ephemeris.spkezr";
  target: string;
  et: number;
  ref: string;
  abcorr: string;
  observer: string;
};

export type StepEphemerisSpkgeo = {
  op: "ephemeris.spkgeo";
  target: number;
  et: number;
  ref: string;
  observer: number;
};

export type StepEphemerisSpkgps = {
  op: "ephemeris.spkgps";
  target: number;
  et: number;
  ref: string;
  observer: number;
};

export type StepEphemerisSpkobj = {
  op: "ephemeris.spkobj";
  spk: PathRefLike;
  idsCellId: string;
  maxCardinality?: number;
};

export type StepEphemerisSpkopa = {
  op: "ephemeris.spkopa";
  file: PathRefLike;
  handleId: string;
};

export type StepEphemerisSpkopn = {
  op: "ephemeris.spkopn";
  file: PathRefLike;
  ifname: string;
  ncomch: number;
  handleId: string;
};

export type StepEphemerisSpkpds = {
  op: "ephemeris.spkpds";
  /** Retain the actual packed result for a later raw spkuds step. */
  descrId?: string;
  body: number;
  center: number;
  frame: string;
  type: number;
  first: number;
  last: number;
};

export type StepEphemerisSpkpos = {
  op: "ephemeris.spkpos";
  target: string;
  et: number;
  ref: string;
  abcorr: string;
  observer: string;
};

export type StepEphemerisSpksfs = {
  op: "ephemeris.spksfs";
  descrId?: string;
  body: number;
  et: number;
};

export type StepEphemerisSpkssb = {
  op: "ephemeris.spkssb";
  target: number;
  et: number;
  ref: string;
};

export type SpkPackedDescriptor = [number, number, number, number, number];

export type StepEphemerisSpkuds = { op: "ephemeris.spkuds" } & (
  | { descr: SpkPackedDescriptor; descrId?: never }
  | { descr?: never; descrId: string }
);

export type StepEphemerisSpkw08 = {
  op: "ephemeris.spkw08";
  handleId: string;
  body: number;
  center: number;
  frame: string;
  first: number;
  last: number;
  segid: string;
  degree: number;
  states: number[];
  epoch1: number;
  step: number;
};

export type StepFileIoExists = {
  op: "file-io.exists";
  path: PathRefLike;
  alias?: string;
};

export type StepFileIoGetfat = {
  op: "file-io.getfat";
  path: PathRefLike;
  alias?: string;
};

export type StepFileIoDafopr = {
  op: "file-io.dafopr";
  path: PathRefLike;
  alias?: string;
  handleId: string;
};

export type StepFileIoDafcls = {
  op: "file-io.dafcls";
  handleId: string;
};

export type StepFileIoDafbfs = {
  op: "file-io.dafbfs";
  handleId: string;
};

export type StepFileIoDaffna = {
  op: "file-io.daffna";
  handleId: string;
};

export type StepFileIoDasopr = {
  op: "file-io.dasopr";
  path: PathRefLike;
  alias?: string;
  handleId: string;
};

export type StepFileIoDascls = {
  op: "file-io.dascls";
  handleId: string;
};

export type StepFileIoDlaopn = {
  op: "file-io.dlaopn";
  path: PathRefLike;
  alias?: string;
  ftype: string;
  ifname: string;
  ncomch: number;
  handleId: string;
};

export type StepFileIoDlabfs = {
  op: "file-io.dlabfs";
  handleId: string;
  descrId: string;
};

export type StepFileIoDlafns = {
  op: "file-io.dlafns";
  handleId: string;
  descrId: string;
};

export type StepFileIoDlacls = {
  op: "file-io.dlacls";
  handleId: string;
};

export type StepFileIoDskopn = {
  op: "file-io.dskopn";
  path: PathRefLike;
  alias?: string;
  ifname: string;
  ncomch: number;
  handleId: string;
};

export type StepFileIoDskmi2 = {
  op: "file-io.dskmi2";
  nv: number;
  vrtces: number[];
  np: number;
  plates: number[];
  finscl: number;
  corscl: number;
  worksz: number;
  voxpsz: number;
  voxlsz: number;
  makvtl: boolean;
  spxisz: number;
  spaixId?: string;
};

export type StepFileIoDskw02 = {
  op: "file-io.dskw02";
  handleId: string;
  center: number;
  surfid: number;
  dclass: number;
  frame: string;
  corsys: number;
  corpar: number[];
  mncor1: number;
  mxcor1: number;
  mncor2: number;
  mxcor2: number;
  mncor3: number;
  mxcor3: number;
  first: number;
  last: number;
  nv: number;
  vrtces: number[];
  np: number;
  plates: number[];
  spaixId: string;
};

export type StepErrorFailed = {
  op: "error.failed";
};

export type StepErrorReset = {
  op: "error.reset";
};

export type StepErrorGetmsg = {
  op: "error.getmsg";
  which: ErrorGetmsgWhich;
};

export type StepErrorSetmsg = {
  op: "error.setmsg";
  message: string;
};

export type StepErrorSigerr = {
  op: "error.sigerr";
  short: string;
  /** Capture the actual thrown SPICE details and continue to observe recovery. */
  capture?: boolean;
};

export type StepErrorChkin = {
  op: "error.chkin";
  name: string;
};

export type StepErrorChkout = {
  op: "error.chkout";
  name: string;
};

export type CkCoverageLevel = "SEGMENT" | "INTERVAL";
export type CkCoverageTimeSystem = "SCLK" | "TDB";

export type StepFramesNamfrm = {
  op: "frames.namfrm";
  name: string;
};

export type StepFramesFrmnam = {
  op: "frames.frmnam";
  code: number;
};

export type StepFramesCidfrm = {
  op: "frames.cidfrm";
  center: number;
};

export type StepFramesCnmfrm = {
  op: "frames.cnmfrm";
  centerName: string;
};

export type StepFramesFrinfo = {
  op: "frames.frinfo";
  frameId: number;
};

export type StepFramesCcifrm = {
  op: "frames.ccifrm";
  frameClass: number;
  classId: number;
};

export type StepFramesCkgp = {
  op: "frames.ckgp";
  inst: number;
  sclkdp: number;
  tol: number;
  ref: string;
};

export type StepFramesCkgpav = {
  op: "frames.ckgpav";
  inst: number;
  sclkdp: number;
  tol: number;
  ref: string;
};

export type StepFramesCklpf = {
  op: "frames.cklpf";
  ck: PathRefLike;
  handleId: string;
};

export type StepFramesCkupf = {
  op: "frames.ckupf";
  handleId: string;
};

export type StepFramesCkobj = {
  op: "frames.ckobj";
  ck: PathRefLike;
  idsId: string;
  maxCard?: number;
  /** Clear before inspection by default; false accumulates raw set output. */
  reset?: boolean;
};

export type StepFramesCkcov = {
  op: "frames.ckcov";
  ck: PathRefLike;
  idcode: number;
  needav: boolean;
  level: CkCoverageLevel;
  tol: number;
  timsys: CkCoverageTimeSystem;
  coverId: string;
  maxIntervals?: number;
  /** Clear before inspection by default; false accumulates raw window output. */
  reset?: boolean;
};

export type StepFramesPxform = {
  op: "frames.pxform";
  from: string;
  to: string;
  et: number;
};

export type StepFramesSxform = {
  op: "frames.sxform";
  from: string;
  to: string;
  et: number;
};

export type StepEkEkfind = {
  op: "ek.ekfind";
  query: string;
};

export type StepEkEkgc = {
  op: "ek.ekgc";
  selidx: number;
  row: number;
  elment: number;
};

export type StepEkEkgd = {
  op: "ek.ekgd";
  selidx: number;
  row: number;
  elment: number;
};

export type StepEkEkgi = {
  op: "ek.ekgi";
  selidx: number;
  row: number;
  elment: number;
};

export type StepEkEkopn = {
  op: "ek.ekopn";
  path: PathRefLike;
  ifname: string;
  ncomch: number;
  handleId: string;
};

export type StepEkEkopr = {
  op: "ek.ekopr";
  path: PathRefLike;
  handleId: string;
};

export type StepEkEkopw = {
  op: "ek.ekopw";
  path: PathRefLike;
  handleId: string;
};

export type StepEkEkcls = {
  op: "ek.ekcls";
  handleId: string;
};

export type StepEkEkntab = {
  op: "ek.ekntab";
};

export type StepEkEktnam = {
  op: "ek.ektnam";
  n: number;
};

export type StepEkEknseg = {
  op: "ek.eknseg";
  handleId: string;
};

export type StepEkEkifld = {
  op: "ek.ekifld";
  handleId: string;
  tabnam: string;
  nrows: number;
  cnames: string[];
  decls: string[];
  segmentId: string;
};

export type StepEkEkacli = {
  op: "ek.ekacli";
  segmentId: string;
  column: string;
  ivals: number[];
  entszs: number[];
  nlflgs: boolean[];
};

export type StepEkEkacld = {
  op: "ek.ekacld";
  segmentId: string;
  column: string;
  dvals: number[];
  entszs: number[];
  nlflgs: boolean[];
};

export type StepEkEkaclc = {
  op: "ek.ekaclc";
  segmentId: string;
  column: string;
  cvals: string[];
  entszs: number[];
  nlflgs: boolean[];
};

export type StepEkEkffld = {
  op: "ek.ekffld";
  segmentId: string;
};

export type StepGeometryGfGfsstp = {
  op: "geometry-gf.gfsstp";
  step: number;
};

export type StepGeometryGfGfstep = {
  op: "geometry-gf.gfstep";
  time: number;
};

export type StepGeometryGfGfstol = {
  op: "geometry-gf.gfstol";
  value: number;
};

export type StepGeometryGfGfrefn = {
  op: "geometry-gf.gfrefn";
  t1: number;
  t2: number;
  s1: boolean;
  s2: boolean;
};

export type StepGeometryGfGfrepi = {
  op: "geometry-gf.gfrepi";
  windowId: string;
  begmss: string;
  endmss: string;
};

export type StepGeometryGfGfrepf = {
  op: "geometry-gf.gfrepf";
};

export type StepGeometryGfGfsep = {
  op: "geometry-gf.gfsep";
  targ1: string;
  shape1: string;
  frame1: string;
  targ2: string;
  shape2: string;
  frame2: string;
  abcorr: string;
  obsrvr: string;
  relate: string;
  refval: number;
  adjust: number;
  step: number;
  nintvls: number;
  cnfineWindowId: string;
  resultWindowId: string;
  /** Output capacity, separate from the internal workspace interval count. */
  resultMaxIntervals?: number;
};

export type StepGeometryGfGfdist = {
  op: "geometry-gf.gfdist";
  target: string;
  abcorr: string;
  obsrvr: string;
  relate: string;
  refval: number;
  adjust: number;
  step: number;
  nintvls: number;
  cnfineWindowId: string;
  resultWindowId: string;
  /** Output capacity, separate from the internal workspace interval count. */
  resultMaxIntervals?: number;
};

export type StepGeometrySubpnt = {
  op: "geometry.subpnt";
  method: string;
  target: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
};

export type StepGeometrySubslr = {
  op: "geometry.subslr";
  method: string;
  target: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
};

export type StepGeometrySincpt = {
  op: "geometry.sincpt";
  method: string;
  target: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
  dref: string;
  dvec: Vec3;
};

export type StepGeometryIlumin = {
  op: "geometry.ilumin";
  method: string;
  target: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
  spoint: Vec3;
};

export type StepGeometryIllumg = {
  op: "geometry.illumg";
  method: string;
  target: string;
  ilusrc: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
  spoint: Vec3;
};

export type StepGeometryIllumf = {
  op: "geometry.illumf";
  method: string;
  target: string;
  ilusrc: string;
  et: number;
  fixref: string;
  abcorr: string;
  observer: string;
  spoint: Vec3;
};

export type StepGeometryOccult = {
  op: "geometry.occult";
  targ1: string;
  shape1: string;
  frame1: string;
  targ2: string;
  shape2: string;
  frame2: string;
  abcorr: string;
  observer: string;
  et: number;
};

export type StepGeometryNvc2pl = {
  op: "geometry.nvc2pl";
  normal: Vec3;
  konst: number;
};

export type StepGeometryPl2nvc = {
  op: "geometry.pl2nvc";
  plane: SpicePlane;
};

export type StepDskDskobj = {
  op: "dsk.dskobj";
  path: PathRefLike;
  cellSize?: number;
  initial?: number[];
  repetitions?: number;
};

export type StepDskDsksrf = {
  op: "dsk.dsksrf";
  path: PathRefLike;
  bodyid: number;
  cellSize?: number;
  initial?: number[];
  repetitions?: number;
};

export type StepDskDskopn = {
  op: "dsk.dskopn";
  handleId: string;
  path: PathRefLike;
  ifname: string;
  ncomch: number;
};

export type StepDskDskmi2 = {
  op: "dsk.dskmi2";
  spatialIndexId: string;
  vrtces: Vec3[];
  plates: IndexTriple[];
  finscl: number;
  corscl: number;
  worksz: number;
  voxpsz: number;
  voxlsz: number;
  makvtl: boolean;
  spxisz: number;
};

export type StepDskDskw02 = {
  op: "dsk.dskw02";
  handleId: string;
  spatialIndexId: string;
  center: number;
  surfid: number;
  dclass: number;
  frame: string;
  corsys: number;
  corpar: number[];
  mncor1: number;
  mxcor1: number;
  mncor2: number;
  mxcor2: number;
  mncor3: number;
  mxcor3: number;
  first: number;
  last: number;
  vrtces: Vec3[];
  plates: IndexTriple[];
};

export type StepDskDasopr = {
  op: "dsk.dasopr";
  handleId: string;
  path: PathRefLike;
};

export type StepDskDascls = {
  op: "dsk.dascls";
  handleId: string;
};

export type StepDskDlabfs = {
  op: "dsk.dlabfs";
  handleId: string;
  dladscId: string;
};

export type StepDskDskgd = {
  op: "dsk.dskgd";
  handleId: string;
  dladscId: string;
};

export type StepDskDskb02 = {
  op: "dsk.dskb02";
  handleId: string;
  dladscId: string;
};

export type WorkflowStep =
  | StepTimeStr2Et
  | StepTimeEt2Utc
  | StepTimeSpd
  | StepTimeJ2000
  | StepTimeJ1900
  | StepTimeB1950
  | StepTimeB1900
  | StepTimeJ1950
  | StepTimeJ2100
  | StepTimeJyear
  | StepTimeTyear
  | StepTimeTkvrsn
  | StepTimeTimout
  | StepTimeDeltet
  | StepTimeUnitim
  | StepTimeTparse
  | StepTimeTpictr
  | StepTimeTimdefGet
  | StepTimeTimdefSet
  | StepTimeScs2e
  | StepTimeSce2s
  | StepTimeScencd
  | StepTimeScdecd
  | StepTimeSct2e
  | StepTimeSce2c
  | StepIdsNamesBodn2c
  | StepIdsNamesBodc2n
  | StepIdsNamesBodc2s
  | StepIdsNamesBoddef
  | StepIdsNamesBodfnd
  | StepIdsNamesBods2c
  | StepIdsNamesBodvar
  | StepCoordsVectorsCyllat
  | StepCoordsVectorsCylrec
  | StepCoordsVectorsCylsph
  | StepCoordsVectorsLatcyl
  | StepCoordsVectorsLatsph
  | StepCoordsVectorsReccyl
  | StepCoordsVectorsSphcyl
  | StepCoordsVectorsSphlat
  | StepCoordsVectorsVdist
  | StepCoordsVectorsVequ
  | StepCoordsVectorsVpack
  | StepCoordsVectorsVupack
  | StepCoordsVectorsVzero
  | StepCoordsVectorsUnorm
  | StepCoordsVectorsUcrss
  | StepCoordsVectorsVsep
  | StepCoordsVectorsVlcom
  | StepCoordsVectorsVlcom3
  | StepCoordsVectorsVperp
  | StepCoordsVectorsVproj
  | StepCoordsVectorsVrel
  | StepCoordsVectorsVrotv
  | StepCoordsVectorsRotvec
  | StepCoordsVectorsVtmv
  | StepCoordsVectorsAzlrec
  | StepCoordsVectorsRecazl
  | StepCoordsVectorsPgrrec
  | StepCoordsVectorsRecpgr
  | StepCoordsVectorsRadrec
  | StepCoordsVectorsRecrad
  | StepCoordsVectorsSrfrec
  | StepCoordsVectorsBrcktd
  | StepCoordsVectorsBrckti
  | StepCoordsVectorsConvrt
  | StepCoordsVectorsSumad
  | StepCoordsVectorsSumai
  | StepCoordsVectorsMaxd
  | StepCoordsVectorsMaxi
  | StepCoordsVectorsMind
  | StepCoordsVectorsMini
  | StepCoordsVectorsDucrss
  | StepCoordsVectorsDvcrss
  | StepCoordsVectorsDvdot
  | StepCoordsVectorsDvhat
  | StepCoordsVectorsDvnorm
  | StepCoordsVectorsDvsep
  | StepCoordsVectorsChbder
  | StepCoordsVectorsChbigr
  | StepCoordsVectorsChbint
  | StepCoordsVectorsChbval
  | StepCoordsVectorsPolyds
  | StepCoordsVectorsRquad
  | StepCoordsVectorsHrmesp
  | StepCoordsVectorsHrmint
  | StepCoordsVectorsLgresp
  | StepCoordsVectorsLgrind
  | StepCoordsVectorsLgrint
  | StepCoordsVectorsQderiv
  | StepCoordsVectorsClearc
  | StepCoordsVectorsCleard
  | StepCoordsVectorsCleari
  | StepCoordsVectorsFilld
  | StepCoordsVectorsFilli
  | StepCoordsVectorsMoved
  | StepCoordsVectorsEul2m
  | StepCoordsVectorsM2eul
  | StepCoordsVectorsM2q
  | StepCoordsVectorsQ2m
  | StepCoordsVectorsQxq
  | StepCoordsVectorsQdq2av
  | StepCoordsVectorsRaxisa
  | StepCoordsVectorsDet
  | StepCoordsVectorsDiags2
  | StepCoordsVectorsIdent
  | StepCoordsVectorsInvert
  | StepCoordsVectorsInvort
  | StepCoordsVectorsIsrot
  | StepCoordsVectorsMequ
  | StepCoordsVectorsMtxm
  | StepCoordsVectorsMxmt
  | StepCoordsVectorsTrace
  | StepCoordsVectorsXpose
  | StepCoordsVectorsMequg
  | StepCoordsVectorsMtxmg
  | StepCoordsVectorsMtxvg
  | StepCoordsVectorsMxmg
  | StepCoordsVectorsMxmtg
  | StepCoordsVectorsMxvg
  | StepCoordsVectorsVtmvg
  | StepCoordsVectorsXposeg
  | StepCoordsVectorsVaddg
  | StepCoordsVectorsVdistg
  | StepCoordsVectorsVdotg
  | StepCoordsVectorsVequg
  | StepCoordsVectorsVhatg
  | StepCoordsVectorsVlcomg
  | StepCoordsVectorsVminug
  | StepCoordsVectorsVnormg
  | StepCoordsVectorsVprojg
  | StepCoordsVectorsVrelg
  | StepCoordsVectorsVsclg
  | StepCoordsVectorsVsepg
  | StepCoordsVectorsVsubg
  | StepCoordsVectorsVzerog
  | StepCoordsVectorsUnormg
  | StepCoordsVectorsReclat
  | StepCoordsVectorsLatrec
  | StepCoordsVectorsRecsph
  | StepCoordsVectorsSphrec
  | StepCoordsVectorsPi
  | StepCoordsVectorsTwopi
  | StepCoordsVectorsHalfpi
  | StepCoordsVectorsDpr
  | StepCoordsVectorsRpd
  | StepCoordsVectorsClight
  | StepCoordsVectorsDpmax
  | StepCoordsVectorsDpmin
  | StepCoordsVectorsIntmax
  | StepCoordsVectorsIntmin
  | StepCoordsVectorsVnorm
  | StepCoordsVectorsVhat
  | StepCoordsVectorsVdot
  | StepCoordsVectorsVcrss
  | StepCoordsVectorsVadd
  | StepCoordsVectorsVsub
  | StepCoordsVectorsVminus
  | StepCoordsVectorsVscl
  | StepCoordsVectorsMxm
  | StepCoordsVectorsRotate
  | StepCoordsVectorsRotmat
  | StepCoordsVectorsAxisar
  | StepCoordsVectorsGeorec
  | StepCoordsVectorsRecgeo
  | StepCoordsVectorsMxv
  | StepCoordsVectorsMtxv
  | StepCellsWindowsCard
  | StepCellsWindowsInsrtc
  | StepCellsWindowsInsrtd
  | StepCellsWindowsInsrti
  | StepCellsWindowsScard
  | StepCellsWindowsSize
  | StepCellsWindowsSsize
  | StepCellsWindowsValid
  | StepCellsWindowsWncard
  | StepCellsWindowsWninsd
  | StepCellsWindowsWnfetd
  | StepCellsWindowsWnvald
  | StepKernelPoolGdpool
  | StepKernelPoolGipool
  | StepKernelPoolGcpool
  | StepKernelPoolGnpool
  | StepKernelPoolDtpool
  | StepKernelPoolPdpool
  | StepKernelPoolPipool
  | StepKernelPoolPcpool
  | StepKernelPoolSwpool
  | StepKernelPoolCvpool
  | StepKernelPoolExpool
  | StepKernelsFurnsh
  | StepKernelsKclear
  | StepKernelsKinfo
  | StepKernelsKplfrm
  | StepKernelsKtotal
  | StepKernelsKdata
  | StepKernelsKxtrct
  | StepKernelsUnload
  | StepEphemerisSpkcls
  | StepEphemerisSpkcov
  | StepEphemerisSpkez
  | StepEphemerisSpkezp
  | StepEphemerisSpkezr
  | StepEphemerisSpkgeo
  | StepEphemerisSpkgps
  | StepEphemerisSpkobj
  | StepEphemerisSpkopa
  | StepEphemerisSpkopn
  | StepEphemerisSpkpds
  | StepEphemerisSpkpos
  | StepEphemerisSpksfs
  | StepEphemerisSpkssb
  | StepEphemerisSpkuds
  | StepEphemerisSpkw08
  | StepFileIoExists
  | StepFileIoGetfat
  | StepFileIoDafopr
  | StepFileIoDafcls
  | StepFileIoDafbfs
  | StepFileIoDaffna
  | StepFileIoDasopr
  | StepFileIoDascls
  | StepFileIoDlaopn
  | StepFileIoDlabfs
  | StepFileIoDlafns
  | StepFileIoDlacls
  | StepFileIoDskopn
  | StepFileIoDskmi2
  | StepFileIoDskw02
  | StepErrorFailed
  | StepErrorReset
  | StepErrorGetmsg
  | StepErrorSetmsg
  | StepErrorSigerr
  | StepErrorChkin
  | StepErrorChkout
  | StepFramesNamfrm
  | StepFramesFrmnam
  | StepFramesCidfrm
  | StepFramesCnmfrm
  | StepFramesFrinfo
  | StepFramesCcifrm
  | StepFramesCkgp
  | StepFramesCkgpav
  | StepFramesCklpf
  | StepFramesCkupf
  | StepFramesCkobj
  | StepFramesCkcov
  | StepFramesPxform
  | StepFramesSxform
  | StepEkEkopn
  | StepEkEkopr
  | StepEkEkopw
  | StepEkEkcls
  | StepEkEkntab
  | StepEkEktnam
  | StepEkEknseg
  | StepEkEkfind
  | StepEkEkgc
  | StepEkEkgd
  | StepEkEkgi
  | StepEkEkifld
  | StepEkEkacli
  | StepEkEkacld
  | StepEkEkaclc
  | StepEkEkffld
  | StepGeometrySubpnt
  | StepGeometrySubslr
  | StepGeometrySincpt
  | StepGeometryIlumin
  | StepGeometryIllumg
  | StepGeometryIllumf
  | StepGeometryOccult
  | StepGeometryNvc2pl
  | StepGeometryPl2nvc
  | StepGeometryGfGfsstp
  | StepGeometryGfGfstep
  | StepGeometryGfGfstol
  | StepGeometryGfGfrefn
  | StepGeometryGfGfrepi
  | StepGeometryGfGfrepf
  | StepGeometryGfGfsep
  | StepGeometryGfGfdist
  | StepDskDskobj
  | StepDskDsksrf
  | StepDskDskopn
  | StepDskDskmi2
  | StepDskDskw02
  | StepDskDasopr
  | StepDskDascls
  | StepDskDlabfs
  | StepDskDskgd
  | StepDskDskb02;

export type WorkflowOp = WorkflowStep["op"];

export type KernelPoolFoundNumbers =
  { found: false } | { found: true; values: number[] };
export type KernelPoolFoundStrings =
  { found: false } | { found: true; values: string[] };

export type EkGetStringResult =
  | { found: false }
  | { found: true; isNull: true }
  | { found: true; isNull: false; value: string };

export type EkGetNumberResult =
  | { found: false }
  | { found: true; isNull: true }
  | { found: true; isNull: false; value: number };

/** Complete observable windows after an actual GF search. */
export type GfSearchWindowPayload = {
  intervals: [number, number][];
  confinementIntervals: [number, number][];
};

export type StepOutput =
  | {
      op: "coords-vectors.cyllat";
      value: { radius: number; lon: number; lat: number };
    }
  | { op: "coords-vectors.cylrec"; value: Vector3 }
  | {
      op: "coords-vectors.cylsph";
      value: { radius: number; colat: number; lon: number };
    }
  | {
      op: "coords-vectors.latcyl";
      value: { radius: number; lon: number; z: number };
    }
  | {
      op: "coords-vectors.latsph";
      value: { radius: number; colat: number; lon: number };
    }
  | {
      op: "coords-vectors.reccyl";
      value: { radius: number; lon: number; z: number };
    }
  | {
      op: "coords-vectors.sphcyl";
      value: { radius: number; lon: number; z: number };
    }
  | {
      op: "coords-vectors.sphlat";
      value: { radius: number; lon: number; lat: number };
    }
  | { op: "coords-vectors.vdist"; value: number }
  | { op: "coords-vectors.vequ"; value: Vector3 }
  | { op: "coords-vectors.vpack"; value: Vector3 }
  | { op: "coords-vectors.vupack"; value: { x: number; y: number; z: number } }
  | { op: "coords-vectors.vzero"; value: boolean }
  | { op: "coords-vectors.unorm"; value: { unit: Vector3; norm: number } }
  | { op: "coords-vectors.ucrss"; value: Vector3 }
  | { op: "coords-vectors.vsep"; value: number }
  | { op: "coords-vectors.vlcom"; value: Vector3 }
  | { op: "coords-vectors.vlcom3"; value: Vector3 }
  | { op: "coords-vectors.vperp"; value: Vector3 }
  | { op: "coords-vectors.vproj"; value: Vector3 }
  | { op: "coords-vectors.vrel"; value: number }
  | { op: "coords-vectors.vrotv"; value: Vector3 }
  | { op: "coords-vectors.rotvec"; value: Vector3 }
  | { op: "coords-vectors.vtmv"; value: number }
  | { op: "coords-vectors.azlrec"; value: Vector3 }
  | {
      op: "coords-vectors.recazl";
      value: { range: number; az: number; el: number };
    }
  | { op: "coords-vectors.pgrrec"; value: Vector3 }
  | {
      op: "coords-vectors.recpgr";
      value: { lon: number; lat: number; alt: number };
    }
  | { op: "coords-vectors.radrec"; value: Vector3 }
  | {
      op: "coords-vectors.recrad";
      value: { range: number; ra: number; dec: number };
    }
  | { op: "coords-vectors.srfrec"; value: Vector3 }
  | { op: "coords-vectors.brcktd"; value: number }
  | { op: "coords-vectors.brckti"; value: number }
  | { op: "coords-vectors.convrt"; value: number }
  | { op: "coords-vectors.sumad"; value: number }
  | { op: "coords-vectors.sumai"; value: number }
  | { op: "coords-vectors.maxd"; value: number }
  | { op: "coords-vectors.maxi"; value: number }
  | { op: "coords-vectors.mind"; value: number }
  | { op: "coords-vectors.mini"; value: number }
  | { op: "coords-vectors.ducrss"; value: Vector6 }
  | { op: "coords-vectors.dvcrss"; value: Vector6 }
  | { op: "coords-vectors.dvdot"; value: number }
  | { op: "coords-vectors.dvhat"; value: Vector6 }
  | { op: "coords-vectors.dvnorm"; value: number }
  | { op: "coords-vectors.dvsep"; value: number }
  | { op: "coords-vectors.chbder"; value: number[] }
  | { op: "coords-vectors.chbigr"; value: { p: number; itgrlp: number } }
  | { op: "coords-vectors.chbint"; value: { p: number; dpdx: number } }
  | { op: "coords-vectors.chbval"; value: number }
  | { op: "coords-vectors.polyds"; value: number[] }
  | { op: "coords-vectors.rquad"; value: { root1: Vector2; root2: Vector2 } }
  | { op: "coords-vectors.hrmesp"; value: { f: number; df: number } }
  | { op: "coords-vectors.hrmint"; value: { f: number; df: number } }
  | { op: "coords-vectors.lgresp"; value: number }
  | { op: "coords-vectors.lgrind"; value: { p: number; dp: number } }
  | { op: "coords-vectors.lgrint"; value: number }
  | { op: "coords-vectors.qderiv"; value: number[] }
  | { op: "coords-vectors.clearc"; value: number[] }
  | { op: "coords-vectors.cleard"; value: number[] }
  | { op: "coords-vectors.cleari"; value: number[] }
  | { op: "coords-vectors.filld"; value: number[] }
  | { op: "coords-vectors.filli"; value: number[] }
  | { op: "coords-vectors.moved"; value: number[] }
  | { op: "coords-vectors.eul2m"; value: Matrix3x3 }
  | {
      op: "coords-vectors.m2eul";
      value: { angle3: number; angle2: number; angle1: number };
    }
  | { op: "coords-vectors.m2q"; value: Quaternion }
  | { op: "coords-vectors.q2m"; value: Matrix3x3 }
  | { op: "coords-vectors.qxq"; value: Quaternion }
  | { op: "coords-vectors.qdq2av"; value: Vector3 }
  | { op: "coords-vectors.raxisa"; value: { axis: Vector3; angle: number } }
  | { op: "coords-vectors.det"; value: number }
  | {
      op: "coords-vectors.diags2";
      value: { diag: Matrix2RowMajor; rotate: Matrix2RowMajor };
    }
  | { op: "coords-vectors.ident"; value: Matrix3x3 }
  | { op: "coords-vectors.invert"; value: Matrix3x3 }
  | { op: "coords-vectors.invort"; value: Matrix3x3 }
  | { op: "coords-vectors.isrot"; value: boolean }
  | { op: "coords-vectors.mequ"; value: Matrix3x3 }
  | { op: "coords-vectors.mtxm"; value: Matrix3x3 }
  | { op: "coords-vectors.mxmt"; value: Matrix3x3 }
  | { op: "coords-vectors.trace"; value: number }
  | { op: "coords-vectors.xpose"; value: Matrix3x3 }
  | { op: "coords-vectors.mequg"; value: number[] }
  | { op: "coords-vectors.mtxmg"; value: number[] }
  | { op: "coords-vectors.mtxvg"; value: number[] }
  | { op: "coords-vectors.mxmg"; value: number[] }
  | { op: "coords-vectors.mxmtg"; value: number[] }
  | { op: "coords-vectors.mxvg"; value: number[] }
  | { op: "coords-vectors.vtmvg"; value: number }
  | { op: "coords-vectors.xposeg"; value: number[] }
  | { op: "coords-vectors.vaddg"; value: number[] }
  | { op: "coords-vectors.vdistg"; value: number }
  | { op: "coords-vectors.vdotg"; value: number }
  | { op: "coords-vectors.vequg"; value: number[] }
  | { op: "coords-vectors.vhatg"; value: number[] }
  | { op: "coords-vectors.vlcomg"; value: number[] }
  | { op: "coords-vectors.vminug"; value: number[] }
  | { op: "coords-vectors.vnormg"; value: number }
  | { op: "coords-vectors.vprojg"; value: number[] }
  | { op: "coords-vectors.vrelg"; value: number }
  | { op: "coords-vectors.vsclg"; value: number[] }
  | { op: "coords-vectors.vsepg"; value: number }
  | { op: "coords-vectors.vsubg"; value: number[] }
  | { op: "coords-vectors.vzerog"; value: boolean }
  | { op: "coords-vectors.unormg"; value: { unit: number[]; norm: number } }
  | { op: "time.str2et"; value: number }
  | { op: "time.et2utc"; value: string }
  | { op: "time.spd"; value: number }
  | { op: "time.j2000"; value: number }
  | { op: "time.j1900"; value: number }
  | { op: "time.b1950"; value: number }
  | { op: "time.b1900"; value: number }
  | { op: "time.j1950"; value: number }
  | { op: "time.j2100"; value: number }
  | { op: "time.jyear"; value: number }
  | { op: "time.tyear"; value: number }
  | { op: "time.tkvrsn"; value: string }
  | { op: "time.timout"; value: string }
  | { op: "time.deltet"; value: number }
  | { op: "time.unitim"; value: { epoch: number; secondsPastJ2000: number } }
  | { op: "time.tparse"; value: number }
  | { op: "time.tpictr"; value: string }
  | { op: "time.timdef"; value: string | null }
  | { op: "time.scs2e"; value: number }
  | { op: "time.sce2s"; value: string }
  | { op: "time.scencd"; value: number }
  | { op: "time.scdecd"; value: string }
  | { op: "time.sct2e"; value: number }
  | { op: "time.sce2c"; value: number }
  | {
      op: "ids-names.bodn2c";
      value: { found: false } | { found: true; code: number };
    }
  | {
      op: "ids-names.bodc2n";
      value: { found: false } | { found: true; name: string };
    }
  | { op: "ids-names.bodc2s"; value: string }
  | { op: "ids-names.boddef"; value: null }
  | { op: "ids-names.bodfnd"; value: boolean }
  | {
      op: "ids-names.bods2c";
      value: { found: false } | { found: true; code: number };
    }
  | { op: "ids-names.bodvar"; value: number[] }
  | {
      op: "coords-vectors.reclat";
      value: { radius: number; lon: number; lat: number };
    }
  | { op: "coords-vectors.latrec"; value: Vector3 }
  | {
      op: "coords-vectors.recsph";
      value: { radius: number; colat: number; lon: number };
    }
  | { op: "coords-vectors.sphrec"; value: Vector3 }
  | { op: "coords-vectors.pi"; value: number }
  | { op: "coords-vectors.twopi"; value: number }
  | { op: "coords-vectors.halfpi"; value: number }
  | { op: "coords-vectors.dpr"; value: number }
  | { op: "coords-vectors.rpd"; value: number }
  | { op: "coords-vectors.clight"; value: number }
  | { op: "coords-vectors.dpmax"; value: number }
  | { op: "coords-vectors.dpmin"; value: number }
  | { op: "coords-vectors.intmax"; value: number }
  | { op: "coords-vectors.intmin"; value: number }
  | { op: "coords-vectors.vnorm"; value: number }
  | { op: "coords-vectors.vhat"; value: Vector3 }
  | { op: "coords-vectors.vdot"; value: number }
  | { op: "coords-vectors.vcrss"; value: Vector3 }
  | { op: "coords-vectors.vadd"; value: Vector3 }
  | { op: "coords-vectors.vsub"; value: Vector3 }
  | { op: "coords-vectors.vminus"; value: Vector3 }
  | { op: "coords-vectors.vscl"; value: Vector3 }
  | { op: "coords-vectors.mxm"; value: Matrix3x3 }
  | { op: "coords-vectors.rotate"; value: Matrix3x3 }
  | { op: "coords-vectors.rotmat"; value: Matrix3x3 }
  | { op: "coords-vectors.axisar"; value: Matrix3x3 }
  | { op: "coords-vectors.georec"; value: Vector3 }
  | {
      op: "coords-vectors.recgeo";
      value: { lon: number; lat: number; alt: number };
    }
  | { op: "coords-vectors.mxv"; value: Vector3 }
  | { op: "coords-vectors.mtxv"; value: Vector3 }
  | { op: "cells-windows.card"; value: number }
  | { op: "cells-windows.insrtc"; value: string[] }
  | { op: "cells-windows.insrtd"; value: number[] }
  | { op: "cells-windows.insrti"; value: number[] }
  | { op: "cells-windows.scard"; value: number }
  | { op: "cells-windows.size"; value: number }
  | { op: "cells-windows.ssize"; value: { size: number; card: number } }
  | { op: "cells-windows.valid"; value: number[] | string[] | null }
  | { op: "cells-windows.wncard"; value: number }
  | { op: "cells-windows.wninsd"; value: null }
  | { op: "cells-windows.wnfetd"; value: { left: number; right: number } }
  | { op: "cells-windows.wnvald"; value: { left: number; right: number }[] }
  | { op: "kernel-pool.gdpool"; value: KernelPoolFoundNumbers }
  | { op: "kernel-pool.gipool"; value: KernelPoolFoundNumbers }
  | { op: "kernel-pool.gcpool"; value: KernelPoolFoundStrings }
  | { op: "kernel-pool.gnpool"; value: KernelPoolFoundStrings }
  | {
      op: "kernel-pool.dtpool";
      value: { found: false } | { found: true; n: number; type: "C" | "N" };
    }
  | { op: "kernel-pool.pdpool"; value: null }
  | { op: "kernel-pool.pipool"; value: null }
  | { op: "kernel-pool.pcpool"; value: null }
  | { op: "kernel-pool.swpool"; value: null }
  | { op: "kernel-pool.cvpool"; value: boolean }
  | { op: "kernel-pool.expool"; value: boolean }
  | { op: "kernels.furnsh"; value: null }
  | { op: "kernels.kclear"; value: null }
  | {
      op: "kernels.kinfo";
      value:
        | { found: false }
        | {
            found: true;
            filtyp: string;
            source: string;
            handleIsZero: boolean;
            handleMatchesEntry: boolean;
          };
    }
  | { op: "kernels.kplfrm"; value: { ids: number[] } }
  | { op: "kernels.ktotal"; value: number }
  | {
      op: "kernels.kdata";
      value:
        | { found: false }
        | {
            found: true;
            file: string;
            filtyp: string;
            source: string;
            handleIsZero: boolean;
          };
    }
  | {
      op: "kernels.kxtrct";
      value: { found: false } | { found: true; wordsq: string; substr: string };
    }
  | { op: "kernels.unload"; value: null }
  | { op: "ephemeris.spkcls"; value: null | { short: string } }
  | {
      op: "ephemeris.spkcov";
      value: { intervals: [number, number][] };
    }
  | {
      op: "ephemeris.spkez";
      value: {
        state: [number, number, number, number, number, number];
        lt: number;
      };
    }
  | {
      op: "ephemeris.spkezp";
      value: { pos: [number, number, number]; lt: number };
    }
  | {
      op: "ephemeris.spkezr";
      value: {
        state: [number, number, number, number, number, number];
        lt: number;
      };
    }
  | {
      op: "ephemeris.spkgeo";
      value: {
        state: [number, number, number, number, number, number];
        lt: number;
      };
    }
  | {
      op: "ephemeris.spkgps";
      value: { pos: [number, number, number]; lt: number };
    }
  | { op: "ephemeris.spkobj"; value: { ids: number[] } }
  | { op: "ephemeris.spkopa"; value: { handleId: string } }
  | { op: "ephemeris.spkopn"; value: { handleId: string } }
  | {
      op: "ephemeris.spkpds";
      value: { first: number; last: number; packedIntegers: number[] };
    }
  | {
      op: "ephemeris.spkpos";
      value: { pos: [number, number, number]; lt: number };
    }
  | {
      op: "ephemeris.spksfs";
      value:
        | { found: false }
        | {
            found: true;
            descr: { first: number; last: number; packedIntegers: number[] };
            ident: string;
          };
    }
  | {
      op: "ephemeris.spkssb";
      value: [number, number, number, number, number, number];
    }
  | {
      op: "ephemeris.spkuds";
      value: {
        body: number;
        center: number;
        frame: number;
        type: number;
        first: number;
        last: number;
        baddr: number;
        eaddr: number;
      };
    }
  | { op: "ephemeris.spkw08"; value: null }
  | { op: "file-io.exists"; value: boolean }
  | { op: "file-io.getfat"; value: { arch: string; type: string } }
  | { op: "file-io.dafopr"; value: null }
  | { op: "file-io.dafcls"; value: null }
  | { op: "file-io.dafbfs"; value: null }
  | { op: "file-io.daffna"; value: boolean }
  | { op: "file-io.dasopr"; value: null }
  | { op: "file-io.dascls"; value: null }
  | { op: "file-io.dlaopn"; value: null }
  | { op: "file-io.dlabfs"; value: FoundDlaDescriptor }
  | { op: "file-io.dlafns"; value: FoundDlaDescriptor }
  | { op: "file-io.dlacls"; value: null }
  | { op: "file-io.dskopn"; value: null }
  | {
      op: "file-io.dskmi2";
      value: {
        spaixd: number[];
        spaixi: number[];
      };
    }
  | { op: "file-io.dskw02"; value: null }
  | { op: "error.failed"; value: boolean }
  | { op: "error.reset"; value: null }
  | { op: "error.getmsg"; value: string }
  | { op: "error.setmsg"; value: null }
  | {
      op: "error.sigerr";
      value: null | {
        short: string;
        long: string;
        trace: string;
        failed: boolean;
      };
    }
  | { op: "error.chkin"; value: null }
  | { op: "error.chkout"; value: null }
  | {
      op: "frames.namfrm";
      value: { found: false } | { found: true; code: number };
    }
  | {
      op: "frames.frmnam";
      value: { found: false } | { found: true; name: string };
    }
  | {
      op: "frames.cidfrm";
      value: { found: false } | { found: true; frcode: number; frname: string };
    }
  | {
      op: "frames.cnmfrm";
      value: { found: false } | { found: true; frcode: number; frname: string };
    }
  | {
      op: "frames.frinfo";
      value:
        | { found: false }
        | { found: true; center: number; frameClass: number; classId: number };
    }
  | {
      op: "frames.ccifrm";
      value:
        | { found: false }
        | { found: true; frcode: number; frname: string; center: number };
    }
  | {
      op: "frames.ckgp";
      value:
        { found: false } | { found: true; cmat: Matrix3x3; clkout: number };
    }
  | {
      op: "frames.ckgpav";
      value:
        | { found: false }
        | {
            found: true;
            cmat: Matrix3x3;
            av: [number, number, number];
            clkout: number;
          };
    }
  | { op: "frames.cklpf"; value: { opened: true } }
  | { op: "frames.ckupf"; value: { closed: true } }
  | { op: "frames.ckobj"; value: { ids: number[] } }
  | {
      op: "frames.ckcov";
      value: {
        intervals: Array<{ left: number; right: number }>;
      };
    }
  | { op: "frames.pxform"; value: Matrix3x3 }
  | { op: "frames.sxform"; value: Matrix6x6 }
  | {
      op: "ek.ekopn";
      value: { handleId: string };
    }
  | {
      op: "ek.ekopr";
      value: { handleId: string };
    }
  | {
      op: "ek.ekopw";
      value: { handleId: string };
    }
  | {
      op: "ek.ekcls";
      value: null;
    }
  | {
      op: "ek.ekntab";
      value: number;
    }
  | {
      op: "ek.ektnam";
      value: string;
    }
  | {
      op: "ek.eknseg";
      value: number;
    }
  | {
      op: "ek.ekfind";
      value: { ok: true; nmrows: number } | { ok: false; errmsg: string };
    }
  | {
      op: "ek.ekgc";
      value: EkGetStringResult;
    }
  | {
      op: "ek.ekgd";
      value: EkGetNumberResult;
    }
  | {
      op: "ek.ekgi";
      value: EkGetNumberResult;
    }
  | {
      op: "ek.ekifld";
      value: { segmentId: string; segno: number; rcptrs: number[] };
    }
  | {
      op: "ek.ekacli";
      value: null;
    }
  | {
      op: "ek.ekacld";
      value: null;
    }
  | {
      op: "ek.ekaclc";
      value: null;
    }
  | {
      op: "ek.ekffld";
      value: null;
    }
  | {
      op: "geometry.subpnt";
      value: { spoint: Vec3; trgepc: number; srfvec: Vec3 };
    }
  | {
      op: "geometry.subslr";
      value: { spoint: Vec3; trgepc: number; srfvec: Vec3 };
    }
  | {
      op: "geometry.sincpt";
      value:
        | { found: false }
        | { found: true; spoint: Vec3; trgepc: number; srfvec: Vec3 };
    }
  | {
      op: "geometry.ilumin";
      value: {
        trgepc: number;
        srfvec: Vec3;
        phase: number;
        incdnc: number;
        emissn: number;
      };
    }
  | {
      op: "geometry.illumg";
      value: {
        trgepc: number;
        srfvec: Vec3;
        phase: number;
        incdnc: number;
        emissn: number;
      };
    }
  | {
      op: "geometry.illumf";
      value: {
        trgepc: number;
        srfvec: Vec3;
        phase: number;
        incdnc: number;
        emissn: number;
        visibl: boolean;
        lit: boolean;
      };
    }
  | { op: "geometry.occult"; value: number }
  | { op: "geometry.nvc2pl"; value: SpicePlane }
  | {
      op: "geometry.pl2nvc";
      value: { normal: Vec3; konst: number };
    }
  | { op: "geometry-gf.gfsstp"; value: null }
  | { op: "geometry-gf.gfstep"; value: number }
  | { op: "geometry-gf.gfstol"; value: null }
  | { op: "geometry-gf.gfrefn"; value: number }
  | { op: "geometry-gf.gfrepi"; value: null }
  | { op: "geometry-gf.gfrepf"; value: null }
  | { op: "geometry-gf.gfsep"; value: GfSearchWindowPayload }
  | { op: "geometry-gf.gfdist"; value: GfSearchWindowPayload }
  | {
      op: "dsk.dskobj";
      value: { bodyIds: number[]; snapshots: number[][] };
    }
  | {
      op: "dsk.dsksrf";
      value: { surfaceIds: number[]; snapshots: number[][] };
    }
  | { op: "dsk.dskopn"; value: null }
  | { op: "dsk.dskmi2"; value: null }
  | { op: "dsk.dskw02"; value: null }
  | { op: "dsk.dasopr"; value: null }
  | { op: "dsk.dascls"; value: null }
  | { op: "dsk.dlabfs"; value: { found: boolean } }
  | { op: "dsk.dskgd"; value: DskDescriptorPayload }
  | { op: "dsk.dskb02"; value: DskType2BookkeepingPayload };

export type CaseError = {
  type: string;
  message: string;
};

export type CaseExecutionSuccess = {
  caseId: string;
  ok: true;
  outputs: StepOutput[];
  error: null;
};

export type CaseExecutionFailure = {
  caseId: string;
  ok: false;
  outputs: [];
  error: CaseError;
};

export type CaseExecutionResult = CaseExecutionSuccess | CaseExecutionFailure;

export type CaseExpectation =
  | { kind: "success" }
  | {
      kind: "error";
      errorTypeIncludes?: string;
      errorMessageIncludes?: string[];
    };

export type ParityCase = {
  caseId: string;
  description: string;
  workflow: WorkflowStep[];
  expectation: CaseExpectation;
};
