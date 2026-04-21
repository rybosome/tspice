export type TimdefItem = "SYSTEM" | "CALENDAR" | "ZONE";

export type ErrorGetmsgWhich = "SHORT" | "LONG" | "EXPLAIN";

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

export type StepCoordsVectorsMxm = {
  op: "coords-vectors.mxm";
  m1: Matrix3x3;
  m2: Matrix3x3;
};

export type StepCoordsVectorsRecgeo = {
  op: "coords-vectors.recgeo";
  rectan: [number, number, number];
  re: number;
  f: number;
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
  | StepCoordsVectorsMxm
  | StepCoordsVectorsRecgeo
  | StepCellsWindowsWninsd
  | StepCellsWindowsWnfetd
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
  | StepKernelsKtotal
  | StepKernelsKdata
  | StepKernelsKxtrct
  | StepErrorFailed
  | StepErrorReset
  | StepErrorGetmsg
  | StepErrorSetmsg
  | StepErrorSigerr
  | StepErrorChkin
  | StepErrorChkout
  | StepEkEkfind
  | StepEkEkgc;

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
  | { op: "coords-vectors.mxm"; value: Matrix3x3 }
  | { op: "coords-vectors.recgeo"; value: { lon: number; lat: number; alt: number } }
  | { op: "cells-windows.wninsd"; value: null }
  | { op: "cells-windows.wnfetd"; value: { left: number; right: number } }
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
  | { op: "kernels.ktotal"; value: number }
  | {
      op: "kernels.kdata";
      value: { found: false } | { found: true; file: string; filtyp: string; source: string };
    }
  | {
      op: "kernels.kxtrct";
      value: { found: false } | { found: true; wordsq: string; substr: string };
    }
  | { op: "error.failed"; value: boolean }
  | { op: "error.reset"; value: null }
  | { op: "error.getmsg"; value: string }
  | { op: "error.setmsg"; value: null }
  | { op: "error.sigerr"; value: null }
  | { op: "error.chkin"; value: null }
  | { op: "error.chkout"; value: null }
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
