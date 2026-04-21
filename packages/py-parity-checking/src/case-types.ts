export type TimdefItem = "SYSTEM" | "CALENDAR" | "ZONE";

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

export type Matrix3x3 = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
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

export type StepKernelPoolGcpool = {
  op: "kernel-pool.gcpool";
  name: string;
  start: number;
  room: number;
};

export type StepKernelsFurnsh = {
  op: "kernels.furnsh";
  file: string;
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
  | StepCellsWindowsWninsd
  | StepCellsWindowsWnfetd
  | StepKernelPoolGcpool
  | StepKernelsFurnsh
  | StepKernelsKtotal
  | StepKernelsKdata
  | StepKernelsKxtrct
  | StepEkEkfind
  | StepEkEkgc;

export type WorkflowOp = WorkflowStep["op"];

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
  | { op: "cells-windows.wninsd"; value: null }
  | { op: "cells-windows.wnfetd"; value: { left: number; right: number } }
  | { op: "kernel-pool.gcpool"; value: { found: false } | { found: true; values: string[] } }
  | { op: "kernels.furnsh"; value: null }
  | { op: "kernels.ktotal"; value: number }
  | {
      op: "kernels.kdata";
      value: { found: false } | { found: true; file: string; filtyp: string; source: string };
    }
  | {
      op: "kernels.kxtrct";
      value: { found: false } | { found: true; wordsq: string; substr: string };
    }
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
    };

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
