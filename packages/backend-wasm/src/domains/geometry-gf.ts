import type {
  GeometryGfApi,
  SpiceWindow,
} from "@rybosome/tspice-backend-contract";
import { assertSpiceInt32 } from "@rybosome/tspice-backend-contract";

import type { EmscriptenModule } from "../lowlevel/exports.js";

import { withAllocs, withMalloc, WASM_ERR_MAX_BYTES } from "../codec/alloc.js";
import { throwWasmSpiceError } from "../codec/errors.js";
import { writeUtf8CString } from "../codec/strings.js";

import { assertWasmOwnedWindowHandle } from "./cells-windows.js";

function assertFiniteNumber(value: unknown, context: string): asserts value is number {
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
    const result = module._tspice_gfstep(time, outStepPtr, errPtr, WASM_ERR_MAX_BYTES);
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

function tspiceCallGfrefn(module: EmscriptenModule, t1: number, t2: number, s1: boolean, s2: boolean): number {
  return withAllocs(module, [WASM_ERR_MAX_BYTES, 8], (errPtr, outTPtr) => {
    module.HEAPF64[outTPtr >> 3] = 0;
    const result = module._tspice_gfrefn(t1, t2, s1 ? 1 : 0, s2 ? 1 : 0, outTPtr, errPtr, WASM_ERR_MAX_BYTES);
    if (result !== 0) {
      throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
    }

    const out = module.HEAPF64[outTPtr >> 3];
    assertFiniteNumber(out, "gfrefn(): return value");
    return out;
  });
}

function tspiceCallGfrepi(module: EmscriptenModule, window: SpiceWindow, begmss: string, endmss: string): void {
  withMalloc(module, WASM_ERR_MAX_BYTES, (errPtr) => {
    const begmssPtr = writeUtf8CString(module, begmss);
    const endmssPtr = writeUtf8CString(module, endmss);
    if (!begmssPtr || !endmssPtr) {
      if (endmssPtr) module._free(endmssPtr);
      if (begmssPtr) module._free(begmssPtr);
      throw new Error("WASM malloc failed");
    }

    try {
      const result = module._tspice_gfrepi(window, begmssPtr, endmssPtr, errPtr, WASM_ERR_MAX_BYTES);
      if (result !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, result);
      }
    } finally {
      module._free(endmssPtr);
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
    const shape1Ptr = writeUtf8CString(module, shape1);
    const frame1Ptr = writeUtf8CString(module, frame1);
    const targ2Ptr = writeUtf8CString(module, targ2);
    const shape2Ptr = writeUtf8CString(module, shape2);
    const frame2Ptr = writeUtf8CString(module, frame2);
    const abcorrPtr = writeUtf8CString(module, abcorr);
    const obsrvrPtr = writeUtf8CString(module, obsrvr);
    const relatePtr = writeUtf8CString(module, relate);

    if (!targ1Ptr || !shape1Ptr || !frame1Ptr || !targ2Ptr || !shape2Ptr || !frame2Ptr || !abcorrPtr || !obsrvrPtr || !relatePtr) {
      for (const ptr of [relatePtr, obsrvrPtr, abcorrPtr, frame2Ptr, shape2Ptr, targ2Ptr, frame1Ptr, shape1Ptr, targ1Ptr]) {
        if (ptr) module._free(ptr);
      }
      throw new Error("WASM malloc failed");
    }

    try {
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
        cnfine,
        resultWindow,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (out !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, out);
      }
    } finally {
      module._free(relatePtr);
      module._free(obsrvrPtr);
      module._free(abcorrPtr);
      module._free(frame2Ptr);
      module._free(shape2Ptr);
      module._free(targ2Ptr);
      module._free(frame1Ptr);
      module._free(shape1Ptr);
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
    const abcorrPtr = writeUtf8CString(module, abcorr);
    const obsrvrPtr = writeUtf8CString(module, obsrvr);
    const relatePtr = writeUtf8CString(module, relate);

    if (!targetPtr || !abcorrPtr || !obsrvrPtr || !relatePtr) {
      for (const ptr of [relatePtr, obsrvrPtr, abcorrPtr, targetPtr]) {
        if (ptr) module._free(ptr);
      }
      throw new Error("WASM malloc failed");
    }

    try {
      const out = module._tspice_gfdist(
        targetPtr,
        abcorrPtr,
        obsrvrPtr,
        relatePtr,
        refval,
        adjust,
        step,
        nintvls,
        cnfine,
        resultWindow,
        errPtr,
        WASM_ERR_MAX_BYTES,
      );
      if (out !== 0) {
        throwWasmSpiceError(module, errPtr, WASM_ERR_MAX_BYTES, out);
      }
    } finally {
      module._free(relatePtr);
      module._free(obsrvrPtr);
      module._free(abcorrPtr);
      module._free(targetPtr);
    }
  });
}

export function createGeometryGfApi(module: EmscriptenModule): GeometryGfApi {
  return {
    gfsstp: (step) => tspiceCallGfsstp(module, step),
    gfstep: (time) => tspiceCallGfstep(module, time),
    gfstol: (value) => tspiceCallGfstol(module, value),
    gfrefn: (t1, t2, s1, s2) => tspiceCallGfrefn(module, t1, t2, s1, s2),

    gfrepi: (window, begmss, endmss) => {
      assertWasmOwnedWindowHandle(module, window as unknown as number, "gfrepi(window)");
      tspiceCallGfrepi(module, window, begmss, endmss);
    },
    gfrepf: () => tspiceCallGfrepf(module),

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
      assertSpiceInt32(nintvls, "gfsep(nintvls)", { min: 1 });
      assertFiniteNumber(refval, "gfsep(refval)");
      assertFiniteNumber(adjust, "gfsep(adjust)");
      assertFiniteNumber(step, "gfsep(step)");
      assertWasmOwnedWindowHandle(module, cnfine as unknown as number, "gfsep(cnfine)");
      assertWasmOwnedWindowHandle(module, result as unknown as number, "gfsep(result)");
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

    gfdist: (target, abcorr, obsrvr, relate, refval, adjust, step, nintvls, cnfine, result) => {
      assertSpiceInt32(nintvls, "gfdist(nintvls)", { min: 1 });
      assertFiniteNumber(refval, "gfdist(refval)");
      assertFiniteNumber(adjust, "gfdist(adjust)");
      assertFiniteNumber(step, "gfdist(step)");
      assertWasmOwnedWindowHandle(module, cnfine as unknown as number, "gfdist(cnfine)");
      assertWasmOwnedWindowHandle(module, result as unknown as number, "gfdist(result)");
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
