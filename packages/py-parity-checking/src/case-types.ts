export type TimdefItem = "SYSTEM" | "CALENDAR" | "ZONE";

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

export type Vector3 = [number, number, number];

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
};

export type StepKernelsKtotal = {
  op: "kernels.ktotal";
  kind: string;
};

export type StepKernelsKdata = {
  op: "kernels.kdata";
  which: number;
  kind: string;
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
};

export type StepDskDsksrf = {
  op: "dsk.dsksrf";
  path: PathRefLike;
  bodyid: number;
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
  | StepCoordsVectorsReclat
  | StepCoordsVectorsLatrec
  | StepCoordsVectorsRecsph
  | StepCoordsVectorsSphrec
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
  | StepEkEkfind
  | StepEkEkgc
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

export type KernelPoolFoundNumbers = { found: false } | { found: true; values: number[] };
export type KernelPoolFoundStrings = { found: false } | { found: true; values: string[] };

export type StepOutput =
  | { op: "time.str2et"; value: number }
  | { op: "time.et2utc"; value: string }
  | { op: "time.tkvrsn"; value: string }
  | { op: "time.timout"; value: string }
  | { op: "time.deltet"; value: number }
  | { op: "time.unitim"; value: number }
  | { op: "time.tparse"; value: number }
  | { op: "time.tpictr"; value: string }
  | { op: "time.timdef"; value: string | null }
  | { op: "time.scs2e"; value: number }
  | { op: "time.sce2s"; value: string }
  | { op: "time.scencd"; value: number }
  | { op: "time.scdecd"; value: string }
  | { op: "time.sct2e"; value: number }
  | { op: "time.sce2c"; value: number }
  | { op: "ids-names.bodn2c"; value: { found: false } | { found: true; code: number } }
  | { op: "ids-names.bodc2n"; value: { found: false } | { found: true; name: string } }
  | { op: "ids-names.bodc2s"; value: string }
  | { op: "ids-names.boddef"; value: null }
  | { op: "ids-names.bodfnd"; value: boolean }
  | { op: "ids-names.bods2c"; value: { found: false } | { found: true; code: number } }
  | { op: "ids-names.bodvar"; value: number[] }
  | { op: "coords-vectors.reclat"; value: { radius: number; lon: number; lat: number } }
  | { op: "coords-vectors.latrec"; value: Vector3 }
  | { op: "coords-vectors.recsph"; value: { radius: number; colat: number; lon: number } }
  | { op: "coords-vectors.sphrec"; value: Vector3 }
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
  | { op: "coords-vectors.recgeo"; value: { lon: number; lat: number; alt: number } }
  | { op: "coords-vectors.mxv"; value: Vector3 }
  | { op: "coords-vectors.mtxv"; value: Vector3 }
  | { op: "cells-windows.card"; value: number }
  | { op: "cells-windows.insrtc"; value: null }
  | { op: "cells-windows.insrtd"; value: null }
  | { op: "cells-windows.insrti"; value: null }
  | { op: "cells-windows.scard"; value: null }
  | { op: "cells-windows.size"; value: number }
  | { op: "cells-windows.ssize"; value: null }
  | { op: "cells-windows.valid"; value: null }
  | { op: "cells-windows.wncard"; value: number }
  | { op: "cells-windows.wninsd"; value: null }
  | { op: "cells-windows.wnfetd"; value: { left: number; right: number } }
  | { op: "cells-windows.wnvald"; value: null }
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
      value: { found: false } | { found: true; filtyp: string; source: string };
    }
  | { op: "kernels.kplfrm"; value: { ids: number[] } }
  | { op: "kernels.ktotal"; value: number }
  | {
      op: "kernels.kdata";
      value: { found: false } | { found: true; file: string; filtyp: string; source: string };
    }
  | {
      op: "kernels.kxtrct";
      value: { found: false } | { found: true; wordsq: string; substr: string };
    }
  | { op: "kernels.unload"; value: null }
  | { op: "file-io.exists"; value: boolean }
  | { op: "file-io.getfat"; value: { arch: string; type: string } }
  | { op: "file-io.dafopr"; value: null }
  | { op: "file-io.dafcls"; value: null }
  | { op: "file-io.dafbfs"; value: null }
  | { op: "file-io.daffna"; value: boolean }
  | { op: "file-io.dasopr"; value: null }
  | { op: "file-io.dascls"; value: null }
  | { op: "file-io.dlaopn"; value: null }
  | { op: "file-io.dlabfs"; value: { found: boolean } }
  | { op: "file-io.dlafns"; value: { found: boolean } }
  | { op: "file-io.dlacls"; value: null }
  | { op: "file-io.dskopn"; value: null }
  | {
      op: "file-io.dskmi2";
      value: {
        spaixdLength: number;
        spaixiLength: number;
        spaixdHead: number[];
        spaixiHead: number[];
      };
    }
  | { op: "file-io.dskw02"; value: null }
  | { op: "error.failed"; value: boolean }
  | { op: "error.reset"; value: null }
  | { op: "error.getmsg"; value: string }
  | { op: "error.setmsg"; value: null }
  | { op: "error.sigerr"; value: null }
  | { op: "error.chkin"; value: null }
  | { op: "error.chkout"; value: null }
  | { op: "frames.namfrm"; value: { found: false } | { found: true; code: number } }
  | { op: "frames.frmnam"; value: { found: false } | { found: true; name: string } }
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
        | { found: false }
        | { found: true; cmat: Matrix3x3; clkout: number };
    }
  | {
      op: "frames.ckgpav";
      value:
        | { found: false }
        | { found: true; cmat: Matrix3x3; av: [number, number, number]; clkout: number };
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
      op: "ek.ekfind";
      value: { ok: true; nmrows: number } | { ok: false; errmsg: string };
    }
  | {
      op: "ek.ekgc";
      value:
        | { found: false }
        | { found: true; isNull: true }
        | { found: true; isNull: false; value: string };
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
  | { op: "geometry-gf.gfsep"; value: null }
  | { op: "geometry-gf.gfdist"; value: null }
  | {
      op: "dsk.dskobj";
      value: { bodyIds: number[] };
    }
  | {
      op: "dsk.dsksrf";
      value: { surfaceIds: number[] };
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
