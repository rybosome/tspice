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
  | StepTimeTimdefGet
  | StepTimeTimdefSet
  | StepIdsNamesBodn2c
  | StepCoordsVectorsMxm
  | StepCoordsVectorsRecgeo
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
  | { op: "time.timdef"; value: string | null }
  | { op: "ids-names.bodn2c"; value: { found: false } | { found: true; code: number } }
  | { op: "coords-vectors.mxm"; value: Matrix3x3 }
  | { op: "coords-vectors.recgeo"; value: { lon: number; lat: number; alt: number } }
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
