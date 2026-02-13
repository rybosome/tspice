import type {
  AbCorr,
  Found,
  GeometryApi,
  IllumfResult,
  IllumgResult,
  IluminResult,
  Pl2nvcResult,
  SpicePlane,
  SpiceVector3,
  SubPointResult,
} from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

function tspiceCallSubpnt(
  module: EmscriptenModule,
  method: string,
  target: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
): SubPointResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const outSpointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);

  if (!errPtr || !methodPtr || !targetPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !outSpointPtr || !outTrgepcPtr || !outSrfvecPtr) {
    for (const ptr of [outSrfvecPtr, outTrgepcPtr, outSpointPtr, observerPtr, abcorrPtr, fixrefPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outTrgepcPtr >> 3] = 0;

    const result = module._tspice_subpnt(
      methodPtr,
      targetPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      outSpointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const spoint = Array.from(module.HEAPF64.subarray(outSpointPtr >> 3, (outSpointPtr >> 3) + 3)) as unknown as SpiceVector3;
    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;

    return { spoint, trgepc, srfvec };
  } finally {
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(outSpointPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallSubslr(
  module: EmscriptenModule,
  method: string,
  target: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
): SubPointResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const outSpointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);

  if (!errPtr || !methodPtr || !targetPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !outSpointPtr || !outTrgepcPtr || !outSrfvecPtr) {
    for (const ptr of [outSrfvecPtr, outTrgepcPtr, outSpointPtr, observerPtr, abcorrPtr, fixrefPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64[outTrgepcPtr >> 3] = 0;

    const result = module._tspice_subslr(
      methodPtr,
      targetPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      outSpointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const spoint = Array.from(module.HEAPF64.subarray(outSpointPtr >> 3, (outSpointPtr >> 3) + 3)) as unknown as SpiceVector3;
    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;

    return { spoint, trgepc, srfvec };
  } finally {
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(outSpointPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallSincpt(
  module: EmscriptenModule,
  method: string,
  target: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
  dref: string,
  dvec: SpiceVector3,
): Found<SubPointResult> {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const drefPtr = writeUtf8CString(module, dref);
  const dvecPtr = module._malloc(3 * 8);
  const outSpointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);
  const outFoundPtr = module._malloc(4);

  if (!errPtr || !methodPtr || !targetPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !drefPtr || !dvecPtr || !outSpointPtr || !outTrgepcPtr || !outSrfvecPtr || !outFoundPtr) {
    for (const ptr of [outFoundPtr, outSrfvecPtr, outTrgepcPtr, outSpointPtr, dvecPtr, drefPtr, observerPtr, abcorrPtr, fixrefPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(dvec, dvecPtr >> 3);
    module.HEAPF64[outTrgepcPtr >> 3] = 0;
    module.HEAP32[outFoundPtr >> 2] = 0;

    const result = module._tspice_sincpt(
      methodPtr,
      targetPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      drefPtr,
      dvecPtr,
      outSpointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outFoundPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const found = module.HEAP32[outFoundPtr >> 2] ?? 0;
    if (!found) {
      return { found: false };
    }

    const spoint = Array.from(module.HEAPF64.subarray(outSpointPtr >> 3, (outSpointPtr >> 3) + 3)) as unknown as SpiceVector3;
    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;

    return { found: true, spoint, trgepc, srfvec };
  } finally {
    module._free(outFoundPtr);
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(outSpointPtr);
    module._free(dvecPtr);
    module._free(drefPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallIlumin(
  module: EmscriptenModule,
  method: string,
  target: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
  spoint: SpiceVector3,
): IluminResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const spointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);
  const outPhasePtr = module._malloc(8);
  const outIncdncPtr = module._malloc(8);
  const outEmissnPtr = module._malloc(8);

  if (!errPtr || !methodPtr || !targetPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !spointPtr || !outTrgepcPtr || !outSrfvecPtr || !outPhasePtr || !outIncdncPtr || !outEmissnPtr) {
    for (const ptr of [outEmissnPtr, outIncdncPtr, outPhasePtr, outSrfvecPtr, outTrgepcPtr, spointPtr, observerPtr, abcorrPtr, fixrefPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(spoint, spointPtr >> 3);
    module.HEAPF64[outTrgepcPtr >> 3] = 0;
    module.HEAPF64[outPhasePtr >> 3] = 0;
    module.HEAPF64[outIncdncPtr >> 3] = 0;
    module.HEAPF64[outEmissnPtr >> 3] = 0;

    const result = module._tspice_ilumin(
      methodPtr,
      targetPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;
    const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
    const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
    const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;

    return { trgepc, srfvec, phase, incdnc, emissn };
  } finally {
    module._free(outEmissnPtr);
    module._free(outIncdncPtr);
    module._free(outPhasePtr);
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(spointPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallIllumg(
  module: EmscriptenModule,
  method: string,
  target: string,
  ilusrc: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
  spoint: SpiceVector3,
): IllumgResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const ilusrcPtr = writeUtf8CString(module, ilusrc);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const spointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);
  const outPhasePtr = module._malloc(8);
  const outIncdncPtr = module._malloc(8);
  const outEmissnPtr = module._malloc(8);

  if (!errPtr || !methodPtr || !targetPtr || !ilusrcPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !spointPtr || !outTrgepcPtr || !outSrfvecPtr || !outPhasePtr || !outIncdncPtr || !outEmissnPtr) {
    for (const ptr of [outEmissnPtr, outIncdncPtr, outPhasePtr, outSrfvecPtr, outTrgepcPtr, spointPtr, observerPtr, abcorrPtr, fixrefPtr, ilusrcPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(spoint, spointPtr >> 3);
    module.HEAPF64[outTrgepcPtr >> 3] = 0;
    module.HEAPF64[outPhasePtr >> 3] = 0;
    module.HEAPF64[outIncdncPtr >> 3] = 0;
    module.HEAPF64[outEmissnPtr >> 3] = 0;

    const result = module._tspice_illumg(
      methodPtr,
      targetPtr,
      ilusrcPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;
    const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
    const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
    const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;

    return { trgepc, srfvec, phase, incdnc, emissn };
  } finally {
    module._free(outEmissnPtr);
    module._free(outIncdncPtr);
    module._free(outPhasePtr);
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(spointPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(ilusrcPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallIllumf(
  module: EmscriptenModule,
  method: string,
  target: string,
  ilusrc: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
  spoint: SpiceVector3,
): IllumfResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const methodPtr = writeUtf8CString(module, method);
  const targetPtr = writeUtf8CString(module, target);
  const ilusrcPtr = writeUtf8CString(module, ilusrc);
  const fixrefPtr = writeUtf8CString(module, fixref);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const spointPtr = module._malloc(3 * 8);
  const outTrgepcPtr = module._malloc(8);
  const outSrfvecPtr = module._malloc(3 * 8);
  const outPhasePtr = module._malloc(8);
  const outIncdncPtr = module._malloc(8);
  const outEmissnPtr = module._malloc(8);
  const outVisiblPtr = module._malloc(4);
  const outLitPtr = module._malloc(4);

  if (!errPtr || !methodPtr || !targetPtr || !ilusrcPtr || !fixrefPtr || !abcorrPtr || !observerPtr || !spointPtr || !outTrgepcPtr || !outSrfvecPtr || !outPhasePtr || !outIncdncPtr || !outEmissnPtr || !outVisiblPtr || !outLitPtr) {
    for (const ptr of [outLitPtr, outVisiblPtr, outEmissnPtr, outIncdncPtr, outPhasePtr, outSrfvecPtr, outTrgepcPtr, spointPtr, observerPtr, abcorrPtr, fixrefPtr, ilusrcPtr, targetPtr, methodPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(spoint, spointPtr >> 3);
    module.HEAPF64[outTrgepcPtr >> 3] = 0;
    module.HEAPF64[outPhasePtr >> 3] = 0;
    module.HEAPF64[outIncdncPtr >> 3] = 0;
    module.HEAPF64[outEmissnPtr >> 3] = 0;
    module.HEAP32[outVisiblPtr >> 2] = 0;
    module.HEAP32[outLitPtr >> 2] = 0;

    const result = module._tspice_illumf(
      methodPtr,
      targetPtr,
      ilusrcPtr,
      et,
      fixrefPtr,
      abcorrPtr,
      observerPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
      outVisiblPtr,
      outLitPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
    const srfvec = Array.from(module.HEAPF64.subarray(outSrfvecPtr >> 3, (outSrfvecPtr >> 3) + 3)) as unknown as SpiceVector3;
    const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
    const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
    const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;
    const visibl = module.HEAP32[outVisiblPtr >> 2] ?? 0;
    const lit = module.HEAP32[outLitPtr >> 2] ?? 0;

    return { trgepc, srfvec, phase, incdnc, emissn, visibl: Boolean(visibl), lit: Boolean(lit) };
  } finally {
    module._free(outLitPtr);
    module._free(outVisiblPtr);
    module._free(outEmissnPtr);
    module._free(outIncdncPtr);
    module._free(outPhasePtr);
    module._free(outSrfvecPtr);
    module._free(outTrgepcPtr);
    module._free(spointPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(fixrefPtr);
    module._free(ilusrcPtr);
    module._free(targetPtr);
    module._free(methodPtr);
    module._free(errPtr);
  }
}

function tspiceCallNvc2pl(module: EmscriptenModule, normal: SpiceVector3, konst: number): SpicePlane {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const normalPtr = module._malloc(3 * 8);
  const outPlanePtr = module._malloc(4 * 8);

  if (!errPtr || !normalPtr || !outPlanePtr) {
    for (const ptr of [outPlanePtr, normalPtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(normal, normalPtr >> 3);

    const result = module._tspice_nvc2pl(normalPtr, konst, outPlanePtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    return Array.from(module.HEAPF64.subarray(outPlanePtr >> 3, (outPlanePtr >> 3) + 4)) as unknown as SpicePlane;
  } finally {
    module._free(outPlanePtr);
    module._free(normalPtr);
    module._free(errPtr);
  }
}

function tspiceCallPl2nvc(module: EmscriptenModule, plane: SpicePlane): Pl2nvcResult {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const planePtr = module._malloc(4 * 8);
  const outNormalPtr = module._malloc(3 * 8);
  const outKonstPtr = module._malloc(8);

  if (!errPtr || !planePtr || !outNormalPtr || !outKonstPtr) {
    for (const ptr of [outKonstPtr, outNormalPtr, planePtr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAPF64.set(plane, planePtr >> 3);
    module.HEAPF64[outKonstPtr >> 3] = 0;

    const result = module._tspice_pl2nvc(planePtr, outNormalPtr, outKonstPtr, errPtr, errMaxBytes);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    const normal = Array.from(module.HEAPF64.subarray(outNormalPtr >> 3, (outNormalPtr >> 3) + 3)) as unknown as SpiceVector3;
    const konst = module.HEAPF64[outKonstPtr >> 3] ?? 0;

    return { normal, konst };
  } finally {
    module._free(outKonstPtr);
    module._free(outNormalPtr);
    module._free(planePtr);
    module._free(errPtr);
  }
}

function tspiceCallOccult(
  module: EmscriptenModule,
  targ1: string,
  shape1: string,
  frame1: string,
  targ2: string,
  shape2: string,
  frame2: string,
  abcorr: string,
  observer: string,
  et: number,
): number {
  const errMaxBytes = 2048;
  const errPtr = module._malloc(errMaxBytes);
  const targ1Ptr = writeUtf8CString(module, targ1);
  const shape1Ptr = writeUtf8CString(module, shape1);
  const frame1Ptr = writeUtf8CString(module, frame1);
  const targ2Ptr = writeUtf8CString(module, targ2);
  const shape2Ptr = writeUtf8CString(module, shape2);
  const frame2Ptr = writeUtf8CString(module, frame2);
  const abcorrPtr = writeUtf8CString(module, abcorr);
  const observerPtr = writeUtf8CString(module, observer);
  const outOcltidPtr = module._malloc(4);

  if (!errPtr || !targ1Ptr || !shape1Ptr || !frame1Ptr || !targ2Ptr || !shape2Ptr || !frame2Ptr || !abcorrPtr || !observerPtr || !outOcltidPtr) {
    for (const ptr of [outOcltidPtr, observerPtr, abcorrPtr, frame2Ptr, shape2Ptr, targ2Ptr, frame1Ptr, shape1Ptr, targ1Ptr, errPtr]) {
      if (ptr) module._free(ptr);
    }
    throw new Error("WASM malloc failed");
  }

  try {
    module.HEAP32[outOcltidPtr >> 2] = 0;

    const result = module._tspice_occult(
      targ1Ptr,
      shape1Ptr,
      frame1Ptr,
      targ2Ptr,
      shape2Ptr,
      frame2Ptr,
      abcorrPtr,
      observerPtr,
      et,
      outOcltidPtr,
      errPtr,
      errMaxBytes,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, errMaxBytes, result);
    }

    return module.HEAP32[outOcltidPtr >> 2] ?? 0;
  } finally {
    module._free(outOcltidPtr);
    module._free(observerPtr);
    module._free(abcorrPtr);
    module._free(frame2Ptr);
    module._free(shape2Ptr);
    module._free(targ2Ptr);
    module._free(frame1Ptr);
    module._free(shape1Ptr);
    module._free(targ1Ptr);
    module._free(errPtr);
  }
}

export function createGeometryApi(module: EmscriptenModule): GeometryApi {
  return {
    subpnt: (method: string, target: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSubpnt(module, method, target, et, fixref, abcorr, observer),
    subslr: (method: string, target: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string) =>
      tspiceCallSubslr(module, method, target, et, fixref, abcorr, observer),
    sincpt: (method: string, target: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string, dref: string, dvec: SpiceVector3) =>
      tspiceCallSincpt(module, method, target, et, fixref, abcorr, observer, dref, dvec),
    ilumin: (method: string, target: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string, spoint: SpiceVector3) =>
      tspiceCallIlumin(module, method, target, et, fixref, abcorr, observer, spoint),
    illumg: (method: string, target: string, ilusrc: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string, spoint: SpiceVector3) =>
      tspiceCallIllumg(module, method, target, ilusrc, et, fixref, abcorr, observer, spoint),
    illumf: (method: string, target: string, ilusrc: string, et: number, fixref: string, abcorr: AbCorr | string, observer: string, spoint: SpiceVector3) =>
      tspiceCallIllumf(module, method, target, ilusrc, et, fixref, abcorr, observer, spoint),
    occult: (targ1: string, shape1: string, frame1: string, targ2: string, shape2: string, frame2: string, abcorr: AbCorr | string, observer: string, et: number) =>
      tspiceCallOccult(module, targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer, et),
    nvc2pl: (normal: SpiceVector3, konst: number) => tspiceCallNvc2pl(module, normal, konst),
    pl2nvc: (plane: SpicePlane) => tspiceCallPl2nvc(module, plane),
  };
}
