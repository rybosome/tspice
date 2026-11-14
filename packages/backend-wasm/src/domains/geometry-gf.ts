import type {
  GeometryGfApi,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import {
  assertSpiceInt32,
  finiteGeometryVector,
  fovRayDirection,
  spiceStringByteLength,
} from "@rybosome/tspice-core";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, withMalloc, WASM_ERR_MAX_BYTES } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

import {
  assertWasmOwnedWindowHandle,
  wasmWindowPointer,
} from "./cells-windows.js";

const visibilityEncoder = new TextEncoder();

function writeSearchText(
  module: EmscriptenModule,
  pointer: number,
  size: number,
  text: string,
) {
  const start = pointer >>> 0;
  visibilityEncoder.encodeInto(
    text,
    module.HEAPU8.subarray(start, start + size - 1),
  );
  module.HEAPU8[start + size - 1] = 0;
}

function assertGfStrings(values: readonly unknown[], context: string): void {
  for (const value of values)
    if (typeof value !== "string")
      throw new TypeError(`${context}: expected strings`);
}
function assertGfBoolean(value: unknown, context: string): void {
  if (typeof value !== "boolean")
    throw new TypeError(`${context}: expected boolean`);
}

function validateScalarSearch(
  refval: number,
  adjust: number,
  step: number,
  nintvls: number,
): void {
  assertFiniteNumber(refval, "refval");
  assertFiniteNumber(adjust, "adjust");
  assertFiniteNumber(step, "step");
  assertSpiceInt32(nintvls, "nintvls");
}

function assertFiniteNumber(
  value: unknown,
  context: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RangeError(`${context}: expected a finite number (got ${value})`);
  }
}

function tspiceCallGfsstp(module: EmscriptenModule, step: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_gfsstp(step, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallGfstep(module: EmscriptenModule, time: number): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outStepPtr) => {
    module.HEAPF64[outStepPtr >> 3] = 0;
    const result = module._tspice_gfstep(
      time,
      outStepPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }

    const out = module.HEAPF64[outStepPtr >> 3];
    assertFiniteNumber(out, "gfstep(): return value");
    return out;
  });
}

function tspiceCallGfstol(module: EmscriptenModule, value: number): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_gfstol(value, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallGfrefn(
  module: EmscriptenModule,
  t1: number,
  t2: number,
  s1: boolean,
  s2: boolean,
): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outTPtr) => {
    module.HEAPF64[outTPtr >> 3] = 0;
    const result = module._tspice_gfrefn(
      t1,
      t2,
      s1 ? 1 : 0,
      s2 ? 1 : 0,
      outTPtr,
      errPtr,
      WASM_ERR_MAX_BYTES,
    );
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }

    const out = module.HEAPF64[outTPtr >> 3];
    assertFiniteNumber(out, "gfrefn(): return value");
    return out;
  });
}

function tspiceCallGfrepi(
  module: EmscriptenModule,
  window: SpiceWindow,
  begmss: string,
  endmss: string,
): void {
  const pointer = wasmWindowPointer(module, window, "gfrepi()");
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const begmssPtr = writeUtf8CString(module, begmss);
    let endmssPtr = 0;
    try {
      endmssPtr = writeUtf8CString(module, endmss);

      const result = module._tspice_gfrepi(
        pointer,
        begmssPtr,
        endmssPtr,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    } finally {
      if (endmssPtr) module._free(endmssPtr);
      module._free(begmssPtr);
    }
  });
}

function tspiceCallGfrepf(module: EmscriptenModule): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const result = module._tspice_gfrepf(errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }
  });
}

function tspiceCallGfsep(
  module: EmscriptenModule,
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
  resultWindow: SpiceWindow,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const targ1Ptr = writeUtf8CString(module, targ1);
    let shape1Ptr = 0,
      frame1Ptr = 0,
      targ2Ptr = 0,
      shape2Ptr = 0,
      frame2Ptr = 0,
      abcorrPtr = 0,
      obsrvrPtr = 0,
      relatePtr = 0;
    try {
      shape1Ptr = writeUtf8CString(module, shape1);
      frame1Ptr = writeUtf8CString(module, frame1);
      targ2Ptr = writeUtf8CString(module, targ2);
      shape2Ptr = writeUtf8CString(module, shape2);
      frame2Ptr = writeUtf8CString(module, frame2);
      abcorrPtr = writeUtf8CString(module, abcorr);
      obsrvrPtr = writeUtf8CString(module, obsrvr);
      relatePtr = writeUtf8CString(module, relate);

      const out = module._tspice_gfsep(
        targ1Ptr,
        shape1Ptr,
        frame1Ptr,
        targ2Ptr,
        shape2Ptr,
        frame2Ptr,
        abcorrPtr,
        obsrvrPtr,
        relatePtr,
        refval,
        adjust,
        step,
        nintvls,
        wasmWindowPointer(module, cnfine, "gfsep()"),
        wasmWindowPointer(module, resultWindow, "gfsep()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (out !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, out);
      }
    } finally {
      if (relatePtr) module._free(relatePtr);
      if (obsrvrPtr) module._free(obsrvrPtr);
      if (abcorrPtr) module._free(abcorrPtr);
      if (frame2Ptr) module._free(frame2Ptr);
      if (shape2Ptr) module._free(shape2Ptr);
      if (targ2Ptr) module._free(targ2Ptr);
      if (frame1Ptr) module._free(frame1Ptr);
      if (shape1Ptr) module._free(shape1Ptr);
      module._free(targ1Ptr);
    }
  });
}

function tspiceCallGfdist(
  module: EmscriptenModule,
  target: string,
  abcorr: string,
  obsrvr: string,
  relate: string,
  refval: number,
  adjust: number,
  step: number,
  nintvls: number,
  cnfine: SpiceWindow,
  resultWindow: SpiceWindow,
): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const targetPtr = writeUtf8CString(module, target);
    let abcorrPtr = 0,
      obsrvrPtr = 0,
      relatePtr = 0;
    try {
      abcorrPtr = writeUtf8CString(module, abcorr);
      obsrvrPtr = writeUtf8CString(module, obsrvr);
      relatePtr = writeUtf8CString(module, relate);

      const out = module._tspice_gfdist(
        targetPtr,
        abcorrPtr,
        obsrvrPtr,
        relatePtr,
        refval,
        adjust,
        step,
        nintvls,
        wasmWindowPointer(module, cnfine, "gfdist()"),
        wasmWindowPointer(module, resultWindow, "gfdist()"),
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (out !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, out);
      }
    } finally {
      if (relatePtr) module._free(relatePtr);
      if (obsrvrPtr) module._free(obsrvrPtr);
      if (abcorrPtr) module._free(abcorrPtr);
      module._free(targetPtr);
    }
  });
}

/** Create a {@link GeometryGfApi} implementation backed by a WASM Emscripten module. */
export function createGeometryGfApi(module: EmscriptenModule): GeometryGfApi {
  return {
    gfsstp: (step) => tspiceCallGfsstp(module, step),
    gfstep: (time) => tspiceCallGfstep(module, time),
    gfstol: (value) => tspiceCallGfstol(module, value),
    gfrefn: (t1, t2, s1, s2) => {
      assertFiniteNumber(t1, "gfrefn(t1)");
      assertFiniteNumber(t2, "gfrefn(t2)");
      assertGfBoolean(s1, "gfrefn(s1)");
      assertGfBoolean(s2, "gfrefn(s2)");
      return tspiceCallGfrefn(module, t1, t2, s1, s2);
    },

    gfrepi: (window, begmss, endmss) => {
      assertGfStrings([begmss, endmss], "gfrepi");
      assertWasmOwnedWindowHandle(module, window, "gfrepi(window)");
      tspiceCallGfrepi(module, window, begmss, endmss);
    },
    gfrepf: () => tspiceCallGfrepf(module),

    gfpa: (
      target,
      illmn,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfpa(cnfine)"),
        output = wasmWindowPointer(module, result, "gfpa(result)");
      const text = [target, illmn, abcorr, obsrvr, relate],
        sizes = text.map((x) => spiceStringByteLength(x, "gfpa") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (targetPtr, illmnPtr, abcorrPtr, obsrvrPtr, relatePtr, err) => {
          [targetPtr, illmnPtr, abcorrPtr, obsrvrPtr, relatePtr].forEach(
            (ptr, i) => writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          const status = module._tspice_gfpa(
            targetPtr,
            illmnPtr,
            abcorrPtr,
            obsrvrPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfposc: (
      target,
      frame,
      abcorr,
      obsrvr,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfposc(cnfine)"),
        output = wasmWindowPointer(module, result, "gfposc(result)");
      const text = [target, frame, abcorr, obsrvr, crdsys, coord, relate],
        sizes = text.map((x) => spiceStringByteLength(x, "gfposc") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (
          targetPtr,
          framePtr,
          abcorrPtr,
          obsrvrPtr,
          crdsysPtr,
          coordPtr,
          relatePtr,
          err,
        ) => {
          [
            targetPtr,
            framePtr,
            abcorrPtr,
            obsrvrPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          const status = module._tspice_gfposc(
            targetPtr,
            framePtr,
            abcorrPtr,
            obsrvrPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfrr: (
      target,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfrr(cnfine)"),
        output = wasmWindowPointer(module, result, "gfrr(result)");
      const text = [target, abcorr, obsrvr, relate],
        sizes = text.map((x) => spiceStringByteLength(x, "gfrr") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (targetPtr, abcorrPtr, obsrvrPtr, relatePtr, err) => {
          [targetPtr, abcorrPtr, obsrvrPtr, relatePtr].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          const status = module._tspice_gfrr(
            targetPtr,
            abcorrPtr,
            obsrvrPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfsntc: (
      target,
      fixref,
      method,
      abcorr,
      obsrvr,
      dref,
      dvec,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfsntc(cnfine)"),
        output = wasmWindowPointer(module, result, "gfsntc(result)");
      const text = [
          target,
          fixref,
          method,
          abcorr,
          obsrvr,
          dref,
          crdsys,
          coord,
          relate,
        ],
        sizes = text.map((x) => spiceStringByteLength(x, "gfsntc") + 1);
      const vector = finiteGeometryVector(dvec, "dvec");
      withAllocs(
        module,
        [...sizes, 24, WASM_ERR_MAX_BYTES],
        (
          targetPtr,
          fixrefPtr,
          methodPtr,
          abcorrPtr,
          obsrvrPtr,
          drefPtr,
          crdsysPtr,
          coordPtr,
          relatePtr,
          vectorPtr,
          err,
        ) => {
          [
            targetPtr,
            fixrefPtr,
            methodPtr,
            abcorrPtr,
            obsrvrPtr,
            drefPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          module.HEAPF64.set(vector, vectorPtr >>> 3);
          const status = module._tspice_gfsntc(
            targetPtr,
            fixrefPtr,
            methodPtr,
            abcorrPtr,
            obsrvrPtr,
            drefPtr,
            vectorPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfsubc: (
      target,
      fixref,
      method,
      abcorr,
      obsrvr,
      crdsys,
      coord,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfsubc(cnfine)"),
        output = wasmWindowPointer(module, result, "gfsubc(result)");
      const text = [
          target,
          fixref,
          method,
          abcorr,
          obsrvr,
          crdsys,
          coord,
          relate,
        ],
        sizes = text.map((x) => spiceStringByteLength(x, "gfsubc") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (
          targetPtr,
          fixrefPtr,
          methodPtr,
          abcorrPtr,
          obsrvrPtr,
          crdsysPtr,
          coordPtr,
          relatePtr,
          err,
        ) => {
          [
            targetPtr,
            fixrefPtr,
            methodPtr,
            abcorrPtr,
            obsrvrPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          const status = module._tspice_gfsubc(
            targetPtr,
            fixrefPtr,
            methodPtr,
            abcorrPtr,
            obsrvrPtr,
            crdsysPtr,
            coordPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfilum: (
      method,
      angtyp,
      target,
      illmn,
      fixref,
      abcorr,
      obsrvr,
      spoint,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      validateScalarSearch(refval, adjust, step, nintvls);
      const input = wasmWindowPointer(module, cnfine, "gfilum(cnfine)"),
        output = wasmWindowPointer(module, result, "gfilum(result)");
      const text = [
          method,
          angtyp,
          target,
          illmn,
          fixref,
          abcorr,
          obsrvr,
          relate,
        ],
        sizes = text.map((x) => spiceStringByteLength(x, "gfilum") + 1);
      const vector = finiteGeometryVector(spoint, "spoint");
      withAllocs(
        module,
        [...sizes, 24, WASM_ERR_MAX_BYTES],
        (
          methodPtr,
          angtypPtr,
          targetPtr,
          illmnPtr,
          fixrefPtr,
          abcorrPtr,
          obsrvrPtr,
          relatePtr,
          vectorPtr,
          err,
        ) => {
          [
            methodPtr,
            angtypPtr,
            targetPtr,
            illmnPtr,
            fixrefPtr,
            abcorrPtr,
            obsrvrPtr,
            relatePtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, text[i]!),
          );
          module.HEAPF64.set(vector, vectorPtr >>> 3);
          const status = module._tspice_gfilum(
            methodPtr,
            angtypPtr,
            targetPtr,
            illmnPtr,
            fixrefPtr,
            abcorrPtr,
            obsrvrPtr,
            vectorPtr,
            relatePtr,
            refval,
            adjust,
            step,
            nintvls,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfoclt: (
      occtyp,
      front,
      fshape,
      fframe,
      back,
      bshape,
      bframe,
      abcorr,
      obsrvr,
      step,
      cnfine,
      result,
    ) => {
      assertFiniteNumber(step, "gfoclt(step)");
      const input = wasmWindowPointer(module, cnfine, "gfoclt(cnfine)"),
        output = wasmWindowPointer(module, result, "gfoclt(result)");
      const texts = [
          occtyp,
          front,
          fshape,
          fframe,
          back,
          bshape,
          bframe,
          abcorr,
          obsrvr,
        ],
        sizes = texts.map((t) => spiceStringByteLength(t, "gfoclt") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (
          occtypPtr,
          frontPtr,
          fshapePtr,
          fframePtr,
          backPtr,
          bshapePtr,
          bframePtr,
          abcorrPtr,
          obsrvrPtr,
          err,
        ) => {
          [
            occtypPtr,
            frontPtr,
            fshapePtr,
            fframePtr,
            backPtr,
            bshapePtr,
            bframePtr,
            abcorrPtr,
            obsrvrPtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, texts[i]!),
          );
          const status = module._tspice_gfoclt(
            occtypPtr,
            frontPtr,
            fshapePtr,
            fframePtr,
            backPtr,
            bshapePtr,
            bframePtr,
            abcorrPtr,
            obsrvrPtr,
            step,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfrfov: (inst, raydir, rframe, abcorr, obsrvr, step, cnfine, result) => {
      assertFiniteNumber(step, "gfrfov(step)");
      const input = wasmWindowPointer(module, cnfine, "gfrfov(cnfine)"),
        output = wasmWindowPointer(module, result, "gfrfov(result)");
      const texts = [inst, rframe, abcorr, obsrvr],
        sizes = texts.map((t) => spiceStringByteLength(t, "gfrfov") + 1);
      const dir = fovRayDirection(raydir);
      withAllocs(
        module,
        [...sizes, 24, WASM_ERR_MAX_BYTES],
        (instPtr, rframePtr, abcorrPtr, obsrvrPtr, rayPtr, err) => {
          [instPtr, rframePtr, abcorrPtr, obsrvrPtr].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, texts[i]!),
          );
          module.HEAPF64.set(dir, rayPtr >>> 3);
          const status = module._tspice_gfrfov(
            instPtr,
            rayPtr,
            rframePtr,
            abcorrPtr,
            obsrvrPtr,
            step,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gftfov: (
      inst,
      target,
      tshape,
      tframe,
      abcorr,
      obsrvr,
      step,
      cnfine,
      result,
    ) => {
      assertFiniteNumber(step, "gftfov(step)");
      const input = wasmWindowPointer(module, cnfine, "gftfov(cnfine)"),
        output = wasmWindowPointer(module, result, "gftfov(result)");
      const texts = [inst, target, tshape, tframe, abcorr, obsrvr],
        sizes = texts.map((t) => spiceStringByteLength(t, "gftfov") + 1);
      withAllocs(
        module,
        [...sizes, WASM_ERR_MAX_BYTES],
        (
          instPtr,
          targetPtr,
          tshapePtr,
          tframePtr,
          abcorrPtr,
          obsrvrPtr,
          err,
        ) => {
          [
            instPtr,
            targetPtr,
            tshapePtr,
            tframePtr,
            abcorrPtr,
            obsrvrPtr,
          ].forEach((ptr, i) =>
            writeSearchText(module, ptr, sizes[i]!, texts[i]!),
          );
          const status = module._tspice_gftfov(
            instPtr,
            targetPtr,
            tshapePtr,
            tframePtr,
            abcorrPtr,
            obsrvrPtr,
            step,
            input,
            output,
            err,
            WASM_ERR_MAX_BYTES,
          );
          if (status)
            throwWasmSpiceError(module, err, WASM_ERR_MAX_BYTES, status);
        },
      );
    },
    gfsep: (
      targ1,
      shape1,
      frame1,
      targ2,
      shape2,
      frame2,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      assertGfStrings(
        [targ1, shape1, frame1, targ2, shape2, frame2, abcorr, obsrvr, relate],
        "gfsep",
      );
      assertSpiceInt32(nintvls, "gfsep(nintvls)");
      assertFiniteNumber(refval, "gfsep(refval)");
      assertFiniteNumber(adjust, "gfsep(adjust)");
      assertFiniteNumber(step, "gfsep(step)");
      assertWasmOwnedWindowHandle(module, cnfine, "gfsep(cnfine)");
      assertWasmOwnedWindowHandle(module, result, "gfsep(result)");
      tspiceCallGfsep(
        module,
        targ1,
        shape1,
        frame1,
        targ2,
        shape2,
        frame2,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },

    gfdist: (
      target,
      abcorr,
      obsrvr,
      relate,
      refval,
      adjust,
      step,
      nintvls,
      cnfine,
      result,
    ) => {
      assertGfStrings([target, abcorr, obsrvr, relate], "gfdist");
      assertSpiceInt32(nintvls, "gfdist(nintvls)");
      assertFiniteNumber(refval, "gfdist(refval)");
      assertFiniteNumber(adjust, "gfdist(adjust)");
      assertFiniteNumber(step, "gfdist(step)");
      assertWasmOwnedWindowHandle(module, cnfine, "gfdist(cnfine)");
      assertWasmOwnedWindowHandle(module, result, "gfdist(result)");
      tspiceCallGfdist(
        module,
        target,
        abcorr,
        obsrvr,
        relate,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        result,
      );
    },
  };
}
