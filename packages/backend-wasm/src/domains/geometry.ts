import {
  dskRay,
  surfaceGrid,
  surfaceCutLimits,
  surfaceCutCount,
  surfaceVectors,
  surfaceTextBytes,
} from "@rybosome/tspice-core";
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

import { withAllocs } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

const surfaceEncoder = new TextEncoder();
function writeSurfaceText(module: EmscriptenModule, text: string, ptr: number) {
  const encoded = surfaceEncoder.encode(text);
  module.HEAPU8.set(encoded, ptr >>> 0);
  module.HEAPU8[(ptr >>> 0) + encoded.length] = 0;
}

function geometryInputs(
  et: unknown,
  strings: readonly unknown[],
  label: string,
): void {
  if (typeof et !== "number" || !Number.isFinite(et))
    throw new RangeError(`${label}: ET must be finite`);
  for (const value of strings)
    if (typeof value !== "string")
      throw new TypeError(`${label}: inputs must be strings`);
}

function geometryNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new RangeError(`${label} must be finite`);
  return value;
}
function readGeometryVector(
  module: EmscriptenModule,
  ptr: number,
): SpiceVector3 {
  const i = ptr >> 3;
  return [
    geometryNumber(module.HEAPF64[i], "vector[0]"),
    geometryNumber(module.HEAPF64[i + 1], "vector[1]"),
    geometryNumber(module.HEAPF64[i + 2], "vector[2]"),
  ];
}
function readGeometryPlane(module: EmscriptenModule, ptr: number): SpicePlane {
  const i = ptr >> 3;
  return [
    geometryNumber(module.HEAPF64[i], "plane[0]"),
    geometryNumber(module.HEAPF64[i + 1], "plane[1]"),
    geometryNumber(module.HEAPF64[i + 2], "plane[2]"),
    geometryNumber(module.HEAPF64[i + 3], "plane[3]"),
  ];
}

function tspiceCallSubpnt(
  module: EmscriptenModule,
  method: string,
  target: string,
  et: number,
  fixref: string,
  abcorr: string,
  observer: string,
): SubPointResult {
  geometryInputs(et, [method, target, fixref, abcorr, observer], "subpnt");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 8, 3 * 8],
    (errPtr, outSpointPtr, outTrgepcPtr, outSrfvecPtr) => {
      let methodPtr = 0,
        targetPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);

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

        const spoint = readGeometryVector(module, outSpointPtr);
        const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
        const srfvec = readGeometryVector(module, outSrfvecPtr);

        return { spoint, trgepc, srfvec };
      } finally {
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
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
  geometryInputs(et, [method, target, fixref, abcorr, observer], "subslr");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 8, 3 * 8],
    (errPtr, outSpointPtr, outTrgepcPtr, outSrfvecPtr) => {
      let methodPtr = 0,
        targetPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);

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

        const spoint = readGeometryVector(module, outSpointPtr);
        const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
        const srfvec = readGeometryVector(module, outSrfvecPtr);

        return { spoint, trgepc, srfvec };
      } finally {
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
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
  geometryInputs(
    et,
    [method, target, fixref, abcorr, observer, dref],
    "sincpt",
  );
  assertFiniteNumberArrayFixed(dvec, 3, "sincpt(dvec)");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 3 * 8, 8, 3 * 8, 4],
    (
      errPtr,
      dvecPtr,
      outSpointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outFoundPtr,
    ) => {
      let methodPtr = 0,
        targetPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0,
        drefPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);
        drefPtr = writeUtf8CString(module, dref);

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

        const spoint = readGeometryVector(module, outSpointPtr);
        const trgepc = module.HEAPF64[outTrgepcPtr >> 3] ?? 0;
        const srfvec = readGeometryVector(module, outSrfvecPtr);

        return { found: true, spoint, trgepc, srfvec };
      } finally {
        if (drefPtr) module._free(drefPtr);
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
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
  geometryInputs(et, [method, target, fixref, abcorr, observer], "ilumin");
  assertFiniteNumberArrayFixed(spoint, 3, "ilumin(spoint)");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 8, 3 * 8, 8, 8, 8],
    (
      errPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
    ) => {
      let methodPtr = 0,
        targetPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);

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
        const srfvec = readGeometryVector(module, outSrfvecPtr);
        const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
        const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
        const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;

        return { trgepc, srfvec, phase, incdnc, emissn };
      } finally {
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
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
  geometryInputs(
    et,
    [method, target, ilusrc, fixref, abcorr, observer],
    "illumg",
  );
  assertFiniteNumberArrayFixed(spoint, 3, "illumg(spoint)");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 8, 3 * 8, 8, 8, 8],
    (
      errPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
    ) => {
      let methodPtr = 0,
        targetPtr = 0,
        ilusrcPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        ilusrcPtr = writeUtf8CString(module, ilusrc);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);

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
        const srfvec = readGeometryVector(module, outSrfvecPtr);
        const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
        const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
        const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;

        return { trgepc, srfvec, phase, incdnc, emissn };
      } finally {
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (ilusrcPtr) module._free(ilusrcPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
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
  geometryInputs(
    et,
    [method, target, ilusrc, fixref, abcorr, observer],
    "illumf",
  );
  assertFiniteNumberArrayFixed(spoint, 3, "illumf(spoint)");
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 8, 3 * 8, 8, 8, 8, 4, 4],
    (
      errPtr,
      spointPtr,
      outTrgepcPtr,
      outSrfvecPtr,
      outPhasePtr,
      outIncdncPtr,
      outEmissnPtr,
      outVisiblPtr,
      outLitPtr,
    ) => {
      let methodPtr = 0,
        targetPtr = 0,
        ilusrcPtr = 0,
        fixrefPtr = 0,
        abcorrPtr = 0,
        observerPtr = 0;
      try {
        methodPtr = writeUtf8CString(module, method);
        targetPtr = writeUtf8CString(module, target);
        ilusrcPtr = writeUtf8CString(module, ilusrc);
        fixrefPtr = writeUtf8CString(module, fixref);
        abcorrPtr = writeUtf8CString(module, abcorr);
        observerPtr = writeUtf8CString(module, observer);

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
        const srfvec = readGeometryVector(module, outSrfvecPtr);
        const phase = module.HEAPF64[outPhasePtr >> 3] ?? 0;
        const incdnc = module.HEAPF64[outIncdncPtr >> 3] ?? 0;
        const emissn = module.HEAPF64[outEmissnPtr >> 3] ?? 0;
        const visibl = module.HEAP32[outVisiblPtr >> 2] ?? 0;
        const lit = module.HEAP32[outLitPtr >> 2] ?? 0;

        return {
          trgepc,
          srfvec,
          phase,
          incdnc,
          emissn,
          visibl: Boolean(visibl),
          lit: Boolean(lit),
        };
      } finally {
        if (observerPtr) module._free(observerPtr);
        if (abcorrPtr) module._free(abcorrPtr);
        if (fixrefPtr) module._free(fixrefPtr);
        if (ilusrcPtr) module._free(ilusrcPtr);
        if (targetPtr) module._free(targetPtr);
        if (methodPtr) module._free(methodPtr);
      }
    },
  );
}

function tspiceCallNvc2pl(
  module: EmscriptenModule,
  normal: SpiceVector3,
  konst: number,
): SpicePlane {
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 3 * 8, 4 * 8],
    (errPtr, normalPtr, outPlanePtr) => {
      module.HEAPF64.set(normal, normalPtr >> 3);

      const result = module._tspice_nvc2pl(
        normalPtr,
        konst,
        outPlanePtr,
        errPtr,
        errMaxBytes,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }

      return readGeometryPlane(module, outPlanePtr);
    },
  );
}

function tspiceCallPl2nvc(
  module: EmscriptenModule,
  plane: SpicePlane,
): Pl2nvcResult {
  const errMaxBytes = 2048;
  return withAllocs(
    module,
    [errMaxBytes, 4 * 8, 3 * 8, 8],
    (errPtr, planePtr, outNormalPtr, outKonstPtr) => {
      module.HEAPF64.set(plane, planePtr >> 3);
      module.HEAPF64[outKonstPtr >> 3] = 0;

      const result = module._tspice_pl2nvc(
        planePtr,
        outNormalPtr,
        outKonstPtr,
        errPtr,
        errMaxBytes,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, errMaxBytes, result);
      }

      const normal = readGeometryVector(module, outNormalPtr);
      const konst = module.HEAPF64[outKonstPtr >> 3] ?? 0;

      return { normal, konst };
    },
  );
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
  geometryInputs(
    et,
    [targ1, shape1, frame1, targ2, shape2, frame2, abcorr, observer],
    "occult",
  );
  const errMaxBytes = 2048;
  return withAllocs(module, [errMaxBytes, 4], (errPtr, outOcltidPtr) => {
    let targ1Ptr = 0,
      shape1Ptr = 0,
      frame1Ptr = 0,
      targ2Ptr = 0,
      shape2Ptr = 0,
      frame2Ptr = 0,
      abcorrPtr = 0,
      observerPtr = 0;
    try {
      targ1Ptr = writeUtf8CString(module, targ1);
      shape1Ptr = writeUtf8CString(module, shape1);
      frame1Ptr = writeUtf8CString(module, frame1);
      targ2Ptr = writeUtf8CString(module, targ2);
      shape2Ptr = writeUtf8CString(module, shape2);
      frame2Ptr = writeUtf8CString(module, frame2);
      abcorrPtr = writeUtf8CString(module, abcorr);
      observerPtr = writeUtf8CString(module, observer);

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
      if (observerPtr) module._free(observerPtr);
      if (abcorrPtr) module._free(abcorrPtr);
      if (frame2Ptr) module._free(frame2Ptr);
      if (shape2Ptr) module._free(shape2Ptr);
      if (targ2Ptr) module._free(targ2Ptr);
      if (frame1Ptr) module._free(frame1Ptr);
      if (shape1Ptr) module._free(shape1Ptr);
      if (targ1Ptr) module._free(targ1Ptr);
    }
  });
}

function assertFiniteNumberArrayFixed(
  value: unknown,
  expectedLength: number,
  label: string,
): asserts value is number[] {
  if (!Array.isArray(value) || value.length !== expectedLength) {
    throw new TypeError(`${label}: expected a length-${expectedLength} array`);
  }
  for (let i = 0; i < expectedLength; i++) {
    const v = value[i];
    if (typeof v !== "number") {
      throw new TypeError(`${label}[${i}]: expected a number`);
    }
    if (!Number.isFinite(v)) {
      throw new RangeError(`${label}[${i}]: expected a finite number`);
    }
  }
}

/** Create a {@link GeometryApi} implementation backed by a WASM Emscripten module. */
export function createGeometryApi(module: EmscriptenModule): GeometryApi {
  return {
    latsrf: (method, target, et, fixref, rows) => {
      const { count, words } = surfaceGrid(rows, 2);
      if (![et].every(Number.isFinite))
        throw new TypeError("Expected finite geometry parameters");
      return withAllocs(
        module,
        [
          2048,
          surfaceTextBytes(method),
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          words.byteLength,
          Math.max(1, count) * 24,
        ],
        (errPtr, methodPtr, targetPtr, fixrefPtr, inputPtr, outPtr) => {
          writeSurfaceText(module, method, methodPtr);
          writeSurfaceText(module, target, targetPtr);
          writeSurfaceText(module, fixref, fixrefPtr);
          module.HEAPF64.set(words, inputPtr >>> 3);
          const rc = module._tspice_latsrf(
            methodPtr,
            targetPtr,
            et,
            fixrefPtr,
            count,
            inputPtr,
            outPtr,
            errPtr,
            2048,
          );
          if (rc !== 0) throwWasmSpiceError(module, errPtr, 2048, rc);
          return surfaceVectors(
            module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + count * 3),
            count,
          );
        },
      );
    },
    srfnrm: (method, target, et, fixref, rows) => {
      const { count, words } = surfaceGrid(rows, 3);
      if (![et].every(Number.isFinite))
        throw new TypeError("Expected finite geometry parameters");
      return withAllocs(
        module,
        [
          2048,
          surfaceTextBytes(method),
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          words.byteLength,
          Math.max(1, count) * 24,
        ],
        (errPtr, methodPtr, targetPtr, fixrefPtr, inputPtr, outPtr) => {
          writeSurfaceText(module, method, methodPtr);
          writeSurfaceText(module, target, targetPtr);
          writeSurfaceText(module, fixref, fixrefPtr);
          module.HEAPF64.set(words, inputPtr >>> 3);
          const rc = module._tspice_srfnrm(
            methodPtr,
            targetPtr,
            et,
            fixrefPtr,
            count,
            inputPtr,
            outPtr,
            errPtr,
            2048,
          );
          if (rc !== 0) throwWasmSpiceError(module, errPtr, 2048, rc);
          return surfaceVectors(
            module.HEAPF64.subarray(outPtr >>> 3, (outPtr >>> 3) + count * 3),
            count,
          );
        },
      );
    },
    limbpt: (
      method,
      target,
      et,
      fixref,
      abcorr,
      corloc,
      observer,
      refvec,
      rolstp,
      ncuts,
      schstp,
      soltol,
      maxn,
    ) => {
      const sizes = surfaceCutLimits(ncuts, maxn);
      const ref = dskRay(refvec);
      if (![et, rolstp, schstp, soltol].every(Number.isFinite))
        throw new TypeError("Expected finite geometry parameters");
      return withAllocs(
        module,
        [
          2048,
          surfaceTextBytes(method),
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(corloc),
          surfaceTextBytes(observer),
          24,
          sizes.counts * 4,
          sizes.rows * 24,
          sizes.rows * 8,
          sizes.rows * 24,
        ],
        (
          errPtr,
          methodPtr,
          targetPtr,
          fixrefPtr,
          abcorrPtr,
          corlocPtr,
          observerPtr,
          refPtr,
          nptsPtr,
          pointsPtr,
          epochsPtr,
          vectorsPtr,
        ) => {
          writeSurfaceText(module, method, methodPtr);
          writeSurfaceText(module, target, targetPtr);
          writeSurfaceText(module, fixref, fixrefPtr);
          writeSurfaceText(module, abcorr, abcorrPtr);
          writeSurfaceText(module, corloc, corlocPtr);
          writeSurfaceText(module, observer, observerPtr);
          module.HEAPF64.set(ref, refPtr >>> 3);
          const rc = module._tspice_limbpt(
            methodPtr,
            targetPtr,
            et,
            fixrefPtr,
            abcorrPtr,
            corlocPtr,
            observerPtr,
            refPtr,
            rolstp,
            ncuts,
            schstp,
            soltol,
            maxn,
            nptsPtr,
            pointsPtr,
            epochsPtr,
            vectorsPtr,
            errPtr,
            2048,
          );
          if (rc !== 0) throwWasmSpiceError(module, errPtr, 2048, rc);
          const counts = module.HEAP32.subarray(
            nptsPtr >>> 2,
            (nptsPtr >>> 2) + ncuts,
          );
          const total = surfaceCutCount(counts, maxn);
          return {
            npts: Array.from(counts),
            points: surfaceVectors(
              module.HEAPF64.subarray(
                pointsPtr >>> 3,
                (pointsPtr >>> 3) + total * 3,
              ),
              total,
            ),
            epochs: Array.from(
              module.HEAPF64.subarray(
                epochsPtr >>> 3,
                (epochsPtr >>> 3) + total,
              ),
            ),
            tangts: surfaceVectors(
              module.HEAPF64.subarray(
                vectorsPtr >>> 3,
                (vectorsPtr >>> 3) + total * 3,
              ),
              total,
            ),
          };
        },
      );
    },
    termpt: (
      method,
      ilusrc,
      target,
      et,
      fixref,
      abcorr,
      corloc,
      observer,
      refvec,
      rolstp,
      ncuts,
      schstp,
      soltol,
      maxn,
    ) => {
      const sizes = surfaceCutLimits(ncuts, maxn);
      const ref = dskRay(refvec);
      if (![et, rolstp, schstp, soltol].every(Number.isFinite))
        throw new TypeError("Expected finite geometry parameters");
      return withAllocs(
        module,
        [
          2048,
          surfaceTextBytes(method),
          surfaceTextBytes(ilusrc),
          surfaceTextBytes(target),
          surfaceTextBytes(fixref),
          surfaceTextBytes(abcorr),
          surfaceTextBytes(corloc),
          surfaceTextBytes(observer),
          24,
          sizes.counts * 4,
          sizes.rows * 24,
          sizes.rows * 8,
          sizes.rows * 24,
        ],
        (
          errPtr,
          methodPtr,
          ilusrcPtr,
          targetPtr,
          fixrefPtr,
          abcorrPtr,
          corlocPtr,
          observerPtr,
          refPtr,
          nptsPtr,
          pointsPtr,
          epochsPtr,
          vectorsPtr,
        ) => {
          writeSurfaceText(module, method, methodPtr);
          writeSurfaceText(module, ilusrc, ilusrcPtr);
          writeSurfaceText(module, target, targetPtr);
          writeSurfaceText(module, fixref, fixrefPtr);
          writeSurfaceText(module, abcorr, abcorrPtr);
          writeSurfaceText(module, corloc, corlocPtr);
          writeSurfaceText(module, observer, observerPtr);
          module.HEAPF64.set(ref, refPtr >>> 3);
          const rc = module._tspice_termpt(
            methodPtr,
            ilusrcPtr,
            targetPtr,
            et,
            fixrefPtr,
            abcorrPtr,
            corlocPtr,
            observerPtr,
            refPtr,
            rolstp,
            ncuts,
            schstp,
            soltol,
            maxn,
            nptsPtr,
            pointsPtr,
            epochsPtr,
            vectorsPtr,
            errPtr,
            2048,
          );
          if (rc !== 0) throwWasmSpiceError(module, errPtr, 2048, rc);
          const counts = module.HEAP32.subarray(
            nptsPtr >>> 2,
            (nptsPtr >>> 2) + ncuts,
          );
          const total = surfaceCutCount(counts, maxn);
          return {
            npts: Array.from(counts),
            points: surfaceVectors(
              module.HEAPF64.subarray(
                pointsPtr >>> 3,
                (pointsPtr >>> 3) + total * 3,
              ),
              total,
            ),
            epochs: Array.from(
              module.HEAPF64.subarray(
                epochsPtr >>> 3,
                (epochsPtr >>> 3) + total,
              ),
            ),
            trmvcs: surfaceVectors(
              module.HEAPF64.subarray(
                vectorsPtr >>> 3,
                (vectorsPtr >>> 3) + total * 3,
              ),
              total,
            ),
          };
        },
      );
    },
    subpnt: (
      method: string,
      target: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
    ) => tspiceCallSubpnt(module, method, target, et, fixref, abcorr, observer),
    subslr: (
      method: string,
      target: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
    ) => tspiceCallSubslr(module, method, target, et, fixref, abcorr, observer),
    sincpt: (
      method: string,
      target: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
      dref: string,
      dvec: SpiceVector3,
    ) =>
      tspiceCallSincpt(
        module,
        method,
        target,
        et,
        fixref,
        abcorr,
        observer,
        dref,
        dvec,
      ),
    ilumin: (
      method: string,
      target: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
      spoint: SpiceVector3,
    ) =>
      tspiceCallIlumin(
        module,
        method,
        target,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      ),
    illumg: (
      method: string,
      target: string,
      ilusrc: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
      spoint: SpiceVector3,
    ) =>
      tspiceCallIllumg(
        module,
        method,
        target,
        ilusrc,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      ),
    illumf: (
      method: string,
      target: string,
      ilusrc: string,
      et: number,
      fixref: string,
      abcorr: AbCorr | string,
      observer: string,
      spoint: SpiceVector3,
    ) =>
      tspiceCallIllumf(
        module,
        method,
        target,
        ilusrc,
        et,
        fixref,
        abcorr,
        observer,
        spoint,
      ),
    occult: (
      targ1: string,
      shape1: string,
      frame1: string,
      targ2: string,
      shape2: string,
      frame2: string,
      abcorr: AbCorr | string,
      observer: string,
      et: number,
    ) =>
      tspiceCallOccult(
        module,
        targ1,
        shape1,
        frame1,
        targ2,
        shape2,
        frame2,
        abcorr,
        observer,
        et,
      ),
    nvc2pl: (normal: SpiceVector3, konst: number) => {
      assertFiniteNumberArrayFixed(normal, 3, "nvc2pl(): normal");
      if (!Number.isFinite(konst)) {
        throw new RangeError("nvc2pl(): konst must be a finite number");
      }
      const out = tspiceCallNvc2pl(module, normal, konst);
      assertFiniteNumberArrayFixed(out, 4, "nvc2pl(): result");
      return out;
    },

    pl2nvc: (plane: SpicePlane) => {
      assertFiniteNumberArrayFixed(plane, 4, "pl2nvc(): plane");
      const out = tspiceCallPl2nvc(module, plane);
      assertFiniteNumberArrayFixed(out.normal, 3, "pl2nvc(): normal");
      if (!Number.isFinite(out.konst)) {
        throw new RangeError("pl2nvc(): konst must be a finite number");
      }
      return out;
    },
  };
}
